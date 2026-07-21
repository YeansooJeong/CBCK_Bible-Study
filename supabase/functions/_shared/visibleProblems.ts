// deno-lint-ignore-file no-explicit-any

// Mirrors the share_scope priority rule (problem-level overrides project-level,
// used consistently across list-problems/start-quiz-session/list-quiz-scopes).
export async function fetchVisibleProblems(supabase: any, userId: string, projectId?: string) {
  let query = supabase
    .from('problems')
    .select(
      'id, project_id, type, question, options, keywords, ref_course, ref_session, ref_location, share_scope, created_at, projects!inner(owner_id, share_scope)',
    )
    .limit(500)
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as any[]

  const { data: projectShareRows } = await supabase
    .from('project_shares')
    .select('project_id')
    .eq('target_user_id', userId)
  const sharedProjectIds = new Set((projectShareRows ?? []).map((r: any) => r.project_id))

  const { data: problemShareRows } = await supabase
    .from('problem_shares')
    .select('problem_id')
    .eq('target_user_id', userId)
  const sharedProblemIds = new Set((problemShareRows ?? []).map((r: any) => r.problem_id))

  return rows.filter((p) => {
    if (p.projects.owner_id === userId) return true
    if (p.share_scope === 'all') return true
    if (p.share_scope === 'selected') return sharedProblemIds.has(p.id)
    if (p.share_scope === 'inherit') {
      if (p.projects.share_scope === 'all') return true
      if (p.projects.share_scope === 'selected') return sharedProjectIds.has(p.project_id)
    }
    return false
  })
}
