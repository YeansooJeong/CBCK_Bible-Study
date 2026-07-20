import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { projectId, count: requestedCount } = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(Number(requestedCount) || 10, 1), 50)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    let query = supabase.from('problems').select('id, project_id, type, question, options, keywords, ref_course, ref_session, ref_location, share_scope, created_at, projects!inner(owner_id, share_scope)').limit(500)
    if (projectId) query = query.eq('project_id', projectId)
    const { data, error } = await query
    if (error) throw error
    const visible = (data ?? []).filter((p: any) => p.projects.owner_id === userId || p.share_scope === 'all' || (p.share_scope === 'inherit' && p.projects.share_scope === 'all'))
    const selected = visible.sort(() => Math.random() - 0.5).slice(0, count)
    if (!selected.length) return json({ error: 'no_available_problems' }, 400)
    const { data: session, error: sessionError } = await supabase.from('quiz_sessions').insert({ user_id: userId, total: selected.length }).select('id').single()
    if (sessionError) throw sessionError
    return json({ success: true, sessionId: session.id, problems: selected.map(({ projects: _projects, ...problem }: any) => problem) })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
