'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const GOOGLE_CLIENT_ID = '582381287068-io9joj0kkqbrhnp33s6n06q6dd7niede.apps.googleusercontent.com'
const SHEETS_URL       = 'https://script.google.com/macros/s/AKfycbyElB41_PM_KMrpu2UjvchHtncl46lTYrP6SkoSvdx22rqPI3iAaJbG6W_vluOomI78/exec'

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tabParam     = searchParams.get('tab')
  const planParam    = searchParams.get('plan')

  const [tab,      setTab]      = useState(tabParam === 'login' ? 'login' : 'signup')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [lEmail,   setLEmail]   = useState('')
  const [lPass,    setLPass]    = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const googleRef = useRef(null)

  // If already logged in
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('sr_user') || 'null')
    if (user) {
      if (planParam) doCheckout(planParam, user)
      else router.push('/homepage')
    }
  }, [])

  // Init Google Sign-In
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
            theme: 'outline', size: 'large', text: 'continue_with', width: 360,
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
    sendToSheets(user)
    if (planParam) doCheckout(planParam, user)
    else router.push('/homepage')
  }

  async function doCheckout(planId, user) {
    setLoading(true)
    try {
      const res  = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, email: user.email, name: user.name }),
      })
      const data = await res.json()
      if (!data.url) throw new Error(data.error || 'No checkout URL')

      if (typeof DodoPaymentsCheckout !== 'undefined') {
        DodoPaymentsCheckout.DodoPayments.Initialize({
          mode: 'live', displayType: 'overlay',
          onEvent: (e) => {
            if (['payment.succeeded','checkout.completed','subscription.active'].includes(e.type)) {
              router.push('/homepage?payment=success&plan='+planId)
            }
          }
        })
        DodoPaymentsCheckout.DodoPayments.Checkout.open({ checkoutUrl: data.url })
      } else {
        window.location.href = data.url
      }
    } catch(e) {
      console.error('Checkout:', e)
      router.push('/homepage')
    }
    setLoading(false)
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
    <div style={{minHeight:'100svh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,background:'var(--ink)'}}>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
      <Script src="https://cdn.jsdelivr.net/npm/dodopayments-checkout@latest/dist/index.js" strategy="lazyOnload" />

      <div style={{width:'100%',maxWidth:420,position:'relative',zIndex:1}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <Link href="/" className="logo">Scout<span>Reddit</span></Link>
          <div style={{fontSize:14,color:'var(--muted)',marginTop:8}}>
            {tab === 'signup' ? 'Create your free account' : 'Welcome back'}
          </div>
        </div>

        {/* Card */}
        <div className="auth-modal" style={{position:'static',width:'auto',background:'var(--surf)',border:'1px solid var(--b2)',borderRadius:'var(--rxl)',padding:36}}>
          {/* Plan notice */}
          {planParam && (
            <div style={{background:'var(--adim)',border:'1px solid var(--ab)',borderRadius:'var(--r)',padding:'10px 14px',fontSize:12,marginBottom:16}}>
              ⚡ After signing up you&apos;ll be taken to checkout for {planParam === 'pro' ? 'Pro ($20/mo)' : 'Starter ($9/mo)'}
            </div>
          )}

          {/* Tabs */}
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

          <button className="auth-submit" onClick={submitAuth} disabled={loading} style={{marginTop:4}}>
            {loading ? 'Loading…' : tab === 'signup' ? 'Create free account' : 'Log in'}
          </button>

          <div className="auth-divider">or</div>
          <div style={{display:'flex',justifyContent:'center',minHeight:44,alignItems:'center'}}>
            <div ref={googleRef} id="google-signin-btn"></div>
            <div id="google-loading" style={{fontSize:13,color:'#888'}}>Loading Google sign-in…</div>
          </div>
          <div className="auth-terms">
            By signing up you agree to our <Link href="/terms" style={{color:'var(--acc)'}}>Terms</Link> and <Link href="/privacy" style={{color:'var(--acc)'}}>Privacy Policy</Link>.
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:20,fontSize:13,color:'var(--muted)'}}>
          ← <Link href="/" style={{color:'var(--acc)'}}>Back to homepage</Link>
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
