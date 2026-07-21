import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import StudentShell, { Icon } from '../components/StudentShell'
import { api, type Problem, type ProblemComment, type Project } from '../lib/api'
import { studentSession, type StudentUser } from '../lib/session'

type HistoryItem = { id: string; started_at: string; total: number; correct: number }
type WeakArea = { refCourse: string; refSession: string; total: number; correct: number; rate: number }
type Summary = { total: number; correct: number; score: number; weakAreas: WeakArea[] }
type Scope = { course: string; sessions: string[] }

function sameLocalDay(a: Date, b: Date) { return a.toDateString() === b.toDateString() }

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
  const [scopes, setScopes] = useState<Scope[]>([])
  const [selectedSession, setSelectedSession] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
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

  useEffect(() => {
    const token = studentSession.get()
    if (!token || !user) { navigate('/login'); return }
    Promise.all([api.quizHistory(token), api.listProjects({ userToken: token }), api.getActiveQuizSession(token)])
      .then(([historyResult, projectResult, activeResult]) => {
        setHistory(historyResult.sessions); setProjects(projectResult.projects); setActiveSession(activeResult.session)
      })
      .catch(() => setError('학습 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [navigate, user])

  useEffect(() => {
    const token = studentSession.get()
    if (token) api.listBookmarkedProblems(token).then(({ problems: rows }) => { setBookmarkedProblems(rows); setBookmarkedIds(new Set(rows.map((row) => row.id))) }).catch(() => undefined)
  }, [])

  function resumeQuiz() {
    if (!activeSession) return
    setSessionId(activeSession.sessionId); setProblems(activeSession.problems)
    setQuestionIndex(Math.min(activeSession.resumeIndex, activeSession.problems.length - 1))
    setAnswer(''); setResult(null); setSummary(null); setError('')
    setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
    setQuizOpen(true)
  }

  useEffect(() => {
    if ((location.state as { openStudy?: boolean } | null)?.openStudy) {
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
    return { total, rate: total ? Math.round(correct / total * 100) : 0, days, streak, progress: Math.min(100, days * 20) }
  }, [history])

  const greeting = new Date().getHours() >= 18 ? '평안한 저녁이에요' : '평안한 하루예요'
  const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date())
  const question = problems[questionIndex]

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
  function closeQuiz() { if (!submitting) { setQuizOpen(false); setSessionId(null); setProblems([]); setSummary(null) } }

  useEffect(() => {
    if (!quizOpen || sessionId) return
    const token = studentSession.get(); if (!token) return
    api.listQuizScopes(token, selectedProject || undefined)
      .then((data) => setScopes(data.courses))
      .catch(() => setScopes([]))
  }, [quizOpen, sessionId, selectedProject])

  async function startQuiz() {
    const token = studentSession.get(); if (!token) return navigate('/login')
    setSubmitting(true); setError('')
    try {
      const data = await api.startQuizSession(token, {
        projectId: selectedProject || undefined,
        refSession: selectedSession || undefined,
        bookmarkedOnly,
        count,
      })
      setSessionId(data.sessionId); setProblems(data.problems); setQuestionIndex(0); setAnswer(''); setResult(null)
      setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
    } catch { setError('선택한 범위에 출제 가능한 문제가 없습니다.') }
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
      setResult(data.isCorrect)
      loadComments(question.id)
    }
    catch { setError('답안 제출에 실패했습니다.') }
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

  async function nextQuestion() {
    setCommentPanelOpen(false); setCommentDraft(''); setEditingCommentId(null)
    if (questionIndex < problems.length - 1) { setQuestionIndex((value) => value + 1); setAnswer(''); setResult(null); return }
    const token = studentSession.get(); if (!token || !sessionId) return
    setSubmitting(true)
    try {
      const data = await api.finishQuizSession(token, sessionId); setSummary(data)
      setHistory((await api.quizHistory(token)).sessions)
      setActiveSession(null)
    } catch { setError('학습 결과를 불러오지 못했습니다.') }
    finally { setSubmitting(false) }
  }

  if (!user) return null
  return <StudentShell>{question && quizOpen && sessionId && <button type="button" className="fixed bottom-6 right-6 z-50 rounded-full bg-accent px-4 py-3 text-sm font-medium text-white shadow-lg" onClick={toggleBookmark}>{bookmarkedIds.has(question.id) ? '★ 북마크됨' : '☆ 북마크'}</button>}<main className="student-shell">
    <section className="welcome-row">
      <div><h1>{greeting}, {user.displayName}님</h1><p>오늘도 말씀을 차분히 익혀보세요.</p></div>
      <p className="today-date">{dateLabel}</p>
    </section>

    {error && !quizOpen && <div className="notice error" role="alert">{error}</div>}
    <section className="dashboard-grid">
      <article className="study-hero">
        <div className="hero-copy"><p className="eyebrow">오늘의 학습</p><h2>{activeSession ? '풀던 문제를\n이어서 볼까요?' : history.length ? '오늘은 어떤 문제를\n복습해 볼까요?' : '첫 번째 학습을\n시작해 볼까요?'}</h2><p className="recommend">{activeSession ? `${activeSession.problems.length}문제 중 ${activeSession.resumeIndex + 1}번째` : <>추천 10문제 <span>·</span> 예상 12분</>}</p>{activeSession ? <div style={{ display: 'flex', gap: 10 }}><button className="primary-button" onClick={resumeQuiz}>이어서 풀기 <Icon name="arrow" /></button><button className="secondary-button" onClick={() => openQuiz()}>새로 시작</button></div> : <button className="primary-button" onClick={() => openQuiz()}>오늘의 학습 시작 <Icon name="arrow" /></button>}</div>
        <div className="study-visual" aria-hidden="true"><div className="desk-card back-two"/><div className="desk-card back-one"/><div className="desk-card front"><span/><i/><i/><i/></div><div className="book-base"><span/></div></div>
      </article>
      <article className="weekly-card">
        <h2>이번 주 학습</h2>
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

    {bookmarkedProblems.length > 0 && <section className="recent-section"><div className="section-heading"><h2>북마크한 문제</h2><button className="text-link" onClick={openBookmarkedQuiz}>복습 퀴즈 시작</button></div><div className="project-grid">{bookmarkedProblems.slice(0, 3).map((problem) => <article className="project-card" key={problem.id}><div className="project-card-copy"><h3>{problem.question}</h3><p>{problem.ref_course ?? '문제'} {problem.ref_session ?? ''}</p></div></article>)}</div></section>}
    <section className="quick-card"><div><p className="eyebrow">문제 만들기</p><h2>배운 내용을 직접 문제로 남겨보세요.</h2><p>객관식·단답형·성경문제를 만들고 동료들과 공유할 수 있어요.</p></div><Link className="secondary-button" to="/problems/new"><Icon name="plus"/> 새 문제 만들기</Link></section>
  </main>

  {quizOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeQuiz()}><section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title"><button className="modal-close" aria-label="닫기" onClick={closeQuiz}>×</button>
    {!sessionId ? <div className="quiz-setup"><span className="modal-bookmark"/><p className="eyebrow">맞춤 학습</p><h2 id="quiz-title">오늘은 어떤 문제를 복습할까요?</h2><p>모든 공유 문제에서 골고루 출제하거나, 원하는 과목과 회차를 선택할 수 있어요.</p>
      {error && <div className="notice error">{error}</div>}
      <label>학습 범위<select value={selectedProject} onChange={(event) => { setSelectedProject(event.target.value); setSelectedSession('') }}><option value="">전체 문제</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      {selectedProject && (scopes[0]?.sessions.length ?? 0) > 0 && <label>회차<select value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)}><option value="">전체 회차 ({projects.find((p) => p.id === selectedProject)?.session_count ?? scopes[0].sessions.length}강 전체)</option>{scopes[0].sessions.map((session) => <option key={session} value={session}>{session}강</option>)}</select></label>}
      <label>문제 수<div className="count-options">{[5, 10, 20].map((value) => <button type="button" className={count === value ? 'chosen' : ''} onClick={() => setCount(value)} key={value}>{value}문제</button>)}</div></label>
      <button className="primary-button wide" disabled={submitting} onClick={startQuiz}>{submitting ? '문제를 준비하는 중…' : `${count}문제 학습 시작`} {!submitting && <Icon name="arrow"/>}</button>
    </div> : summary ? <div className="quiz-result"><div className="result-ring" style={{ '--score': `${summary.score}%` } as React.CSSProperties}><strong>{summary.score}</strong><span>점</span></div><p className="eyebrow">학습 완료</p><h2 id="quiz-title">오늘의 복습을 마쳤어요</h2><p>{summary.total}문제 중 <strong>{summary.correct}문제</strong>를 맞혔습니다.<br/>틀린 문제의 레퍼런스를 다시 확인해 보세요.</p>
      {summary.weakAreas.some((area) => area.rate < 100) && <div className="weak-areas">
        <p className="eyebrow">취약 구간</p>
        <ul>{summary.weakAreas.filter((area) => area.rate < 100).slice(0, 5).map((area) => <li key={`${area.refCourse}::${area.refSession}`}><span>{area.refCourse}{area.refSession ? ` · ${area.refSession}` : ''}</span><strong>{area.correct}/{area.total} ({area.rate}%)</strong></li>)}</ul>
      </div>}
      <div className="result-actions"><button className="secondary-button" onClick={() => openQuiz(selectedProject)}>다시 풀기</button><button className="primary-button" onClick={closeQuiz}>학습 마치기</button></div></div>
    : question && <div className="quiz-body"><div className="quiz-top"><div><p className="eyebrow">{question.ref_course || '문제은행'} {question.ref_session ? `${question.ref_session}강` : ''}</p><span>{questionIndex + 1} / {problems.length}</span></div><div className="quiz-progress"><span style={{ width: `${(questionIndex + 1) / problems.length * 100}%` }}/></div></div><h2 id="quiz-title">{question.question}</h2>
      {question.options ? <div className="answer-options">{Object.entries(question.options).map(([key, value]) => <button key={key} disabled={result !== null} className={answer === key ? 'selected' : ''} onClick={() => setAnswer(key)}><span>{key}</span>{value}</button>)}</div> : <input className="answer-input" value={answer} disabled={result !== null} onChange={(event) => setAnswer(event.target.value)} placeholder={question.type === 'bible' ? '예: 히브리서;11;1' : '답안을 입력하세요'} />}
      {result !== null && <div className={`feedback ${result ? 'correct' : 'wrong'}`}><strong>{result ? '정답이에요.' : '한 번 더 기억해 주세요.'}</strong><p>{[question.ref_course, question.ref_session ? `${question.ref_session}강` : '', question.ref_kind, question.ref_detail].filter(Boolean).join(' · ') || '등록된 레퍼런스가 없습니다.'}</p></div>}
      {result !== null && <div className="comment-block">
        <button type="button" className="comment-bubble" onClick={() => setCommentPanelOpen((value) => !value)}>
          <Icon name="file" size={16}/> 댓글 {(commentsByProblem[question.id] ?? []).length > 0 && <span className="comment-count">{(commentsByProblem[question.id] ?? []).length}</span>}
        </button>
        {commentPanelOpen && <div className="comment-panel">
          {(commentsByProblem[question.id] ?? []).map((comment) => <div key={comment.id} className="comment-row">
            <p><strong>{comment.users?.display_name ?? '학생'}</strong> · {editingCommentId === comment.id ? <input className="field" value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} /> : comment.content}</p>
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
      {result === null ? <button className="primary-button wide" disabled={!answer.trim() || submitting} onClick={submitAnswer}>답안 확인 <Icon name="arrow"/></button> : <button className="primary-button wide" disabled={submitting} onClick={nextQuestion}>{questionIndex === problems.length - 1 ? '결과 보기' : '다음 문제'} <Icon name="arrow"/></button>}
    </div>}
  </section></div>}
  </StudentShell>
}

export default StudentHomePage
