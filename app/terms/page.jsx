import Link from 'next/link'

export const metadata = { title: 'Terms of Service — ScoutReddit' }

export default function TermsPage() {
  return (
    <main style={{minHeight:'100svh',background:'var(--ink)',color:'var(--t)',padding:'90px 20px 64px'}}>
      <div style={{maxWidth:760,margin:'0 auto'}}>
        <Link href="/" className="logo">Scout<span>Reddit</span></Link>

        <h1 style={{fontFamily:'var(--serif)',fontSize:'clamp(32px,5vw,46px)',fontWeight:900,letterSpacing:'-1.5px',margin:'24px 0 8px'}}>Terms of Service</h1>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:36,fontFamily:'var(--mono)'}}>Last updated: {new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>

        <section style={{display:'flex',flexDirection:'column',gap:20,fontSize:15,lineHeight:1.72,color:'var(--muted)'}}>
          <p>By creating an account or using ScoutReddit you agree to these Terms of Service.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Use of the service</h2>
          <p>You agree to use ScoutReddit to assist genuine, helpful participation on Reddit. You will not use the service to spam, harass, impersonate users, evade subreddit rules, or violate Reddit&rsquo;s own Terms of Service.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Subscriptions and payments</h2>
          <p>Paid plans renew on a monthly basis until cancelled. You can cancel any time from the account section; cancellation takes effect at the end of the current billing period. We do not offer refunds for partially used periods unless required by law.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>AI-generated content</h2>
          <p>Reply drafts produced by ScoutReddit are suggestions. You are responsible for reviewing and editing them before posting on Reddit.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Termination</h2>
          <p>We may suspend or terminate accounts that violate these terms or that are used for abusive activity.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Disclaimer</h2>
          <p>The service is provided &ldquo;as is&rdquo;. We do not guarantee any specific business outcome.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Contact</h2>
          <p>Questions about these terms? Email <a href="mailto:hello@scoutreddit.com" style={{color:'var(--acc)'}}>hello@scoutreddit.com</a>.</p>
        </section>

        <div style={{marginTop:48,paddingTop:24,borderTop:'1px solid var(--b1)',fontSize:13}}>
          <Link href="/" style={{color:'var(--acc)'}}>← Back to homepage</Link>
        </div>
      </div>
    </main>
  )
}
