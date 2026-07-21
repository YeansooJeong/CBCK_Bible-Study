// deno-lint-ignore-file no-explicit-any
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
  return (data ?? []).filter(
    (p: any) =>
      p.projects.owner_id === userId ||
      p.share_scope === 'all' ||
      (p.share_scope === 'inherit' && p.projects.share_scope === 'all'),
  )
}
