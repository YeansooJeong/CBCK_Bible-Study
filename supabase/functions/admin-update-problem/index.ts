import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSuperOrGeneralAdmin } from '../_shared/adminAuth.ts'

const VALID_TYPES = ['mcq', 'short', 'bible']

// 슈퍼/일반 admin의 문제 모더레이션(소유권 무관하게 내용 수정).
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

    const { problemId, type, question, options, answer, keywords, refCourse, refSession, refLocation } = await req.json()
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const updates: Record<string, unknown> = {}
    if (type !== undefined) updates.type = type
    if (question !== undefined) updates.question = question
    if (options !== undefined) updates.options = options
    if (answer !== undefined) updates.answer = answer
    if (keywords !== undefined) updates.keywords = keywords
    if (refCourse !== undefined) updates.ref_course = refCourse
    if (refSession !== undefined) updates.ref_session = refSession
    if (refLocation !== undefined) updates.ref_location = refLocation

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'no_updates' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: problem, error } = await supabase
      .from('problems')
      .update(updates)
      .eq('id', problemId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!problem) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
