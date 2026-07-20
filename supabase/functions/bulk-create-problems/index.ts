import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

const VALID_TYPES = ['mcq', 'short', 'bible']
const MAX_PROBLEMS_PER_PROJECT = 100

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { projectId, problems } = await req.json()
    if (!projectId || !Array.isArray(problems) || problems.length === 0 || problems.length > 100) {
      return json({ error: 'invalid_payload' }, 400)
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: project } = await supabase.from('projects').select('owner_id').eq('id', projectId).maybeSingle()
    if (!project || project.owner_id !== userId) return json({ error: 'not_found_or_forbidden' }, 404)
    const { count } = await supabase.from('problems').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
    if ((count ?? 0) + problems.length > MAX_PROBLEMS_PER_PROJECT) return json({ error: 'project_full' }, 400)
    const rows = problems.map((p: any) => {
      if (!VALID_TYPES.includes(p.type) || !p.question || !p.answer) throw new Error('invalid_problem')
      return { project_id: projectId, type: p.type, question: p.question, options: p.options ?? null, answer: p.answer, keywords: p.keywords ?? null, ref_course: p.refCourse ?? null, ref_session: p.refSession ?? null, ref_location: p.refLocation ?? null, share_scope: 'inherit' }
    })
    const { error } = await supabase.from('problems').insert(rows)
    if (error) throw error
    return json({ success: true, created: rows.length })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error && err.message === 'invalid_problem' ? 'invalid_problem' : 'internal_error' }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
