import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSuperOrGeneralAdmin } from '../_shared/adminAuth.ts'

const MAX_STUDENTS_PER_BATCH = 200

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const actor = await requireSuperOrGeneralAdmin(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!actor) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { cohortId, students } = await req.json()
    if (!cohortId || !Array.isArray(students) || students.length === 0 || students.length > MAX_STUDENTS_PER_BATCH) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let created = 0
    const failed: Array<{ row: number; name: string; phone: string; reason: string }> = []

    for (let i = 0; i < students.length; i++) {
      const row = students[i]
      const name = String(row?.name ?? '').trim()
      const phone = String(row?.phone ?? '').trim()
      if (!name || !phone) {
        failed.push({ row: i + 1, name, phone, reason: 'missing_fields' })
        continue
      }

      try {
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
          failed.push({ row: i + 1, name, phone, reason: 'phone_already_registered' })
          continue
        }

        const { data: phoneEnc, error: encError } = await supabase.rpc('encrypt_phone', {
          phone,
          enc_key: Deno.env.get('PHONE_ENC_KEY')!,
        })
        if (encError) throw encError

        const { error: insertError } = await supabase.from('users').insert({
          phone_hash: phoneHash,
          phone_encrypted: phoneEnc,
          name,
          display_name: name,
          cohort_id: cohortId,
          password_hash: '',
          status: 'pending',
        })
        if (insertError) throw insertError
        created++
      } catch (rowErr) {
        console.error('bulk-create-students row failed', rowErr)
        failed.push({ row: i + 1, name, phone, reason: 'internal_error' })
      }
    }

    return new Response(JSON.stringify({ success: true, created, failed }), {
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
