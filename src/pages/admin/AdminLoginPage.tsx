import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { adminSession } from '../../lib/session'
import churchLogo from '../../assets/church-logo.png'

function AdminLoginPage() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await api.adminLogin(loginId, password)
      adminSession.set(result.token)
      navigate('/admin')
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-frame-solo">
        <div className="brand" style={{ marginBottom: 24, justifyContent: 'center' }}>
          <img className="brand-logo" src={churchLogo} alt="사랑침례교회" />
          <strong>신학원 스터디 카페</strong>
        </div>
        <section className="auth-card">
          <h2>관리자 로그인</h2>
          <p className="sub">등록된 관리자 계정으로 로그인합니다.</p>
          {error && <div className="notice error">{error}</div>}
          <form onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="adminId">아이디</label>
              <input
                id="adminId"
                className="field"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="adminPassword">비밀번호</label>
              <input
                id="adminPassword"
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? '처리하는 중…' : '로그인'}
            </button>
          </form>
          <div className="auth-meta" style={{ justifyContent: 'center' }}>
            <Link className="admin-link" to="/login">
              ← 신학원생 로그인으로
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminLoginPage
