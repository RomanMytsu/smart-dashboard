import {
  checkDashboardPassword,
  createSessionCookie,
  createSessionToken,
  hasSameOrigin,
  SessionConfigurationError,
} from '../server/auth/session.js'

const MAX_REQUEST_BODY_LENGTH = 2_048
const MAX_PASSWORD_LENGTH = 1_024

function jsonResponse(
  payload: unknown,
  statusCode = 200,
  setCookie?: string,
): Response {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  })
  if (setCookie) headers.set('Set-Cookie', setCookie)

  return new Response(JSON.stringify(payload), { status: statusCode, headers })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    if (!hasSameOrigin(request)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403)
    }

    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/json') {
      return jsonResponse({ error: 'Expected application/json' }, 415)
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (contentLength > MAX_REQUEST_BODY_LENGTH) {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }

    let body: unknown
    try {
      const rawBody = await request.text()
      if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
        return jsonResponse({ error: 'Invalid request' }, 400)
      }
      body = JSON.parse(rawBody) as unknown
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }

    if (!isObject(body) || typeof body.password !== 'string' || body.password.length > MAX_PASSWORD_LENGTH) {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }

    const passwordCheck = checkDashboardPassword(body.password)
    if (passwordCheck === 'not-configured') {
      return jsonResponse({ error: 'Authentication is not configured' }, 503)
    }
    if (passwordCheck !== 'valid') {
      return jsonResponse({ error: 'Invalid credentials' }, 401)
    }

    try {
      const token = createSessionToken()
      return jsonResponse(
        { authenticated: true },
        200,
        createSessionCookie(token),
      )
    } catch (error) {
      if (error instanceof SessionConfigurationError) {
        return jsonResponse({ error: 'Session authentication is not configured' }, 503)
      }
      return jsonResponse({ error: 'Unable to create session' }, 500)
    }
  },
}
