import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

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
      .select('is_correct, problems(ref_course, ref_session)')
      .eq('session_id', sessionId)
    if (error) throw error

    const correct = (answers ?? []).filter((a: any) => a.is_correct).length
    const total = session.total ?? 0

    const breakdown = new Map<string, { refCourse: string; refSession: string; total: number; correct: number }>()
    for (const a of (answers ?? []) as any[]) {
      const refCourse = a.problems?.ref_course || '레퍼런스 미기재'
      const refSession = a.problems?.ref_session || ''
      const key = `${refCourse}::${refSession}`
      if (!breakdown.has(key)) breakdown.set(key, { refCourse, refSession, total: 0, correct: 0 })
      const entry = breakdown.get(key)!
      entry.total += 1
      if (a.is_correct) entry.correct += 1
    }
    const weakAreas = Array.from(breakdown.values())
      .map((entry) => ({ ...entry, rate: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
      .sort((a, b) => a.rate - b.rate)

    const { error: updateError } = await supabase
      .from('quiz_sessions')
      .update({ correct, status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (updateError) throw updateError
    return json({ success: true, total, correct, score: total ? Math.round((correct / total) * 100) : 0, weakAreas })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
