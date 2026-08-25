import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { fetchVisibleProblems } from '../_shared/visibleProblems.ts'

const VALID_TYPES = ['mcq', 'short', 'bible']

// 퀴즈와 달리 채점/기록이 없는 자가학습용 카드 목록. 정답을 그대로 내려준다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const body = await req.json().catch(() => ({}))
    const { projectId, projectIds, refCourse, refSession, refSessions, bookmarkedOnly, count: requestedCount, types } = body
    const projectFilter = toList(projectIds, projectId)
    const sessionFilter = toList(refSessions, refSession)
    const count = Math.min(Math.max(Number(requestedCount) || 10, 1), 50)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const visible = await fetchVisibleProblems(supabase, userId, projectFilter, true)
    // 보고 싶은 문제 유형 필터. 값이 없으면 전체 유형을 보여준다(구버전 프론트 호환).
    const typeFilter = (Array.isArray(types) ? types : []).filter((t: unknown) => VALID_TYPES.includes(t as string))
    let filtered = visible.filter(
      (p: any) => (!refCourse || p.ref_course === refCourse)
        && (!sessionFilter.length || sessionFilter.includes(String(p.ref_session ?? '')))
        && (!typeFilter.length || typeFilter.includes(p.type)),
    )
    if (bookmarkedOnly) {
      const { data: bookmarks, error: bookmarkError } = await supabase.from('problem_bookmarks').select('problem_id').eq('user_id', userId)
      if (bookmarkError) throw bookmarkError
      const ids = new Set((bookmarks ?? []).map((row: any) => row.problem_id))
      filtered = filtered.filter((problem: any) => ids.has(problem.id))
    }
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, count)
    return json({ problems: shuffled })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

// 다중 선택 값과 구버전 단수 값을 하나의 목록으로 모은다.
function toList(many: unknown, one: unknown): string[] {
  const values = Array.isArray(many) ? many : one != null && one !== '' ? [one] : []
  return values.map((v) => String(v)).filter(Boolean)
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
