function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export interface SessionPayload {
  sub: string
  exp: number
  role?: 'admin' | 'general_admin'
}

export async function createSessionToken(
  userId: string,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
  role?: 'admin' | 'general_admin',
): Promise<string> {
  const payload: SessionPayload = { sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds, role }
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  const sigB64 = base64url(new Uint8Array(sig))
  return `${payloadB64}.${sigB64}`
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return null

    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(sigB64), new TextEncoder().encode(payloadB64))
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64))) as SessionPayload
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}
