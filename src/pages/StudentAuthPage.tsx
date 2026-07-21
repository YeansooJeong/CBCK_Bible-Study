import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/StudentShell'
import { api, ApiError } from '../lib/api'
import { studentSession } from '../lib/session'
import churchLogo from '../assets/church-logo.png'

type Step = 'phone' | 'login' | 'activate' | 'not-registered'

const stepMeta: Record<Step, { title: string; subtitle: string; dot: number }> = {
  phone: { title: '신학원생 로그인', subtitle: '등록된 휴대전화로 계정을 확인합니다.', dot: 0 },
  login: { title: '비밀번호 입력', subtitle: '안전한 학습 공간으로 이동합니다.', dot: 1 },
  activate: { title: '계정 활성화', subtitle: '본인 확인 후 새 비밀번호를 설정합니다.', dot: 2 },
  'not-registered': { title: '등록 안내', subtitle: '관리자에게 등록을 문의해 주세요.', dot: 0 },
}

function errorMessage(code: string): string {
  switch (code) {
    case 'invalid_credentials':
      return '전화번호 또는 비밀번호가 올바르지 않습니다.'
    case 'locked':
      return '5회 이상 로그인에 실패하여 계정이 잠겼습니다. 잠시 후 다시 시도해주세요.'
    case 'name_mismatch':
      return '이름이 일치하지 않습니다.'
    case 'auth_question_mismatch':
      return '간사 이름 / 반장 이름 / 킹제임스 성경(영어) 출판연도 중 일치하지 않는 항목이 있습니다.'
    case 'weak_password':
      return '비밀번호는 8자 이상이어야 합니다.'
    case 'already_active':
      return '이미 활성화된 계정입니다. 로그인해주세요.'
    case 'rate_limited':
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    default:
      return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

function StudentAuthPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [password, setPassword] = useState('')

  const [name, setName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [kjvYear, setKjvYear] = useState('')
  const [newPassword, setNewPassword] = useState('')

  function goToStep(next: Step) {
    setStep(next)
    setError(null)
    setNotice(null)
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const result = await api.checkPhone(phone)
      if (!result.registered) {
        setStep('not-registered')
      } else if (result.status === 'active') {
        setStep('login')
      } else {
        setStep('activate')
      }
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.message : 'unknown'))
    } finally {
      setLoading(false)
    }
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await api.login(phone, password)
      studentSession.set(result.token, result.user)
      navigate('/home')
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.message : 'unknown'))
    } finally {
      setLoading(false)
    }
  }

  async function handleActivateSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.activateAccount({ phone, name, staffName, leaderName, kjvYear, password: newPassword })
      setPassword('')
      setStep('login')
      setNotice('계정이 활성화되었습니다. 비밀번호로 로그인해 주세요.')
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.message : 'unknown'))
    } finally {
      setLoading(false)
    }
  }

  const meta = stepMeta[step]

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <section className="auth-intro">
          <div className="brand">
            <img className="brand-logo" src={churchLogo} alt="사랑침례교회" />
            <strong>신학원 스터디 카페</strong>
          </div>
          <div className="auth-intro-copy">
            <p className="eyebrow">BIBLE STUDY · QUIZ BANK</p>
            <h1>
              배운 것을
              <br />
              <span className="accent-text">다시 꺼내는</span> 시간
            </h1>
            <p className="lede">나만의 문제를 만들고, 반복해서 풀며 말씀을 더 깊이 기억해 보세요.</p>
            <blockquote className="auth-verse">
              모든 성경기록은 하나님의 영감에 의해 주어진 것으로 교리와 책망과 바로잡음과 의로 교육하기에 유익하니
              <cite>딤후 3:16</cite>
            </blockquote>
          </div>
        </section>

        <section className="auth-card" aria-live="polite">
          <h2>{meta.title}</h2>
          <p className="sub">{meta.subtitle}</p>
          <div className="auth-steps" aria-label="진행 단계">
            {[0, 1, 2].map((i) => (
              <i key={i} className={`auth-step ${i <= meta.dot ? 'on' : ''}`} />
            ))}
          </div>

          {error && <div className="notice error">{error}</div>}
          {notice && !error && <div className="notice">{notice}</div>}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit}>
              <div className="auth-field">
                <label htmlFor="phone">휴대전화</label>
                <input
                  id="phone"
                  className="field"
                  type="tel"
                  inputMode="numeric"
                  placeholder="휴대전화 (- 없이)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? '확인하는 중…' : '다음'} {!loading && <Icon name="arrow" size={18} />}
              </button>
            </form>
          )}

          {step === 'not-registered' && (
            <div>
              <div className="notice">등록되지 않은 휴대전화입니다. 관리자에게 등록을 문의해 주세요.</div>
              <button type="button" className="secondary-button" onClick={() => goToStep('phone')}>
                돌아가기
              </button>
            </div>
          )}

          {step === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <div className="notice">등록된 계정입니다. 비밀번호를 입력해 주세요.</div>
              <div className="auth-field">
                <label htmlFor="password">비밀번호</label>
                <input
                  id="password"
                  className="field"
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? '로그인하는 중…' : '로그인'} {!loading && <Icon name="arrow" size={18} />}
              </button>
              <button type="button" className="secondary-button" onClick={() => goToStep('phone')}>
                휴대전화 다시 입력
              </button>
            </form>
          )}

          {step === 'activate' && (
            <form onSubmit={handleActivateSubmit}>
              <div className="notice">첫 로그인입니다. 본인 확인 질문에 답하고 비밀번호를 설정해 주세요.</div>
              <div className="auth-field">
                <label htmlFor="name">이름</label>
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="auth-field">
                <label htmlFor="staff">간사 이름</label>
                <input id="staff" className="field" value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
              </div>
              <div className="auth-field">
                <label htmlFor="leader">반장 이름</label>
                <input id="leader" className="field" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} required />
              </div>
              <div className="auth-field">
                <label htmlFor="kjv">킹제임스 성경(영어) 출판연도</label>
                <input
                  id="kjv"
                  className="field"
                  inputMode="numeric"
                  placeholder="해당 연도 숫자만 입력"
                  value={kjvYear}
                  onChange={(e) => setKjvYear(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="newPassword">새 비밀번호</label>
                <input
                  id="newPassword"
                  className="field"
                  type="password"
                  minLength={8}
                  placeholder="8자 이상"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? '처리하는 중…' : '계정 활성화'} {!loading && <Icon name="arrow" size={18} />}
              </button>
              <button type="button" className="secondary-button" onClick={() => goToStep('phone')}>
                휴대전화 다시 입력
              </button>
            </form>
          )}

          <div className="auth-meta" style={{ justifyContent: 'flex-end' }}>
            <Link className="admin-link" to="/admin/login">
              관리자이신가요? 관리자 로그인 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default StudentAuthPage
