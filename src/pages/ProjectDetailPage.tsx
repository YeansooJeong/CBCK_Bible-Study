import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Problem, type ProblemShareScope, type Project } from '../lib/api'
import { studentSession } from '../lib/session'
import { parseCsvLine, downloadCsv } from '../lib/csv'
import { formatBibleAnswer } from '../lib/format'
import StudentShell, { Icon } from '../components/StudentShell'

const typeLabel: Record<Problem['type'], string> = { mcq: '4지선다', short: '단답형', bible: '성경문제' }

// 1행: 헤더, 2~4행: 유형별(mcq/short/bible) 작성 예시, 5행부터 실제 문제 데이터
const SAMPLE_CSV =
  'type,question,option1,option2,option3,option4,answer,keywords,ref_session,ref_kind,ref_detail\n' +
  'mcq,"천지창조는 며칠 동안 이루어졌는가?",3일,6일,7일,40일,2,,1,강의요약본,초반부\n' +
  'short,"믿음의 정의를 한 문장으로 쓰시오.",,,,,"바라는 것들의 실상","실상;증거;바라는것",3,강의영상,5분경\n' +
  'bible,"믿음장으로 불리는 본문의 위치는?",,,,,"히브리서 11:1",,3,강의요약본,후반부\n'

function downloadSampleCsv() {
  downloadCsv('cbck_problem_sample.csv', SAMPLE_CSV)
}

// ChatGPT/Claude/NotebookLM 등 어떤 생성형 AI에도 붙여넣어 쓸 수 있도록 범용으로 작성.
// 표는 확인용, 그 아래 헤더 없는 CSV 블록만 복사해 샘플 양식 5행부터 붙여넣으면 됨.
function buildAiPrompt(projectTitle: string) {
  return `아래 소스 자료를 바탕으로 문제 [문제 개수]개를 만들어줘. 대부분 4지선다(mcq)로 내고, 필요하면 단답형(short)이나 성경문제(bible)를 섞어줘. 이 문제들은 "${projectTitle}" 과목의 [회차]강 내용이야.

먼저 아래 열로 구성된 표를 만들어서 보여줘(내용 확인용):
type | question | option1 | option2 | option3 | option4 | answer | keywords | ref_session | ref_kind | ref_detail

각 열 작성 규칙:
- type: mcq(객관식) / short(단답형) / bible(성경문제) 중 하나
- question: 문제 본문
- option1~4: mcq일 때만 4개 보기를 채우고, 그 외 유형은 비워둬
- answer: mcq는 정답 보기의 번호(1~4 중 하나), short는 정답 문장, bible은 세미콜론 없이 "책 장:절" 형식(예: 히브리서 11:1)
- keywords: short 유형일 때만 정답으로 인정할 핵심 단어를 세미콜론(;)으로 구분해서 적고, 그 외 유형은 비워둬
- ref_session: [회차] 값을 숫자만 그대로 적어줘(예: 3)
- ref_kind: 정답의 출처가 "강의요약본"인지 "강의영상"인지 둘 중 하나
- ref_detail: 정답을 다시 찾을 수 있는 대략적 위치(예: "초반부", "유튜브 강의 1분 50초경", "PDF 중반부") — 알 수 있으면 적어줘

표를 보여준 다음, 같은 내용을 아래 형식으로 한 번 더 출력해줘. 이번엔 헤더 없이 각 문제를 한 줄씩, 쉼표(,)로 구분한 CSV 형식으로만 출력하고(다른 설명 문구 없이), 값 안에 쉼표나 큰따옴표가 들어가면 큰따옴표로 감싸줘. 예시:
"mcq","천지창조는 며칠 동안 이루어졌는가?","3일","6일","7일","40일","2","","3","강의요약본","초반부"

이 두 번째 CSV 블록만 복사해서, CBCK 문제은행 사이트에서 다운로드한 샘플 양식 파일의 5행부터 그대로 붙여넣어 사용할 거야. 정답은 반드시 아래 소스 자료 안에서 실제로 확인 가능한 내용으로만 출제해줘.

[여기에 소스 자료(강의 스크립트, PDF 텍스트 등)를 붙여넣으세요]`
}

const VALID_PROBLEM_TYPES: Problem['type'][] = ['mcq', 'short', 'bible']

// 값이 없어야 할 자리(예: mcq가 아닌 유형의 보기 칸)까지 셀 개수는 항상 헤더와 맞아야 하며,
// AI가 생성한 CSV에서 따옴표 누락 등으로 열이 밀리면 이 단계에서 바로 잡아낸다.
function parseCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).map(parseCsvLine)
  if (rows.length < 5) throw new Error('no_data')
  const headers = rows[0]
  const required = ['type', 'question', 'answer']
  if (required.some((h) => !headers.includes(h))) throw new Error('header')
  // 1행 헤더 + 2~4행 예시는 건너뛰고 5행부터 실제 데이터로 읽음
  const dataRows = rows
    .slice(4)
    .map((cells, i) => ({ cells, rowNumber: i + 5 }))
    .filter(({ cells }) => cells.some(Boolean))
  if (dataRows.length === 0) throw new Error('no_data')
  return dataRows.map(({ cells: r, rowNumber }) => {
    if (r.length !== headers.length) throw new Error(`row_columns:${rowNumber}`)
    const value = (name: string) => r[headers.indexOf(name)] ?? ''
    const type = value('type') as Problem['type']
    if (!VALID_PROBLEM_TYPES.includes(type)) throw new Error(`row_type:${rowNumber}`)
    if (!value('question').trim()) throw new Error(`row_question:${rowNumber}`)
    if (!value('answer').trim()) throw new Error(`row_answer:${rowNumber}`)
    const options = ['1', '2', '3', '4'].map((n) => value(`option${n}`))
    if (type === 'mcq' && options.some((v) => !v.trim())) throw new Error(`row_options:${rowNumber}`)
    return {
      type,
      question: value('question'),
      options: type === 'mcq' ? Object.fromEntries(options.map((v, i) => [String(i + 1), v])) : undefined,
      answer: value('answer'),
      keywords: value('keywords') || undefined,
      refSession: value('ref_session') || undefined,
      refKind: (value('ref_kind') || undefined) as '강의요약본' | '강의영상' | undefined,
      refDetail: value('ref_detail') || undefined,
    }
  })
}

function describeCsvError(err: unknown): string {
  const code = err instanceof Error ? err.message : ''
  if (code === 'header') return '컬럼명(1행)이 올바르지 않습니다. 샘플 양식을 참고해주세요.'
  if (code === 'no_data') return '5행부터 실제 문제 데이터를 입력해주세요.'
  const [reason, rowNumber] = code.split(':')
  switch (reason) {
    case 'row_columns':
      return `${rowNumber}행의 열 개수가 헤더와 맞지 않습니다. 값 안에 쉼표가 있으면 큰따옴표로 감싸주세요.`
    case 'row_type':
      return `${rowNumber}행의 유형(type)이 mcq/short/bible 중 하나가 아닙니다.`
    case 'row_question':
      return `${rowNumber}행에 문제 내용이 비어 있습니다.`
    case 'row_answer':
      return `${rowNumber}행에 정답이 비어 있습니다.`
    case 'row_options':
      return `${rowNumber}행은 4지선다인데 보기 4개 중 비어 있는 칸이 있습니다.`
    default:
      return 'CSV 업로드에 실패했습니다.'
  }
}

function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [token] = useState<string | null>(() => studentSession.get())
  const userId = studentSession.getUser()?.id
  const [project, setProject] = useState<Project | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [csvMessage, setCsvMessage] = useState<string | null>(null)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)
  const [shareUsers, setShareUsers] = useState<Array<{ id: string; displayName: string }>>([])
  const [problemSharePickerId, setProblemSharePickerId] = useState<string | null>(null)
  const [problemShareIds, setProblemShareIds] = useState<string[]>([])

  const [problemActionError, setProblemActionError] = useState<string | null>(null)
  const [problemQuery, setProblemQuery] = useState('')
  const [problemTypeFilter, setProblemTypeFilter] = useState<Problem['type'] | 'all'>('all')
  const [problemSessionFilter, setProblemSessionFilter] = useState('')
  const [problemSort, setProblemSort] = useState<'latest' | 'oldest' | 'session'>('latest')

  async function reload(t: string, pid: string) {
    const [{ projects }, { problems }] = await Promise.all([api.listProjects({ userToken: t }), api.listProblems(t, pid)])
    setProject(projects.find((p) => p.id === pid) ?? null)
    setProblems(problems)
  }

  useEffect(() => {
    if (!token || !projectId) {
      navigate('/login')
      return
    }
    // Initial server synchronization for the selected project.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload(token, projectId)
    api.listShareableUsers(token).then(({ users }) => setShareUsers(users)).catch(() => setShareUsers([]))
  }, [projectId, navigate, token])

  async function copyAiPrompt() {
    if (!project) return
    await navigator.clipboard.writeText(buildAiPrompt(project.title))
    setPromptCopied(true)
    window.setTimeout(() => setPromptCopied(false), 2400)
  }

  async function handleProblemShareScopeChange(problemId: string, scope: ProblemShareScope) {
    if (!token || !projectId) return
    if (scope === 'selected') {
      setProblemShareIds([])
      setProblemSharePickerId(problemId)
      return
    }
    if (problemSharePickerId === problemId) setProblemSharePickerId(null)
    setProblemActionError(null)
    try {
      await api.updateProblem(token, { problemId, shareScope: scope })
      await reload(token, projectId)
    } catch {
      setProblemActionError('공개 범위 변경에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  async function applyProblemShare(problemId: string) {
    if (!token || !projectId) return
    setProblemActionError(null)
    try {
      await api.updateProblem(token, { problemId, shareScope: 'selected', sharedUserIds: problemShareIds })
      setProblemSharePickerId(null)
      await reload(token, projectId)
    } catch {
      setProblemActionError('공유 설정에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  function toggleShareId(ids: string[], setIds: (ids: string[]) => void, userId: string) {
    setIds(ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId])
  }

  async function handleDeleteProblem(problemId: string) {
    if (!token || !projectId) return
    if (!window.confirm('이 문제를 삭제할까요?')) return
    setProblemActionError(null)
    try {
      await api.deleteProblem(token, problemId)
      await reload(token, projectId)
    } catch {
      setProblemActionError('문제 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  function openProblemEditor(problem: Problem) {
    if (problem.author_id !== userId) return
    navigate(`/problems/${problem.id}/edit`, { state: { problem } })
  }

  const availableSessions = useMemo(
    () => [...new Set(problems.map((p) => p.ref_session).filter((value): value is string => Boolean(value)))].sort((a, b) => Number(a) - Number(b)),
    [problems],
  )

  const visibleProblems = useMemo(() => {
    const normalizedQuery = problemQuery.trim().toLocaleLowerCase()
    const filtered = problems.filter((p) => {
      const searchable = `${p.question} ${p.answer}`.toLocaleLowerCase()
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (problemTypeFilter === 'all' || p.type === problemTypeFilter) &&
        (!problemSessionFilter || p.ref_session === problemSessionFilter)
      )
    })
    const sorted = [...filtered]
    if (problemSort === 'latest') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (problemSort === 'oldest') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
    else sorted.sort((a, b) => Number(a.ref_session ?? 0) - Number(b.ref_session ?? 0))
    return sorted
  }, [problems, problemQuery, problemTypeFilter, problemSessionFilter, problemSort])

  if (!token) return null
  if (!project) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-white">
        <p className="text-neutral-500">과목을 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <StudentShell><main className="management-shell">
        <div className="management-heading">
          <div>
            <Link to="/projects" className="text-link">
              ← 과목 목록
            </Link>
            <h1>{project.title}</h1>
            <p>총 {project.session_count}강</p>
          </div>
        </div>

        <div className="problem-layout">
        <section className="management-card">
          <h2>CSV로 문제 등록</h2>
          <div className="csv-block">
            <p>
              1행은 컬럼명, 2~4행은 유형별(4지선다/단답형/성경문제) 작성 예시입니다. <strong>실제 문제는 5행부터</strong> 채워주세요.
            </p>
            <div className="csv-actions">
              <button type="button" onClick={downloadSampleCsv} className="secondary-button">
                샘플 양식 다운로드
              </button>
              <button type="button" onClick={copyAiPrompt} className="secondary-button">
                {promptCopied ? '복사됨 ✓' : '생성형AI용 프롬프트 복사'}
              </button>
            </div>
            <p className="csv-ai-hint">복사한 프롬프트를 ChatGPT·Claude·NotebookLM 등에 붙여넣고 대괄호([ ]) 부분을 채운 뒤, 결과로 나온 CSV 블록을 샘플 양식 5행부터 붙여넣으세요.</p>
            {csvMessage && <div className="notice">{csvMessage}</div>}
            <div className="file-picker">
              <label htmlFor="csvFile" className="primary-button">
                <Icon name="upload" size={16} /> CSV 파일 선택
              </label>
              <span>{csvFileName ?? '선택된 파일 없음'}</span>
            </div>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              className="visually-hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setCsvMessage(null)
                setCsvFileName(file.name)
                try {
                  const imported = parseCsv(await file.text())
                  await api.bulkCreateProblems(token, projectId!, imported)
                  setCsvMessage(`${imported.length}개 문제가 등록되었습니다.`)
                  await reload(token, projectId!)
                } catch (err) {
                  setCsvMessage(describeCsvError(err))
                }
                e.target.value = ''
              }}
            />
          </div>
        </section>

        <section><div className="section-heading"><h2>내가 등록한 문제</h2><span>{visibleProblems.length}/{problems.length}문제</span></div>
          {problemActionError && <div className="notice error">{problemActionError}</div>}
          <div className="problem-filters">
            <input
              className="field"
              placeholder="문제·정답 검색"
              value={problemQuery}
              onChange={(e) => setProblemQuery(e.target.value)}
            />
            <select className="field" value={problemTypeFilter} onChange={(e) => setProblemTypeFilter(e.target.value as Problem['type'] | 'all')}>
              <option value="all">전체 유형</option>
              <option value="mcq">4지선다</option>
              <option value="short">단답형</option>
              <option value="bible">성경문제</option>
            </select>
            <select className="field" value={problemSessionFilter} onChange={(e) => setProblemSessionFilter(e.target.value)}>
              <option value="">전체 회차</option>
              {availableSessions.map((session) => (
                <option key={session} value={session}>
                  {session}강
                </option>
              ))}
            </select>
            <select className="field" value={problemSort} onChange={(e) => setProblemSort(e.target.value as 'latest' | 'oldest' | 'session')}>
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="session">회차순</option>
            </select>
          </div>
          <ul className="problem-list">
          {visibleProblems.map((problem) => (
            <li key={problem.id} className="problem-item">
              <div className="problem-meta">
                <span>
                  {typeLabel[problem.type]}
                  {problem.ref_session && ` · ${problem.ref_session}강`}
                </span>
                {problem.author_id === userId && (
                  <div className="inline-actions">
                    <select
                      className="field"
                      value={problem.share_scope}
                      onChange={(e) => handleProblemShareScopeChange(problem.id, e.target.value as ProblemShareScope)}
                    >
                      <option value="inherit">전체공개</option>
                      <option value="private">비공개</option>
                      <option value="all">전체공개</option>
                      <option value="selected">선택한 신학원생</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteProblem(problem.id)}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
              {problem.author_id === userId ? (
                <button type="button" className="problem-question-edit" onClick={() => openProblemEditor(problem)}>
                  {problem.question}
                </button>
              ) : (
                <p>{problem.question}</p>
              )}
              <p className="problem-answer">정답: {problem.type === 'bible' ? formatBibleAnswer(problem.answer) : problem.answer}</p>
              {problem.author_id === userId && problemSharePickerId === problem.id && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {shareUsers.map((u) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={problemShareIds.includes(u.id)}
                          onChange={() => toggleShareId(problemShareIds, setProblemShareIds, u.id)}
                        />
                        {u.displayName}
                      </label>
                    ))}
                    {shareUsers.length === 0 && <small>공유 가능한 신학원생이 없습니다.</small>}
                  </div>
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    <button type="button" className="primary-button" onClick={() => applyProblemShare(problem.id)} disabled={problemShareIds.length === 0}>
                      {problemShareIds.length}명에게 공유 적용
                    </button>
                    <button type="button" onClick={() => setProblemSharePickerId(null)}>취소</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {problems.length === 0 && <li className="empty-card">아직 이 과목에 등록한 문제가 없습니다. <Link to="/problems/new">새 문제 만들기</Link>로 추가해 보세요.</li>}
        </ul></section>
        </div>
    </main></StudentShell>
  )
}

export default ProjectDetailPage
