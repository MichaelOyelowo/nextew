import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Missing auth', { status: 401, headers: corsHeaders })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { session_id, revoke_all_others } = await req.json()

    if (revoke_all_others) {
      // Delete all sessions except current one from our tracking table
      await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id)
        .neq('session_id', session_id)
    } else {
      // Delete specific session
      await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('session_id', session_id)
        .eq('user_id', user.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})