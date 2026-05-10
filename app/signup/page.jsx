'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'

const GOOGLE_CLIENT_ID = '582381287068-io9joj0kkqbrhnp33s6n06q6dd7niede.apps.googleusercontent.com'
const SHEETS_URL       = 'https://script.google.com/macros/s/AKfycbyElB41_PM_KMrpu2UjvchHtncl46lTYrP6SkoSvdx22rqPI3iAaJbG6W_vluOomI78/exec'

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tabParam     = searchParams.get('tab')

  const [tab,      setTab]      = useState(tabParam === 'login' ? 'login' : 'signup')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [lEmail,   setLEmail]   = useState('')
  const [lPass,    setLPass]    = useState('')
  const [error,    setError]    = useState('')
  const [loading]               = useState(false)
  const googleRef = useRef(null)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('sr_user') || 'null')
    if (user) router.push('/homepage')
  }, [])

  useEffect(() => {
    const tryInit = setInterval(() => {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        clearInterval(tryInit)
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
        })
        if (googleRef.current && !googleRef.current.hasChildNodes()) {
          google.accounts.id.renderButton(googleRef.current, {
            theme: 'outline', size: 'large', text: 'continue_with', width: 320,
          })
          const loading = document.getElementById('google-loading')
          if (loading) loading.style.display = 'none'
        }
      }
    }, 500)
    return () => clearInterval(tryInit)
  }, [])

  function handleGoogleCredential(response) {
    try {
      const parts   = response.credential.split('.')
      const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')))
      onAuthSuccess({ name: payload.name||payload.email, email: payload.email, picture: payload.picture||'' })
    } catch(e) { setError('Google sign-in error: '+e.message) }
  }

  function submitAuth() {
    setError('')
    if (tab === 'signup') {
      if (!name.trim())          { setError('Please enter your name'); return }
      if (!email.includes('@'))  { setError('Please enter a valid email'); return }
      if (password.length < 8)   { setError('Password must be at least 8 characters'); return }
      onAuthSuccess({ name: name.trim(), email: email.trim() })
    } else {
      if (!lEmail.includes('@')) { setError('Please enter a valid email'); return }
      if (!lPass)                { setError('Please enter your password'); return }
      const stored = JSON.parse(localStorage.getItem('sr_user') || 'null')
      if (stored && stored.email === lEmail) onAuthSuccess(stored)
      else onAuthSuccess({ name: lEmail.split('@')[0], email: lEmail })
    }
  }

  function onAuthSuccess(user) {
    localStorage.setItem('sr_user', JSON.stringify(user))
    if (!localStorage.getItem('sr_trial_start')) {
      localStorage.setItem('sr_trial_start', String(Date.now()))
    }
    localStorage.setItem('sr_plan', 'trial')
    sendToSheets(user)
    router.push('/homepage')
  }

  async function sendToSheets(u) {
    if (!SHEETS_URL) return
    try {
      await fetch(SHEETS_URL, {
        method: 'POST', mode: 'no-cors',
        body: new URLSearchParams({
          name: u.name||'', email: u.email||'',
          source: u.picture ? 'Google' : 'Email',
          signupAt: new Date().toISOString(),
          picture: u.picture||'',
          userAgent: navigator.userAgent.slice(0,80),
        })
      })
    } catch {}
  }

  return (
    <div className="auth-page">
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />

      <div className="auth-shell">
        <div className="auth-head">
          <Link href="/" className="logo">Scout<span>Reddit</span></Link>
          <div className="auth-sub">
            {tab === 'signup' ? 'Start your 7-day free trial' : 'Welcome back'}
          </div>
        </div>

        <div className="auth-card">
          <div className="trial-banner">
            ✨ <strong>Full access for 7 days.</strong> No credit card required.
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab${tab==='signup'?' on':''}`} onClick={() => { setTab('signup'); setError('') }}>Sign up</button>
            <button className={`auth-tab${tab==='login'?' on':''}`}  onClick={() => { setTab('login');  setError('') }}>Log in</button>
          </div>

          {tab === 'signup' ? (
            <>
              <div className="auth-field"><label>Full name</label><input className="auth-input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} /></div>
              <div className="auth-field"><label>Email</label><input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
              <div className="auth-field"><label>Password</label><input className="auth-input" type="password" placeholder="Min 8 characters" value={password} onChange={e=>setPassword(e.target.value)} /></div>
            </>
          ) : (
            <>
              <div className="auth-field"><label>Email</label><input className="auth-input" type="email" placeholder="you@example.com" value={lEmail} onChange={e=>setLEmail(e.target.value)} /></div>
              <div className="auth-field"><label>Password</label><input className="auth-input" type="password" placeholder="Your password" value={lPass} onChange={e=>setLPass(e.target.value)} /></div>
            </>
          )}

          {error && <div className="auth-err">{error}</div>}

          <button className="auth-submit" onClick={submitAuth} disabled={loading}>
            {loading ? 'Loading…' : tab === 'signup' ? 'Start free trial →' : 'Log in →'}
          </button>

          <div className="auth-divider">or</div>
          <div className="google-wrap">
            <div ref={googleRef} id="google-signin-btn"></div>
            <div id="google-loading" className="google-loading">Loading Google sign-in…</div>
          </div>
          <div className="auth-terms">
            By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </div>
        </div>

        <div className="auth-foot">
          ← <Link href="/">Back to homepage</Link>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
