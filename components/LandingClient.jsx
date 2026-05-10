'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LandingClient() {
  const [mobOpen, setMobOpen] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(x => { if (x.isIntersecting) x.target.classList.add('in') }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))

    const handleScroll = () => {
      const nav = document.getElementById('l-nav')
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  function closeMob() { setMobOpen(false) }

  return (
    <>
      {/* NAV */}
      <nav id="l-nav" className="l-nav">
        <Link href="/" className="logo" onClick={closeMob}>Scout<span>Reddit</span></Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-right">
          <Link href="/signup?tab=login" className="btn-ghost-sm">Log in</Link>
          <Link href="/signup" className="btn-acc-sm">Start 7-day trial</Link>
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
      {mobOpen && (
        <div className="mob-nav">
          <a href="#features" onClick={closeMob}>Features</a>
          <a href="#how" onClick={closeMob}>How it works</a>
          <a href="#pricing" onClick={closeMob}>Pricing</a>
          <Link href="/signup?tab=login" onClick={closeMob}>Log in</Link>
          <Link href="/signup" onClick={closeMob} className="btn-acc-sm" style={{textAlign:'center'}}>Start 7-day trial →</Link>
        </div>
      )}

      {/* HERO */}
      <section id="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-badge"><span className="pulse"></span>7-day free trial · No card required</div>
            <h1>Find the Reddit threads<br /><em>your customers are in.</em></h1>
            <p className="hero-sub">ScoutReddit surfaces high-intent posts on Reddit, drafts replies that sound human, and helps you turn conversations into customers — without spam, ads, or getting downvoted.</p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn-primary">Start 7-day trial →</Link>
              <a href="#how" className="btn-outline">See how it works</a>
            </div>
            <p className="hero-note">Full access · No credit card · 2-min setup</p>
          </div>
          <div className="hero-cards" aria-hidden="true">
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/SaaS · 14m ago</span><span className="intent i-hi">High intent</span></div>
              <div className="hc-title">Any tool to find Reddit threads where people need my product?</div>
              <div className="hc-meta"><span>▲ 318</span><span>💬 47</span></div>
            </div>
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/Entrepreneur · 41m ago</span><span className="intent i-hi">High intent</span></div>
              <div className="hc-title">How do you get users without spending money on ads?</div>
              <div className="hc-meta"><span>▲ 892</span><span>💬 124</span></div>
            </div>
            <div className="hcard">
              <div className="hc-top"><span className="hc-sub">r/startups · 2h ago</span><span className="intent i-md">Medium intent</span></div>
              <div className="hc-title">What&apos;s the best way to validate a product idea before building?</div>
              <div className="hc-meta"><span>▲ 231</span><span>💬 53</span></div>
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

      {/* HOW IT WORKS */}
      <section id="how" className="lsec">
        <div className="linner">
          <div className="sec-hdr reveal">
            <div className="chip">How it works</div>
            <h2 className="l-h2">From cold subreddit to warm reply in three steps.</h2>
          </div>
          <div className="how-grid">
            <div className="how-step reveal">
              <div className="how-num">01</div>
              <h3>Tell us your topic</h3>
              <p>Enter a subreddit, keyword, or competitor. ScoutReddit pulls every fresh post that matches.</p>
            </div>
            <div className="how-step reveal d1">
              <div className="how-num">02</div>
              <h3>Spot high-intent threads</h3>
              <p>Posts get scored on buying intent so you skip the noise and reply where it actually matters.</p>
            </div>
            <div className="how-step reveal d2">
              <div className="how-num">03</div>
              <h3>Drop a reply that converts</h3>
              <p>Get a draft that sounds like a real human, in the tone the subreddit expects. Edit, copy, post.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lsec">
        <div className="linner">
          <div className="sec-hdr reveal">
            <div className="chip">Features</div>
            <h2 className="l-h2">Everything you need to win on Reddit.</h2>
          </div>
          <div className="feat-grid">
            <div className="feat reveal">
              <div className="feat-num">01</div><div className="feat-ico">🎯</div>
              <h3>Conversation finder</h3>
              <p>Surface Reddit threads where people are already asking for what you sell. Each one scored on intent.</p>
              <span className="feat-tag">Intent scoring</span>
            </div>
            <div className="feat reveal d1">
              <div className="feat-num">02</div><div className="feat-ico">🗣</div>
              <h3>Replies that sound human</h3>
              <p>Drafts written to match the subreddit&apos;s tone — helpful, on-topic, never salesy.</p>
              <span className="feat-tag">Tone matching</span>
            </div>
            <div className="feat reveal d2">
              <div className="feat-num">03</div><div className="feat-ico">🔖</div>
              <h3>Watchlist &amp; alerts</h3>
              <p>Save high-value threads. Get notified when a new post matches your keyword and crosses an upvote threshold.</p>
              <span className="feat-tag">Real-time alerts</span>
            </div>
            <div className="feat reveal">
              <div className="feat-num">04</div><div className="feat-ico">📊</div>
              <h3>Sentiment view</h3>
              <p>See exactly how Reddit feels about your brand vs your competitors — pulled from real post data.</p>
              <span className="feat-tag">Competitive intel</span>
            </div>
            <div className="feat reveal d1">
              <div className="feat-num">05</div><div className="feat-ico">🕵</div>
              <h3>Competitor monitor</h3>
              <p>The moment a competitor gets mentioned, you know. Be the first useful voice in the thread.</p>
              <span className="feat-tag">Real-time</span>
            </div>
            <div className="feat reveal d2 feat-cta">
              <div className="feat-ico">🚀</div>
              <h3>Free for 7 days</h3>
              <p>Full access. No card. See real leads inside your first session.</p>
              <Link href="/signup" className="btn-primary btn-primary-sm">Start trial →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="lsec lsec-alt">
        <div className="linner">
          <div className="sec-hdr reveal">
            <div className="chip">Pricing</div>
            <h2 className="l-h2">Try it free for 7 days.</h2>
            <p className="sec-sub">Full access during your trial. No credit card. Decide if it&apos;s worth keeping.</p>
          </div>
          <div className="trial-card reveal">
            <div className="trial-tag">EARLY ACCESS</div>
            <div className="trial-name">7-Day Free Trial</div>
            <div className="trial-price">$0</div>
            <div className="trial-period">For your first week — full feature set</div>
            <ul className="trial-feats">
              <li>Unlimited Reddit post fetches</li>
              <li>AI reply drafts in 6 tones</li>
              <li>Watchlists with upvote-threshold alerts</li>
              <li>Competitor monitor + sentiment view</li>
              <li>Bookmarks &amp; saved threads</li>
              <li>Email signup logging to your sheet</li>
            </ul>
            <Link href="/signup" className="btn-primary trial-cta">Start 7-day trial →</Link>
            <div className="trial-note">No card. No auto-renew. Cancel by closing the tab.</div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="final-cta">
        <div className="fcta-in">
          <h2>Stop guessing where your <em>customers</em> hang out.</h2>
          <p>They&apos;re already on Reddit, asking for what you built. Find them in the next 10 minutes.</p>
          <Link href="/signup" className="btn-primary">Start 7-day trial →</Link>
          <div className="live-chip"><span className="ldot"></span>Live · 500+ founders shipping daily</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="foot-in">
          <div className="foot-top">
            <div className="foot-brand">
              <Link href="/" className="logo">Scout<span>Reddit</span></Link>
              <p>Turn Reddit into your highest-converting acquisition channel.</p>
            </div>
            <div className="foot-col"><h4>Product</h4><a href="#features">Features</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><Link href="/homepage">App</Link></div>
            <div className="foot-col"><h4>Account</h4><Link href="/signup">Sign up</Link><Link href="/signup?tab=login">Log in</Link></div>
            <div className="foot-col"><h4>Legal</h4><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
          </div>
          <div className="foot-btm">
            <span>© {new Date().getFullYear()} ScoutReddit</span>
            <span>Built for founders who ship.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
