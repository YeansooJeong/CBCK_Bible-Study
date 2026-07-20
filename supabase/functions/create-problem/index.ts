import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

const MAX_PROBLEMS_PER_PROJECT = 100
const VALID_TYPES = ['mcq', 'short', 'bible']
const VALID_SHARE_SCOPES = ['inherit', 'private', 'all', 'selected']

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

    const { projectId, type, question, options, answer, keywords, refCourse, refSession, refLocation, shareScope } =
      await req.json()

    if (!projectId || !type || !question || !answer) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: 'invalid_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (shareScope && !VALID_SHARE_SCOPES.includes(shareScope)) {
      return new Response(JSON.stringify({ error: 'invalid_share_scope' }), {
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
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project || project.owner_id !== userId) {
      return new Response(JSON.stringify({ error: 'not_found_or_forbidden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { count, error: countError } = await supabase
      .from('problems')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_PROBLEMS_PER_PROJECT) {
      return new Response(JSON.stringify({ error: 'project_full' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: problem, error } = await supabase
      .from('problems')
      .insert({
        project_id: projectId,
        type,
        question,
        options: options ?? null,
        answer,
        keywords: keywords ?? null,
        ref_course: refCourse ?? null,
        ref_session: refSession ?? null,
        ref_location: refLocation ?? null,
        share_scope: shareScope ?? 'inherit',
      })
      .select('*')
      .single()
    if (error) throw error

    return new Response(JSON.stringify({ success: true, problem }), {
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
