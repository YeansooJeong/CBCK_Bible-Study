import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { adminSession } from '../../lib/session'

const inputClass = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

function AdminLoginPage() {
  const navigate = useNavigate()
  const [setupMode, setSetupMode] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (setupMode && (password.length < 8 || password !== confirm)) { setError('비밀번호는 8자 이상이며 서로 일치해야 합니다.'); return }
    setLoading(true)
    try {
      if (setupMode) { await api.setupAdmin(password); setSetupMode(false); setPassword(''); setConfirm(''); setError('초기 관리자 admin이 생성되었습니다. 로그인해 주세요.') }
      else { const result = await api.adminLogin('admin', password); adminSession.set(result.token); navigate('/admin') }
    } catch { setError(setupMode ? '초기 관리자 생성에 실패했습니다. 이미 생성되었을 수 있습니다.' : '비밀번호가 올바르지 않습니다.') }
    finally { setLoading(false) }
  }

  return <div className="flex min-h-svh items-center justify-center bg-white px-4 dark:bg-neutral-950"><div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
    <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-50">{setupMode ? '초기 관리자 생성' : '관리자 로그인'}</h1>
    {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input className={inputClass} value="admin" disabled placeholder="관리자 ID" />
      {setupMode && <p className="text-xs text-neutral-500">관리자 ID는 admin으로 고정됩니다.</p>}
      <input className={inputClass} type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {setupMode && <input className={inputClass} type="password" placeholder="비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}
      <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-50">{setupMode ? '관리자 생성' : '로그인'}</button>
    </form>
    <button type="button" onClick={() => { setSetupMode(!setupMode); setError(null); setPassword(''); setConfirm('') }} className="mt-4 w-full text-sm text-accent hover:underline">{setupMode ? '로그인으로 돌아가기' : '초기 관리자 생성'}</button>
  </div></div>
}
export default AdminLoginPage
