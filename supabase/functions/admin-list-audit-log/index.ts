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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: logs, error } = await supabase
      .from('access_audit_log')
      .select('id, action, created_at, actor_id, target_user_id')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error

    const actorIds = Array.from(new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean)))
    const targetIds = Array.from(new Set((logs ?? []).map((l) => l.target_user_id).filter(Boolean)))

    const { data: admins } = actorIds.length
      ? await supabase.from('admins').select('id, login_id').in('id', actorIds)
      : { data: [] }
    const { data: students } = targetIds.length
      ? await supabase.from('users').select('id, display_name').in('id', targetIds)
      : { data: [] }

    const adminNameById = new Map((admins ?? []).map((a) => [a.id, a.login_id]))
    const studentNameById = new Map((students ?? []).map((s) => [s.id, s.display_name]))

    const entries = (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.created_at,
      actorName: adminNameById.get(l.actor_id) ?? '알 수 없음',
      targetName: studentNameById.get(l.target_user_id) ?? '알 수 없음',
    }))

    return new Response(JSON.stringify({ entries }), {
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
