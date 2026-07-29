import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { PARTIAL_THRESHOLD, CORRECT_THRESHOLD } from '../_shared/grading.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const { sessionId } = await req.json()
    if (!sessionId) return json({ error: 'missing_session_id' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: session } = await supabase.from('quiz_sessions').select('id, user_id, total').eq('id', sessionId).maybeSingle()
    if (!session || session.user_id !== userId) return json({ error: 'session_not_found' }, 404)
    const { data: answers, error } = await supabase
      .from('session_answers')
      .select('is_correct, match_score, problems(ref_course, ref_session)')
      .eq('session_id', sessionId)
    if (error) throw error

    const rows = (answers ?? []) as any[]
    const scoreOf = (row: any) => Number(row.match_score ?? (row.is_correct ? 1 : 0))
    const correct = rows.filter((a) => a.is_correct).length
    // 정답에는 못 미쳤지만 부분점수를 받은 문항 수. 결과 화면에서 따로 안내한다.
    const partial = rows.filter((a) => !a.is_correct && scoreOf(a) >= PARTIAL_THRESHOLD).length
    // 부분점수를 합산한 획득 점수. 최종 점수(%)는 이 값을 기준으로 계산한다.
    const earned = rows.reduce((sum, a) => sum + scoreOf(a), 0)
    const total = session.total ?? 0

    const breakdown = new Map<string, { refCourse: string; refSession: string; total: number; earned: number }>()
    for (const a of rows) {
      const refCourse = a.problems?.ref_course || '레퍼런스 미기재'
      const refSession = a.problems?.ref_session || ''
      const key = `${refCourse}::${refSession}`
      if (!breakdown.has(key)) breakdown.set(key, { refCourse, refSession, total: 0, earned: 0 })
      const entry = breakdown.get(key)!
      entry.total += 1
      entry.earned += scoreOf(a)
    }
    const weakAreas = Array.from(breakdown.values())
      .map((entry) => ({
        refCourse: entry.refCourse,
        refSession: entry.refSession,
        total: entry.total,
        correct: Math.round(entry.earned * 10) / 10,
        rate: entry.total ? Math.round((entry.earned / entry.total) * 100) : 0,
      }))
      .sort((a, b) => a.rate - b.rate)

    const { error: updateError } = await supabase
      .from('quiz_sessions')
      .update({ correct: Math.round(earned), status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (updateError) throw updateError
    return json({
      success: true,
      total,
      correct,
      partial,
      earned: Math.round(earned * 10) / 10,
      score: total ? Math.round((earned / total) * 100) : 0,
      weakAreas,
      thresholds: { correct: CORRECT_THRESHOLD, partial: PARTIAL_THRESHOLD },
    })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
