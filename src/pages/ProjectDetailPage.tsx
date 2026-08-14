import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type Problem, type ProblemShareScope, type Project } from '../lib/api'
import { studentSession } from '../lib/session'
import { parseCsvRows, readCsvFile, downloadCsv } from '../lib/csv'
import { formatBibleAnswer } from '../lib/format'
import StudentShell, { Icon } from '../components/StudentShell'

const typeLabel: Record<Problem['type'], string> = { mcq: '4지선다', short: '단답형', bible: '성경문제' }

// 1행 헤더 + 2~4행에 유형별(mcq/short/bible) 작성 예시. 예시를 지우고 써도 되고
// 그대로 두고 5행부터 채워도 된다(업로더가 예시 행을 내용으로 알아본다).
const SAMPLE_CSV =
  'type,question,option1,option2,option3,option4,answer,keywords,ref_session,ref_kind,ref_detail\n' +
  'mcq,"천지창조는 며칠 동안 이루어졌는가?",3일,6일,7일,40일,2,,1,강의요약본,초반부\n' +
  'short,"믿음의 정의를 한 문장으로 쓰시오.",,,,,"바라는 것들의 실상","실상;증거;바라는것",3,강의영상,5분경\n' +
  'bible,"믿음장으로 불리는 본문의 위치는?",,,,,"히브리서 11:1",,3,강의요약본,후반부\n'

function downloadSampleCsv() {
  downloadCsv('cbck_problem_sample.csv', SAMPLE_CSV)
}

// ChatGPT/Claude/NotebookLM 등 어떤 생성형 AI에도 붙여넣어 쓸 수 있도록 범용으로 작성.
// 업로더가 헤더 행을 스스로 찾으므로, 확인용 표 없이 헤더 포함 CSV 하나만 받으면 된다.
const AI_PROMPT = `단답형(short)과 성경문제(bible)를 섞어서 문제를 내줘. 각 강의별로 10~12문제씩 출제해주고, 단답형과 성경문제의 비율은 7:3 정도로 맞춰줘. 한 번에 올릴 수 있는 최대가 100문제라서 전체 합계가 100문제를 넘으면 안 돼. 강의 수가 많아 넘칠 것 같으면 강의를 나눠서 CSV를 여러 개로 따로 출력해줘.

결과는 다른 설명 없이 CSV 하나로만 출력해줘. 첫 줄은 아래 헤더를 그대로 쓰고, 그 아래에 문제를 한 줄씩 적어줘. 값 안에 쉼표나 큰따옴표, 줄바꿈이 들어가면 그 값을 큰따옴표로 감싸줘.
type,question,option1,option2,option3,option4,answer,keywords,ref_session,ref_kind,ref_detail

각 열 작성 규칙:
- type: short(단답형) / bible(성경문제) 중 하나. 객관식(mcq)은 출제하지 마
- question: 문제 본문
- option1~4: 항상 비워둬. 객관식에만 쓰는 칸이라 지금은 쓸 일이 없지만, 나중에 쓸 수 있으니 칸(쉼표)은 그대로 남겨줘
- answer: short는 정답 문장, bible은 "책 장:절" 형식(예: 히브리서 11:1)
- keywords: short 유형일 때만 정답으로 인정할 핵심 단어를 세미콜론(;)으로 구분해서 적고, bible은 비워둬. 일부만 맞혀도 그 비율만큼 부분 점수를 받아
- ref_session: 그 문제가 나온 강의의 순번을 숫자만 적어줘. "9강"이 아니라 "9"처럼 숫자만. 차수와 무관하게 전체 강의 순번을 쓴다(2차 1강이 전체 9강이면 9)
- ref_kind: "강의요약본" 또는 "강의영상" 둘 중 하나만 (다른 표현 금지)
- ref_detail: 정답에 대한 소스의 근거위치와 함께 이것이 왜 정답인지에 대한 개략적인 설명을 적어줘. Notebook LM 퀴즈에서와 같이 짧은 형태의 코멘트로 알려주면 돼.

작성 예시:
short,"믿음이란 무엇이라고 정의하는가?",,,,,"바라는 것들의 실상","실상;증거;바라는것",9,강의요약본,"강의 초반부. 히브리서 11장 1절을 인용해 믿음을 '바라는 것들의 실상'으로 정의한다."
bible,"믿음장으로 불리는 본문의 위치는 어디인가?",,,,,히브리서 11:1,,9,강의영상,"영상 12분경. 히브리서 11장을 믿음장이라 부르는 이유를 설명한다."

정답은 반드시 아래 소스 자료 안에서 실제로 확인 가능한 내용으로만 출제해줘.

[여기에 소스 자료(강의 스크립트, PDF 텍스트 등)를 붙여넣으세요]`

const VALID_PROBLEM_TYPES: Problem['type'][] = ['mcq', 'short', 'bible']
const VALID_REF_KINDS = ['강의요약본', '강의영상']
const REQUIRED_HEADERS = ['type', 'question', 'answer']
const MAX_REF_SESSION = 999

// 샘플 양식 2~4행의 작성 예시. 이 셀 구성과 완전히 같은 행만 예시로 보고 건너뛴다.
// 행 위치로 판단하면(예: 무조건 4행 건너뛰기) 예시 없이 헤더+데이터만 있는 CSV에서
// 실제 문제 3개가 조용히 사라지므로, 내용으로 판별한다.
const EXAMPLE_ROW_KEYS = new Set(
  parseCsvRows(SAMPLE_CSV)
    .slice(1)
    .filter((cells) => cells.some(Boolean))
    .map((cells) => cells.join('\u0000')),
)

// 값이 없어야 할 자리(예: mcq가 아닌 유형의 보기 칸)까지 셀 개수는 항상 헤더와 맞아야 하며,
// AI가 생성한 CSV에서 따옴표 누락 등으로 열이 밀리면 이 단계에서 바로 잡아낸다.
function parseCsv(text: string) {
  const rows = parseCsvRows(text)
  const headerIndex = rows.findIndex((cells) => REQUIRED_HEADERS.every((h) => cells.includes(h)))
  if (headerIndex === -1) throw new Error('header')
  const headers = rows[headerIndex]
  const dataRows = rows
    .map((cells, index) => ({ cells, rowNumber: index + 1 }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some(Boolean))
    .filter(({ cells }) => !EXAMPLE_ROW_KEYS.has(cells.join('\u0000')))
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
    // 보기 번호가 아닌 보기 문구를 정답에 적으면 업로드는 되지만 채점에서 영원히 오답이 된다.
    if (type === 'mcq' && !['1', '2', '3', '4'].includes(value('answer').trim())) throw new Error(`row_answer_mcq:${rowNumber}`)
    const refKind = value('ref_kind')
    if (refKind && !VALID_REF_KINDS.includes(refKind)) throw new Error(`row_ref_kind:${rowNumber}`)
    // 회차는 과목별 개수가 아니라 전체 강의 순번으로 적는다(예: 2차 1강 = 9강).
    // 그래서 과목의 총 회차 수로는 막지 않고 상식 범위만 확인한다.
    const refSession = value('ref_session')
    if (refSession) {
      const sessionNumber = Number(refSession)
      if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > MAX_REF_SESSION) {
        throw new Error(`row_ref_session:${rowNumber}:${refSession}`)
      }
    }
    return {
      rowNumber,
      problem: {
        type,
        question: value('question'),
        options: type === 'mcq' ? Object.fromEntries(options.map((v, i) => [String(i + 1), v])) : undefined,
        answer: value('answer'),
        keywords: value('keywords') || undefined,
        refSession: refSession || undefined,
        refKind: (refKind || undefined) as '강의요약본' | '강의영상' | undefined,
        refDetail: value('ref_detail') || undefined,
      },
    }
  })
}

// rowNumbers: 서버가 돌려준 문제 순번(index)을 CSV 행 번호로 되돌리기 위한 표
function describeCsvError(err: unknown, rowNumbers: number[] = []): string {
  const code = err instanceof Error ? err.message : ''
  if (code === 'header') return 'type · question · answer 컬럼이 있는 헤더 행을 찾지 못했습니다. 샘플 양식을 참고해주세요.'
  if (code === 'no_data') return '헤더 아래에 실제 문제 데이터를 입력해주세요.'

  if (err instanceof ApiError) {
    const details = err.details as { index?: number; reason?: string } | undefined
    const at = typeof details?.index === 'number' ? `${rowNumbers[details.index] ?? details.index + 1}행: ` : ''
    switch (code) {
      case 'too_many_problems':
        return '한 번에 100개까지만 올릴 수 있습니다. 파일을 나눠서 올려주세요.'
      case 'project_full':
        return '이 과목의 문제 수가 한도(2000개)를 넘습니다.'
      case 'invalid_problem':
        switch (details?.reason) {
          case 'ref_kind':
            return `${at}출처 종류(ref_kind)는 "강의요약본" 또는 "강의영상"만 가능합니다.`
          case 'ref_session':
            return `${at}회차(ref_session)는 1~${MAX_REF_SESSION} 사이의 숫자만 가능합니다.`
          case 'options':
            return `${at}4지선다인데 보기 4개 중 비어 있는 칸이 있습니다.`
          default:
            return `${at}유형·문제·정답 중 비어 있거나 잘못된 값이 있습니다.`
        }
      case 'not_found':
        return '과목을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.'
      case 'unauthorized':
        return '로그인이 만료되었습니다. 다시 로그인해주세요.'
    }
  }

  const [reason, rowNumber, actual] = code.split(':')
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
    case 'row_answer_mcq':
      return `${rowNumber}행은 4지선다인데 정답이 보기 번호(1~4)가 아닙니다. 보기 문구가 아니라 번호를 적어주세요.`
    case 'row_ref_kind':
      return `${rowNumber}행의 출처 종류(ref_kind)는 "강의요약본" 또는 "강의영상"만 가능합니다.`
    case 'row_ref_session':
      return `${rowNumber}행의 회차(ref_session)가 "${actual}"입니다. 1~${MAX_REF_SESSION} 사이의 숫자만 적어주세요("9강"이 아니라 "9").`
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
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

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
    await navigator.clipboard.writeText(AI_PROMPT)
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

  function toggleSelectedProblem(problemId: string) {
    setSelectedProblemIds((current) => {
      const next = new Set(current)
      if (next.has(problemId)) next.delete(problemId)
      else next.add(problemId)
      return next
    })
  }

  function toggleSelectAllOwn(ownIds: string[]) {
    setSelectedProblemIds((current) => {
      const allSelected = ownIds.length > 0 && ownIds.every((id) => current.has(id))
      return allSelected ? new Set() : new Set(ownIds)
    })
  }

  async function handleBulkDeleteOwn() {
    if (!token || !projectId || selectedProblemIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedProblemIds.size}개 문제를 삭제할까요?`)) return
    setBulkDeleting(true)
    setProblemActionError(null)
    try {
      await Promise.all([...selectedProblemIds].map((id) => api.deleteProblem(token, id)))
      setSelectedProblemIds(new Set())
      await reload(token, projectId)
    } catch {
      setProblemActionError('일부 문제 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setBulkDeleting(false)
    }
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
              1행은 컬럼명, 2~4행은 유형별(4지선다/단답형/성경문제) 작성 예시입니다. 예시는 <strong>지우고 쓰셔도 되고 그대로 두셔도</strong> 됩니다. 회차는 차수와 무관하게 <strong>전체 강의 순번</strong>(2차 1강이면 9)으로 적어주세요.
            </p>
            <div className="csv-actions">
              <button type="button" onClick={downloadSampleCsv} className="secondary-button">
                샘플 양식 다운로드
              </button>
              <button type="button" onClick={copyAiPrompt} className="secondary-button">
                {promptCopied ? '복사됨 ✓' : '생성형AI용 프롬프트 복사'}
              </button>
            </div>
            <p className="csv-ai-hint">복사한 프롬프트를 ChatGPT·Claude·NotebookLM 등에 붙여넣고 대괄호([ ]) 부분을 채운 뒤, 결과로 나온 CSV를 그대로 파일로 저장해 올리세요. 샘플 양식에 붙여넣어 쓰셔도 됩니다.</p>
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
                let rowNumbers: number[] = []
                try {
                  const parsed = parseCsv(await readCsvFile(file))
                  rowNumbers = parsed.map((entry) => entry.rowNumber)
                  const imported = parsed.map((entry) => entry.problem)
                  await api.bulkCreateProblems(token, projectId!, imported)
                  setCsvMessage(`${imported.length}개 문제가 등록되었습니다.`)
                  await reload(token, projectId!)
                } catch (err) {
                  setCsvMessage(describeCsvError(err, rowNumbers))
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
          {(() => {
            const ownVisibleIds = visibleProblems.filter((p) => p.author_id === userId).map((p) => p.id)
            return ownVisibleIds.length > 0 ? (
              <div className="problem-bulk-bar">
                <label>
                  <input
                    type="checkbox"
                    checked={ownVisibleIds.every((id) => selectedProblemIds.has(id))}
                    onChange={() => toggleSelectAllOwn(ownVisibleIds)}
                  />
                  내 문제 전체 선택 ({ownVisibleIds.length}개)
                </label>
                <button type="button" className="danger-button" disabled={selectedProblemIds.size === 0 || bulkDeleting} onClick={handleBulkDeleteOwn}>
                  {bulkDeleting ? '삭제하는 중…' : `선택 삭제 (${selectedProblemIds.size})`}
                </button>
              </div>
            ) : null
          })()}
          <ul className="problem-list">
          {visibleProblems.map((problem) => (
            <li key={problem.id} className="problem-item">
              <div className="problem-meta">
                {problem.author_id === userId && (
                  <input
                    type="checkbox"
                    checked={selectedProblemIds.has(problem.id)}
                    onChange={() => toggleSelectedProblem(problem.id)}
                  />
                )}
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
