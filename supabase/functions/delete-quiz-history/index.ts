import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

// 사용자가 "이번 주 학습" 통계를 직접 리셋하고 싶을 때 본인의 퀴즈 세션 전체를 삭제한다.
// session_answers는 quiz_sessions에 on delete cascade로 걸려 있어 함께 삭제된다.
// 북마크·문제·댓글 등 다른 데이터는 건드리지 않는다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error, count } = await supabase.from('quiz_sessions').delete({ count: 'exact' }).eq('user_id', userId)
    if (error) throw error
    return json({ success: true, deleted: count ?? 0 })
  } catch (error) {
    console.error(error)
    return json({ error: 'internal_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
