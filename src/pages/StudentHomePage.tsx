import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Problem } from '../lib/api'
import { studentSession, type StudentUser } from '../lib/session'

function StudentHomePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<StudentUser | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [summary, setSummary] = useState<{ total: number; correct: number; score: number } | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; started_at: string; total: number; correct: number }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const current = studentSession.getUser()
    if (!studentSession.get() || !current) { navigate('/login'); return }
    setUser(current)
    api.quizHistory(studentSession.get()!).then(({ sessions }) => setHistory(sessions)).catch(() => undefined)
  }, [navigate])

  async function startQuiz() {
    const token = studentSession.get()
    if (!token) return navigate('/login')
    setError('')
    try {
      const result = await api.startQuizSession(token, { count: 10 })
      setSessionId(result.sessionId); setProblems(result.problems); setAnswers({}); setResults({})
      setSummary(null)
    } catch { setError('출제 가능한 문제가 없습니다.') }
  }

  async function finishQuiz() {
    const token = studentSession.get()
    if (!token || !sessionId) return
    try { const result = await api.finishQuizSession(token, sessionId); setSummary(result); setHistory((await api.quizHistory(token)).sessions) } catch { setError('퀴즈 결과를 불러오지 못했습니다.') }
  }

  async function submit(problem: Problem) {
    if (!sessionId || !studentSession.get() || !answers[problem.id]?.trim()) return
    try {
      const result = await api.submitAnswer(studentSession.get()!, { sessionId, problemId: problem.id, userAnswer: answers[problem.id] })
      setResults((current) => ({ ...current, [problem.id]: result.isCorrect }))
    } catch { setError('답안 제출에 실패했습니다.') }
  }

  if (!user) return null
  return <div className="min-h-svh bg-white px-4 py-6 sm:px-6 sm:py-10 dark:bg-neutral-950"><div className="mx-auto flex max-w-2xl flex-col gap-6">
    <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">환영합니다, {user.displayName}님</h1>
    <p className="text-neutral-500">문제를 풀어 보세요.</p>
    {error && <p className="text-sm text-red-500">{error}</p>}
    {summary && <section className="rounded-2xl border border-accent p-5"><h2 className="text-lg font-semibold">퀴즈 결과</h2><p className="mt-2">{summary.total}문제 중 {summary.correct}문제 정답 · 점수 {summary.score}점</p></section>}
    {problems.length > 0 && <section className="rounded-2xl border p-5 dark:border-neutral-800"><p className="mb-4 text-sm text-neutral-500">퀴즈 세션 · {problems.length}문제</p>{problems.map((p, i) => <article key={p.id} className="mb-4 rounded-lg border p-4 dark:border-neutral-800"><p className="text-xs text-neutral-400">{i + 1}. {p.type}</p><p className="mt-1 text-neutral-900 dark:text-neutral-50">{p.question}</p>{p.options ? <div className="mt-2 flex flex-col gap-1">{Object.entries(p.options).map(([key, value]) => <label key={key} className="text-sm"><input type="radio" name={p.id} value={key} checked={answers[p.id] === key} onChange={(e) => setAnswers({ ...answers, [p.id]: e.target.value })} /> <span className="ml-1">{key}. {value}</span></label>)}</div> : <input className="mt-3 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" value={answers[p.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [p.id]: e.target.value })} placeholder="답안을 입력하세요" />}<div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => submit(p)} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white">제출</button>{results[p.id] !== undefined && <span className={results[p.id] ? 'text-sm text-green-600' : 'text-sm text-red-500'}>{results[p.id] ? '정답입니다.' : '오답입니다.'}</span>}</div></article>)}<button type="button" onClick={finishQuiz} className="rounded-lg border border-accent px-4 py-2 text-sm text-accent">퀴즈 종료 및 결과 보기</button></section>}
    {history.length > 0 && <section className="rounded-2xl border p-5 dark:border-neutral-800"><h2 className="mb-3 font-semibold">최근 퀴즈 기록</h2>{history.map((item) => <div key={item.id} className="flex justify-between border-t py-2 text-sm dark:border-neutral-800"><span>{new Date(item.started_at).toLocaleString()}</span><span>{item.correct}/{item.total} ({item.total ? Math.round(item.correct / item.total * 100) : 0}점)</span></div>)}</section>}
    <div className="flex flex-wrap gap-3"><button type="button" onClick={startQuiz} className="rounded-lg bg-accent px-4 py-2 font-medium text-white">퀴즈 시작</button><Link to="/projects" className="rounded-lg border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700">프로젝트</Link><button type="button" onClick={() => { studentSession.clear(); navigate('/login') }} className="rounded-lg border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700">로그아웃</button></div>
  </div></div>
}

export default StudentHomePage
