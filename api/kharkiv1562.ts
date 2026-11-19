import { load, type CheerioAPI } from 'cheerio'
import { hasValidSession } from '../server/auth/session.js'

const SOURCE_URL =
  'https://1562.kharkivrada.gov.ua/ajax/inform/informList-v2.php'
const KYIV_TIME_ZONE = 'Europe/Kyiv'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_PAGES = 3
const MAX_HTML_LENGTH = 2_500_000
const PAGE_SIZE = 100

type ListingRecord = {
  id: string
  title: string
  description: string
  executor: string
  workType: 'emergency'
  listingState: 'active'
  times: {
    startRaw: string
    plannedEndRaw: string
    modifiedRaw: string | null
    actualEndRaw: null
    timeZone: null
  }
  cancellationState: 'unknown'
}

type ApiPayload = {
  source: '1562'
  fetchedAt: string
  query: {
    workType: 'emergency'
    service: 'energy-supply'
    listingState: 'active'
  }
  pagination: {
    pagesFetched: number
    truncated: boolean
  }
  records: ListingRecord[]
}

type EnvironmentConfig = {
  streetId: string
  houseId: string
  streetLabel: string
  houseLabel: string
}

type Card = ReturnType<CheerioAPI>

class ApiError extends Error {
  public readonly statusCode: number
  public readonly code: string

  public constructor(statusCode: number, code: string) {
    super(code)
    this.statusCode = statusCode
    this.code = code
  }
}

class SourceParseError extends Error {}

function jsonResponse(payload: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  })
}

function getEnvironmentConfig(): EnvironmentConfig {
  const streetId = process.env.KH1562_STREET_ID?.trim() ?? ''
  const houseId = process.env.KH1562_HOUSE_ID?.trim() ?? ''
  const streetLabel = process.env.KH1562_STREET_LABEL?.trim() ?? ''
  const houseLabel = process.env.KH1562_HOUSE_LABEL?.trim() ?? ''
  if (
    !/^\d+$/.test(streetId) ||
    !/^\d+$/.test(houseId) ||
    streetLabel.length === 0 ||
    houseLabel.length === 0 ||
    streetLabel.length > 200 ||
    houseLabel.length > 200
  ) {
    throw new ApiError(503, 'SERVER_CONFIGURATION_INCOMPLETE')
  }

  return { streetId, houseId, streetLabel, houseLabel }
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function getKyivDateRange(now: Date): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values: Record<string, string> = {}

  for (const part of parts) {
    values[part.type] = part.value
  }

  const year = Number(values.year)
  const month = Number(values.month)
  const day = Number(values.day)

  if (!year || !month || !day) {
    throw new ApiError(500, 'KYIV_DATE_UNAVAILABLE')
  }

  const end = new Date(Date.UTC(year, month - 1, day + 31))
  const from = `${year}/${padDatePart(month)}/${padDatePart(day)}`
  const to = `${end.getUTCFullYear()}/${padDatePart(end.getUTCMonth() + 1)}/${padDatePart(end.getUTCDate())}`

  return { from, to }
}

function buildFilterData(
  config: EnvironmentConfig,
  range: { from: string; to: string },
): string {
  const filters = new URLSearchParams()
  filters.append('from', range.from)
  filters.append('to', range.to)
  filters.append('streetid', config.streetId)
  filters.append('skyscraperid', config.houseId)
  filters.append('street', config.streetLabel)
  filters.append('house', config.houseLabel)
  filters.append('radio1580works', '4')
  filters.append('radio1580datetype', '2')
  filters.append('organizationMultiSelect[]', '184')
  filters.append('ServiceGroup[]', '4')
  filters.append('InformType[]', '844')

  return filters.toString()
}

function createUpstreamBody(filterData: string, cursor: string): FormData {
  const formData = new FormData()
  formData.append('data', filterData)
  formData.append('rn', cursor)
  formData.append('all', '1')
  formData.append('isFrame', '')
  formData.append('hr', '1')
  formData.append('ls', '0')
  formData.append('conf', '0')
  formData.append('frameJeoId', '0')

  return formData
}

function extractDateTime(
  text: string,
  format: 'short' | 'long',
): string | null {
  const expression =
    format === 'short'
      ? /(?:^|\D)(\d{2}\.\d{2}\.\d{2}\s+\d{2}:\d{2})(?!\d)/
      : /(?:^|\D)(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})(?!\d)/
  const match = text.match(expression)
  const raw = match?.[1]

  if (!raw) return null

  const parts = raw.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})\s+(\d{2}):(\d{2})$/)
  if (!parts) return null

  const day = Number(parts[1])
  const month = Number(parts[2])
  const yearText = parts[3]
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)
  const hour = Number(parts[4])
  const minute = Number(parts[5])
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute))

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null
  }

  return raw
}

function removeAddressText(text: string, config: EnvironmentConfig): string {
  let safeText = text
  const privateLabels = [config.streetLabel, config.houseLabel]

  for (const label of privateLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    safeText = safeText.replace(new RegExp(escaped, 'giu'), '[скрыто]')
  }

  const addressLine =
    /(?:вул\.|вулиця|просп\.?|проспект|пров\.?|провулок|бульв\.?|бульвар|буд\.?|будинок)/iu

  return safeText
    .split(/\r?\n/)
    .filter((line) => !addressLine.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cardText($: CheerioAPI, card: Card, selector: string): string | null {
  const element = card.find(selector).first()
  if (element.length === 0) return null

  return $(element).text().replace(/\s+/g, ' ').trim()
}

function parseCard(
  $: CheerioAPI,
  card: Card,
  config: EnvironmentConfig,
): ListingRecord {
  const idAttribute = card.attr('id') ?? ''
  const idMatch = idAttribute.match(/^infoId(\d+)$/)
  const titleRaw = cardText($, card, '.panelinform .card-title h5')
  const descriptionRaw = cardText($, card, '.panelinform .card-title pre.mb-1')
  const startText = cardText($, card, '.panelinform .StartDate')
  const plannedEndText = cardText($, card, '.panelinform .PlanDate')
  const modificationElement = card.find('.panelinform .bi-pen').first()
  const modificationText =
    modificationElement.length > 0
      ? $(modificationElement).closest('div.me-3').text().replace(/\s+/g, ' ').trim()
      : ''

  if (!idMatch || !titleRaw || descriptionRaw === null || !startText || !plannedEndText) {
    throw new SourceParseError()
  }

  const title = removeAddressText(titleRaw, config)
  const description = removeAddressText(descriptionRaw, config)
  const startRaw = extractDateTime(startText, 'short')
  const plannedEndRaw = extractDateTime(plannedEndText, 'short')
  const modifiedRaw = modificationText
    ? extractDateTime(modificationText, 'long')
    : null

  if (!title || !startRaw || !plannedEndRaw || (modificationText && !modifiedRaw)) {
    throw new SourceParseError()
  }

  return {
    id: idMatch[1],
    title,
    description,
    executor: 'АТ «Харківобленерго»',
    workType: 'emergency',
    listingState: 'active',
    times: {
      startRaw,
      plannedEndRaw,
      modifiedRaw,
      actualEndRaw: null,
      timeZone: null,
    },
    cancellationState: 'unknown',
  }
}

function parsePage(
  html: string,
  config: EnvironmentConfig,
): { records: ListingRecord[]; nextCursor: string | null } {
  const $ = load(html, {}, false)
  const cards = $('div[id^="infoId"]')
  const cursor = $('loadedid').first().text().trim()

  if (!/^(?:-1|\d+)$/.test(cursor)) {
    throw new SourceParseError()
  }

  if (cards.length === 0) {
    const emptyMarker = $('h3').first().text().replace(/\s+/g, ' ').trim()
    if (cursor === '-1' && emptyMarker === 'Оголошеня відсутні') {
      return { records: [], nextCursor: null }
    }

    throw new SourceParseError()
  }

  const records: ListingRecord[] = []
  cards.each((_index, element) => {
    const card = $(element)
    if (card.find('.panelinform').length === 0) {
      throw new SourceParseError()
    }
    records.push(parseCard($, card, config))
  })

  return {
    records,
    nextCursor: cursor === '-1' ? null : cursor,
  }
}

async function readSourcePage(
  filterData: string,
  cursor: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(SOURCE_URL, {
    method: 'POST',
    body: createUpstreamBody(filterData, cursor),
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ApiError(502, 'SOURCE_HTTP_ERROR')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('text/html')) {
    throw new ApiError(502, 'SOURCE_CONTENT_TYPE_INVALID')
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_HTML_LENGTH) {
    throw new ApiError(502, 'SOURCE_RESPONSE_TOO_LARGE')
  }

  const html = await response.text()
  if (html.length > MAX_HTML_LENGTH) {
    throw new ApiError(502, 'SOURCE_RESPONSE_TOO_LARGE')
  }

  return html
}

async function loadAnnouncements(
  config: EnvironmentConfig,
  signal: AbortSignal,
): Promise<{ records: ListingRecord[]; pagesFetched: number; truncated: boolean }> {
  const range = getKyivDateRange(new Date())
  const filterData = buildFilterData(config, range)
  const recordsById = new Map<string, ListingRecord>()
  let cursor = '0'
  let pagesFetched = 0
  let truncated = false

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
    const html = await readSourcePage(filterData, cursor, signal)
    const page = parsePage(html, config)
    if (page.records.length > PAGE_SIZE) throw new SourceParseError()
    pagesFetched += 1

    for (const record of page.records) {
      if (!recordsById.has(record.id)) {
        recordsById.set(record.id, record)
      }
    }

    if (page.nextCursor === null) break
    if (page.nextCursor === cursor) throw new SourceParseError()

    cursor = page.nextCursor
    if (pageNumber === MAX_PAGES - 1) truncated = true
  }

  return {
    records: Array.from(recordsById.values()),
    pagesFetched,
    truncated,
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
    }

    if (!hasValidSession(request)) {
      return jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401)
    }

    let config: EnvironmentConfig
    try {
      config = getEnvironmentConfig()
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonResponse({ error: { code: error.code } }, error.statusCode)
      }
      return jsonResponse({ error: { code: 'SERVER_CONFIGURATION_ERROR' } }, 503)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const result = await loadAnnouncements(config, controller.signal)
      const payload: ApiPayload = {
        source: '1562',
        fetchedAt: new Date().toISOString(),
        query: {
          workType: 'emergency',
          service: 'energy-supply',
          listingState: 'active',
        },
        pagination: {
          pagesFetched: result.pagesFetched,
          truncated: result.truncated,
        },
        records: result.records,
      }

      return jsonResponse(payload)
    } catch (error) {
      if (controller.signal.aborted) {
        return jsonResponse({ error: { code: 'SOURCE_TIMEOUT' } }, 504)
      }
      if (error instanceof ApiError) {
        return jsonResponse({ error: { code: error.code } }, error.statusCode)
      }
      if (error instanceof SourceParseError) {
        return jsonResponse({ error: { code: 'SOURCE_HTML_UNRECOGNIZED' } }, 502)
      }
      return jsonResponse({ error: { code: 'SOURCE_UNAVAILABLE' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
