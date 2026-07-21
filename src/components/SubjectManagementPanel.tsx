import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, type Project } from '../lib/api'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

// Super/일반 Admin 공용 과목(커리큘럼 프로젝트) 관리 패널.
export default function SubjectManagementPanel({ actor }: { actor: { adminToken?: string; userToken?: string } }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [sessionCount, setSessionCount] = useState('32')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSessionCount, setEditSessionCount] = useState('')

  async function load() {
    try {
      const { projects } = await api.listProjects(actor)
      setProjects(projects)
    } catch {
      setError('과목 목록을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createProject(actor, { title, sessionCount: Number(sessionCount) || 32 })
      setTitle('')
      setSessionCount('32')
      await load()
    } catch {
      setError('과목 생성에 실패했습니다.')
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditTitle(p.title)
    setEditSessionCount(String(p.session_count))
  }

  async function saveEdit(p: Project) {
    try {
      await api.updateProject(actor, { projectId: p.id, title: editTitle, sessionCount: Number(editSessionCount) || p.session_count })
      setEditingId(null)
      await load()
    } catch {
      setError('과목 수정에 실패했습니다.')
    }
  }

  async function handleDelete(projectId: string) {
    if (!window.confirm('이 과목을 삭제할까요?')) return
    try {
      await api.deleteProject(actor, projectId)
      await load()
    } catch (err) {
      setError(
        err instanceof ApiError && err.message === 'has_problems'
          ? '이 과목에 등록된 문제가 있어 삭제할 수 없습니다. 먼저 문제를 정리해주세요.'
          : '과목 삭제에 실패했습니다.',
      )
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">과목 관리</h2>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      <form onSubmit={handleCreate} className="mb-6 flex gap-3">
        <input className={inputClass} placeholder="과목명 (예: 창세기)" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input
          className={inputClass + ' max-w-[140px]'}
          type="number"
          min={1}
          placeholder="총 회차 수"
          value={sessionCount}
          onChange={(e) => setSessionCount(e.target.value)}
        />
        <button type="submit" className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark">
          과목 추가
        </button>
      </form>
      <ul className="flex flex-col gap-2 text-sm">
        {projects.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="rounded-lg border border-accent p-3">
              <div className="flex gap-2">
                <input className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <input
                  className={inputClass + ' max-w-[140px]'}
                  type="number"
                  min={1}
                  value={editSessionCount}
                  onChange={(e) => setEditSessionCount(e.target.value)}
                />
              </div>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => saveEdit(p)} className="text-accent hover:underline">
                  저장
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-neutral-400 hover:underline">
                  취소
                </button>
              </div>
            </li>
          ) : (
            <li key={p.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-900">
              <span className="text-neutral-900 dark:text-neutral-50">
                {p.title} <span className="text-neutral-400">· 총 {p.session_count}강</span>
              </span>
              <div className="flex gap-3">
                <button type="button" onClick={() => startEdit(p)} className="text-accent hover:underline">
                  수정
                </button>
                <button type="button" onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline">
                  삭제
                </button>
              </div>
            </li>
          ),
        )}
        {projects.length === 0 && <p className="text-neutral-400">개설된 과목이 없습니다.</p>}
      </ul>
    </section>
  )
}
