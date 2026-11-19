import { clearSessionCookie, hasSameOrigin } from '../server/auth/session.js'

function jsonResponse(
  payload: unknown,
  statusCode = 200,
  clearCookie = false,
): Response {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  })
  if (clearCookie) headers.set('Set-Cookie', clearSessionCookie())

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers,
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    if (!hasSameOrigin(request)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403)
    }

    return jsonResponse({ loggedOut: true }, 200, true)
  },
}
