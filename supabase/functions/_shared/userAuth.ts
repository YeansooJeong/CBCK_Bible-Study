import { verifySessionToken } from './session.ts'

export async function requireUser(req: Request, secret: string): Promise<string | null> {
  const authHeader = req.headers.get('x-user-token')
  if (!authHeader) return null

  const payload = await verifySessionToken(authHeader, secret)
  if (!payload || payload.role === 'admin') return null

  return payload.sub
}
