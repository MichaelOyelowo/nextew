import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Turnstile } from '@marsidev/react-turnstile'
import './Auth.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.88 2.69-6.64z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.55-1.85.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72c-.18-.55-.28-1.13-.28-1.72s.1-1.17.28-1.72V4.95H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.05l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  )
}

export default function Auth() {
  const [turnstileToken, setTurnstileToken] = useState(null)
  const [turnstileKey, setTurnstileKey] = useState(0) // for resetting widget
  const [step, setStep] = useState('email') // 'email' | 'code' | 'name'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleContinueWithEmail = async (e) => {
    e.preventDefault()
    if (!turnstileToken) return alert('Please complete the security check.')
    setLoading(true)
     // Verify token server-side first
    const verifyRes = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      }
    )

    if (!verifyRes.ok) {
      setLoading(false)
      setTurnstileKey(k => k + 1) // reset widget so they can try again
      return alert('Security check failed. Please try again.')
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) return alert(error.message)
    setStep('code')
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (error) return alert(error.message)

    // Returning user already has a name — skip straight home
    const existingName = data.user?.user_metadata?.full_name
    if (existingName) {
      navigate('/')
    } else {
      setStep('name')
    }
  }

  const handleSaveName = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name }
    })
    setLoading(false)
    if (error) return alert(error.message)
    navigate('/')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        {step === 'email' && (
          <>
            <h2 className="auth-title">Welcome to Nextew</h2>

            <button type="button" className="btn-google" onClick={handleGoogle}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="divider"><span>OR</span></div>

            <form onSubmit={handleContinueWithEmail} className="auth-form">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Turnstile
                key={turnstileKey}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={token => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                options={{ theme: 'light' }}
              />
              <button
                type="submit"
                disabled={loading || !turnstileToken}
                className="btn-continue"
              >
                {loading ? 'Sending...' : 'Continue with email'}
              </button>
            </form>

            <p className="auth-footnote">
              By continuing, you agree to Nextew's Terms & Privacy Policy.
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <h2 className="auth-title">Check your email</h2>
            <p className="auth-subtext">We sent a 6-digit code to {email}</p>

            <form onSubmit={handleVerify} className="auth-form">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="otp-input"
                required
                autoFocus
              />
              <button type="submit" disabled={loading} className="btn-continue">
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>

            <button type="button" className="btn-link" onClick={() => setStep('email')}>
              ← Use a different email
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <h2 className="auth-title">What's your name?</h2>
            <p className="auth-subtext">Just so we know what to call you.</p>

            <form onSubmit={handleSaveName} className="auth-form">
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-continue"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  )
}