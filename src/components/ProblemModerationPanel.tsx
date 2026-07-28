import { useEffect, useState } from 'react'
import { api, type ModeratedProblem, type ProblemType } from '../lib/api'
import { formatBibleAnswer } from '../lib/format'

const typeLabel: Record<ProblemType, string> = { mcq: '4지선다', short: '단답형', bible: '성경문제' }

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

export default function ProblemModerationPanel({ actor }: { actor: { adminToken?: string; userToken?: string } }) {
  const [open, setOpen] = useState(true)
  const [problems, setProblems] = useState<ModeratedProblem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editOptions, setEditOptions] = useState(['', '', '', ''])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProblemType | 'all'>('all')
  const [courseFilter, setCourseFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function load() {
    try {
      const { problems } = await api.adminListProblems(actor)
      setProblems(problems)
    } catch {
      setError('문제 목록을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit(p: ModeratedProblem) {
    setEditingId(p.id)
    setEditQuestion(p.question)
    setEditAnswer(p.answer)
    setEditOptions(['1', '2', '3', '4'].map((n) => p.options?.[n] ?? ''))
  }

  async function saveEdit(p: ModeratedProblem) {
    try {
      await api.adminUpdateProblem(actor, {
        problemId: p.id,
        question: editQuestion,
        answer: editAnswer,
        options: p.type === 'mcq' ? Object.fromEntries(editOptions.map((v, i) => [String(i + 1), v])) : undefined,
      })
      setEditingId(null)
      await load()
    } catch {
      setError('문제 수정에 실패했습니다.')
    }
  }

  async function handleDelete(problemId: string) {
    if (!window.confirm('이 문제를 삭제할까요?')) return
    try {
      await api.adminDeleteProblem(actor, problemId)
      await load()
    } catch {
      setError('문제 삭제에 실패했습니다.')
    }
  }

  function toggleExpanded(problemId: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(problemId)) next.delete(problemId)
      else next.add(problemId)
      return next
    })
  }

  function toggleAll() {
    setExpandedIds((current) => current.size === problems.length ? new Set() : new Set(problems.map((p) => p.id)))
  }

  function toggleSelected(problemId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(problemId)) next.delete(problemId)
      else next.add(problemId)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      const allSelected = filteredProblems.length > 0 && filteredProblems.every((p) => current.has(p.id))
      return allSelected ? new Set() : new Set(filteredProblems.map((p) => p.id))
    })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 문제를 삭제할까요?`)) return
    setBulkDeleting(true)
    setError(null)
    try {
      await Promise.all([...selectedIds].map((id) => api.adminDeleteProblem(actor, id)))
      setSelectedIds(new Set())
      await load()
    } catch {
      setError('일부 문제 삭제에 실패했습니다.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredProblems = problems.filter((p) => {
    const searchable = `${p.question} ${p.answer} ${p.ownerName} ${p.projectTitle} ${p.refCourse ?? ''} ${p.refSession ?? ''}`.toLocaleLowerCase()
    return (!normalizedQuery || searchable.includes(normalizedQuery)) && (typeFilter === 'all' || p.type === typeFilter) && (!courseFilter || p.refCourse === courseFilter)
  })
  const courses = [...new Set(problems.map((p) => p.refCourse).filter((value): value is string => Boolean(value)))].sort()

  return (
    <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">문제 관리</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {open && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {error ? <p className="text-sm text-red-500">{error}</p> : <span className="text-xs text-neutral-500">총 {problems.length}문제</span>}
            {problems.length > 0 && <button type="button" onClick={toggleAll} className="text-xs text-accent hover:underline">
              {expandedIds.size === problems.length ? '전체 접기' : '전체 펼치기'}
            </button>}
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="문제·정답·출제자·프로젝트 검색" />
            <select className={inputClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ProblemType | 'all')}>
              <option value="all">전체 유형</option><option value="mcq">객관식</option><option value="short">단답형</option><option value="bible">성경문제</option>
            </select>
            <select className={inputClass} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">전체 과정</option>{courses.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
          </div>
          {filteredProblems.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
              <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={filteredProblems.every((p) => selectedIds.has(p.id))}
                  onChange={toggleSelectAllFiltered}
                />
                검색 결과 전체 선택 ({filteredProblems.length}개)
              </label>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-1 text-xs text-red-500 disabled:opacity-40"
              >
                {bulkDeleting ? '삭제하는 중…' : `선택 삭제 (${selectedIds.size})`}
              </button>
            </div>
          )}
          <ul className="flex flex-col gap-3 text-sm">
            {filteredProblems.map((p) =>
              editingId === p.id ? (
                <li key={p.id} className="rounded-lg border border-accent p-3">
                  <p className="mb-2 text-xs text-neutral-400">
                    {p.projectTitle} · {p.ownerName} · {typeLabel[p.type]}
                  </p>
                  <textarea className={inputClass + ' mb-2'} value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} rows={2} />
                  {p.type === 'mcq' && (
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      {editOptions.map((opt, i) => (
                        <input
                          key={i}
                          className={inputClass}
                          placeholder={`보기 ${i + 1}`}
                          value={opt}
                          onChange={(e) => setEditOptions((cur) => cur.map((v, idx) => (idx === i ? e.target.value : v)))}
                        />
                      ))}
                    </div>
                  )}
                  <input className={inputClass + ' mb-2'} placeholder="정답" value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => saveEdit(p)} className="text-accent hover:underline">
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-neutral-400 hover:underline">
                      취소
                    </button>
                  </div>
                </li>
              ) : (
                <li key={p.id} className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelected(p.id)}
                  />
                  <div className="flex flex-1 flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-neutral-400">
                        {p.projectTitle} · {p.ownerName} · {typeLabel[p.type]}
                      </p>
                      <p className={`text-neutral-900 dark:text-neutral-50 ${expandedIds.has(p.id) ? '' : 'line-clamp-2'}`}>{p.question}</p>
                      <p className="text-xs text-neutral-500">정답: {p.type === 'bible' ? formatBibleAnswer(p.answer) : p.answer}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 text-xs sm:text-sm">
                      <button type="button" onClick={() => toggleExpanded(p.id)} className="text-neutral-500 hover:underline">
                        {expandedIds.has(p.id) ? '접기' : '펼치기'}
                      </button>
                      <button type="button" onClick={() => startEdit(p)} className="text-accent hover:underline">
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline">
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              ),
            )}
            {problems.length === 0 && <p className="text-neutral-400">등록된 문제가 없습니다.</p>}
          </ul>
        </>
      )}
    </section>
  )
}
