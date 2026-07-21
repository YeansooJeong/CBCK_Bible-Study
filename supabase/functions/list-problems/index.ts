import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

// 이 과목(프로젝트)에 내가 등록한 문제 목록(관리용). 실제 학습/풀이 시 노출되는
// 전체 공유 문제 조회는 start-quiz-session이 _shared/visibleProblems.ts로 별도 처리한다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const projectId = url.searchParams.get('projectId')
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'missing_project_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: problems, error } = await supabase
      .from('problems')
      .select('*')
      .eq('project_id', projectId)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error

    return new Response(JSON.stringify({ problems: problems ?? [] }), {
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
