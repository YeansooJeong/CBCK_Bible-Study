import { verifySessionToken } from './session.ts'

export async function requireAdmin(req: Request, secret: string): Promise<string | null> {
  const authHeader = req.headers.get('x-admin-token')
  if (!authHeader) return null

  const payload = await verifySessionToken(authHeader, secret)
  if (!payload || payload.role !== 'admin') return null

  return payload.sub
}

// 슈퍼 admin(admins 테이블 로그인) 또는 일반 admin 권한이 부여된 학생 계정 모두 허용.
// 일반 admin은 학생 로그인 그대로이므로 x-user-token에 role: 'general_admin'으로 실려온다.
export async function requireSuperOrGeneralAdmin(
  req: Request,
  secret: string,
): Promise<{ actorId: string; isSuperAdmin: boolean } | null> {
  const adminToken = req.headers.get('x-admin-token')
  if (adminToken) {
    const payload = await verifySessionToken(adminToken, secret)
    if (payload && payload.role === 'admin') return { actorId: payload.sub, isSuperAdmin: true }
  }

  const userToken = req.headers.get('x-user-token')
  if (userToken) {
    const payload = await verifySessionToken(userToken, secret)
    if (payload && payload.role === 'general_admin') return { actorId: payload.sub, isSuperAdmin: false }
  }

  return null
}
