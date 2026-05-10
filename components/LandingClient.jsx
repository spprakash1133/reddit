'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LandingClient() {
  const [mobOpen, setMobOpen] = useState(false)

  useEffect(() => {
    // Scroll reveal
    const obs = new IntersectionObserver(
      entries => entries.forEach(x => { if (x.isIntersecting) x.target.classList.add('in') }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))

    const handleScroll = () => {
      const nav = document.getElementById('l-nav')
      if (nav) nav.style.borderBottomColor = window.scrollY > 30 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.06)'
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Init Dodo (defensive — SDK may not load on first paint or be blocked)
    const tryDodo = setInterval(() => {
      if (typeof window !== 'undefined' && typeof window.DodoPaymentsCheckout !== 'undefined') {
        clearInterval(tryDodo)
        try {
          window.DodoPaymentsCheckout.DodoPayments.Initialize({
            mode: 'live',
            displayType: 'overlay',
            onEvent: (e) => {
              if (['payment.succeeded', 'checkout.completed', 'subscription.active'].includes(e?.type)) {
                const plan = window._pendingPlan || 'starter'
                try { localStorage.setItem('sr_plan', plan) } catch {}
                window.location.href = '/homepage?payment=success&plan=' + plan
              }
            },
          })
        } catch (err) { console.warn('Dodo init failed', err) }
      }
    }, 300)
    // Stop polling after 12 seconds even if SDK never loads
    const stopDodo = setTimeout(() => clearInterval(tryDodo), 12000)

    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', handleScroll)
      clearInterval(tryDodo)
      clearTimeout(stopDodo)
    }
  }, [])

  // Close mobile menu when clicking an in-page anchor
  function closeMob() { setMobOpen(false) }

  async function goCheckout(planId, btn) {
    let user = null
    try { user = JSON.parse(localStorage.getItem('sr_user') || 'null') } catch {}
    if (!user) { window.location.href = '/signup?plan=' + planId; return }
    if (btn) { btn.textContent = 'Opening…'; btn.disabled = true }
    window._pendingPlan = planId
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, email: user.email, name: user.name }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`)
      if (typeof window.DodoPaymentsCheckout !== 'undefined') {
        window.DodoPaymentsCheckout.DodoPayments.Checkout.open({ checkoutUrl: data.url })
      } else {
        window.location.href = data.url
      }
    } catch (e) {
      alert('Checkout error: ' + e.message)
    }
    if (btn) { btn.textContent = planId === 'starter' ? 'Get Starter →' : 'Start Pro free →'; btn.disabled = false }
  }

  return (
    <>
      {/* NAV */}
      <nav id="l-nav" style={{position:'fixed',top:0,left:0,right:0,zIndex:200,height:58,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',background:'rgba(7,9,15,.88)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,.06)',transition:'border-color .3s'}}>
        <Link href="/" className="logo" onClick={closeMob}>Scout<span>Reddit</span></Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/signup?tab=login">Log in</Link>
        </div>
        <div className="nav-right">
          <Link href="/signup?tab=login" className="btn-ghost-sm">Log in</Link>
          <Link href="/signup" className="btn-acc-sm">Start free →</Link>
        </div>
        <button
          className="hamburger"
          aria-label="Toggle menu"
          aria-expanded={mobOpen}
          onClick={() => setMobOpen(o => !o)}
        >
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* MOBILE NAV */}
      <div className="mob-nav" style={{display: mobOpen ? 'flex' : 'none'}}>
        <a href="#features" onClick={closeMob}>Features</a>
        <a href="#pricing" onClick={closeMob}>Pricing</a>
        <Link href="/signup?tab=login" onClick={closeMob}>Log in</Link>
        <Link href="/signup" onClick={closeMob}>Start free →</Link>
      </div>

      {/* HERO */}
      <section id="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-badge"><span className="pulse"></span>Now live — start for free</div>
            <h1>Reddit is your<br /><em>demand engine.</em><br />Get on it.</h1>
            <p className="hero-sub">Find the right conversations, drop replies that convert, and turn attention into real users — without getting downvoted or banned.</p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn-primary">Start free →</Link>
              <a href="#features" className="btn-outline">See how it works</a>
            </div>
            <p className="hero-note">No credit card · 2-minute setup</p>
          </div>
          <div className="hero-cards">
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/SaaS · 14 mins ago</span><span className="intent i-hi">High intent</span></div>
              <div className="hc-title">Any tools that help find Reddit threads where people need my product?</div>
              <div className="hc-meta"><span>▲ 318</span><span>💬 47 comments</span></div>
            </div>
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/Entrepreneur · 41 mins ago</span><span className="intent i-hi">High intent</span></div>
              <div className="hc-title">How do you get users without spending money on ads?</div>
              <div className="hc-meta"><span>▲ 892</span><span>💬 124 comments</span></div>
            </div>
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/startups · 2 hrs ago</span><span className="intent i-md">Medium intent</span></div>
              <div className="hc-title">What&apos;s the best way to validate a product idea before building?</div>
              <div className="hc-meta"><span>▲ 231</span><span>💬 53 comments</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div id="stats-bar">
        <div className="stats-row">
          <div className="stat-item reveal"><div className="stat-n">2.4M+</div><div className="stat-l">Posts scanned daily</div></div>
          <div className="stat-item reveal d1"><div className="stat-n">48k+</div><div className="stat-l">Leads surfaced / month</div></div>
          <div className="stat-item reveal d2"><div className="stat-n">&lt;30m</div><div className="stat-l">Time to first lead</div></div>
          <div className="stat-item reveal d3"><div className="stat-n">500+</div><div className="stat-l">Founders using it</div></div>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="lsec">
        <div className="linner">
          <div style={{textAlign:'center',maxWidth:560,margin:'0 auto 52px'}} className="reveal">
            <div className="chip" style={{justifyContent:'center'}}>Features</div>
            <h2 className="l-h2" style={{textAlign:'center',marginBottom:0}}>Everything you need to win on Reddit</h2>
          </div>
          <div className="feat-grid">
            <div className="feat reveal"><div className="feat-num">01</div><div className="feat-ico">🎯</div><h3>Conversation Finder</h3><p>Surface threads where people are already asking for solutions like yours. Scored by intent.</p><span className="feat-tag">Intent scoring</span></div>
            <div className="feat reveal d1"><div className="feat-num">02</div><div className="feat-ico">🗣</div><h3>Human-like Replies</h3><p>Generate responses that match subreddit tone — helpful, natural, and non-salesy.</p><span className="feat-tag">Tone matching</span></div>
            <div className="feat reveal d2"><div className="feat-num">03</div><div className="feat-ico">🔖</div><h3>Bookmark & Track</h3><p>Save high-value posts, monitor competitors, set keyword alerts with upvote thresholds.</p><span className="feat-tag">Lead tracking</span></div>
            <div className="feat reveal"><div className="feat-num">04</div><div className="feat-ico">📊</div><h3>Sentiment Analysis</h3><p>See how Reddit talks about your brand vs competitors with real post data.</p><span className="feat-tag">Competitive intel</span></div>
            <div className="feat reveal d1"><div className="feat-num">05</div><div className="feat-ico">🕵</div><h3>Competitor Monitor</h3><p>Get notified when your competitors are mentioned. Be first to reply.</p><span className="feat-tag">Real-time</span></div>
            <div className="feat reveal d2" style={{background:'var(--adim)',border:'1px solid var(--ab)'}}>
              <div className="feat-num" style={{color:'var(--acc)'}}>→</div>
              <div className="feat-ico">🚀</div>
              <h3 style={{color:'var(--acc)'}}>Start in minutes</h3>
              <p>Enter your product. See threads. Drop replies.</p>
              <Link href="/signup" className="btn-primary" style={{marginTop:18,fontSize:13,padding:'10px 20px',display:'inline-flex'}}>Try it free →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="lsec" style={{background:'var(--ink2)'}}>
        <div className="linner">
          <div style={{textAlign:'center'}} className="reveal">
            <div className="chip" style={{justifyContent:'center'}}>Pricing</div>
            <h2 className="l-h2" style={{textAlign:'center',marginBottom:10}}>Simple, honest pricing</h2>
            <p style={{fontSize:15,color:'var(--muted)'}}>Start free. Upgrade when you&apos;re getting results.</p>
          </div>
          <div className="price-grid">
            <div className="plan reveal">
              <div className="plan-name">Starter — Monthly</div>
              <div className="plan-price">$9<sub>/mo</sub></div>
              <div className="plan-period">Billed monthly · cancel anytime</div>
              <ul className="plan-feats">
                <li>25 posts per fetch</li><li>250 AI replies/month</li><li>Watchlist alerts</li>
                <li>10 keywords monitoring</li><li>Bookmarks</li><li>Auto sync</li>
              </ul>
              <button className="plan-btn out" onClick={e => goCheckout('starter', e.currentTarget)}>Get Starter →</button>
            </div>
            <div className="plan pro reveal d1">
              <div className="plan-badge-tag">MOST POPULAR</div>
              <div className="plan-name">Pro — Monthly</div>
              <div className="plan-price">$20<sub>/mo</sub></div>
              <div className="plan-period">Billed monthly · cancel anytime</div>
              <ul className="plan-feats">
                <li>Unlimited posts</li><li>750 AI replies/month</li><li>Competitor monitor</li>
                <li>Sentiment analysis</li><li>30 keywords monitoring</li><li>Priority support</li>
              </ul>
              <button className="plan-btn acc" onClick={e => goCheckout('pro', e.currentTarget)}>Start Pro free →</button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="foot-in">
          <div className="foot-top">
            <div className="foot-brand"><Link href="/" className="logo">Scout<span>Reddit</span></Link><p>Turn Reddit into your highest-converting channel.</p></div>
            <div className="foot-col"><h4>Product</h4><a href="#features">Features</a><a href="#pricing">Pricing</a><Link href="/homepage">App</Link></div>
            <div className="foot-col"><h4>Account</h4><Link href="/signup">Sign up</Link><Link href="/signup?tab=login">Log in</Link></div>
            <div className="foot-col"><h4>Legal</h4><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
          </div>
          <div className="foot-btm"><span>© {new Date().getFullYear()} ScoutReddit</span><span>Built for founders who ship</span></div>
        </div>
      </footer>
    </>
  )
}
