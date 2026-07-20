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

    const { projectId, title, shareScope, sharedUserIds } = await req.json()
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (shareScope && !['private', 'all', 'selected'].includes(shareScope)) {
      return new Response(JSON.stringify({ error: 'invalid_share_scope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!project || project.owner_id !== userId) {
      return new Response(JSON.stringify({ error: 'not_found_or_forbidden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updates: Record<string, string> = {}
    if (title !== undefined) updates.title = title
    if (shareScope !== undefined) updates.share_scope = shareScope

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('projects').update(updates).eq('id', projectId)
      if (updateError) throw updateError
    }

    if (Array.isArray(sharedUserIds)) {
      await supabase.from('project_shares').delete().eq('project_id', projectId)
      if (sharedUserIds.length > 0) {
        const { error: shareError } = await supabase
          .from('project_shares')
          .insert(sharedUserIds.map((target_user_id: string) => ({ project_id: projectId, target_user_id })))
        if (shareError) throw shareError
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
