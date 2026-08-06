import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

const VALID_TYPES = ['mcq', 'short', 'bible']
const VALID_REF_KINDS = ['강의요약본', '강의영상']
const MAX_PROBLEMS_PER_PROJECT = 2000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { projectId, problems } = await req.json()
    if (!projectId || !Array.isArray(problems) || problems.length === 0) {
      return json({ error: 'invalid_payload' }, 400)
    }
    // 개수 초과는 따로 알려야 업로드 화면에서 "나눠서 올려주세요"로 안내할 수 있다.
    if (problems.length > 100) return json({ error: 'too_many_problems', limit: 100 }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: project } = await supabase.from('projects').select('id, title, session_count').eq('id', projectId).maybeSingle()
    if (!project) return json({ error: 'not_found' }, 404)
    const { count } = await supabase.from('problems').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
    if ((count ?? 0) + problems.length > MAX_PROBLEMS_PER_PROJECT) return json({ error: 'project_full' }, 400)
    const rows = problems.map((p: any, index: number) => {
      // 어느 문제가 왜 거절됐는지 화면에서 안내할 수 있도록 위치와 사유를 함께 던진다.
      const reject = (reason: string) => { throw new InvalidProblem(index, reason) }
      if (!VALID_TYPES.includes(p.type) || !String(p.question ?? '').trim() || !String(p.answer ?? '').trim()) reject('basic')
      if (p.type === 'mcq' && (!p.options || ['1', '2', '3', '4'].some((k) => !String(p.options[k] ?? '').trim()))) reject('options')
      if (p.refKind && !VALID_REF_KINDS.includes(p.refKind)) reject('ref_kind')
      if (p.refSession) {
        const sessionNumber = Number(p.refSession)
        if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > project.session_count) {
          reject('ref_session')
        }
      }
      return {
        project_id: projectId,
        author_id: userId,
        type: p.type,
        question: p.question,
        options: p.options ?? null,
        answer: p.answer,
        keywords: p.keywords ?? null,
        ref_course: project.title,
        ref_session: p.refSession ?? null,
        ref_kind: p.refKind ?? null,
        ref_detail: p.refDetail ?? null,
        share_scope: 'inherit',
      }
    })
    const { error } = await supabase.from('problems').insert(rows)
    if (error) throw error

    try {
      await supabase.from('problem_audit_log').insert({
        problem_id: null,
        actor_id: userId,
        actor_role: 'student',
        action: 'create',
        question_snapshot: `CSV 일괄 생성 (${rows.length}개)`,
        ref_course: project.title,
        ref_session: null,
      })
    } catch (auditErr) {
      console.error('problem_audit_log insert failed', auditErr)
    }

    return json({ success: true, created: rows.length })
  } catch (err) {
    console.error(err)
    if (err instanceof InvalidProblem) return json({ error: 'invalid_problem', index: err.index, reason: err.reason }, 400)
    return json({ error: 'internal_error' }, 400)
  }
})

class InvalidProblem extends Error {
  index: number
  reason: string
  constructor(index: number, reason: string) {
    super('invalid_problem')
    this.index = index
    this.reason = reason
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
