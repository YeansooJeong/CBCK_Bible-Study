import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { fetchVisibleProblems } from '../_shared/visibleProblems.ts'

const PROBLEM_TYPES = ['mcq', 'short', 'bible']

// 출제 후보를 다루는 데 필요한 최소 형태만 둔다.
interface Problem { id: string; type: string; ref_course?: string | null; ref_session?: string | null }

// sort(() => Math.random() - 0.5)는 비교 결과가 일관되지 않아 정렬이 한쪽으로 치우친다.
// 출제 순서가 고르게 섞이도록 Fisher-Yates로 섞는다.
function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const body = await req.json().catch(() => ({}))
    const { projectId, projectIds, refCourse, refSession, refSessions, sessionsByProject, bookmarkedOnly, count: requestedCount, types } = body
    // 과목·회차는 여러 개를 고를 수 있다. 단수 필드는 구버전 프론트 호환용이다.
    const projectFilter = toList(projectIds, projectId)
    const sessionFilter = toList(refSessions, refSession)
    const count = Math.min(Math.max(Number(requestedCount) || 10, 1), 50)
    // 풀고 싶은 문제 유형 필터. 값이 없으면 전체 유형을 출제한다(구버전 프론트 호환).
    const typeFilter = (Array.isArray(types) ? types : []).filter((t: unknown) => PROBLEM_TYPES.includes(t as string))
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const visible = await fetchVisibleProblems(supabase, userId, projectFilter)
    let filtered = visible.filter(
      (p: any) => (!refCourse || p.ref_course === refCourse)
        && matchesSession(p, sessionsByProject, sessionFilter)
        && (!typeFilter.length || typeFilter.includes(p.type)),
    )
    if (bookmarkedOnly) {
      const { data: bookmarks, error: bookmarkError } = await supabase.from('problem_bookmarks').select('problem_id').eq('user_id', userId)
      if (bookmarkError) throw bookmarkError
      const ids = new Set((bookmarks ?? []).map((row) => row.problem_id))
      filtered = filtered.filter((problem: any) => ids.has(problem.id))
    }
    if (!filtered.length) return json({ error: 'no_available_problems' }, 400)

    // 전에 풀어본 문제는 뒤로 미뤄, 안 풀어본 문제부터 출제한다.
    // 위에서 유형·과목·회차·북마크 필터를 이미 적용했으므로, "안 풀어본 문제"의
    // 모수도 사용자가 고른 범위 안으로 자연히 좁혀진다.
    const { data: answeredRows, error: answeredError } = await supabase
      .from('session_answers')
      .select('problem_id, quiz_sessions!inner(user_id)')
      .eq('quiz_sessions.user_id', userId)
    if (answeredError) throw answeredError
    const answered = new Set((answeredRows ?? []).map((row: { problem_id: string }) => row.problem_id))

    const unseen = shuffle(filtered.filter((p: Problem) => !answered.has(p.id)))
    const reviewed = shuffle(filtered.filter((p: Problem) => answered.has(p.id)))
    // 안 풀어본 문제가 모자라면 남는 자리를 이미 푼 문제로 채우고,
    // 범위를 전부 풀었으면 자연히 전체에서 무작위로 출제된다.
    const selected = [...unseen, ...reviewed].slice(0, count)

    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({ user_id: userId, total: selected.length, status: 'in_progress', problem_ids: selected.map((p: any) => p.id) })
      .select('id')
      .single()
    if (sessionError) throw sessionError
    return json({
      success: true,
      sessionId: session.id,
      problems: selected,
      // 이번 회차 구성과 남은 새 문제 수. 화면에서 "복습으로 다시 나온다"는 안내에 쓴다.
      newCount: Math.min(unseen.length, count),
      reviewCount: Math.max(0, selected.length - Math.min(unseen.length, count)),
      remainingNew: Math.max(0, unseen.length - count),
    })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

// 회차는 과목마다 따로 고른다. 어떤 과목에 고른 회차가 없으면 그 과목은 전체 회차가 대상이다.
// refSessions(과목 구분 없는 목록)는 구버전 프론트 호환용이다.
function matchesSession(problem: { project_id?: string; ref_session?: string | null }, byProject: unknown, flat: string[]): boolean {
  const session = String(problem.ref_session ?? '')
  if (byProject && typeof byProject === 'object' && !Array.isArray(byProject)) {
    const chosen = (byProject as Record<string, unknown>)[problem.project_id ?? '']
    if (Array.isArray(chosen) && chosen.length) return chosen.map(String).includes(session)
    return true
  }
  return !flat.length || flat.includes(session)
}

// 다중 선택 값과 구버전 단수 값을 하나의 목록으로 모은다.
function toList(many: unknown, one: unknown): string[] {
  const values = Array.isArray(many) ? many : one != null && one !== '' ? [one] : []
  return values.map((v) => String(v)).filter(Boolean)
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
