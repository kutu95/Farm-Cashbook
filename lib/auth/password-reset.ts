const PRODUCTION_ORIGIN = 'https://books.landlife.au'

export function appOrigin(request: { headers: Headers; nextUrl: URL }) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim() || ''
  const hostname = host.replace(/^\[|\]$/g, '').split(':')[0]

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
    return `${proto}://${host}`
  }

  return PRODUCTION_ORIGIN
}

export function isPlausibleEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function missingUser(error: { message?: string; status?: number; code?: string }) {
  const message = error.message?.toLowerCase() || ''
  return error.status === 404
    || error.code === 'user_not_found'
    || message.includes('user not found')
    || message.includes('unable to find user')
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
