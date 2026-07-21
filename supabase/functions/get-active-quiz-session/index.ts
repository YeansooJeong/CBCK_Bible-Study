import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, problem_ids, started_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session || !session.problem_ids?.length) return json({ session: null })

    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select('id, project_id, type, question, options, keywords, ref_course, ref_session, ref_kind, ref_detail, share_scope, created_at')
      .in('id', session.problem_ids)
    if (problemsError) throw problemsError

    const byId = new Map((problems ?? []).map((p: any) => [p.id, p]))
    const ordered = (session.problem_ids as string[]).map((id) => byId.get(id)).filter(Boolean)
    if (!ordered.length) return json({ session: null })

    const { data: answered, error: answeredError } = await supabase
      .from('session_answers')
      .select('problem_id')
      .eq('session_id', session.id)
    if (answeredError) throw answeredError
    const answeredIds = new Set((answered ?? []).map((a: any) => a.problem_id))

    const resumeIndex = ordered.findIndex((p: any) => !answeredIds.has(p.id))

    return json({
      session: {
        sessionId: session.id,
        problems: ordered,
        resumeIndex: resumeIndex === -1 ? ordered.length - 1 : resumeIndex,
      },
    })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
