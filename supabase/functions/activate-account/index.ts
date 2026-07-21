import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit, clientIp } from '../_shared/rateLimit.ts'

// 이름/직함류: 앞뒤 공백·존칭이 붙어도 핵심 키워드가 서로 포함되면 일치로 간주
function fuzzyTextMatch(input: string, stored: string): boolean {
  const a = input.replace(/\s+/g, '')
  const b = stored.replace(/\s+/g, '')
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

// 연도류: "1611", "1611년", "1611년도" 등 숫자만 뽑아 핵심 숫자가 포함되는지 확인
function fuzzyYearMatch(input: string, stored: string): boolean {
  const digitsIn = input.replace(/\D+/g, '')
  const digitsStored = stored.replace(/\D+/g, '')
  if (!digitsStored) return false
  return digitsIn.includes(digitsStored)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, name, staffName, leaderName, kjvYear, password } = await req.json()
    if (!phone || !name || !staffName || !leaderName || !kjvYear || !password) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return new Response(JSON.stringify({ error: 'weak_password' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const allowed = await checkRateLimit(supabase, `activate-account:${clientIp(req)}`, 10, 600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: phoneHash, error: hashError } = await supabase.rpc('hash_phone', {
      phone,
      secret: Deno.env.get('PHONE_HMAC_SECRET')!,
    })
    if (hashError) throw hashError

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, status, cohort_id, cohorts(staff_name, leader_name, kjv_year)')
      .eq('phone_hash', phoneHash)
      .maybeSingle()
    if (userError) throw userError

    if (!user) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (user.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'already_active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (user.name !== name) {
      return new Response(JSON.stringify({ error: 'name_mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cohort = Array.isArray(user.cohorts) ? user.cohorts[0] : user.cohorts
    if (
      !cohort ||
      !fuzzyTextMatch(staffName, cohort.staff_name) ||
      !fuzzyTextMatch(leaderName, cohort.leader_name) ||
      !fuzzyYearMatch(kjvYear, cohort.kjv_year)
    ) {
      return new Response(JSON.stringify({ error: 'auth_question_mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const passwordHash = bcrypt.hashSync(password, 10)

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, status: 'active' })
      .eq('id', user.id)
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
