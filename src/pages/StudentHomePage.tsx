import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import StudentShell, { Icon } from '../components/StudentShell'
import { api, describeApiError, type Problem, type ProblemComment, type ProblemType, type Project } from '../lib/api'
import { studentSession, type StudentUser } from '../lib/session'
import { formatBibleAnswer } from '../lib/format'
import { NewContentNotice } from '../components/NewContentNotice'

type HistoryItem = { id: string; started_at: string; total: number; correct: number }
type WeakArea = { refCourse: string; refSession: string; total: number; correct: number; rate: number }
type Summary = { total: number; correct: number; partial?: number; earned?: number; score: number; weakAreas: WeakArea[] }
// 채점 결과는 정답/부분정답/오답 3단계다. 부분정답은 점수의 일부만 받는다.
type Verdict = 'correct' | 'partial' | 'wrong'

// 학습 시작 화면에서 고를 수 있는 문제 유형. 기본값은 전체 선택이다.
const problemTypeOptions: Array<{ value: ProblemType; label: string }> = [
  { value: 'mcq', label: '객관식' },
  { value: 'short', label: '단답형' },
  { value: 'bible', label: '성경문제' },
]
const allProblemTypes = problemTypeOptions.map((option) => option.value)

const withdrawReasons = ['신학원 과정 이수 중단', '더 이상 이용하지 않음', '개인정보가 걱정됨', '사용이 불편함', '기타']

// 정답과 함께 보여주는 출처 문구. 퀴즈 채점 피드백과 플래시카드가 같은 형식을 쓴다.
function formatReference(problem: Problem): string {
  return [problem.ref_course, problem.ref_session ? `${problem.ref_session}강` : '', problem.ref_kind, problem.ref_detail]
    .filter(Boolean)
    .join(' · ') || '등록된 레퍼런스가 없습니다.'
}
type Scope = { course: string; sessions: string[] }

function sameLocalDay(a: Date, b: Date) { return a.toDateString() === b.toDateString() }

const WEEKLY_GOAL_KEY = 'cbck_weekly_goal_days'
const DEFAULT_WEEKLY_GOAL = 5

function readStoredWeeklyGoal(): number {
  const stored = Number(localStorage.getItem(WEEKLY_GOAL_KEY))
  return stored >= 1 && stored <= 7 ? stored : DEFAULT_WEEKLY_GOAL
}

function StudentHomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user] = useState<StudentUser | null>(() => studentSession.getUser())
  const [projects, setProjects] = useState<Project[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quizOpen, setQuizOpen] = useState(() => Boolean((location.state as { openStudy?: boolean } | null)?.openStudy))
  const [selectedProject, setSelectedProject] = useState('')
  const [count, setCount] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<ProblemType[]>(allProblemTypes)
  const [scopes, setScopes] = useState<Scope[]>([])
  const [selectedSession, setSelectedSession] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<Verdict | null>(null)
  const [score, setScore] = useState(0)
  // 이전 문제로 되돌아갔을 때 채점 결과를 그대로 다시 보여주기 위해 문제별로 보관한다.
  const [answered, setAnswered] = useState<Record<string, { answer: string; verdict: Verdict; score: number; correctAnswer: string }>>({})
  // 이번 회차가 복습으로 채워졌을 때만 뜨는 안내
  const [quizNotice, setQuizNotice] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeSession, setActiveSession] = useState<{ sessionId: string; problems: Problem[]; resumeIndex: number } | null>(null)
  const [bookmarkedProblems, setBookmarkedProblems] = useState<Problem[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const [commentsByProblem, setCommentsByProblem] = useState<Record<string, ProblemComment[]>>({})
  const [commentPanelOpen, setCommentPanelOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  const [weeklyGoal, setWeeklyGoal] = useState(readStoredWeeklyGoal)
  const [weeklySettingsOpen, setWeeklySettingsOpen] = useState(false)
  const [historyDeleting, setHistoryDeleting] = useState(false)
  const [historyDeleteMessage, setHistoryDeleteMessage] = useState('')
  // 회원 탈퇴: 사유를 받고 개인정보를 즉시 파기한다.
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawDetail, setWithdrawDetail] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

  const [flashOpen, setFlashOpen] = useState(false)
  const [flashProject, setFlashProject] = useState('')
  const [flashSession, setFlashSession] = useState('')
  const [flashBookmarkedOnly, setFlashBookmarkedOnly] = useState(false)
  const [flashCount, setFlashCount] = useState(10)
  const [flashScopes, setFlashScopes] = useState<Scope[]>([])
  const [flashCards, setFlashCards] = useState<Problem[]>([])
  const [flashIndex, setFlashIndex] = useState(0)
  const [flashRevealed, setFlashRevealed] = useState(false)
  const [flashKnown, setFlashKnown] = useState<Set<string>>(new Set())
  const [flashUnknown, setFlashUnknown] = useState<Set<string>>(new Set())
  const [flashDone, setFlashDone] = useState(false)
  const [flashLoading, setFlashLoading] = useState(false)
  const [flashError, setFlashError] = useState('')
  const [flashBookmarkMessage, setFlashBookmarkMessage] = useState('')

  useEffect(() => {
    const token = studentSession.get()
    if (!token || !user) { navigate('/login'); return }
    Promise.all([api.quizHistory(token), api.listProjects({ userToken: token }), api.getActiveQuizSession(token)])
      .then(([historyResult, projectResult, activeResult]) => {
        setHistory(historyResult.sessions); setProjects(projectResult.projects); setActiveSession(activeResult.session)
      })
      .catch((err) => setError(describeApiError(err, '학습 정보를 불러오지 못했습니다.')))
      .finally(() => setLoading(false))
  }, [navigate, user])

  useEffect(() => {
    const token = studentSession.get()
    if (token) api.listBookmarkedProblems(token).then(({ problems: rows }) => { setBookmarkedProblems(rows); setBookmarkedIds(new Set(rows.map((row) => row.id))) }).catch(() => undefined)
  }, [])

  async function submitWithdrawal() {
    const token = studentSession.get(); if (!token) return navigate('/login')
    if (!withdrawReason) { setWithdrawError('탈퇴 사유를 선택해 주세요.'); return }
    if (withdrawReason === '기타' && !withdrawDetail.trim()) { setWithdrawError('기타 사유를 적어 주세요.'); return }
    setWithdrawing(true); setWithdrawError('')
    try {
      await api.withdrawAccount(token, { reason: withdrawReason, reasonDetail: withdrawDetail.trim() || undefined })
      studentSession.clear()
      navigate('/login', { replace: true, state: { withdrawn: true } })
    } catch (err) {
      setWithdrawError(describeApiError(err, '탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'))
    } finally { setWithdrawing(false) }
  }

  function resumeQuiz() {
    if (!activeSession) return
    setSessionId(activeSession.sessionId); setProblems(activeSession.problems)
    setQuestionIndex(Math.min(activeSession.resumeIndex, activeSession.problems.length - 1))
    setAnswer(''); setResult(null); setCorrectAnswer(null); setSummary(null); setError(''); setAnswered({})
    setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
    setQuizOpen(true)
  }

  useEffect(() => {
    if ((location.state as { openStudy?: boolean } | null)?.openStudy) {
      setQuizOpen(true)
      navigate('/home', { replace: true, state: null })
    }
  }, [location.state, navigate])

  const weekly = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const sessions = history.filter((item) => new Date(item.started_at) >= start)
    const total = sessions.reduce((sum, item) => sum + item.total, 0)
    const correct = sessions.reduce((sum, item) => sum + item.correct, 0)
    const days = new Set(sessions.map((item) => new Date(item.started_at).toDateString())).size
    let streak = 0
    const cursor = new Date(now); cursor.setHours(0, 0, 0, 0)
    const dates = history.map((item) => new Date(item.started_at))
    if (!dates.some((date) => sameLocalDay(date, cursor))) cursor.setDate(cursor.getDate() - 1)
    while (dates.some((date) => sameLocalDay(date, cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) }
    return { total, rate: total ? Math.round(correct / total * 100) : 0, days, streak, progress: Math.min(100, Math.round((days / weeklyGoal) * 100)) }
  }, [history, weeklyGoal])

  function updateWeeklyGoal(days: number) {
    setWeeklyGoal(days)
    localStorage.setItem(WEEKLY_GOAL_KEY, String(days))
  }
  function resetWeeklyGoal() {
    setWeeklyGoal(DEFAULT_WEEKLY_GOAL)
    localStorage.removeItem(WEEKLY_GOAL_KEY)
  }

  async function handleDeleteHistory() {
    const token = studentSession.get()
    if (!token) return
    if (!window.confirm('지금까지 쌓인 학습 기록(퀴즈 결과)을 전부 삭제할까요? 이 작업은 되돌릴 수 없습니다. 등록된 문제나 북마크는 삭제되지 않습니다.')) return
    setHistoryDeleting(true)
    try {
      await api.deleteQuizHistory(token)
      setHistory([])
      setActiveSession(null)
      setHistoryDeleteMessage('학습 기록을 모두 삭제했습니다.')
    } catch {
      setHistoryDeleteMessage('학습 기록 삭제에 실패했습니다.')
    } finally {
      setHistoryDeleting(false)
    }
  }

  const greeting = new Date().getHours() >= 18 ? '평안한 저녁이에요' : '평안한 하루예요'
  const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date())
  const question = problems[questionIndex]
  const flashCard = flashCards[flashIndex]

  function openQuiz(projectId = '') {
    setSelectedProject(projectId); setSelectedSession(''); setBookmarkedOnly(false)
    setQuizOpen(true); setSessionId(null); setProblems([]); setSummary(null); setError('')
  }

  function openBookmarkedQuiz() {
    setSelectedProject(''); setSelectedSession(''); setBookmarkedOnly(true); setQuizOpen(true); setSessionId(null); setProblems([]); setSummary(null); setError('')
  }

  async function toggleBookmark() {
    const token = studentSession.get()
    if (!token || !question) return
    const bookmarked = !bookmarkedIds.has(question.id)
    await api.toggleProblemBookmark(token, question.id, bookmarked)
    setBookmarkedIds((current) => { const next = new Set(current); bookmarked ? next.add(question.id) : next.delete(question.id); return next })
    setBookmarkedProblems((current) => bookmarked ? [...current, question] : current.filter((item) => item.id !== question.id))
  }

  async function removeBookmark(problemId: string) {
    const token = studentSession.get()
    if (!token) return
    await api.toggleProblemBookmark(token, problemId, false)
    setBookmarkedIds((current) => { const next = new Set(current); next.delete(problemId); return next })
    setBookmarkedProblems((current) => current.filter((item) => item.id !== problemId))
  }

  async function toggleFlashBookmark() {
    const token = studentSession.get()
    const card = flashCards[flashIndex]
    if (!token || !card) return
    const bookmarked = !bookmarkedIds.has(card.id)
    await api.toggleProblemBookmark(token, card.id, bookmarked)
    setBookmarkedIds((current) => { const next = new Set(current); bookmarked ? next.add(card.id) : next.delete(card.id); return next })
    setBookmarkedProblems((current) => bookmarked ? [...current, card] : current.filter((item) => item.id !== card.id))
  }
  function closeQuiz() { if (!submitting) { setQuizOpen(false); setSessionId(null); setProblems([]); setSummary(null) } }

  function resetFlashcardState() {
    setFlashCards([]); setFlashIndex(0); setFlashRevealed(false)
    setFlashKnown(new Set()); setFlashUnknown(new Set()); setFlashDone(false); setFlashError(''); setFlashBookmarkMessage('')
  }

  function openFlashcards(projectId = '') {
    setFlashProject(projectId); setFlashSession(''); setFlashBookmarkedOnly(false)
    resetFlashcardState(); setFlashOpen(true)
  }

  function openBookmarkedFlashcards() {
    setFlashProject(''); setFlashSession(''); setFlashBookmarkedOnly(true)
    resetFlashcardState(); setFlashOpen(true)
  }

  function closeFlashcards() { setFlashOpen(false); resetFlashcardState() }

  useEffect(() => {
    if (!flashOpen || flashCards.length) return
    const token = studentSession.get(); if (!token) return
    api.listQuizScopes(token, flashProject || undefined).then((data) => setFlashScopes(data.courses)).catch(() => setFlashScopes([]))
  }, [flashOpen, flashCards.length, flashProject])

  async function startFlashcards() {
    const token = studentSession.get(); if (!token) return navigate('/login')
    setFlashLoading(true); setFlashError('')
    try {
      const data = await api.listFlashcardProblems(token, {
        projectId: flashProject || undefined,
        refSession: flashSession || undefined,
        bookmarkedOnly: flashBookmarkedOnly,
        count: flashCount,
      })
      if (!data.problems.length) { setFlashError('선택한 범위에 학습할 문제가 없습니다.'); return }
      setFlashCards(data.problems); setFlashIndex(0); setFlashRevealed(false)
      setFlashKnown(new Set()); setFlashUnknown(new Set()); setFlashDone(false)
    } catch { setFlashError('문제를 불러오지 못했습니다.') }
    finally { setFlashLoading(false) }
  }

  function markFlashcard(known: boolean) {
    const card = flashCards[flashIndex]
    // 이전 카드로 돌아가 다시 표시할 수 있으므로, 한쪽에 넣을 때 반대쪽에서는 반드시 빼야
    // 같은 카드가 양쪽에 모두 남아 집계가 어긋나지 않는다.
    setFlashKnown((current) => { const next = new Set(current); if (known) next.add(card.id); else next.delete(card.id); return next })
    setFlashUnknown((current) => { const next = new Set(current); if (known) next.delete(card.id); else next.add(card.id); return next })
    if (flashIndex < flashCards.length - 1) { setFlashIndex((value) => value + 1); setFlashRevealed(false) }
    else setFlashDone(true)
  }

  // 이미 본 카드로 돌아가는 것이므로 정답을 펼친 상태로 보여준다.
  function prevFlashcard() {
    if (flashIndex > 0) { setFlashIndex((value) => value - 1); setFlashRevealed(true) }
  }

  function restartUnknownFlashcards() {
    const unknownCards = flashCards.filter((card) => flashUnknown.has(card.id)).sort(() => Math.random() - 0.5)
    setFlashCards(unknownCards); setFlashIndex(0); setFlashRevealed(false)
    setFlashKnown(new Set()); setFlashUnknown(new Set()); setFlashDone(false); setFlashBookmarkMessage('')
  }

  async function bookmarkUnknownFlashcards() {
    const token = studentSession.get(); if (!token) return
    setFlashBookmarkMessage('저장하는 중…')
    await Promise.all([...flashUnknown].map((problemId) => api.toggleProblemBookmark(token, problemId, true)))
    const { problems: rows } = await api.listBookmarkedProblems(token)
    setBookmarkedProblems(rows); setBookmarkedIds(new Set(rows.map((row) => row.id)))
    setFlashBookmarkMessage(`✓ ${flashUnknown.size}개 문제를 북마크에 저장했습니다.`)
  }

  useEffect(() => {
    if (!quizOpen || sessionId) return
    const token = studentSession.get(); if (!token) return
    api.listQuizScopes(token, selectedProject || undefined)
      .then((data) => setScopes(data.courses))
      .catch(() => setScopes([]))
  }, [quizOpen, sessionId, selectedProject])

  // 마지막 한 개는 끌 수 없게 버튼을 비활성화하므로 여기서 빈 배열이 될 일은 없다.
  function toggleType(value: ProblemType) {
    setSelectedTypes((current) => (current.includes(value) ? current.filter((type) => type !== value) : [...current, value]))
  }

  async function startQuiz() {
    const token = studentSession.get(); if (!token) return navigate('/login')
    setSubmitting(true); setError('')
    try {
      const data = await api.startQuizSession(token, {
        projectId: selectedProject || undefined,
        refSession: selectedSession || undefined,
        bookmarkedOnly,
        count,
        types: selectedTypes,
      })
      setSessionId(data.sessionId); setProblems(data.problems); setQuestionIndex(0); setAnswer(''); setResult(null); setCorrectAnswer(null); setAnswered({})
      setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
      // 안 풀어본 문제가 바닥나 이미 푼 문제가 섞인 경우에만 알려준다.
      const review = data.reviewCount ?? 0
      setQuizNotice(review > 0
        ? (data.newCount ? `새 문제 ${data.newCount}개를 다 담고, 남은 ${review}개는 전에 푼 문제로 채웠어요.` : '이 범위의 문제를 모두 풀어보셨어요. 지금부터는 무작위로 다시 출제됩니다.')
        : '')
    } catch {
      const typeNames = problemTypeOptions.filter((option) => selectedTypes.includes(option.value)).map((option) => option.label).join('·')
      setError(selectedTypes.length < allProblemTypes.length
        ? `선택한 범위에 ${typeNames} 문제가 없습니다. 유형을 더 선택해 보세요.`
        : '선택한 범위에 출제 가능한 문제가 없습니다.')
    }
    finally { setSubmitting(false) }
  }

  async function loadComments(problemId: string) {
    const token = studentSession.get(); if (!token) return
    try { const { comments } = await api.listProblemComments(token, problemId); setCommentsByProblem((current) => ({ ...current, [problemId]: comments })) }
    catch { /* 댓글 로딩 실패는 조용히 무시 */ }
  }

  async function submitAnswer() {
    const token = studentSession.get(); if (!token || !sessionId || !question || !answer.trim()) return
    setSubmitting(true)
    try {
      const data = await api.submitAnswer(token, { sessionId, problemId: question.id, userAnswer: answer })
      // 채점 함수(submit-answer)는 프론트와 배포 경로가 달라 잠시 구버전 응답이 올 수 있다.
      // verdict가 없으면 기존 isCorrect로 판정을 대신한다.
      const verdict = data.verdict ?? (data.isCorrect ? 'correct' : 'wrong')
      const gained = data.score ?? (data.isCorrect ? 1 : 0)
      setResult(verdict)
      setScore(gained)
      setCorrectAnswer(data.answer)
      setAnswered((current) => ({ ...current, [question.id]: { answer, verdict, score: gained, correctAnswer: data.answer } }))
      loadComments(question.id)
    }
    catch (err) { setError(describeApiError(err, '답안 제출에 실패했습니다.')) }
    finally { setSubmitting(false) }
  }

  async function submitComment() {
    const token = studentSession.get(); if (!token || !question || !commentDraft.trim()) return
    await api.createProblemComment(token, { problemId: question.id, content: commentDraft })
    setCommentDraft('')
    await loadComments(question.id)
  }

  async function saveComment(commentId: string) {
    const token = studentSession.get(); if (!token || !question || !editingCommentText.trim()) return
    await api.updateProblemComment(token, { commentId, content: editingCommentText })
    setEditingCommentId(null)
    await loadComments(question.id)
  }

  async function removeComment(commentId: string) {
    const token = studentSession.get(); if (!token || !question || !window.confirm('댓글을 삭제할까요?')) return
    await api.deleteProblemComment(token, commentId)
    await loadComments(question.id)
  }

  // 해당 순번의 문제로 이동하면서, 이미 푼 문제면 그때의 답안과 채점 결과를 되살린다.
  function goToQuestion(index: number) {
    const target = problems[index]
    const saved = target ? answered[target.id] : undefined
    setQuestionIndex(index)
    setAnswer(saved?.answer ?? '')
    setResult(saved?.verdict ?? null)
    setScore(saved?.score ?? 0)
    setCorrectAnswer(saved?.correctAnswer ?? null)
    setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
  }

  function prevQuestion() {
    if (questionIndex > 0) goToQuestion(questionIndex - 1)
  }

  async function nextQuestion() {
    setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
    if (questionIndex < problems.length - 1) { goToQuestion(questionIndex + 1); return }
    const token = studentSession.get(); if (!token || !sessionId) return
    setSubmitting(true)
    try {
      const data = await api.finishQuizSession(token, sessionId); setSummary(data)
      setHistory((await api.quizHistory(token)).sessions)
      setActiveSession(null)
    } catch (err) { setError(describeApiError(err, '학습 결과를 불러오지 못했습니다.')) }
    finally { setSubmitting(false) }
  }

  if (!user) return null
  return <StudentShell><NewContentNotice projects={projects} loading={loading} /><main className="student-shell">
    <section className="welcome-row">
      <div><h1>{greeting}, {user.displayName}님</h1><p>오늘도 말씀을 차분히 익혀보세요.</p></div>
      <p className="today-date">{dateLabel}</p>
    </section>

    {error && !quizOpen && <div className="notice error" role="alert">{error}</div>}
    <section className="dashboard-grid">
      <article className="study-hero">
        <div className="hero-copy"><p className="eyebrow">오늘의 학습</p><h2>{activeSession ? '풀던 문제를\n이어서 볼까요?' : history.length ? '오늘은 어떤 문제를\n복습해 볼까요?' : '첫 번째 학습을\n시작해 볼까요?'}</h2><p className="recommend">{activeSession ? `${activeSession.problems.length}문제 중 ${activeSession.resumeIndex + 1}번째` : <>추천 10문제 <span>·</span> 예상 12분</>}</p>{activeSession ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="primary-button" onClick={resumeQuiz}>이어서 풀기 <Icon name="arrow" /></button><button className="secondary-button" onClick={() => openQuiz()}>새로 시작</button><button className="secondary-button" onClick={() => openFlashcards()}>플래시카드로 복습</button></div> : <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="primary-button" onClick={() => openQuiz()}>오늘의 학습 시작 <Icon name="arrow" /></button><button className="secondary-button" onClick={() => openFlashcards()}>플래시카드로 복습</button></div>}</div>
        <div className="study-visual" aria-hidden="true"><div className="desk-card back-two"/><div className="desk-card back-one"/><div className="desk-card front"><span/><i/><i/><i/></div><div className="book-base"><span/></div></div>
      </article>
      <article className="weekly-card">
        <div className="weekly-card-head">
          <h2>이번 주 학습</h2>
          <button type="button" className="weekly-settings-toggle" aria-label="주간 목표 설정" aria-expanded={weeklySettingsOpen} onClick={() => setWeeklySettingsOpen((value) => !value)}>⚙</button>
          {weeklySettingsOpen && <div className="weekly-settings-panel">
            <p>주간 목표(일)</p>
            <div className="count-options">{[3, 5, 7].map((days) => <button type="button" key={days} className={weeklyGoal === days ? 'chosen' : ''} onClick={() => updateWeeklyGoal(days)}>{days}일</button>)}</div>
            <button type="button" className="text-link" onClick={resetWeeklyGoal}>기본값(5일)으로</button>
            <hr className="weekly-settings-divider" />
            <p>학습 기록</p>
            {historyDeleteMessage && <span className="weekly-settings-note">{historyDeleteMessage}</span>}
            <button type="button" className="weekly-settings-danger" disabled={historyDeleting} onClick={handleDeleteHistory}>{historyDeleting ? '삭제하는 중…' : '학습 기록 전체 삭제'}</button>
            <hr className="weekly-settings-divider" />
            <p>계정</p>
            <button type="button" className="weekly-settings-danger" onClick={() => { setWeeklySettingsOpen(false); setWithdrawReason(''); setWithdrawDetail(''); setWithdrawError(''); setWithdrawOpen(true) }}>회원 탈퇴</button>
          </div>}
        </div>
        <div className="progress-ring" style={{ '--progress': `${weekly.progress}%` } as React.CSSProperties}><div><strong>{weekly.progress}</strong><span>%</span></div></div>
        <div className="weekly-stats"><div><span>푼 문제</span><strong>{weekly.total}</strong></div><div><span>정답률</span><strong>{weekly.rate}<small>%</small></strong></div><div><span>연속 학습</span><strong>{weekly.streak}<small>일</small></strong></div></div>
      </article>
    </section>

    <section className="recent-section">
      <div className="section-heading"><h2>과목</h2><Link to="/projects">전체 보기 <span>›</span></Link></div>
      {loading ? <div className="empty-card">과목을 불러오는 중입니다.</div> : projects.length ? <div className="project-grid">{projects.slice(0, 3).map((project) => <article className="project-card" key={project.id}>
        <div className="project-icon"><Icon name="book" /></div>
        <div className="project-card-copy"><div><h3><Link to={`/projects/${project.id}`}>{project.title}</Link></h3></div><p>총 {project.session_count}강 · {new Date(project.created_at).toLocaleDateString('ko-KR')} 개설</p><div className="project-actions"><button onClick={() => openQuiz(project.id)}>이 과목 학습</button><Link to={`/projects/${project.id}`}>문제 보기</Link></div></div>
      </article>)}</div> : <div className="empty-card"><strong>아직 개설된 과목이 없습니다.</strong><p>관리자가 과목을 개설하면 이곳에 표시됩니다.</p><Link className="text-link" to="/projects">과목 목록 보기 →</Link></div>}
    </section>

    {bookmarkedProblems.length > 0 && <section className="recent-section"><div className="section-heading"><h2>북마크한 문제 ({bookmarkedProblems.length})</h2><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}><button className="text-link" onClick={openBookmarkedQuiz}>복습 퀴즈 시작</button><button className="text-link" onClick={openBookmarkedFlashcards}>플래시카드로 복습</button></div></div><div className="project-grid">{bookmarkedProblems.map((problem) => <article className="project-card bookmark-card" key={problem.id}>
      <button type="button" className="bookmark-card-body" onClick={openBookmarkedFlashcards}><div className="project-card-copy"><h3>{problem.question}</h3><p>{problem.ref_course ?? '문제'} {problem.ref_session ?? ''}</p></div></button>
      <button type="button" className="bookmark-remove" onClick={() => removeBookmark(problem.id)}>★ 북마크 해제</button>
    </article>)}</div></section>}
    <section className="quick-card"><div><p className="eyebrow">문제 만들기</p><h2>배운 내용을 직접 문제로 남겨보세요.</h2><p>객관식·단답형·성경문제를 만들고 동료들과 공유할 수 있어요.</p></div><Link className="secondary-button" to="/problems/new"><Icon name="plus"/> 새 문제 만들기</Link></section>
  </main>

  {withdrawOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !withdrawing && setWithdrawOpen(false)}>
    <section className="quiz-modal withdraw-modal" role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
      <button className="modal-close" aria-label="닫기" disabled={withdrawing} onClick={() => setWithdrawOpen(false)}>×</button>
      <p className="eyebrow">회원 탈퇴</p>
      <h2 id="withdraw-title">정말 탈퇴하시겠어요?</h2>
      <p>탈퇴하시면 이름·휴대전화번호 등 개인정보와 학습 기록이 <strong>즉시 파기</strong>되며 되돌릴 수 없습니다.</p>
      <p>그동안 만들어 주신 문제는 다른 분들의 학습을 위해 남습니다.</p>
      <label>탈퇴 사유<select value={withdrawReason} onChange={(event) => { setWithdrawReason(event.target.value); setWithdrawError('') }} disabled={withdrawing}>
        <option value="">사유를 선택해 주세요</option>
        {withdrawReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
      </select></label>
      <label>{withdrawReason === '기타' ? '사유를 적어 주세요' : '남기실 말씀 (선택)'}<textarea value={withdrawDetail} maxLength={300} rows={3} disabled={withdrawing} onChange={(event) => { setWithdrawDetail(event.target.value); setWithdrawError('') }} placeholder="서비스 개선에 참고하겠습니다." /></label>
      {withdrawError && <div className="notice error">{withdrawError}</div>}
      <div className="result-actions">
        <button type="button" className="secondary-button" disabled={withdrawing} onClick={() => setWithdrawOpen(false)}>취소</button>
        <button type="button" className="weekly-settings-danger" disabled={withdrawing} onClick={submitWithdrawal}>{withdrawing ? '처리하는 중…' : '탈퇴하기'}</button>
      </div>
    </section>
  </div>}

  {quizOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeQuiz()}><section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title"><button className="modal-close" aria-label="닫기" onClick={closeQuiz}>×</button>
    {!sessionId ? <div className="quiz-setup"><span className="modal-bookmark"/><p className="eyebrow">맞춤 학습</p><h2 id="quiz-title">오늘은 어떤 문제를 복습할까요?</h2><p>모든 공유 문제에서 골고루 출제하거나, 원하는 과목과 회차를 선택할 수 있어요.</p>
      {error && <div className="notice error">{error}</div>}
      <label>학습 범위<select value={selectedProject} onChange={(event) => { setSelectedProject(event.target.value); setSelectedSession('') }}><option value="">전체 문제</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      {selectedProject && (scopes[0]?.sessions.length ?? 0) > 0 && <label>회차<select value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)}><option value="">전체 회차 ({projects.find((p) => p.id === selectedProject)?.session_count ?? scopes[0].sessions.length}강 전체)</option>{[...scopes[0].sessions].sort((a, b) => Number(a) - Number(b)).map((session) => <option key={session} value={session}>{session}강</option>)}</select></label>}
      <label>문제 유형<div className="count-options type-options">{problemTypeOptions.map(({ value, label }) => {
        const chosen = selectedTypes.includes(value)
        return <button type="button" key={value} className={chosen ? 'chosen' : ''} aria-pressed={chosen} disabled={chosen && selectedTypes.length === 1} onClick={() => toggleType(value)}>{label}</button>
      })}</div></label>
      <label>문제 수<div className="count-options">{[5, 10, 20, 50].map((value) => <button type="button" className={count === value ? 'chosen' : ''} onClick={() => setCount(value)} key={value}>{value}문제</button>)}</div></label>
      <button className="primary-button wide" disabled={submitting} onClick={startQuiz}>{submitting ? '문제를 준비하는 중…' : `${count}문제 학습 시작`} {!submitting && <Icon name="arrow"/>}</button>
    </div> : summary ? <div className="quiz-result"><div className="result-ring" style={{ '--score': `${summary.score}%` } as React.CSSProperties}><strong>{summary.score}</strong><span>점</span></div><p className="eyebrow">학습 완료</p><h2 id="quiz-title">오늘의 복습을 마쳤어요</h2><p>{summary.total}문제 중 <strong>{summary.correct}문제</strong>를 맞혔습니다.{(summary.partial ?? 0) > 0 && <> 부분 정답 <strong>{summary.partial}문제</strong>를 더해 <strong>{summary.earned}점</strong>을 얻었어요.</>}<br/>틀린 문제의 레퍼런스를 다시 확인해 보세요.</p>
      {summary.weakAreas.some((area) => area.rate < 100) && <div className="weak-areas">
        <p className="eyebrow">취약 구간</p>
        <ul>{summary.weakAreas.filter((area) => area.rate < 100).slice(0, 5).map((area) => <li key={`${area.refCourse}::${area.refSession}`}><span>{area.refCourse}{area.refSession ? ` · ${area.refSession}` : ''}</span><strong>{area.correct}/{area.total} ({area.rate}%)</strong></li>)}</ul>
      </div>}
      <div className="result-actions"><button className="secondary-button" onClick={() => openQuiz(selectedProject)}>다시 풀기</button><button className="primary-button" onClick={closeQuiz}>학습 마치기</button></div></div>
    : question && <div className="quiz-body"><button type="button" className={`bookmark-fab${bookmarkedIds.has(question.id) ? ' active' : ''}`} aria-label={bookmarkedIds.has(question.id) ? '북마크 해제' : '북마크에 추가'} aria-pressed={bookmarkedIds.has(question.id)} onClick={toggleBookmark}>★</button><div className="quiz-top"><div><p className="eyebrow">{question.ref_course || '문제은행'} {question.ref_session ? `${question.ref_session}강` : ''}</p><span>{questionIndex + 1} / {problems.length}</span></div><div className="quiz-progress"><span style={{ width: `${(questionIndex + 1) / problems.length * 100}%` }}/></div></div><h2 id="quiz-title">{question.question}</h2>
      {quizNotice && questionIndex === 0 && <div className="notice quiz-review-notice">{quizNotice}</div>}
      {question.options ? <div className="answer-options">{Object.entries(question.options).map(([key, value]) => <button key={key} disabled={result !== null} className={answer === key ? 'selected' : ''} onClick={() => setAnswer(key)}><span>{key}</span>{value}</button>)}</div> : <input className="answer-input" value={answer} disabled={result !== null} onChange={(event) => setAnswer(event.target.value)} placeholder={question.type === 'bible' ? '예: 히브리서 11:1' : '답안을 입력하세요'} />}
      {result !== null && <div className={`feedback ${result}`}><strong>{result === 'correct' ? '정답이에요.' : result === 'partial' ? `거의 맞았어요. 부분 점수 ${Math.round(score * 100)}%를 받았어요.` : '한 번 더 기억해 주세요.'}</strong>{result !== 'correct' && correctAnswer && <p className="feedback-answer">정답: {question.options ? (question.options[correctAnswer] ?? correctAnswer) : question.type === 'bible' ? formatBibleAnswer(correctAnswer) : correctAnswer}</p>}<p>{formatReference(question)}</p></div>}
      {result !== null && <div className="comment-block">
        <button type="button" className="comment-bubble" onClick={() => setCommentPanelOpen((value) => !value)}>
          <Icon name="file" size={16}/> 댓글 {(commentsByProblem[question.id] ?? []).length > 0 && <span className="comment-count">{(commentsByProblem[question.id] ?? []).length}</span>}
        </button>
        {commentPanelOpen && <div className="comment-panel">
          {(commentsByProblem[question.id] ?? []).map((comment) => <div key={comment.id} className="comment-row">
            <p><strong>{comment.users?.display_name ?? '신학원생'}</strong> · {editingCommentId === comment.id ? <input className="field" value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} /> : comment.content}</p>
            {studentSession.getUser()?.id === comment.author_id && <div className="comment-actions">
              <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }}>{editingCommentId === comment.id ? '수정 중' : '수정'}</button>
              {editingCommentId === comment.id && <button type="button" onClick={() => saveComment(comment.id)}>저장</button>}
              <button type="button" onClick={() => removeComment(comment.id)}>삭제</button>
            </div>}
          </div>)}
          {(commentsByProblem[question.id] ?? []).length === 0 && <p className="comment-empty">아직 댓글이 없습니다.</p>}
          <div className="comment-compose"><input className="field" placeholder="문제에 댓글 남기기" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} /><button type="button" className="secondary-button" onClick={submitComment}>작성</button></div>
        </div>}
      </div>}
      <div className="quiz-nav">
        {questionIndex > 0 && <button type="button" className="secondary-button quiz-back" disabled={submitting} onClick={prevQuestion}>← 이전 문제</button>}
        {result === null ? <button className="primary-button wide" disabled={!answer.trim() || submitting} onClick={submitAnswer}>답안 확인 <Icon name="arrow"/></button> : <button className="primary-button wide" disabled={submitting} onClick={nextQuestion}>{questionIndex === problems.length - 1 ? '결과 보기' : '다음 문제'} <Icon name="arrow"/></button>}
      </div>
    </div>}
  </section></div>}

  {flashOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeFlashcards()}><section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="flash-title"><button className="modal-close" aria-label="닫기" onClick={closeFlashcards}>×</button>
    {!flashCards.length ? <div className="quiz-setup"><p className="eyebrow">플래시카드</p><h2 id="flash-title">가볍게 훑어볼까요?</h2><p>채점 없이 문제를 넘겨보며 아는지 모르는지만 표시하는 학습 모드예요.</p>
      {flashError && <div className="notice error">{flashError}</div>}
      <label>학습 범위<select value={flashProject} onChange={(event) => { setFlashProject(event.target.value); setFlashSession('') }}><option value="">전체 문제</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      {flashProject && (flashScopes[0]?.sessions.length ?? 0) > 0 && <label>회차<select value={flashSession} onChange={(event) => setFlashSession(event.target.value)}><option value="">전체 회차</option>{[...flashScopes[0].sessions].sort((a, b) => Number(a) - Number(b)).map((session) => <option key={session} value={session}>{session}강</option>)}</select></label>}
      <label>카드 수<div className="count-options">{[5, 10, 20, 50].map((value) => <button type="button" className={flashCount === value ? 'chosen' : ''} onClick={() => setFlashCount(value)} key={value}>{value}장</button>)}</div></label>
      <button className="primary-button wide" disabled={flashLoading} onClick={startFlashcards}>{flashLoading ? '카드를 준비하는 중…' : `${flashCount}장 시작`} {!flashLoading && <Icon name="arrow" />}</button>
    </div> : flashDone ? <div className="quiz-result"><p className="eyebrow">학습 완료</p><h2 id="flash-title">전체 {flashCards.length}장 중 {flashKnown.size}장을 알고 계셨어요</h2><p>모르는 문제 {flashUnknown.size}장은 북마크에 담아 나중에 다시 볼 수 있어요.</p>
      {flashBookmarkMessage && <div className="notice">{flashBookmarkMessage}</div>}
      <div className="result-actions">
        {flashUnknown.size > 0 && <button className="secondary-button" onClick={restartUnknownFlashcards}>모르는 문제만 다시보기</button>}
        {flashUnknown.size > 0 && <button className="secondary-button" onClick={bookmarkUnknownFlashcards}>모르는 문제 북마크</button>}
        <button className="primary-button" onClick={closeFlashcards}>학습 마치기</button>
      </div>
    </div> : <div className="quiz-body"><button type="button" className={`bookmark-fab${bookmarkedIds.has(flashCards[flashIndex].id) ? ' active' : ''}`} aria-label={bookmarkedIds.has(flashCards[flashIndex].id) ? '북마크 해제' : '북마크에 추가'} aria-pressed={bookmarkedIds.has(flashCards[flashIndex].id)} onClick={toggleFlashBookmark}>★</button><div className="quiz-top"><div><p className="eyebrow">{flashCards[flashIndex].ref_course || '문제은행'} {flashCards[flashIndex].ref_session ? `${flashCards[flashIndex].ref_session}강` : ''}</p><span>{flashIndex + 1} / {flashCards.length}</span></div><div className="quiz-progress"><span style={{ width: `${(flashIndex + 1) / flashCards.length * 100}%` }} /></div></div>
      <div className="flashcard-face"><h2>{flashCards[flashIndex].question}</h2>
        {flashRevealed && <div className="flashcard-reveal"><strong>{flashCard.options ? (flashCard.options[flashCard.answer] ?? flashCard.answer) : flashCard.type === 'bible' ? formatBibleAnswer(flashCard.answer) : flashCard.answer}</strong><span>정답</span><p className="flashcard-reference"><b>출처</b> {formatReference(flashCard)}</p></div>}
      </div>
      {!flashRevealed ? <button className="primary-button wide" onClick={() => setFlashRevealed(true)}>정답 보기 <Icon name="arrow" /></button> : <div className="flashcard-choices"><button type="button" className="unknown" onClick={() => markFlashcard(false)}>몰랐어요</button><button type="button" className="know" onClick={() => markFlashcard(true)}>알고 있었어요</button></div>}
      {flashIndex > 0 && <button type="button" className="secondary-button flash-back" onClick={prevFlashcard}>← 이전 카드</button>}
    </div>}
  </section></div>}
  </StudentShell>
}

export default StudentHomePage
