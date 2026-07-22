import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { fetchVisibleProblems } from '../_shared/visibleProblems.ts'

// 퀴즈와 달리 채점/기록이 없는 자가학습용 카드 목록. 정답을 그대로 내려준다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { projectId, refCourse, refSession, bookmarkedOnly } = await req.json().catch(() => ({}))
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const visible = await fetchVisibleProblems(supabase, userId, projectId, true)
    let filtered = visible.filter(
      (p: any) => (!refCourse || p.ref_course === refCourse) && (!refSession || p.ref_session === refSession),
    )
    if (bookmarkedOnly) {
      const { data: bookmarks, error: bookmarkError } = await supabase.from('problem_bookmarks').select('problem_id').eq('user_id', userId)
      if (bookmarkError) throw bookmarkError
      const ids = new Set((bookmarks ?? []).map((row: any) => row.problem_id))
      filtered = filtered.filter((problem: any) => ids.has(problem.id))
    }
    const shuffled = filtered.sort(() => Math.random() - 0.5)
    return json({ problems: shuffled })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
