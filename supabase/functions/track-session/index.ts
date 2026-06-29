import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseUserAgent(ua: string) {
  const browser =
    ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome' :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari' :
    ua.includes('Edg') ? 'Edge' :
    ua.includes('OPR') || ua.includes('Opera') ? 'Opera' : 'Unknown Browser'

  const os =
    ua.includes('Windows NT 10') ? 'Windows 10' :
    ua.includes('Windows NT 11') ? 'Windows 11' :
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Android 13') ? 'Android 13' :
    ua.includes('Android 12') ? 'Android 12' :
    ua.includes('Android 11') ? 'Android 11' :
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone') ? 'iOS' :
    ua.includes('iPad') ? 'iPadOS' :
    ua.includes('Mac OS X') ? 'macOS' :
    ua.includes('Linux') ? 'Linux' : 'Unknown OS'

  const deviceType =
    ua.includes('Mobile') || ua.includes('Android') && !ua.includes('Tablet') ? 'Mobile' :
    ua.includes('iPad') || ua.includes('Tablet') ? 'Tablet' : 'Desktop'

  return { browser, os, deviceType }
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

    const { session_id, refresh_token } = await req.json()
    const userAgent = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'Unknown'

    const { browser, os, deviceType } = parseUserAgent(userAgent)

    // Get location from IP
    let city = 'Unknown'
    let country = 'Unknown'
    try {
      if (ip && ip !== 'Unknown' && ip !== '127.0.0.1') {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`)
        const geo = await geoRes.json()
        city = geo.city || 'Unknown'
        country = geo.country_name || 'Unknown'
      }
    } catch {
      // Geo lookup failed — non-critical
    }

    // Upsert so re-logins on same device update last_active
    await supabaseAdmin.from('user_sessions').upsert({
      user_id: user.id,
      session_id,
      refresh_token,
      browser,
      os,
      device_type: deviceType,
      ip_address: ip,
      city,
      country,
      last_active: new Date().toISOString(),
    }, { onConflict: 'session_id' })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error(err)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})