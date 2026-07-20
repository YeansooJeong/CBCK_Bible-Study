import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { sessionId } = await req.json()
    if (!sessionId) return json({ error: 'missing_session_id' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: session } = await supabase.from('quiz_sessions').select('id, user_id, total').eq('id', sessionId).maybeSingle()
    if (!session || session.user_id !== userId) return json({ error: 'session_not_found' }, 404)
    const { count, error } = await supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('is_correct', true)
    if (error) throw error
    const correct = count ?? 0
    const total = session.total ?? 0
    const { error: updateError } = await supabase.from('quiz_sessions').update({ correct }).eq('id', sessionId)
    if (updateError) throw updateError
    return json({ success: true, total, correct, score: total ? Math.round((correct / total) * 100) : 0 })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
