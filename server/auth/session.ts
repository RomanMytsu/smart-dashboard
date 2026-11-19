import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE_NAME = '__Secure-dashboard_session'
export const SESSION_MAX_AGE_SECONDS = 2_592_000

const SESSION_VERSION = 1
const MINIMUM_SECRET_BYTES = 32
const MAXIMUM_COOKIE_HEADER_LENGTH = 8_192

type SessionPayload = {
  v: typeof SESSION_VERSION
  iat: number
  exp: number
}

export type PasswordCheck = 'valid' | 'invalid' | 'not-configured'

export class SessionConfigurationError extends Error {}

function getDashboardPassword(): string | null {
  const password = process.env.DASHBOARD_API_TOKEN
  if (!password || Buffer.byteLength(password, 'utf8') < MINIMUM_SECRET_BYTES) {
    return null
  }

  return password
}

function getSessionSecret(): Buffer | null {
  const encodedSecret = process.env.DASHBOARD_SESSION_SECRET
  if (!encodedSecret || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedSecret)) {
    return null
  }

  const secret = Buffer.from(encodedSecret, 'base64')
  if (
    secret.length < MINIMUM_SECRET_BYTES ||
    secret.toString('base64') !== encodedSecret ||
    encodedSecret === process.env.DASHBOARD_API_TOKEN ||
    secret.equals(Buffer.from(process.env.DASHBOARD_API_TOKEN ?? '', 'utf8'))
  ) {
    return null
  }

  return secret
}

export function checkDashboardPassword(password: string): PasswordCheck {
  const expectedPassword = getDashboardPassword()
  if (!expectedPassword) return 'not-configured'

  const suppliedBytes = Buffer.from(password, 'utf8')
  const expectedBytes = Buffer.from(expectedPassword, 'utf8')
  if (suppliedBytes.length !== expectedBytes.length) return 'invalid'

  return timingSafeEqual(suppliedBytes, expectedBytes) ? 'valid' : 'invalid'
}

export function hasSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin')
  if (!originHeader) return false

  try {
    const requestUrl = new URL(request.url)
    const originUrl = new URL(originHeader)

    return (
      originHeader === originUrl.origin &&
      originUrl.origin === requestUrl.origin &&
      (process.env.NODE_ENV !== 'production' || requestUrl.protocol === 'https:')
    )
  } catch {
    return false
  }
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function signPayload(encodedPayload: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(encodedPayload, 'utf8').digest()
}

export function createSessionToken(nowMilliseconds = Date.now()): string {
  const secret = getSessionSecret()
  if (!secret) throw new SessionConfigurationError()

  const issuedAt = Math.floor(nowMilliseconds / 1_000)
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  }
  const encodedPayload = encodePayload(payload)
  const signature = signPayload(encodedPayload, secret).toString('base64url')

  return `${encodedPayload}.${signature}`
}

function parseSessionPayload(encodedPayload: string): SessionPayload | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encodedPayload)) return null

  try {
    const payloadBytes = Buffer.from(encodedPayload, 'base64url')
    if (payloadBytes.toString('base64url') !== encodedPayload) return null

    const value: unknown = JSON.parse(payloadBytes.toString('utf8'))
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

    const payload = value as Record<string, unknown>
    if (
      payload.v !== SESSION_VERSION ||
      typeof payload.iat !== 'number' ||
      !Number.isSafeInteger(payload.iat) ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp)
    ) {
      return null
    }

    return {
      v: SESSION_VERSION,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader || cookieHeader.length > MAXIMUM_COOKIE_HEADER_LENGTH) return null

  const cookiePrefix = `${SESSION_COOKIE_NAME}=`
  const matchingCookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(cookiePrefix))

  if (matchingCookies.length !== 1) return null

  const token = matchingCookies[0].slice(cookiePrefix.length)
  return token.length > 0 ? token : null
}

export function hasValidSession(request: Request, nowMilliseconds = Date.now()): boolean {
  const secret = getSessionSecret()
  const token = extractSessionToken(request)
  if (!secret || !token) return false

  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false

  const [encodedPayload, encodedSignature] = parts
  const suppliedSignature = Buffer.from(encodedSignature, 'base64url')
  const expectedSignature = signPayload(encodedPayload, secret)

  if (
    suppliedSignature.length !== expectedSignature.length ||
    suppliedSignature.toString('base64url') !== encodedSignature ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return false
  }

  const payload = parseSessionPayload(encodedPayload)
  if (!payload) return false

  const nowSeconds = Math.floor(nowMilliseconds / 1_000)
  return (
    payload.exp - payload.iat === SESSION_MAX_AGE_SECONDS &&
    payload.iat <= nowSeconds + 60 &&
    payload.exp > nowSeconds
  )
}

export function createSessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
