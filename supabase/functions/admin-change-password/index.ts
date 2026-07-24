import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/adminAuth.ts'

// Super Admin 본인 계정의 비밀번호 변경. 학생을 승격한 일반 Admin은 학생 로그인/비밀번호
// 체계를 그대로 쓰므로 이 엔드포인트 대상이 아니다(admins 테이블 계정 전용).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminId = await requireAdmin(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!adminId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'weak_password' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, password_hash')
      .eq('id', adminId)
      .maybeSingle()
    if (error) throw error
    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return new Response(JSON.stringify({ error: 'invalid_current_password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newHash = bcrypt.hashSync(newPassword, 10)
    const { error: updateError } = await supabase.from('admins').update({ password_hash: newHash }).eq('id', adminId)
    if (updateError) throw updateError

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
