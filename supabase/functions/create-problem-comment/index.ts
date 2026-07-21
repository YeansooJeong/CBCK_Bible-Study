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
    const { data: problem } = await supabase.from('problems').select('id').eq('id', problemId).maybeSingle()
    if (!problem) return json({ error: 'problem_not_found' }, 404)
    const { data, error } = await supabase.from('problem_comments').insert({ problem_id: problemId, author_id: userId, content: content.trim(), parent_comment_id: parentCommentId ?? null }).select('id, problem_id, author_id, content, parent_comment_id, created_at, updated_at').single()
    if (error) throw error
    return json({ success: true, comment: data })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
