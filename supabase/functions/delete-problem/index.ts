import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/userAuth.ts'

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

    const { problemId } = await req.json()
    if (!problemId) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: problem, error: fetchError } = await supabase
      .from('problems')
      .select('id, author_id')
      .eq('id', problemId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!problem || problem.author_id !== userId) {
      return new Response(JSON.stringify({ error: 'not_found_or_forbidden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await supabase.from('problems').delete().eq('id', problemId)
    if (deleteError) throw deleteError

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
