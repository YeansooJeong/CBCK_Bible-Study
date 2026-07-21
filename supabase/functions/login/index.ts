import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createSessionToken } from '../_shared/session.ts'
import { checkRateLimit, clientIp } from '../_shared/rateLimit.ts'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, password } = await req.json()
    if (!phone || !password) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const allowed = await checkRateLimit(supabase, `login:${clientIp(req)}`, 30, 600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: phoneHash, error: hashError } = await supabase.rpc('hash_phone', {
      phone,
      secret: Deno.env.get('PHONE_HMAC_SECRET')!,
    })
    if (hashError) throw hashError

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, display_name, password_hash, status, failed_attempts, locked_until, is_admin')
      .eq('phone_hash', phoneHash)
      .maybeSingle()
    if (userError) throw userError

    const invalidResponse = () =>
      new Response(JSON.stringify({ error: 'invalid_credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    if (!user || user.status !== 'active') return invalidResponse()

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return new Response(JSON.stringify({ error: 'locked', lockedUntil: user.locked_until }), {
        status: 423,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const passwordMatches = bcrypt.compareSync(password, user.password_hash)

    if (!passwordMatches) {
      const nextFailedAttempts = user.failed_attempts + 1
      const shouldLock = nextFailedAttempts >= MAX_FAILED_ATTEMPTS
      await supabase
        .from('users')
        .update({
          failed_attempts: shouldLock ? 0 : nextFailedAttempts,
          locked_until: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null,
        })
        .eq('id', user.id)
      return invalidResponse()
    }

    await supabase
      .from('users')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('id', user.id)

    const token = await createSessionToken(
      user.id,
      Deno.env.get('SESSION_JWT_SECRET')!,
      undefined,
      user.is_admin ? 'general_admin' : undefined,
    )

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: { id: user.id, displayName: user.display_name, isAdmin: user.is_admin },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
