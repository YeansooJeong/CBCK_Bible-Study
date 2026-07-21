import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSuperOrGeneralAdmin } from '../_shared/adminAuth.ts'

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

    const { projectId } = await req.json()
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
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
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!project) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { count, error: countError } = await supabase
      .from('problems')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
    if (countError) throw countError
    if (count && count > 0) {
      return new Response(JSON.stringify({ error: 'has_problems' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId)
    if (deleteError) throw deleteError

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
