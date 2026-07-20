import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

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

    const {
      problemId,
      type,
      question,
      options,
      answer,
      keywords,
      refCourse,
      refSession,
      refLocation,
      shareScope,
      sharedUserIds,
    } = await req.json()

    if (!problemId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (type && !VALID_TYPES.includes(type)) {
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

    const { data: problem, error: fetchError } = await supabase
      .from('problems')
      .select('id, project_id, projects!inner(owner_id)')
      .eq('id', problemId)
      .maybeSingle()
    if (fetchError) throw fetchError
    const owner = (problem as unknown as { projects: { owner_id: string } } | null)?.projects?.owner_id
    if (!problem || owner !== userId) {
      return new Response(JSON.stringify({ error: 'not_found_or_forbidden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updates: Record<string, unknown> = {}
    if (type !== undefined) updates.type = type
    if (question !== undefined) updates.question = question
    if (options !== undefined) updates.options = options
    if (answer !== undefined) updates.answer = answer
    if (keywords !== undefined) updates.keywords = keywords
    if (refCourse !== undefined) updates.ref_course = refCourse
    if (refSession !== undefined) updates.ref_session = refSession
    if (refLocation !== undefined) updates.ref_location = refLocation
    if (shareScope !== undefined) updates.share_scope = shareScope

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('problems').update(updates).eq('id', problemId)
      if (updateError) throw updateError
    }

    if (Array.isArray(sharedUserIds)) {
      await supabase.from('problem_shares').delete().eq('problem_id', problemId)
      if (sharedUserIds.length > 0) {
        const { error: shareError } = await supabase
          .from('problem_shares')
          .insert(sharedUserIds.map((target_user_id: string) => ({ problem_id: problemId, target_user_id })))
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
