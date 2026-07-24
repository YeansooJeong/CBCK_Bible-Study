import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import StudentShell, { Icon } from '../components/StudentShell'
import { api, type Problem, type ProblemShareScope, type ProblemType, type Project, type RefKind } from '../lib/api'
import { studentSession } from '../lib/session'

const DRAFT_KEY = 'cbck-problem-draft'
const typeInfo = {
  mcq: { label: '4지선다', caption: '보기 중 하나를 고르는 문제', badge: '객관식', symbol: '①' },
  short: { label: '단답·짧은 서술', caption: '키워드로 자동 채점하는 문제', badge: '단답형', symbol: 'Aa' },
  bible: { label: '성경문제', caption: '성경책·장·절을 맞히는 문제', badge: '성경', symbol: '§' },
} satisfies Record<ProblemType, { label: string; caption: string; badge: string; symbol: string }>

const refKindOptions: RefKind[] = ['강의요약본', '강의영상']

type Draft = {
  type: ProblemType; question: string; options: string[]; correctIndex: number; shortAnswer: string; keywords: string
  book: string; chapter: string; verse: string; session: string; refKind: RefKind | ''; refDetail: string
  projectId: string; share: ProblemShareScope; sharedUserIds: string[]
}

const emptyDraft: Draft = { type:'mcq', question:'', options:['','','',''], correctIndex:0, shortAnswer:'', keywords:'', book:'', chapter:'', verse:'', session:'', refKind:'', refDetail:'', projectId:'', share:'private', sharedUserIds:[] }

function readDraft(): Draft {
  try { return { ...emptyDraft, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') } as Draft }
  catch { return emptyDraft }
}

function problemToDraft(p: Problem): Draft {
  const base: Draft = {
    ...emptyDraft,
    type: p.type,
    question: p.question,
    projectId: p.project_id,
    session: p.ref_session ?? '',
    refKind: (p.ref_kind ?? '') as RefKind | '',
    refDetail: p.ref_detail ?? '',
    share: p.share_scope,
  }
  if (p.type === 'mcq') {
    const options = ['1', '2', '3', '4'].map((k) => p.options?.[k] ?? '')
    const correctIndex = Math.max(0, Number(p.answer) - 1)
    return { ...base, options, correctIndex }
  }
  if (p.type === 'short') {
    return { ...base, shortAnswer: p.answer, keywords: p.keywords ?? '' }
  }
  const match = p.answer.match(/^(.*)\s+(\d+):(\d+)$/)
  return { ...base, book: match?.[1] ?? p.answer, chapter: match?.[2] ?? '', verse: match?.[3] ?? '' }
}

export default function NewProblemPage() {
  const navigate = useNavigate()
  const { problemId } = useParams<{ problemId?: string }>()
  const location = useLocation()
  const editingProblem = problemId ? (location.state as { problem?: Problem } | null)?.problem : undefined
  const isEditing = Boolean(problemId)
  const [draft, setDraft] = useState<Draft>(() => (editingProblem ? problemToDraft(editingProblem) : readDraft()))
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedProjectId, setSavedProjectId] = useState('')
  const [shareUsers, setShareUsers] = useState<Array<{ id: string; displayName: string }>>([])
  const [shareSearch, setShareSearch] = useState('')

  useEffect(() => {
    const token = studentSession.get()
    if (!token) { navigate('/login'); return }
    api.listProjects({ userToken: token }).then(({ projects }) => {
      setProjects(projects)
      if (!isEditing) {
        setDraft((current) => ({ ...current, projectId: projects.some((item) => item.id === current.projectId) ? current.projectId : (projects[0]?.id || '') }))
      }
    }).catch(() => setError('과목을 불러오지 못했습니다.')).finally(() => setLoading(false))
    api.listShareableUsers(token).then(({ users }) => setShareUsers(users)).catch(() => setShareUsers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const selectedProject = useMemo(() => projects.find((project) => project.id === draft.projectId) ?? null, [projects, draft.projectId])

  const answerLabel = useMemo(() => {
    if (draft.type === 'mcq') return draft.options[draft.correctIndex] || `${draft.correctIndex + 1}번 보기가 정답으로 지정됨`
    if (draft.type === 'short') return draft.shortAnswer || '정답을 입력하면 여기에 표시됩니다.'
    return [draft.book, draft.chapter && `${draft.chapter}장`, draft.verse && `${draft.verse}절`].filter(Boolean).join(' ') || '성경책·장·절을 입력해 주세요.'
  }, [draft])

  if (problemId && !editingProblem) {
    return (
      <StudentShell>
        <main className="create-shell">
          <div className="empty-card create-empty">
            <strong>수정할 문제를 찾을 수 없습니다.</strong>
            <p>과목 화면의 문제 목록에서 다시 눌러 들어와 주세요.</p>
            <Link className="primary-button" to="/projects">
              <Icon name="book" /> 과목 목록 보기
            </Link>
          </div>
        </main>
      </StudentShell>
    )
  }

  function toggleSharedUser(userId: string) {
    setDraft((current) => ({
      ...current,
      sharedUserIds: current.sharedUserIds.includes(userId)
        ? current.sharedUserIds.filter((id) => id !== userId)
        : [...current.sharedUserIds, userId],
    }))
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); setSavedProjectId(''); setError('') }
  function updateOption(index: number, value: string) { const options = [...draft.options]; options[index] = value; update('options', options) }
  function validate() {
    if (!draft.projectId) return '문제를 저장할 과목을 선택해 주세요.'
    if (!draft.question.trim()) return '문제 내용을 입력해 주세요.'
    if (draft.type === 'mcq' && draft.options.some((item) => !item.trim())) return '보기 4개를 모두 입력해 주세요.'
    if (draft.type === 'short' && !draft.shortAnswer.trim()) return '대표 정답을 입력해 주세요.'
    if (draft.type === 'bible' && (!draft.book.trim() || !draft.chapter || !draft.verse)) return '정답 성경책·장·절을 모두 입력해 주세요.'
    if (!draft.session) return '회차를 선택해 주세요.'
    if (!draft.refKind) return '출처 유형(강의요약본/강의영상)을 선택해 주세요.'
    if (draft.share === 'selected' && draft.sharedUserIds.length === 0) return '공유할 신학원생을 한 명 이상 선택해 주세요.'
    return ''
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setNotice('이 기기의 임시보관함에 저장했습니다.')
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); const message = validate(); if (message) { setError(message); return }
    const token = studentSession.get(); if (!token) return navigate('/login')
    setSaving(true); setError('')
    const fields = {
      type: draft.type, question: draft.question.trim(),
      options: draft.type === 'mcq' ? Object.fromEntries(draft.options.map((value, index) => [String(index + 1), value.trim()])) : undefined,
      answer: draft.type === 'mcq' ? String(draft.correctIndex + 1) : draft.type === 'short' ? draft.shortAnswer.trim() : `${draft.book.trim()} ${draft.chapter}:${draft.verse}`,
      keywords: draft.type === 'short' ? draft.keywords.trim() || undefined : undefined,
      refSession: draft.session, refKind: draft.refKind || undefined, refDetail: draft.refDetail.trim() || undefined, shareScope: draft.share,
      sharedUserIds: draft.share === 'selected' ? draft.sharedUserIds : undefined,
    }
    try {
      if (isEditing && editingProblem) {
        await api.updateProblem(token, { problemId: editingProblem.id, ...fields })
        navigate(`/projects/${draft.projectId}`)
        return
      }
      await api.createProblem(token, { projectId: draft.projectId, ...fields })
      localStorage.removeItem(DRAFT_KEY); setSavedProjectId(draft.projectId); setNotice('문제가 과목에 저장되었습니다.')
    } catch { setError('문제 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.') }
    finally { setSaving(false) }
  }

  function resetForNext() { setDraft((current) => ({ ...emptyDraft, projectId: current.projectId, session: current.session, refKind: current.refKind, share: current.share })); setSavedProjectId(''); setNotice('') }

  return <StudentShell><main className="create-shell">
    <div className="create-heading"><div><Link to={isEditing ? `/projects/${draft.projectId}` : '/home'}>← {isEditing ? '과목으로' : '홈으로'}</Link><p className="eyebrow">{isEditing ? '문제 수정' : '새 문제 만들기'}</p><h1>{isEditing ? '등록한 문제를 고쳐보세요.' : '배운 내용을 한 문제로 남겨보세요.'}</h1><p>정답뿐 아니라 다시 찾아볼 수 있는 레퍼런스까지 함께 기록합니다.</p></div>{!isEditing && <Link className="csv-button" to={draft.projectId ? `/projects/${draft.projectId}` : '/projects'}><Icon name="upload" size={17}/> CSV로 여러 문제 등록</Link>}</div>

    {!loading && projects.length === 0 ? <div className="empty-card create-empty"><strong>아직 개설된 과목이 없습니다.</strong><p>관리자가 과목을 개설하면 문제를 등록할 수 있어요.</p><Link className="primary-button" to="/projects"><Icon name="book"/> 과목 목록 보기</Link></div> : <div className="creator-grid">
      <form className="editor-card" onSubmit={handleSubmit}>
        <section className="creator-section"><div className="creator-title"><span>01</span><div><h2>문제 유형</h2><p>문제에 맞는 채점 방식을 선택하세요.</p></div></div><div className="type-tabs">{(Object.keys(typeInfo) as ProblemType[]).map((key) => <button type="button" key={key} className={draft.type === key ? 'selected' : ''} onClick={() => update('type', key)}><i>{typeInfo[key].symbol}</i><strong>{typeInfo[key].label}</strong><small>{typeInfo[key].caption}</small></button>)}</div></section>

        <section className="creator-section"><div className="creator-title"><span>02</span><div><h2>문제와 정답</h2><p>{typeInfo[draft.type].caption}</p></div></div><label className="creator-field">문제 내용 <b>필수</b><textarea value={draft.question} onChange={(e) => update('question', e.target.value)} maxLength={300} placeholder={draft.type === 'bible' ? '예: 믿음장으로 불리는 본문의 위치는 어디인가요?' : '학습자가 이해하기 쉬운 문장으로 질문을 입력하세요.'}/><small>{draft.question.length} / 300</small></label>
          {draft.type === 'mcq' && <div className="option-editor"><div className="creator-field plain">보기 4개와 정답 <b>필수</b><em>왼쪽 원을 눌러 정답을 지정하세요.</em></div>{draft.options.map((option, index) => <div className={`creator-option ${draft.correctIndex === index ? 'answer' : ''}`} key={index}><button type="button" aria-label={`${index + 1}번을 정답으로 지정`} onClick={() => update('correctIndex', index)}>{draft.correctIndex === index ? '✓' : index + 1}</button><input value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`${index + 1}번 보기 입력`}/><span>{draft.correctIndex === index ? '정답' : ''}</span></div>)}</div>}
          {draft.type === 'short' && <><label className="creator-field">대표 정답 <b>필수</b><input value={draft.shortAnswer} onChange={(e) => update('shortAnswer', e.target.value)} placeholder="예: 바라는 것들의 실상"/></label><label className="creator-field">추가 키워드 <span>선택</span><input value={draft.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="실상; 증거; 바라는 것처럼 세미콜론으로 구분"/></label></>}
          {draft.type === 'bible' && <div className="bible-fields"><label className="creator-field">성경책 <b>필수</b><input value={draft.book} onChange={(e) => update('book', e.target.value)} placeholder="히브리서"/></label><label className="creator-field">장 <b>필수</b><input inputMode="numeric" value={draft.chapter} onChange={(e) => update('chapter', e.target.value.replace(/\D/g,''))} placeholder="11"/></label><label className="creator-field">절 <b>필수</b><input inputMode="numeric" value={draft.verse} onChange={(e) => update('verse', e.target.value.replace(/\D/g,''))} placeholder="1"/></label></div>}
        </section>

        <section className="creator-section reference-section"><div className="creator-title"><span>03</span><div><h2>학습 레퍼런스</h2><p>오답을 다시 공부할 수 있도록 출처를 남겨주세요. 과목은 아래에서 선택한 과목으로 자동 기록됩니다.</p></div><mark>필수</mark></div><div className="creator-reference-grid">
          <label className="creator-field">회차 <b>필수</b><select value={draft.session} onChange={(e) => update('session', e.target.value)} disabled={!selectedProject}><option value="">{selectedProject ? '회차 선택' : '과목을 먼저 선택하세요'}</option>{selectedProject && Array.from({ length: selectedProject.session_count }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}강</option>)}</select></label>
          <label className="creator-field">출처 유형 <b>필수</b><select value={draft.refKind} onChange={(e) => update('refKind', e.target.value as RefKind)}><option value="">선택</option>{refKindOptions.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
          <label className="creator-field full">세부 내용 <span>선택</span><input value={draft.refDetail} onChange={(e) => update('refDetail', e.target.value)} placeholder="예: 초반부, 12분경"/></label>
        </div></section>

        <section className="creator-section"><div className="creator-title"><span>04</span><div><h2>저장과 공유</h2><p>문제를 담을 과목과 공개 범위를 정하세요.</p></div></div><label className="creator-field">저장할 과목 <b>필수</b><select value={draft.projectId} disabled={isEditing} onChange={(e) => update('projectId', e.target.value)}><option value="">과목 선택</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select>{isEditing && <small>등록된 과목은 수정 화면에서 바꿀 수 없어요.</small>}</label><div className="share-options">{([{key:'private',title:'나만 보기',desc:'작성자만 조회·수정할 수 있어요.'},{key:'all',title:'전체 신학원생',desc:'등록된 모든 신학원생이 풀 수 있어요.'},{key:'selected',title:'선택한 신학원생',desc:'고른 신학원생만 조회·풀이할 수 있어요.'}] as const).map((item) => <button type="button" key={item.key} className={draft.share === item.key ? 'selected' : ''} onClick={() => update('share', item.key)}><span>{draft.share === item.key ? '●' : '○'}</span><div><strong>{item.title}</strong><small>{item.desc}</small></div></button>)}</div>
          {draft.share === 'selected' && <div className="creator-field plain">
            공유할 신학원생 <b>필수</b>
            <input value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} placeholder="이름으로 검색" style={{ marginTop: 8, marginBottom: 8 }} />
            <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {shareUsers.filter((u) => u.displayName.toLowerCase().includes(shareSearch.toLowerCase())).map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                  <input type="checkbox" checked={draft.sharedUserIds.includes(u.id)} onChange={() => toggleSharedUser(u.id)} />
                  {u.displayName}
                </label>
              ))}
              {shareUsers.length === 0 && <small>공유 가능한 신학원생이 없습니다.</small>}
            </div>
          </div>}
        </section>

        {error && <div className="creator-error" role="alert">! {error}</div>}
        {savedProjectId && <div className="creator-success"><strong>문제가 저장되었습니다.</strong><div><button type="button" onClick={resetForNext}>계속 등록</button><Link to={`/projects/${savedProjectId}`}>과목에서 확인 →</Link></div></div>}
        <div className="creator-actions">{!isEditing && <button type="button" className="draft-button" onClick={saveDraft}>임시저장</button>}<button type="submit" className="primary-button" disabled={saving || loading}>{saving ? '저장 중…' : isEditing ? '수정 저장' : '문제 저장'} {!saving && <Icon name="arrow"/>}</button></div>
      </form>

      <aside className="preview-column"><div className="preview-label"><span>실시간 미리보기</span><small>학습자에게 보이는 화면</small></div><article className="problem-preview"><span className="preview-bookmark"/><div className="preview-meta"><span>{typeInfo[draft.type].badge}</span><span>{selectedProject?.title || '과목'} · {draft.session ? `${draft.session}강` : '회차'}</span></div><h2>{draft.question || '입력한 문제가 이곳에 표시됩니다.'}</h2>{draft.type === 'mcq' ? <div className="preview-options">{draft.options.map((item,index) => <div key={index} className={draft.correctIndex === index && item ? 'answer' : ''}><span>{index+1}</span>{item || `${index+1}번 보기`}</div>)}</div> : <div className="preview-answer"><small>정답</small><strong>{answerLabel}</strong>{draft.type === 'short' && draft.keywords && <p>인정 키워드 · {draft.keywords}</p>}</div>}<div className="preview-reference"><small>학습 레퍼런스</small><strong>{selectedProject?.title || '과목'} · {draft.session ? `${draft.session}강` : '회차'}</strong><p>{[draft.refKind, draft.refDetail].filter(Boolean).join(' · ') || '정답을 다시 확인할 출처'}</p></div></article><div className="policy-note"><strong>공유 설정 안내</strong><p>{draft.share === 'private' ? '저장 후에도 이 문제는 나만 볼 수 있습니다.' : draft.share === 'all' ? '저장하면 전체 신학원생에게 공유됩니다.' : `저장하면 선택한 ${draft.sharedUserIds.length}명에게만 공유됩니다.`}</p><span>문제 단위 설정이 과목 설정보다 우선합니다.</span></div></aside>
    </div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main></StudentShell>
}
