import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { gradeAnswer } from '../_shared/grading.ts'

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

    const { score, isCorrect, verdict } = gradeAnswer(problem.type, userAnswer, String(problem.answer), problem.keywords)

    const answerRow = { session_id: sessionId, problem_id: problemId, user_answer: userAnswer, is_correct: isCorrect, match_score: score }
    const { data: existing } = await supabase.from('session_answers').select('id').eq('session_id', sessionId).eq('problem_id', problemId).maybeSingle()
    const answerResult = existing
      ? await supabase.from('session_answers').update(answerRow).eq('id', existing.id)
      : await supabase.from('session_answers').insert(answerRow)
    if (answerResult.error) throw answerResult.error

    // 부분점수를 반영하려면 정답 개수가 아니라 획득 점수의 합계로 집계해야 한다.
    // quiz_sessions.correct는 int 컬럼이라 반올림해 저장하고, 정확한 값은 finish-quiz-session이 다시 계산한다.
    const { data: scored } = await supabase.from('session_answers').select('match_score').eq('session_id', sessionId)
    const earned = (scored ?? []).reduce((sum: number, row: { match_score: number | null }) => sum + Number(row.match_score ?? 0), 0)
    await supabase.from('quiz_sessions').update({ correct: Math.round(earned) }).eq('id', sessionId)

    return json({ success: true, isCorrect, verdict, score, matchScore: score, answer: problem.answer })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
