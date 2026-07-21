import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { problemId, bookmarked } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const result = bookmarked ? await supabase.from('problem_bookmarks').upsert({ user_id: userId, problem_id: problemId }) : await supabase.from('problem_bookmarks').delete().eq('user_id', userId).eq('problem_id', problemId)
    if (result.error) throw result.error
    return json({ success: true, bookmarked: Boolean(bookmarked) })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
