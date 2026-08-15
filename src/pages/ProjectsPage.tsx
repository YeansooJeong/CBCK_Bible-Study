import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StudentShell, { Icon } from '../components/StudentShell'
import { api, describeApiError, type Project } from '../lib/api'
import { studentSession } from '../lib/session'

function ProjectsPage() {
  const navigate = useNavigate()
  const [token] = useState<string | null>(() => studentSession.get())
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(() => {
    if (!token) { navigate('/login'); return }
    api.listProjects({ userToken: token })
      .then((data) => { setProjects(data.projects); setError(null) })
      .catch((err) => setError(describeApiError(err, '과목을 불러오지 못했습니다.')))
      .finally(() => setLoading(false))
  }, [navigate, token])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // 재시도는 사용자 조작이라 여기서 로딩 상태를 켜도 된다(effect 안에서 켜면 렌더가 연쇄된다).
  function retry() {
    setLoading(true); setError(null)
    fetchProjects()
  }

  if (!token) return null
  return <StudentShell><main className="management-shell">
    <div className="management-heading"><div><p className="eyebrow">Curriculum</p><h1>과목 목록</h1></div><p>과목을 선택해 문제를 만들거나 풀어보세요.</p></div>
    {error && <div className="notice error retry-notice"><span>{error}</span><button type="button" className="secondary-button" disabled={loading} onClick={retry}>{loading ? '불러오는 중…' : '다시 시도'}</button></div>}
    <section className="project-list" aria-label="과목 목록">{loading ? <div className="empty-card">과목을 불러오는 중입니다.</div> : projects.length ? projects.map((project) => <Link className="project-list-card" to={`/projects/${project.id}`} key={project.id}><div className="project-icon"><Icon name="book"/></div><div className="project-list-copy"><strong>{project.title}</strong><span>총 {project.session_count}강 · {new Date(project.created_at).toLocaleDateString('ko-KR')} 개설</span></div><Icon name="arrow"/></Link>) : error ? null : <div className="empty-card"><strong>아직 개설된 과목이 없습니다.</strong><p>관리자가 과목을 개설하면 이곳에 표시됩니다.</p></div>}</section>
  </main></StudentShell>
}

export default ProjectsPage
