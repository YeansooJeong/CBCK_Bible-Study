import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { problemId, content, parentCommentId } = await req.json()
    if (!problemId || typeof content !== 'string' || !content.trim() || content.length > 2000) return json({ error: 'invalid_content' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: problem } = await supabase.from('problems').select('id, author_id, share_scope').eq('id', problemId).maybeSingle()
    if (!problem) return json({ error: 'problem_not_found' }, 404)
    if (!(await canView(supabase, userId, problem as any))) return json({ error: 'forbidden' }, 403)
    const { data, error } = await supabase.from('problem_comments').insert({ problem_id: problemId, author_id: userId, content: content.trim(), parent_comment_id: parentCommentId ?? null }).select('id, problem_id, author_id, content, parent_comment_id, created_at, updated_at').single()
    if (error) throw error
    return json({ success: true, comment: data })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

// 프로젝트는 항상 전체 공개 과목이므로 'inherit'는 'all'과 동일하게 취급한다.
async function canView(supabase: any, userId: string, problem: any) {
  if (problem.author_id === userId || problem.share_scope === 'all' || problem.share_scope === 'inherit') return true
  if (problem.share_scope === 'private') return false
  const { data } = await supabase.from('problem_shares').select('problem_id').eq('problem_id', problem.id).eq('target_user_id', userId).maybeSingle()
  return Boolean(data)
}
