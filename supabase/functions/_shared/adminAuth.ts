import { verifySessionToken } from './session.ts'

export async function requireAdmin(req: Request, secret: string): Promise<string | null> {
  const authHeader = req.headers.get('x-admin-token')
  if (!authHeader) return null

  const payload = await verifySessionToken(authHeader, secret)
  if (!payload || payload.role !== 'admin') return null

  return payload.sub
}
