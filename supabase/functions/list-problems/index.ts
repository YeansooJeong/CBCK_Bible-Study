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

    const url = new URL(req.url)
    const projectId = url.searchParams.get('projectId')
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'missing_project_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id, share_scope')
      .eq('id', projectId)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isOwner = project.owner_id === userId

    if (isOwner) {
      const { data: problems, error } = await supabase
        .from('problems')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ problems, isOwner: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: projectShare } = await supabase
      .from('project_shares')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('target_user_id', userId)
      .maybeSingle()
    const projectVisible = project.share_scope === 'all' || (project.share_scope === 'selected' && !!projectShare)

    const { data: problemShareRows } = await supabase
      .from('problem_shares')
      .select('problem_id')
      .eq('target_user_id', userId)
    const sharedProblemIds = (problemShareRows ?? []).map((r) => r.problem_id)

    let query = supabase.from('problems').select('*').eq('project_id', projectId)
    const orClauses = ['share_scope.eq.all']
    if (projectVisible) orClauses.push('share_scope.eq.inherit')
    if (sharedProblemIds.length > 0) {
      orClauses.push(`and(share_scope.eq.selected,id.in.(${sharedProblemIds.join(',')}))`)
    }
    query = query.or(orClauses.join(','))

    const { data: problems, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    return new Response(JSON.stringify({ problems, isOwner: false }), {
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
