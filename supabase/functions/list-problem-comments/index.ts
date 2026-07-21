import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const problemId = new URL(req.url).searchParams.get('problemId')
    if (!problemId) return json({ error: 'missing_problem_id' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: problem } = await supabase.from('problems').select('id, share_scope, projects!inner(owner_id, share_scope)').eq('id', problemId).maybeSingle()
    if (!problem) return json({ error: 'problem_not_found' }, 404)
    const visible = await canView(supabase, userId, problem as any)
    if (!visible) return json({ error: 'forbidden' }, 403)
    const { data, error } = await supabase.from('problem_comments').select('id, problem_id, author_id, content, parent_comment_id, created_at, updated_at, users(display_name)').eq('problem_id', problemId).order('created_at')
    if (error) throw error
    return json({ comments: data ?? [] })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

async function canView(supabase: any, userId: string, problem: any) {
  if (problem.projects.owner_id === userId || problem.share_scope === 'all') return true
  if (problem.share_scope === 'private') return false
  if (problem.share_scope === 'inherit' && problem.projects.share_scope === 'all') return true
  const { data } = await supabase.from('problem_shares').select('problem_id').eq('problem_id', problem.id).eq('target_user_id', userId).maybeSingle()
  return Boolean(data)
}
