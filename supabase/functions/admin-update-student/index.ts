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

    const { studentId, name, displayName, cohortId, resetToPending } = await req.json()
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

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (displayName !== undefined) updates.display_name = displayName
    if (cohortId !== undefined) updates.cohort_id = cohortId
    if (resetToPending) {
      updates.status = 'pending'
      updates.password_hash = ''
      updates.failed_attempts = 0
      updates.locked_until = null
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'no_updates' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: student, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', studentId)
      .select('id, name, display_name, status, cohort_id, created_at')
      .maybeSingle()
    if (error) throw error
    if (!student) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
