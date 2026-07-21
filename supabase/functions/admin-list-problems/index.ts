import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSuperOrGeneralAdmin } from '../_shared/adminAuth.ts'

// 슈퍼/일반 admin이 시스템 전체 문제를 조회(모더레이션 목적).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const actor = await requireSuperOrGeneralAdmin(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!actor) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: problems, error } = await supabase
      .from('problems')
      .select(
        'id, project_id, type, question, options, answer, keywords, ref_course, ref_session, ref_location, share_scope, created_at, projects!inner(title, owner_id)',
      )
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error

    const ownerIds = Array.from(new Set((problems ?? []).map((p: any) => p.projects?.owner_id).filter(Boolean)))
    const { data: owners } = ownerIds.length
      ? await supabase.from('users').select('id, display_name').in('id', ownerIds)
      : { data: [] as Array<{ id: string; display_name: string }> }
    const ownerNameById = new Map((owners ?? []).map((u) => [u.id, u.display_name]))

    const rows = (problems ?? []).map((p: any) => ({
      id: p.id,
      projectId: p.project_id,
      projectTitle: p.projects?.title ?? '',
      ownerName: ownerNameById.get(p.projects?.owner_id) ?? '',
      type: p.type,
      question: p.question,
      options: p.options,
      answer: p.answer,
      keywords: p.keywords,
      refCourse: p.ref_course,
      refSession: p.ref_session,
      refLocation: p.ref_location,
      shareScope: p.share_scope,
      createdAt: p.created_at,
    }))

    return new Response(JSON.stringify({ problems: rows }), {
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
