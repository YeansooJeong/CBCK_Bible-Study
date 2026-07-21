import { useEffect, useState } from 'react'
import { api, type ModeratedProblem, type ProblemType } from '../lib/api'

const typeLabel: Record<ProblemType, string> = { mcq: '4지선다', short: '단답형', bible: '성경문제' }

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

export default function ProblemModerationPanel({ actor }: { actor: { adminToken?: string; userToken?: string } }) {
  const [problems, setProblems] = useState<ModeratedProblem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editOptions, setEditOptions] = useState(['', '', '', ''])

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

  return (
    <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">문제 관리</h2>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      <ul className="flex flex-col gap-3 text-sm">
        {problems.map((p) =>
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
            <li key={p.id} className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-900">
              <div>
                <p className="text-xs text-neutral-400">
                  {p.projectTitle} · {p.ownerName} · {typeLabel[p.type]}
                </p>
                <p className="text-neutral-900 dark:text-neutral-50">{p.question}</p>
                <p className="text-xs text-neutral-500">정답: {p.answer}</p>
              </div>
              <div className="flex shrink-0 gap-2 whitespace-nowrap">
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
        {problems.length === 0 && <p className="text-neutral-400">등록된 문제가 없습니다.</p>}
      </ul>
    </section>
  )
}
