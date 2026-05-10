import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — ScoutReddit' }

export default function PrivacyPage() {
  return (
    <main style={{minHeight:'100svh',background:'var(--ink)',color:'var(--t)',padding:'90px 20px 64px'}}>
      <div style={{maxWidth:760,margin:'0 auto'}}>
        <Link href="/" className="logo">Scout<span>Reddit</span></Link>

        <h1 style={{fontFamily:'var(--serif)',fontSize:'clamp(32px,5vw,46px)',fontWeight:900,letterSpacing:'-1.5px',margin:'24px 0 8px'}}>Privacy Policy</h1>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:36,fontFamily:'var(--mono)'}}>Last updated: {new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>

        <section style={{display:'flex',flexDirection:'column',gap:20,fontSize:15,lineHeight:1.72,color:'var(--muted)'}}>
          <p>This Privacy Policy explains how ScoutReddit (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) collects, uses, and protects your information when you use our service.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Information we collect</h2>
          <p>When you sign up we collect your name and email address. If you sign in with Google we receive your name, email, and profile picture from Google. We do not collect or store your Reddit credentials.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>How we use information</h2>
          <p>We use your information to authenticate you, deliver the service, send transactional emails, and improve the product. We do not sell your data.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Payments</h2>
          <p>Payments are processed by Dodo Payments. We do not store credit card information on our servers. Please review the Dodo Payments privacy policy for details on how they handle payment data.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Cookies and local storage</h2>
          <p>We use browser local storage to keep you signed in and to remember your preferences. We do not use third-party advertising cookies.</p>

          <h2 style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--t)',marginTop:8}}>Contact</h2>
          <p>For privacy questions please email <a href="mailto:hello@scoutreddit.com" style={{color:'var(--acc)'}}>hello@scoutreddit.com</a>.</p>
        </section>

        <div style={{marginTop:48,paddingTop:24,borderTop:'1px solid var(--b1)',fontSize:13}}>
          <Link href="/" style={{color:'var(--acc)'}}>← Back to homepage</Link>
        </div>
      </div>
    </main>
  )
}
