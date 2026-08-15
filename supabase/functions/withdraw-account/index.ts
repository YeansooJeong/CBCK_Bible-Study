import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

// 회원 탈퇴. 개인정보는 즉시 파기하고, 그동안 만든 문제는 학습 자료로 남긴다.
// 계정 행을 지우면 problems.author_id의 on delete cascade로 문제까지 사라지므로
// 행은 남기고 개인정보만 지우는 공통 함수를 쓴다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)

    const { reason, reasonDetail } = await req.json().catch(() => ({}))
    const trimmedReason = String(reason ?? '').trim()
    if (!trimmedReason) return json({ error: 'reason_required' }, 400)
    const detail = String(reasonDetail ?? '').trim().slice(0, 300)
    const fullReason = detail ? `${trimmedReason}: ${detail}` : trimmedReason

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 탈퇴 사유는 파기 전에 기록해 둔다.
    const { error: markError } = await supabase
      .from('users')
      .update({ withdrawn_at: new Date().toISOString(), withdrawal_reason: fullReason })
      .eq('id', userId)
      .is('purged_at', null)
    if (markError) throw markError

    const { error: purgeError } = await supabase.rpc('purge_user_personal_data', {
      target_id: userId,
      reason: fullReason,
    })
    if (purgeError) throw purgeError

    try {
      await supabase.from('privacy_purge_log').insert({ purged_count: 1, reason: `회원 탈퇴 (${fullReason})` })
    } catch (logError) {
      console.error('privacy_purge_log insert failed', logError)
    }

    return json({ success: true })
  } catch (error) {
    console.error(error)
    return json({ error: 'internal_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
