import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

const VALID_TYPES = ['mcq', 'short', 'bible']
const VALID_SHARE_SCOPES = ['inherit', 'private', 'all', 'selected']
const VALID_REF_KINDS = ['강의요약본', '강의영상']

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
      refSession,
      refKind,
      refDetail,
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
    if (refKind && !VALID_REF_KINDS.includes(refKind)) {
      return new Response(JSON.stringify({ error: 'invalid_ref_kind' }), {
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
      .select('id, author_id, project_id, projects!inner(session_count)')
      .eq('id', problemId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!problem || (problem as { author_id: string | null }).author_id !== userId) {
      return new Response(JSON.stringify({ error: 'not_found_or_forbidden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (refSession !== undefined && refSession !== null && refSession !== '') {
      const sessionCount = (problem as unknown as { projects: { session_count: number } }).projects.session_count
      const sessionNumber = Number(refSession)
      if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > sessionCount) {
        return new Response(JSON.stringify({ error: 'invalid_ref_session' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const updates: Record<string, unknown> = {}
    if (type !== undefined) updates.type = type
    if (question !== undefined) updates.question = question
    if (options !== undefined) updates.options = options
    if (answer !== undefined) updates.answer = answer
    if (keywords !== undefined) updates.keywords = keywords
    if (refSession !== undefined) updates.ref_session = refSession
    if (refKind !== undefined) updates.ref_kind = refKind
    if (refDetail !== undefined) updates.ref_detail = refDetail
    if (shareScope !== undefined) updates.share_scope = shareScope

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('problems').update(updates).eq('id', problemId)
      if (updateError) throw updateError

      try {
        const { data: current } = await supabase
          .from('problems')
          .select('question, ref_course, ref_session')
          .eq('id', problemId)
          .maybeSingle()
        await supabase.from('problem_audit_log').insert({
          problem_id: problemId,
          actor_id: userId,
          actor_role: 'student',
          action: 'update',
          question_snapshot: current?.question ?? null,
          ref_course: current?.ref_course ?? null,
          ref_session: current?.ref_session ?? null,
        })
      } catch (auditErr) {
        console.error('problem_audit_log insert failed', auditErr)
      }
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
