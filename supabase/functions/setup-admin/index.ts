import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { loginId, password } = await req.json()
    if (loginId !== 'admin' || typeof password !== 'string' || password.length < 8) return json({ error: 'invalid_setup' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { count, error: countError } = await supabase.from('admins').select('id', { count: 'exact', head: true })
    if (countError) throw countError
    if ((count ?? 0) > 0) return json({ error: 'admin_already_exists' }, 409)
    const { error } = await supabase.from('admins').insert({ login_id: 'admin', password_hash: bcrypt.hashSync(password, 10) })
    if (error) throw error
    return json({ success: true })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
