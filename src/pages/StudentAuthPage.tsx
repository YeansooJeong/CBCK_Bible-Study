import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { studentSession } from '../lib/session'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

type Step = 'phone' | 'login' | 'activate' | 'not-registered'

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
    default:
      return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

function StudentAuthPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [password, setPassword] = useState('')

  const [name, setName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [kjvYear, setKjvYear] = useState('')
  const [newPassword, setNewPassword] = useState('')

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
    } catch {
      setError(errorMessage('unknown'))
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
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.message : 'unknown'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-white px-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-50">학생 로그인</h1>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-3">
            <input
              className={inputClass}
              type="tel"
              placeholder="전화번호 (- 없이)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              다음
            </button>
          </form>
        )}

        {step === 'not-registered' && (
          <div className="flex flex-col gap-3">
            <p className="text-neutral-600 dark:text-neutral-400">
              등록되지 않은 전화번호입니다. 관리자에게 문의해주세요.
            </p>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700"
            >
              돌아가기
            </button>
          </div>
        )}

        {step === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
            <input
              className={inputClass}
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              로그인
            </button>
          </form>
        )}

        {step === 'activate' && (
          <form onSubmit={handleActivateSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              최초 로그인입니다. 본인 확인 후 비밀번호를 설정해주세요.
            </p>
            <input
              className={inputClass}
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="간사 이름"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="반장 이름"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="킹제임스 성경(영어) 출판연도 (예: 1611)"
              value={kjvYear}
              onChange={(e) => setKjvYear(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="password"
              placeholder="새 비밀번호 (8자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              계정 활성화
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default StudentAuthPage
