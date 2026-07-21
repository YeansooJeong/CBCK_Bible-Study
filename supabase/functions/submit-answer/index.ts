import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { sessionId, problemId, userAnswer } = await req.json()
    if (!sessionId || !problemId || typeof userAnswer !== 'string') return json({ error: 'missing_fields' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: session } = await supabase.from('quiz_sessions').select('id, user_id').eq('id', sessionId).maybeSingle()
    if (!session || session.user_id !== userId) return json({ error: 'session_not_found' }, 404)
    const { data: problem } = await supabase.from('problems').select('type, answer, keywords').eq('id', problemId).maybeSingle()
    if (!problem) return json({ error: 'problem_not_found' }, 404)
    const normalized = userAnswer.trim().toLocaleLowerCase()
    const expected = String(problem.answer).trim().toLocaleLowerCase()
    const keywordList = String(problem.keywords ?? '').split(/[;,]/).map((v) => v.trim().toLocaleLowerCase()).filter(Boolean)
    const isCorrect = problem.type === 'short' && keywordList.length > 0
      ? keywordList.every((keyword) => normalized.includes(keyword))
      : normalized === expected
    const matchScore = isCorrect ? 1 : 0
    const answerRow = { session_id: sessionId, problem_id: problemId, user_answer: userAnswer, is_correct: isCorrect, match_score: matchScore }
    const { data: existing } = await supabase.from('session_answers').select('id').eq('session_id', sessionId).eq('problem_id', problemId).maybeSingle()
    const answerResult = existing
      ? await supabase.from('session_answers').update(answerRow).eq('id', existing.id)
      : await supabase.from('session_answers').insert(answerRow)
    if (answerResult.error) throw answerResult.error
    const { count } = await supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('is_correct', true)
    await supabase.from('quiz_sessions').update({ correct: count ?? 0 }).eq('id', sessionId)
    return json({ success: true, isCorrect, matchScore, answer: problem.answer })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
