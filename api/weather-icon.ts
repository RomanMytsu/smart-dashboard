import {
  isWeatherIconCode,
  isWeatherIconVariant,
} from '../src/shared/lib/weatherIcons.js'

const WEATHER_ICON_ORIGIN = 'https://cdn.weatherapi.com'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_IMAGE_LENGTH = 1_000_000
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface WeatherIconRequest {
  variant: 'day' | 'night'
  code: number
}

function jsonResponse(payload: unknown, statusCode: number): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function parseIconRequest(requestUrl: string): WeatherIconRequest | null {
  const url = new URL(requestUrl)
  const params = url.searchParams
  if (
    url.pathname !== '/api/weather-icon' ||
    [...params.keys()].some((key) => key !== 'variant' && key !== 'code') ||
    params.getAll('variant').length !== 1 ||
    params.getAll('code').length !== 1
  ) return null

  const variant = params.get('variant')
  const codeText = params.get('code')
  const code = Number(codeText)
  if (
    !isWeatherIconVariant(variant) ||
    codeText === null ||
    !/^\d+$/.test(codeText) ||
    String(code) !== codeText ||
    !isWeatherIconCode(code)
  ) return null

  return { variant, code }
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

async function fetchWeatherIcon(
  icon: WeatherIconRequest,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const url = `${WEATHER_ICON_ORIGIN}/weather/64x64/${icon.variant}/${icon.code}.png`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      signal,
      cache: 'no-store',
      redirect: 'error',
    })
  } catch {
    if (signal.aborted) throw new Error('timeout')
    throw new Error('upstream')
  }

  if (!response.ok) throw new Error('upstream')
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'image/png') throw new Error('invalid-image')
  const contentLength = response.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > MAX_IMAGE_LENGTH) {
    throw new Error('invalid-image')
  }

  let image: ArrayBuffer
  try {
    image = await response.arrayBuffer()
  } catch {
    throw new Error('invalid-image')
  }
  const bytes = new Uint8Array(image)
  if (bytes.length > MAX_IMAGE_LENGTH || !isPng(bytes)) {
    throw new Error('invalid-image')
  }
  return image
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { kind: 'http' } }, 405)
    }

    const icon = parseIconRequest(request.url)
    if (!icon) return jsonResponse({ error: { kind: 'invalid-request' } }, 400)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const image = await fetchWeatherIcon(icon, controller.signal)
      return new Response(image, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': 'image/png',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (error) {
      if (controller.signal.aborted) {
        return jsonResponse({ error: { kind: 'timeout' } }, 504)
      }
      const kind = error instanceof Error && error.message === 'invalid-image'
        ? 'invalid-image'
        : 'upstream'
      return jsonResponse({ error: { kind } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
