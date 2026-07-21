import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req, Deno.env.get('SESSION_JWT_SECRET')!)
    if (!userId) return json({ error: 'unauthorized' }, 401)

    const url = new URL(req.url)
    const search = url.searchParams.get('q')?.trim().toLowerCase() || ''

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('status', 'active')
      .neq('id', userId)
      .order('display_name')
      .limit(100)
    if (error) throw error

    const users = (data ?? [])
      .filter((u) => !search || (u.display_name ?? '').toLowerCase().includes(search))
      .map((u) => ({ id: u.id, displayName: u.display_name }))

    return json({ users })
  } catch (error) { console.error(error); return json({ error: 'internal_error' }, 500) }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
