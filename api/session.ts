import { hasValidSession } from '../server/auth/session.js'

export default {
  async fetch(request: Request): Promise<Response> {
    const headers = {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...headers, Allow: 'GET' },
      })
    }

    return new Response(
      JSON.stringify({ authenticated: hasValidSession(request) }),
      { status: 200, headers },
    )
  },
}
