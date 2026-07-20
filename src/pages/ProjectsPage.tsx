import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import StudentShell, { Icon } from '../components/StudentShell'
import { api, type Project, type ShareScope } from '../lib/api'
import { studentSession } from '../lib/session'

function ProjectsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sharedOnly = params.get('scope') === 'shared'
  const [token] = useState<string | null>(() => studentSession.get())
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [shareScope, setShareScope] = useState<ShareScope>('private')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload(t: string) { const data = await api.listProjects(t); setProjects(data.projects) }
  useEffect(() => {
    if (!token) { navigate('/login'); return }
    // Initial server synchronization for this authenticated route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload(token).catch(() => setError('프로젝트를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [navigate, token])
  const visible = useMemo(() => projects.filter((project) => sharedOnly ? !project.isOwner : project.isOwner), [projects, sharedOnly])

  async function handleCreate(event: FormEvent) {
    event.preventDefault(); if (!token) return; setError(null)
    try { await api.createProject(token, { title, shareScope }); setTitle(''); setShareScope('private'); await reload(token) }
    catch { setError('프로젝트 생성에 실패했습니다.') }
  }

  if (!token) return null
  return <StudentShell><main className="management-shell">
    <div className="management-heading"><div><p className="eyebrow">Problem library</p><h1>{sharedOnly ? '공유 문제' : '내 문제함'}</h1></div><p>{sharedOnly ? '동료들이 공유한 프로젝트를 학습해 보세요.' : '배운 내용을 프로젝트별로 정리하세요.'}</p></div>
    {!sharedOnly && <section className="management-card"><div className="section-heading"><h2>새 프로젝트 만들기</h2><Link className="text-link" to="/problems/new">문제 바로 만들기 →</Link></div>{error && <div className="notice error">{error}</div>}<form className="form-row" onSubmit={handleCreate}><input className="field" placeholder="프로젝트 제목 (예: 창세기 1강)" value={title} onChange={(e) => setTitle(e.target.value)} required/><select className="field" value={shareScope} onChange={(e) => setShareScope(e.target.value as ShareScope)}><option value="private">나만 보기</option><option value="all">전체 공유</option></select><button className="primary-button" type="submit"><Icon name="plus"/> 만들기</button></form></section>}
    {sharedOnly && error && <div className="notice error">{error}</div>}
    <section className="project-list" aria-label="프로젝트 목록">{loading ? <div className="empty-card">프로젝트를 불러오는 중입니다.</div> : visible.length ? visible.map((project) => <Link className="project-list-card" to={`/projects/${project.id}`} key={project.id}><div className="project-icon"><Icon name={project.isOwner ? 'book' : 'users'}/></div><div className="project-list-copy"><strong>{project.title}</strong><span>{new Date(project.created_at).toLocaleDateString('ko-KR')} 생성 · {project.share_scope === 'all' ? '전체 공유' : '비공개'}</span></div><span className="badge">{project.isOwner ? '내 문제' : '공유받음'}</span><Icon name="arrow"/></Link>) : <div className="empty-card"><strong>{sharedOnly ? '공유받은 프로젝트가 없습니다.' : '아직 만든 프로젝트가 없습니다.'}</strong><p>{sharedOnly ? '공유된 프로젝트가 생기면 이곳에 표시됩니다.' : '위 입력란에서 첫 프로젝트를 만들어보세요.'}</p></div>}</section>
  </main></StudentShell>
}

export default ProjectsPage
