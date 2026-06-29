import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function trackSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Extract session_id from JWT claims
  const payload = JSON.parse(atob(session.access_token.split('.')[1]))
  const sessionId = payload.session_id
  if (!sessionId) return

  await fetch(`${supabaseUrl}/functions/v1/track-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  })
}