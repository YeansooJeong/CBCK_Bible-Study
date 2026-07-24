import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

const MAX_PROBLEMS_PER_PROJECT = 2000
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

    const { projectId, type, question, options, answer, keywords, refSession, refKind, refDetail, shareScope, sharedUserIds } =
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
    if (type === 'mcq' && (!options || ['1', '2', '3', '4'].some((k) => !String(options[k] ?? '').trim()))) {
      return new Response(JSON.stringify({ error: 'incomplete_options' }), {
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title, session_count')
      .eq('id', projectId)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (refSession !== undefined && refSession !== null && refSession !== '') {
      const sessionNumber = Number(refSession)
      if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > project.session_count) {
        return new Response(JSON.stringify({ error: 'invalid_ref_session' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
        author_id: userId,
        type,
        question,
        options: options ?? null,
        answer,
        keywords: keywords ?? null,
        ref_course: project.title,
        ref_session: refSession ?? null,
        ref_kind: refKind ?? null,
        ref_detail: refDetail ?? null,
        share_scope: shareScope ?? 'inherit',
      })
      .select('*')
      .single()
    if (error) throw error

    if (Array.isArray(sharedUserIds) && sharedUserIds.length > 0) {
      const { error: shareError } = await supabase
        .from('problem_shares')
        .insert(sharedUserIds.map((target_user_id: string) => ({ problem_id: problem.id, target_user_id })))
      if (shareError) throw shareError
    }

    try {
      await supabase.from('problem_audit_log').insert({
        problem_id: problem.id,
        actor_id: userId,
        actor_role: 'student',
        action: 'create',
        question_snapshot: problem.question,
        ref_course: problem.ref_course,
        ref_session: problem.ref_session,
      })
    } catch (auditErr) {
      console.error('problem_audit_log insert failed', auditErr)
    }

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
