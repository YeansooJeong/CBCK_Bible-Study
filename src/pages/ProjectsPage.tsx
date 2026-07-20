import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Project, type ShareScope } from '../lib/api'
import { studentSession } from '../lib/session'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

function ProjectsPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [shareScope, setShareScope] = useState<ShareScope>('private')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = studentSession.get()
    if (!t) {
      navigate('/login')
      return
    }
    setToken(t)
    api.listProjects(t).then(({ projects }) => setProjects(projects))
  }, [navigate])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    try {
      await api.createProject(token, { title, shareScope })
      setTitle('')
      setShareScope('private')
      const { projects } = await api.listProjects(token)
      setProjects(projects)
    } catch {
      setError('프로젝트 생성에 실패했습니다.')
    }
  }

  if (!token) return null

  return (
    <div className="min-h-svh bg-white px-6 py-10 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">내 프로젝트</h1>
          <Link to="/home" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            홈으로
          </Link>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">새 프로젝트 만들기</h2>
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              className={inputClass}
              placeholder="프로젝트 제목 (예: 창세기 1강)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select
              className={inputClass}
              value={shareScope}
              onChange={(e) => setShareScope(e.target.value as ShareScope)}
            >
              <option value="private">비공개</option>
              <option value="all">전체공개</option>
            </select>
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark"
            >
              만들기
            </button>
          </form>
        </section>

        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 transition hover:border-accent dark:border-neutral-800"
              >
                <span className="text-neutral-900 dark:text-neutral-50">{project.title}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-400">
                  {!project.isOwner && <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">공유받음</span>}
                  {project.share_scope === 'all' ? '전체공개' : '비공개'}
                </span>
              </Link>
            </li>
          ))}
          {projects.length === 0 && <p className="text-sm text-neutral-400">아직 프로젝트가 없습니다.</p>}
        </ul>
      </div>
    </div>
  )
}

export default ProjectsPage
