import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/adminAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminId = await requireAdmin(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!adminId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { name, phone, cohortId, displayName } = await req.json()
    if (!name || !phone || !cohortId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: phoneHash, error: hashError } = await supabase.rpc('hash_phone', {
      phone,
      secret: Deno.env.get('PHONE_HMAC_SECRET')!,
    })
    if (hashError) throw hashError

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone_hash', phoneHash)
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ error: 'phone_already_registered' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: phoneEnc, error: encError } = await supabase.rpc('encrypt_phone', {
      phone,
      enc_key: Deno.env.get('PHONE_ENC_KEY')!,
    })
    if (encError) throw encError

    const { data: student, error: insertError } = await supabase
      .from('users')
      .insert({
        phone_hash: phoneHash,
        phone_encrypted: phoneEnc,
        name,
        display_name: displayName || name,
        cohort_id: cohortId,
        password_hash: '',
        status: 'pending',
      })
      .select('id, name, display_name, status')
      .single()
    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true, student }), {
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
