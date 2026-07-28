import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'
import { requireAdmin } from '../_shared/adminAuth.ts'

// 프로젝트(과목)는 전체 공개 커리큘럼 엔티티이므로 학생·Super Admin·일반 Admin 누구나 전체 목록을 본다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secret = Deno.env.get('SESSION_JWT_SECRET')!
    const userId = await requireUser(req, secret)
    const adminId = userId ? null : await requireAdmin(req, secret)
    if (!userId && !adminId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, session_count, created_at, problems(count)')
      .order('created_at', { ascending: false })
    if (error) throw error

    const withCount = (projects ?? []).map((p) => {
      const { problems, ...rest } = p as typeof p & { problems: Array<{ count: number }> }
      return { ...rest, problem_count: problems?.[0]?.count ?? 0 }
    })

    return new Response(JSON.stringify({ projects: withCount }), {
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
