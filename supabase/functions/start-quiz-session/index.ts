import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { fetchVisibleProblems } from '../_shared/visibleProblems.ts'

const PROBLEM_TYPES = ['mcq', 'short', 'bible']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { projectId, refCourse, refSession, bookmarkedOnly, count: requestedCount, types } = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(Number(requestedCount) || 10, 1), 50)
    // 풀고 싶은 문제 유형 필터. 값이 없으면 전체 유형을 출제한다(구버전 프론트 호환).
    const typeFilter = (Array.isArray(types) ? types : []).filter((t: unknown) => PROBLEM_TYPES.includes(t as string))
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const visible = await fetchVisibleProblems(supabase, userId, projectId)
    let filtered = visible.filter(
      (p: any) => (!refCourse || p.ref_course === refCourse)
        && (!refSession || p.ref_session === refSession)
        && (!typeFilter.length || typeFilter.includes(p.type)),
    )
    if (bookmarkedOnly) {
      const { data: bookmarks, error: bookmarkError } = await supabase.from('problem_bookmarks').select('problem_id').eq('user_id', userId)
      if (bookmarkError) throw bookmarkError
      const ids = new Set((bookmarks ?? []).map((row) => row.problem_id))
      filtered = filtered.filter((problem: any) => ids.has(problem.id))
    }
    const selected = filtered.sort(() => Math.random() - 0.5).slice(0, count)
    if (!selected.length) return json({ error: 'no_available_problems' }, 400)
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({ user_id: userId, total: selected.length, status: 'in_progress', problem_ids: selected.map((p: any) => p.id) })
      .select('id')
      .single()
    if (sessionError) throw sessionError
    return json({ success: true, sessionId: session.id, problems: selected })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
