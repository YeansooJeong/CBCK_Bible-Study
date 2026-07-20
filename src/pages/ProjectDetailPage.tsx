import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Problem, type ProblemShareScope, type ProblemType, type Project, type ShareScope } from '../lib/api'
import { studentSession } from '../lib/session'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

const typeLabel: Record<ProblemType, string> = { mcq: '4지선다', short: '단답형', bible: '성경문제' }

function ProblemForm({ token, projectId, onCreated }: { token: string; projectId: string; onCreated: () => void }) {
  const [type, setType] = useState<ProblemType>('mcq')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState('1')
  const [answer, setAnswer] = useState('')
  const [keywords, setKeywords] = useState('')
  const [refCourse, setRefCourse] = useState('')
  const [refSession, setRefSession] = useState('')
  const [refLocation, setRefLocation] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setQuestion('')
    setOptions(['', '', '', ''])
    setCorrectIndex('1')
    setAnswer('')
    setKeywords('')
    setRefCourse('')
    setRefSession('')
    setRefLocation('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createProblem(token, {
        projectId,
        type,
        question,
        options: type === 'mcq' ? { '1': options[0], '2': options[1], '3': options[2], '4': options[3] } : undefined,
        answer: type === 'mcq' ? correctIndex : answer,
        keywords: keywords || undefined,
        refCourse: refCourse || undefined,
        refSession: refSession || undefined,
        refLocation: refLocation || undefined,
      })
      reset()
      onCreated()
    } catch {
      setError('문제 등록에 실패했습니다.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ProblemType)}>
        <option value="mcq">4지선다 객관식</option>
        <option value="short">단답/짧은서술형</option>
        <option value="bible">성경문제</option>
      </select>

      <textarea
        className={inputClass}
        placeholder="문제"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
      />

      {type === 'mcq' && (
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === String(i + 1)}
                onChange={() => setCorrectIndex(String(i + 1))}
              />
              <input
                className={inputClass}
                placeholder={`보기 ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = e.target.value
                  setOptions(next)
                }}
                required
              />
            </div>
          ))}
          <p className="text-xs text-neutral-400">라디오 버튼으로 정답을 선택하세요.</p>
        </div>
      )}

      {type === 'short' && (
        <>
          <input className={inputClass} placeholder="정답" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
          <input
            className={inputClass}
            placeholder="추가 키워드 (세미콜론 ; 으로 구분, 선택)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </>
      )}

      {type === 'bible' && (
        <input
          className={inputClass}
          placeholder="정답 (책;장;절 형식, 예: 히브리서;11;1)"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <input className={inputClass} placeholder="강의명" value={refCourse} onChange={(e) => setRefCourse(e.target.value)} />
        <input className={inputClass} placeholder="회차" value={refSession} onChange={(e) => setRefSession(e.target.value)} />
        <input className={inputClass} placeholder="위치" value={refLocation} onChange={(e) => setRefLocation(e.target.value)} />
      </div>

      <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark">
        문제 추가
      </button>
    </form>
  )
}

function parseCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
  if (rows.length < 2) throw new Error('empty')
  const headers = rows[0]
  const required = ['type', 'question', 'answer']
  if (required.some((h) => !headers.includes(h))) throw new Error('header')
  return rows.slice(1).filter((r) => r.some(Boolean)).map((r) => {
    const value = (name: string) => r[headers.indexOf(name)] ?? ''
    const options = ['1', '2', '3', '4'].map((n) => value(`option${n}`))
    return { type: value('type') as ProblemType, question: value('question'), options: value('type') === 'mcq' ? Object.fromEntries(options.map((v, i) => [String(i + 1), v])) : undefined, answer: value('answer'), keywords: value('keywords') || undefined, refCourse: value('ref_course') || undefined, refSession: value('ref_session') || undefined, refLocation: value('ref_location') || undefined }
  })
}

function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [isOwner, setIsOwner] = useState(false)

  async function reload(t: string, pid: string) {
    const [{ projects }, { problems, isOwner }] = await Promise.all([api.listProjects(t), api.listProblems(t, pid)])
    setProject(projects.find((p) => p.id === pid) ?? null)
    setProblems(problems)
    setIsOwner(isOwner)
  }

  useEffect(() => {
    const t = studentSession.get()
    if (!t || !projectId) {
      navigate('/login')
      return
    }
    setToken(t)
    reload(t, projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, navigate])

  async function handleShareScopeChange(scope: ShareScope) {
    if (!token || !projectId) return
    await api.updateProject(token, { projectId, shareScope: scope })
    reload(token, projectId)
  }

  async function handleProblemShareScopeChange(problemId: string, scope: ProblemShareScope) {
    if (!token || !projectId) return
    await api.updateProblem(token, { problemId, shareScope: scope })
    reload(token, projectId)
  }

  async function handleDeleteProblem(problemId: string) {
    if (!token || !projectId) return
    await api.deleteProblem(token, problemId)
    reload(token, projectId)
  }

  async function handleDeleteProject() {
    if (!token || !projectId) return
    await api.deleteProject(token, projectId)
    navigate('/projects')
  }

  if (!token) return null
  if (!project) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-white dark:bg-neutral-950">
        <p className="text-neutral-500">프로젝트를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-white px-6 py-10 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/projects" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              ← 프로젝트 목록
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{project.title}</h1>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={project.share_scope}
                onChange={(e) => handleShareScopeChange(e.target.value as ShareScope)}
              >
                <option value="private">비공개</option>
                <option value="all">전체공개</option>
              </select>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900"
              >
                프로젝트 삭제
              </button>
            </div>
          )}
        </div>

        {isOwner && (
          <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">문제 등록</h2>
            <ProblemForm token={token} projectId={projectId!} onCreated={() => reload(token, projectId!)} />
            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <h3 className="mb-2 font-medium">CSV 업로드</h3>
              <p className="mb-3 text-xs text-neutral-500">type,question,option1~4,answer,keywords,ref_course,ref_session,ref_location</p>
              <input type="file" accept=".csv,text/csv" className="text-sm" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const imported = parseCsv(await file.text())
                  await api.bulkCreateProblems(token, projectId!, imported)
                  window.alert(`${imported.length}개 문제가 등록되었습니다.`)
                  await reload(token, projectId!)
                } catch { window.alert('CSV 업로드에 실패했습니다.') }
                e.target.value = ''
              }} />
            </div>
          </section>
        )}

        <ul className="flex flex-col gap-3">
          {problems.map((problem) => (
            <li key={problem.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {typeLabel[problem.type]}
                  {problem.ref_course && ` · ${problem.ref_course} ${problem.ref_session ?? ''}`}
                </span>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      value={problem.share_scope}
                      onChange={(e) => handleProblemShareScopeChange(problem.id, e.target.value as ProblemShareScope)}
                    >
                      <option value="inherit">프로젝트 설정 따름</option>
                      <option value="private">비공개</option>
                      <option value="all">전체공개</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteProblem(problem.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
              <p className="text-neutral-900 dark:text-neutral-50">{problem.question}</p>
              {isOwner && <p className="mt-1 text-xs text-neutral-400">정답: {problem.answer}</p>}
            </li>
          ))}
          {problems.length === 0 && <p className="text-sm text-neutral-400">등록된 문제가 없습니다.</p>}
        </ul>
      </div>
    </div>
  )
}

export default ProjectDetailPage
