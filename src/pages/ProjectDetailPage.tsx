import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Problem, type ProblemShareScope, type ProblemType, type Project, type ShareScope } from '../lib/api'
import { studentSession } from '../lib/session'
import StudentShell, { Icon } from '../components/StudentShell'

const inputClass = 'field'

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
    <form onSubmit={handleSubmit} className="problem-form">
      {error && <div className="notice error">{error}</div>}
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
        <div className="problem-form">
          {options.map((opt, i) => (
            <div key={i} className="option-row">
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

      <div className="reference-row">
        <input className={inputClass} placeholder="강의명" value={refCourse} onChange={(e) => setRefCourse(e.target.value)} />
        <input className={inputClass} placeholder="회차" value={refSession} onChange={(e) => setRefSession(e.target.value)} />
        <input className={inputClass} placeholder="위치" value={refLocation} onChange={(e) => setRefLocation(e.target.value)} />
      </div>

      <button type="submit" className="primary-button">
        <Icon name="plus"/> 문제 추가
      </button>
    </form>
  )
}

// CSV 표준 규칙대로 큰따옴표로 감싼 값 안의 쉼표/줄바꿈/이스케이프된 큰따옴표를 처리
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

// 1행: 헤더, 2~4행: 유형별(mcq/short/bible) 작성 예시, 5행부터 실제 문제 데이터
const SAMPLE_CSV =
  'type,question,option1,option2,option3,option4,answer,keywords,ref_course,ref_session,ref_location\n' +
  'mcq,"천지창조는 며칠 동안 이루어졌는가?",3일,6일,7일,40일,2,,창세기,1강,강의요약본 초반부\n' +
  'short,"믿음의 정의를 한 문장으로 쓰시오.",,,,,"바라는 것들의 실상","실상;증거;바라는것",히브리서,3강,강의 유튜브 5분경\n' +
  'bible,"믿음장으로 불리는 본문의 위치는?",,,,,"히브리서;11;1",,히브리서,3강,강의요약본 후반부\n'

function downloadSampleCsv() {
  const blob = new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cbck_problem_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).map(parseCsvLine)
  if (rows.length < 5) throw new Error('no_data')
  const headers = rows[0]
  const required = ['type', 'question', 'answer']
  if (required.some((h) => !headers.includes(h))) throw new Error('header')
  // 1행 헤더 + 2~4행 예시는 건너뛰고 5행부터 실제 데이터로 읽음
  const dataRows = rows.slice(4).filter((r) => r.some(Boolean))
  if (dataRows.length === 0) throw new Error('no_data')
  return dataRows.map((r) => {
    const value = (name: string) => r[headers.indexOf(name)] ?? ''
    const options = ['1', '2', '3', '4'].map((n) => value(`option${n}`))
    return { type: value('type') as ProblemType, question: value('question'), options: value('type') === 'mcq' ? Object.fromEntries(options.map((v, i) => [String(i + 1), v])) : undefined, answer: value('answer'), keywords: value('keywords') || undefined, refCourse: value('ref_course') || undefined, refSession: value('ref_session') || undefined, refLocation: value('ref_location') || undefined }
  })
}

function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [token] = useState<string | null>(() => studentSession.get())
  const [project, setProject] = useState<Project | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [csvMessage, setCsvMessage] = useState<string | null>(null)

  async function reload(t: string, pid: string) {
    const [{ projects }, { problems, isOwner }] = await Promise.all([api.listProjects(t), api.listProblems(t, pid)])
    setProject(projects.find((p) => p.id === pid) ?? null)
    setProblems(problems)
    setIsOwner(isOwner)
  }

  useEffect(() => {
    if (!token || !projectId) {
      navigate('/login')
      return
    }
    // Initial server synchronization for the selected project.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload(token, projectId)
  }, [projectId, navigate, token])

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
      <div className="min-h-svh flex items-center justify-center bg-white">
        <p className="text-neutral-500">프로젝트를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <StudentShell><main className="management-shell">
        <div className="management-heading">
          <div>
            <Link to="/projects" className="text-link">
              ← 프로젝트 목록
            </Link>
            <h1>{project.title}</h1>
          </div>
          {isOwner && (
            <div className="detail-toolbar">
              <select
                className="field"
                value={project.share_scope}
                onChange={(e) => handleShareScopeChange(e.target.value as ShareScope)}
              >
                <option value="private">비공개</option>
                <option value="all">전체공개</option>
              </select>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="danger-button"
              >
                프로젝트 삭제
              </button>
            </div>
          )}
        </div>

        <div className="problem-layout">
        {isOwner && (
          <section className="management-card">
            <h2>문제 등록</h2>
            <ProblemForm token={token} projectId={projectId!} onCreated={() => reload(token, projectId!)} />
            <div className="csv-block">
              <h3>CSV로 한 번에 등록</h3>
              <p>
                1행은 컬럼명, 2~4행은 유형별(4지선다/단답형/성경문제) 작성 예시입니다. <strong>실제 문제는 5행부터</strong> 채워주세요.
              </p>
              <p>컬럼: type, question, option1~4(4지선다만), answer, keywords(단답형 선택), ref_course, ref_session, ref_location</p>
              <button type="button" onClick={downloadSampleCsv} className="secondary-button">
                샘플 양식 다운로드
              </button>
              {csvMessage && <div className="notice">{csvMessage}</div>}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setCsvMessage(null)
                  try {
                    const imported = parseCsv(await file.text())
                    await api.bulkCreateProblems(token, projectId!, imported)
                    setCsvMessage(`${imported.length}개 문제가 등록되었습니다.`)
                    await reload(token, projectId!)
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message === 'header'
                        ? '컬럼명(1행)이 올바르지 않습니다. 샘플 양식을 참고해주세요.'
                        : err instanceof Error && err.message === 'no_data'
                          ? '5행부터 실제 문제 데이터를 입력해주세요.'
                          : 'CSV 업로드에 실패했습니다.'
                    setCsvMessage(message)
                  }
                  e.target.value = ''
                }}
              />

            </div>
          </section>
        )}

        <section><div className="section-heading"><h2>등록된 문제</h2><span>{problems.length}문제</span></div><ul className="problem-list">
          {problems.map((problem) => (
            <li key={problem.id} className="problem-item">
              <div className="problem-meta">
                <span>
                  {typeLabel[problem.type]}
                  {problem.ref_course && ` · ${problem.ref_course} ${problem.ref_session ?? ''}`}
                </span>
                {isOwner && (
                  <div className="inline-actions">
                    <select
                      className="field"
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
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
              <p>{problem.question}</p>
              {isOwner && <p className="problem-answer">정답: {problem.answer}</p>}
            </li>
          ))}
          {problems.length === 0 && <li className="empty-card">등록된 문제가 없습니다.</li>}
        </ul></section>
        </div>
    </main></StudentShell>
  )
}

export default ProjectDetailPage
