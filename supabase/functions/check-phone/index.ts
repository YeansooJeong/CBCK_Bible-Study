import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit, clientIp } from '../_shared/rateLimit.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone } = await req.json()
    if (!phone || typeof phone !== 'string') {
      return new Response(JSON.stringify({ error: 'phone_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const allowed = await checkRateLimit(supabase, `check-phone:${clientIp(req)}`, 30, 600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: hashData, error: hashError } = await supabase.rpc('hash_phone', {
      phone,
      secret: Deno.env.get('PHONE_HMAC_SECRET')!,
    })
    if (hashError) throw hashError

    const { data: user, error } = await supabase
      .from('users')
      .select('status')
      .eq('phone_hash', hashData)
      .maybeSingle()
    if (error) throw error

    if (!user) {
      return new Response(JSON.stringify({ registered: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ registered: true, status: user.status }), {
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
