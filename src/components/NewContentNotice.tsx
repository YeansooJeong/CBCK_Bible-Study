import { useEffect, useState } from 'react'
import type { Project } from '../lib/api'

const SEEN_KEY = 'cbck_seen_project_counts'
const DISMISSED_KEY = 'cbck_new_content_notice_dismissed'

type SeenMap = Record<string, number>
type Change = { title: string; isNew: boolean; added: number; total: number }

function saveBaseline(projects: Project[]) {
  const next: SeenMap = {}
  for (const project of projects) next[project.id] = project.problem_count ?? 0
  localStorage.setItem(SEEN_KEY, JSON.stringify(next))
}

export function NewContentNotice({ projects, loading }: { projects: Project[]; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [changes, setChanges] = useState<Change[]>([])

  useEffect(() => {
    if (loading) return
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return

    const rawSeen = localStorage.getItem(SEEN_KEY)
    if (rawSeen === null) {
      // 최초 실행: 지금 상태를 기준선으로만 저장하고, 팝업은 다음 변경부터 띄운다.
      saveBaseline(projects)
      return
    }

    let seen: SeenMap = {}
    try {
      seen = JSON.parse(rawSeen)
    } catch {
      seen = {}
    }

    const diffs: Change[] = []
    for (const project of projects) {
      const total = project.problem_count ?? 0
      const previous = seen[project.id]
      if (previous === undefined) {
        if (total > 0) diffs.push({ title: project.title, isNew: true, added: total, total })
      } else if (total > previous) {
        diffs.push({ title: project.title, isNew: false, added: total - previous, total })
      }
    }

    if (diffs.length > 0) {
      setChanges(diffs)
      setOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function close() {
    saveBaseline(projects)
    if (dontShowAgain) localStorage.setItem(DISMISSED_KEY, 'true')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="quiz-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="new-content-title">
        <button type="button" className="modal-close" aria-label="닫기" onClick={close}>×</button>
        <h2 id="new-content-title">새로운 학습 콘텐츠</h2>
        <div className="help-body">
          <div className="help-section">
            {changes.map((change) => (
              <p key={change.title}>
                {change.isNew ? (
                  <>
                    <strong>{change.title}</strong> 과목이 새로 열렸어요 (문제 {change.total}개)
                  </>
                ) : (
                  <>
                    <strong>{change.title}</strong>에 문제 {change.added}개가 추가됐어요 (현재 총 {change.total}개)
                  </>
                )}
              </p>
            ))}
          </div>
        </div>
        <label className="help-dismiss">
          <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
          다시 보지 않기
        </label>
      </section>
    </div>
  )
}
