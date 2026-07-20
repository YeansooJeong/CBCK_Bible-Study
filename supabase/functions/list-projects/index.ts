import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: owned, error: ownedError } = await supabase
      .from('projects')
      .select('id, owner_id, title, share_scope, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    if (ownedError) throw ownedError

    const { data: sharedAll, error: sharedAllError } = await supabase
      .from('projects')
      .select('id, owner_id, title, share_scope, created_at')
      .eq('share_scope', 'all')
      .neq('owner_id', userId)
    if (sharedAllError) throw sharedAllError

    const { data: shareRows, error: shareRowsError } = await supabase
      .from('project_shares')
      .select('project_id')
      .eq('target_user_id', userId)
    if (shareRowsError) throw shareRowsError

    let sharedSelected: typeof owned = []
    const sharedProjectIds = (shareRows ?? []).map((r) => r.project_id)
    if (sharedProjectIds.length > 0) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, owner_id, title, share_scope, created_at')
        .in('id', sharedProjectIds)
        .eq('share_scope', 'selected')
      if (error) throw error
      sharedSelected = data ?? []
    }

    const seen = new Set<string>()
    const projects = [...(owned ?? []), ...(sharedAll ?? []), ...sharedSelected].filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    return new Response(
      JSON.stringify({
        projects: projects.map((p) => ({ ...p, isOwner: p.owner_id === userId })),
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
