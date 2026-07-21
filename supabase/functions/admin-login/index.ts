import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createSessionToken } from '../_shared/session.ts'
import { checkRateLimit, clientIp } from '../_shared/rateLimit.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { loginId, password } = await req.json()
    if (!loginId || !password) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const allowed = await checkRateLimit(supabase, `admin-login:${clientIp(req)}`, 10, 600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, password_hash')
      .eq('login_id', loginId)
      .maybeSingle()
    if (error) throw error

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return new Response(JSON.stringify({ error: 'invalid_credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = await createSessionToken(admin.id, Deno.env.get('SESSION_JWT_SECRET')!, 60 * 60 * 8, 'admin')

    return new Response(JSON.stringify({ success: true, token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
