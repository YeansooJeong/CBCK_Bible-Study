import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <div className="auth-shell">
      <div className="auth-frame-solo" style={{ textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <span className="brandmark">
            <span>▯</span>
          </span>
          <strong>CBCK 문제은행</strong>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: 32 }}>신학원 학생들의 자율 학습을 돕는 카드형 문제 풀이 서비스</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/login" className="primary-button" style={{ textDecoration: 'none' }}>
            학생 로그인
          </Link>
          <Link to="/admin/login" className="secondary-button" style={{ textDecoration: 'none' }}>
            관리자
          </Link>
        </div>
      </div>
    </div>
  )
}

export default HomePage
