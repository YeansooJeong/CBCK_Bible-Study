// deno-lint-ignore-file no-explicit-any

// 프로젝트는 항상 전체 공개 커리큘럼 과목이므로 문제 단위 share_scope만 본다.
// 'inherit'는 더 이상 프로젝트 단위 공유를 참조할 필요가 없어 'all'과 동일하게 취급한다.
export async function fetchVisibleProblems(supabase: any, userId: string, projectId?: string) {
  let query = supabase
    .from('problems')
    .select(
      'id, project_id, author_id, type, question, options, keywords, ref_course, ref_session, ref_kind, ref_detail, share_scope, created_at',
    )
    .limit(500)
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as any[]

  const { data: problemShareRows } = await supabase
    .from('problem_shares')
    .select('problem_id')
    .eq('target_user_id', userId)
  const sharedProblemIds = new Set((problemShareRows ?? []).map((r: any) => r.problem_id))

  return rows.filter((p) => {
    if (p.author_id === userId) return true
    if (p.share_scope === 'all' || p.share_scope === 'inherit') return true
    if (p.share_scope === 'selected') return sharedProblemIds.has(p.id)
    return false
  })
}
