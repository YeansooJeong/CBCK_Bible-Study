import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSuperOrGeneralAdmin } from '../_shared/adminAuth.ts'

// 슈퍼/일반 admin의 문제 모더레이션(소유권 무관하게 삭제).
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

    const { problemId } = await req.json()
    if (!problemId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: problem } = await supabase
      .from('problems')
      .select('id, question, ref_course, ref_session')
      .eq('id', problemId)
      .maybeSingle()

    const { error } = await supabase.from('problems').delete().eq('id', problemId)
    if (error) throw error

    try {
      await supabase.from('problem_audit_log').insert({
        problem_id: problemId,
        actor_id: actor.actorId,
        actor_role: actor.isSuperAdmin ? 'admin' : 'general_admin',
        action: 'delete',
        question_snapshot: problem?.question ?? null,
        ref_course: problem?.ref_course ?? null,
        ref_session: problem?.ref_session ?? null,
      })
    } catch (auditErr) {
      console.error('problem_audit_log insert failed', auditErr)
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
