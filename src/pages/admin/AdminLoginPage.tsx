import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { adminSession } from '../../lib/session'

function AdminLoginPage() {
  const navigate = useNavigate()
  const [setupMode, setSetupMode] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (setupMode && (password.length < 8 || password !== confirm)) {
      setError('비밀번호는 8자 이상이며 서로 일치해야 합니다.')
      return
    }
    setLoading(true)
    try {
      if (setupMode) {
        await api.setupAdmin(password)
        setSetupMode(false)
        setPassword('')
        setConfirm('')
        setError('초기 관리자 계정(admin)이 생성되었습니다. 로그인해 주세요.')
      } else {
        const result = await api.adminLogin(loginId, password)
        adminSession.set(result.token)
        navigate('/admin')
      }
    } catch {
      setError(setupMode ? '초기 관리자 생성에 실패했습니다. 이미 관리자 계정이 있을 수 있습니다.' : '아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-frame-solo">
        <div className="brand" style={{ marginBottom: 24, justifyContent: 'center' }}>
          <span className="brandmark">
            <span>▯</span>
          </span>
          <strong>CBCK 문제은행</strong>
        </div>
        <section className="auth-card">
          <h2>{setupMode ? '초기 관리자 생성' : '관리자 로그인'}</h2>
          <p className="sub">{setupMode ? '이 프로젝트의 첫 관리자 계정을 만듭니다.' : '등록된 관리자 계정으로 로그인합니다.'}</p>
          {error && <div className="notice error">{error}</div>}
          <form onSubmit={submit}>
            {setupMode ? (
              <div className="auth-field">
                <label htmlFor="adminId">관리자 ID</label>
                <input id="adminId" className="field" value="admin" disabled />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>최초 생성 시 관리자 ID는 admin으로 고정됩니다.</span>
              </div>
            ) : (
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
            )}
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
            {setupMode && (
              <div className="auth-field">
                <label htmlFor="adminPasswordConfirm">비밀번호 확인</label>
                <input
                  id="adminPasswordConfirm"
                  className="field"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            )}
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? '처리하는 중…' : setupMode ? '관리자 생성' : '로그인'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setSetupMode(!setupMode)
              setError(null)
              setPassword('')
              setConfirm('')
            }}
            className="admin-link"
            style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 18, background: 'none', border: 0, cursor: 'pointer' }}
          >
            {setupMode ? '로그인으로 돌아가기' : '초기 관리자 생성'}
          </button>
          <div className="auth-meta" style={{ justifyContent: 'center' }}>
            <Link className="admin-link" to="/login">
              ← 학생 로그인으로
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminLoginPage
