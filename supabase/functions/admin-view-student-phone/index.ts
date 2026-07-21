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

    const { studentId } = await req.json()
    if (!studentId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: student, error: fetchError } = await supabase
      .from('users')
      .select('phone_encrypted')
      .eq('id', studentId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!student) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: phone, error: decryptError } = await supabase.rpc('decrypt_phone', {
      phone_encrypted: student.phone_encrypted,
      enc_key: Deno.env.get('PHONE_ENC_KEY')!,
    })
    if (decryptError) throw decryptError

    const { error: auditError } = await supabase.from('access_audit_log').insert({
      actor_id: adminId,
      target_user_id: studentId,
      action: 'view_phone',
    })
    if (auditError) throw auditError

    return new Response(JSON.stringify({ success: true, phone }), {
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
