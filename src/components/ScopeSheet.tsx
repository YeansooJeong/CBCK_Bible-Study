import type { ReactNode } from 'react'

// 학습 설정은 이미 모달 안이라, 선택 목록을 모달 위에 또 띄우면 바깥을 눌렀을 때
// 어느 층이 닫히는지 꼬이고 스크롤이 두 겹이 된다. 그래서 같은 모달 안에서
// 화면만 바꿔 끼우고, 왼쪽 위 화살표로 돌아온다.
export function ScopeSheet({
  title,
  hint,
  selectedCount,
  onBack,
  children,
}: {
  title: string
  hint?: string
  selectedCount: number
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="scope-sheet">
      <div className="scope-sheet-head">
        <button type="button" className="scope-back" onClick={onBack} aria-label="뒤로">‹</button>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </div>
      <div className="scope-sheet-body">{children}</div>
      <button type="button" className="primary-button wide" onClick={onBack}>
        {selectedCount > 0 ? `선택 완료 (${selectedCount}개)` : '전체로 두고 돌아가기'}
      </button>
    </div>
  )
}

export function CheckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <label className={`check-row${checked ? ' checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>{label}</span>
    </label>
  )
}


/** 탭하면 선택 화면으로 넘어가는 설정 행. */
export function ScopeRow({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  return (
    <button type="button" className="scope-row" onClick={onOpen}>
      <span className="scope-row-label">{label}</span>
      <span className="scope-row-value">{value}</span>
      <span className="scope-row-arrow" aria-hidden>›</span>
    </button>
  )
}
