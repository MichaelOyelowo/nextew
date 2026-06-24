import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPECTED_AMOUNT = 50000

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySignature(rawBody: string, signature: string, secret: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  return bufferToHex(mac) === signature
}

// FIXED: Parameter is named 'email', and we strictly use 'email' inside.
async function sendReceipt(email: string, reference: string, amount: number) {
  console.log(`Preparing receipt email for: ${email}`)

  const date = new Date().toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
  const amountFormatted = `₦${(amount / 100).toLocaleString()}`

  // YOUR EXACT ORIGINAL HTML RECEIPT UI
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8faff;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(90deg,#22d3ee,#a855f7);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Next<span style="opacity:0.85;">ew</span>
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Payment Receipt</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#a855f7);margin:0 auto;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;line-height:56px;display:block;color:#fff;">✓</span>
              </div>
              <h2 style="margin:16px 0 4px;font-size:20px;font-weight:700;color:#0f172a;">Payment successful</h2>
              <p style="margin:0;color:#64748b;font-size:14px;">Your upscale access has been unlocked.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:13px;color:#64748b;">Amount paid</td><td align="right" style="font-size:14px;font-weight:700;color:#0f172a;">${amountFormatted}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:13px;color:#64748b;">Date</td><td align="right" style="font-size:14px;color:#0f172a;">${date}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:13px;color:#64748b;">Reference</td><td align="right" style="font-size:13px;color:#94a3b8;font-family:monospace;">${reference}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:13px;color:#64748b;">Access type</td><td align="right" style="font-size:14px;color:#0f172a;">Lifetime — pay once</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <a href="https://nextew.vercel.app/upscale" style="display:inline-block;background:linear-gradient(90deg,#22d3ee,#a855f7);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;">Start downloading</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">Questions? Contact <a href="mailto:support@nextew.vercel.app" style="color:#a855f7;text-decoration:none;">support@nextew.vercel.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nextew <onboarding@resend.dev>',
      // CRITICAL FOR TESTING: On Resend Free tier, this must be YOUR registered Resend email.
      // If testing fails, temporarily put: to: ['your-actual-email@gmail.com']
      to: [email], 
      subject: `Payment confirmed — ${amountFormatted} receipt`,
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Resend API Error:', errText)
    throw new Error(`Resend failed: ${errText}`)
  }

  console.log('Receipt email successfully sent via Resend!')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')
  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!

  if (!signature) return new Response('Missing signature', { status: 401 })

  const isValid = await verifySignature(rawBody, signature, secretKey)
  if (!isValid) return new Response('Invalid signature', { status: 401 })

  const payload = JSON.parse(rawBody)
  if (payload.event !== 'charge.success') return new Response('ok', { status: 200 })

  const { reference, amount, status, metadata, customer } = payload.data
  const userId = metadata?.user_id
  const email = customer?.email

  if (status !== 'success' || amount !== EXPECTED_AMOUNT || !userId) {
    return new Response('ok', { status: 200 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ plan: 'paid', paystack_ref: reference, amount_paid: amount })
    .eq('id', userId)

  if (error) {
    console.error('Database error:', error)
    return new Response('Database error', { status: 500 })
  }

  // FIXED: Properly awaited so the server doesn't shut down early
  if (email) {
    try {
      await sendReceipt(email, reference, amount)
    } catch (e) {
      console.error('Failed to send receipt:', e.message)
    }
  }

  return new Response('ok', { status: 200 })
})