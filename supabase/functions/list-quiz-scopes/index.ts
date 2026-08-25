import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { fetchVisibleProblems } from '../_shared/visibleProblems.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)

    const url = new URL(req.url)
    // 과목을 여러 개 고를 수 있으므로 쉼표로 구분해 받는다. projectId는 구버전 호환용.
    const projectIds = (url.searchParams.get('projectIds') || url.searchParams.get('projectId') || '')
      .split(',').map((v) => v.trim()).filter(Boolean)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const visible = await fetchVisibleProblems(supabase, userId, projectIds)

    const courseMap = new Map<string, Set<string>>()
    for (const p of visible as any[]) {
      if (!p.ref_course) continue
      if (!courseMap.has(p.ref_course)) courseMap.set(p.ref_course, new Set())
      if (p.ref_session) courseMap.get(p.ref_course)!.add(p.ref_session)
    }

    const courses = Array.from(courseMap.entries()).map(([course, sessions]) => ({
      course,
      sessions: Array.from(sessions),
    }))

    // 회차를 과목별로 묶어 내려준다. 회차 번호는 과목이 달라도 겹칠 수 있어
    // 화면에서도 필터에서도 "과목 + 회차" 쌍으로 다뤄야 한다.
    const byProject: Record<string, string[]> = {}
    for (const p of visible as Array<{ project_id?: string; ref_session?: string | null }>) {
      if (!p.project_id || !p.ref_session) continue
      if (!byProject[p.project_id]) byProject[p.project_id] = []
      if (!byProject[p.project_id].includes(String(p.ref_session))) byProject[p.project_id].push(String(p.ref_session))
    }
    for (const key of Object.keys(byProject)) byProject[key].sort((a, b) => Number(a) - Number(b))

    return json({ courses, byProject })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
