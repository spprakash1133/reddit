'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Suspense } from 'react'
import { fmt, ago, safeId, hlText, store, fetchRedditPosts } from '../../lib/utils'
import { callAI } from '../../lib/replyEngine'

const TONES = ['Helpful','Professional','Casual','Witty','Empathetic','Direct']
const TONE_PROMPTS = {
  Helpful:'Be genuinely helpful and informative. Share real insights.',
  Professional:'Be polished and professional. Concise and credible.',
  Casual:"Sound relaxed and conversational, like a friend.",
  Witty:'Be clever and lightly humorous. Smart, not sarcastic.',
  Empathetic:"Show understanding and warmth. Acknowledge their situation.",
  Direct:'Get straight to the point. No filler, just the best answer.',
}
const PLANS = {
  free:   {name:'Free',    label:'Free',   feats:['5 posts/fetch','Basic reply drafts']},
  starter:{name:'Starter', label:'$9/mo',  feats:['25 posts/fetch','250 AI drafts/month','Watchlist alerts','10 keywords']},
  pro:    {name:'Pro',     label:'$20/mo', feats:['Unlimited posts','750 AI drafts/month','Competitor monitor','Sentiment','30 keywords']},
}

function AppContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // ── State ──────────────────────────────────────────────────────
  const [user,       setUser]      = useState(null)
  const [posts,      setPosts]     = useState([])
  const [filtered,   setFiltered]  = useState([])
  const [sub,        setSub]       = useState('')
  const [topicInput, setTopicInput]= useState('')
  const [sort,       setSort]      = useState('hot')
  const [mode,       setMode]      = useState('sub') // 'sub' | 'topic'
  const [loading,    setLoading]   = useState(false)
  const [loadMsg,    setLoadMsg]   = useState('')
  const [keywords,   setKeywords]  = useState([])
  const [kwInput,    setKwInput]   = useState('')
  const [filterMode, setFilterMode]= useState('any')
  const [searchIn,   setSearchIn]  = useState({title:true,body:false})
  const [limit,      setLimit]     = useState(25)
  const [afterToken, setAfterToken]= useState(null)
  const [hasMore,    setHasMore]   = useState(false)
  const [activeTab,  setActiveTab] = useState('feed')
  const [notifs,     setNotifs]    = useState([])
  const [notifOpen,  setNotifOpen] = useState(false)
  const [bookmarks,  setBookmarks] = useState([])
  const [watchlist,  setWatchlist] = useState([])
  const [competitors,setCompetitors]=useState([])
  const [plan,       setPlan]      = useState('free')
  const [upgradeOpen,setUpgradeOpen]=useState(false)
  const [openReplies,setOpenReplies]=useState({})  // pid -> {open,tone,ctx,draft}
  const [openCmts,   setOpenCmts]  = useState({})  // pid -> {open, comments:[]}
  const [wlKw,       setWlKw]      = useState('')
  const [wlThresh,   setWlThresh]  = useState(5)
  const [compInput,  setCompInput] = useState('')
  const [sentTF,     setSentTF]    = useState('all')
  const feedRef = useRef(null)

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sr_user')||'null')
    if (!u) { router.push('/signup'); return }
    setUser(u)
    setBookmarks(store.get('bookmarks',[]))
    setWatchlist(store.get('watchlist',[]))
    setCompetitors(store.get('competitors',[]))
    setNotifs(store.get('notifs',[]))
    setPlan(localStorage.getItem('sr_plan')||'free')

    // Payment return
    const payment = searchParams.get('payment')
    const planParam = searchParams.get('plan')
    if (payment === 'success' && planParam && PLANS[planParam]) {
      localStorage.setItem('sr_plan', planParam)
      setPlan(planParam)
      window.history.replaceState({},document.title,window.location.pathname)
      setTimeout(() => alert('🎉 Welcome to ScoutReddit '+PLANS[planParam].name+'! Your plan is active.'), 700)
    }
  }, [])

  // ── Filter posts ────────────────────────────────────────────────
  useEffect(() => {
    if (!keywords.length) { setFiltered(posts); return }
    const kws = keywords.map(k=>k.toLowerCase())
    setFiltered(posts.filter(p => {
      const hay = (p.title+' '+(p.text||'')+(filterMode==='all'?'':'')).toLowerCase()
      return filterMode==='all' ? kws.every(k=>hay.includes(k)) : kws.some(k=>hay.includes(k))
    }))
  }, [posts, keywords, filterMode])

  // ── Fetch ────────────────────────────────────────────────────────
  async function doFetch(append=false) {
    if (!sub && !topicInput) { alert('Enter a subreddit or topic first'); return }
    setLoading(true); setLoadMsg('Fetching posts…')
    try {
      const { posts: newPosts, after } = await fetchRedditPosts({
        sub: mode==='sub' ? sub : '',
        topic: mode==='topic' ? topicInput : '',
        sort, limit, after: append ? afterToken : null, searchIn,
      })
      setPosts(p => append ? [...p, ...newPosts] : newPosts)
      setAfterToken(after); setHasMore(!!after)
      checkWatchlistAlerts(newPosts, watchlist)
    } catch(e) { alert('Fetch error: '+e.message) }
    setLoading(false); setLoadMsg('')
  }

  // ── Watchlist check ──────────────────────────────────────────────
  function checkWatchlistAlerts(newPosts, wl) {
    wl.forEach(w => {
      newPosts.forEach(p => {
        const hay = (p.title+' '+(p.text||'')).toLowerCase()
        if (hay.includes(w.kw.toLowerCase()) && (p.score||0) >= w.thresh) {
          const key = 'wl_'+p.id+'_'+w.id
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key,'1')
            pushNotif('🎯', `Alert: "${w.kw}"`, `▲${p.score} — ${p.title?.slice(0,60)}`)
          }
        }
      })
    })
  }

  // ── Notifications ────────────────────────────────────────────────
  function pushNotif(icon, title, sub) {
    const n = {id:Date.now(),icon,title,sub:sub||'',read:false,ts:new Date().toISOString()}
    setNotifs(prev => {
      const updated = [n,...prev].slice(0,50)
      store.set('notifs',updated)
      return updated
    })
  }

  // ── Bookmarks ────────────────────────────────────────────────────
  function toggleBookmark(pid) {
    const p = [...posts,...bookmarks].find(p=>safeId(p.id||p.url||'')===pid)
    if (!p) return
    setBookmarks(prev => {
      const idx = prev.findIndex(b=>b.id===p.id)
      const updated = idx>-1 ? prev.filter((_,i)=>i!==idx) : [{...p,_savedAt:new Date().toISOString()},...prev]
      store.set('bookmarks',updated)
      if (idx===-1) pushNotif('🔖','Post bookmarked',p.title?.slice(0,60))
      return updated
    })
  }

  function isBookmarked(id) { return bookmarks.some(b=>b.id===id) }

  // ── Reply composer ───────────────────────────────────────────────
  async function genReply(pid) {
    const post = posts.find(p=>safeId(p.id||p.url||'')===pid)
    if (!post) return
    const replyState = openReplies[pid]||{}
    const tone = replyState.tone||'Helpful'
    const userCtx = replyState.ctx||''
    const tp = TONE_PROMPTS[tone]||TONE_PROMPTS.Helpful

    setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],generating:true,draft:''}}))

    const prompt = `Write a Reddit reply under 100 words.
Tone: ${tone} — ${tp}
Sound like a real person. Add value before mentioning any product.
${userCtx?`User context: "${userCtx}"`:''}

Post: "${post.title}"
${post.text?`Body: "${post.text.slice(0,350)}"` : ''}
Subreddit: r/${post.subredditName||sub}

Reply:`

    await new Promise(r=>setTimeout(r,1000))
    try {
      const result = await callAI({model:'claude-haiku',max_tokens:300,messages:[{role:'user',content:prompt}]})
      const text = result?.content?.[0]?.text||''
      setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],generating:false,draft:text}}))
    } catch(e) {
      setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],generating:false}}))
      alert('Draft failed: '+e.message)
    }
  }

  // ── Live comments ────────────────────────────────────────────────
  async function loadComments(pid) {
    const post = posts.find(p=>safeId(p.id||p.url||'')===pid)
    if (!post) return
    const cur = openCmts[pid]
    if (cur?.open) { setOpenCmts(prev=>({...prev,[pid]:{...prev[pid],open:false}})); return }
    setOpenCmts(prev=>({...prev,[pid]:{open:true,loading:true,comments:[]}}))
    try {
      const pathname = new URL(post.url).pathname.replace(/\/$/, '')
      const r = await fetch('https://www.reddit.com'+pathname+'.json?limit=8&sort=top',{headers:{Accept:'application/json'}})
      if (!r.ok) throw new Error('Reddit '+r.status)
      const data = await r.json()
      const cmts = (data[1]?.data?.children||[])
        .filter(c=>c.kind==='t1'&&c.data.body&&c.data.body!=='[deleted]')
        .slice(0,5)
        .map(c=>({id:c.data.id,author:c.data.author,score:c.data.ups,body:c.data.body,created:new Date(c.data.created_utc*1000).toISOString()}))
      setOpenCmts(prev=>({...prev,[pid]:{open:true,loading:false,comments:cmts}}))
    } catch(e) {
      setOpenCmts(prev=>({...prev,[pid]:{open:false,loading:false,comments:[]}}))
    }
  }

  // ── Checkout ─────────────────────────────────────────────────────
  async function startCheckout(planId, btn) {
    if (btn) { btn.textContent='Opening…'; btn.disabled=true }
    try {
      const res = await fetch('/api/checkout',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({planId, email:user?.email, name:user?.name})
      })
      const data = await res.json()
      if (!data.url) throw new Error(data.error||'No URL')
      if (typeof DodoPaymentsCheckout !== 'undefined') {
        window._pendingPlan = planId
        DodoPaymentsCheckout.DodoPayments.Checkout.open({ checkoutUrl: data.url })
      } else { window.location.href = data.url }
    } catch(e) { alert('Checkout error: '+e.message) }
    if (btn) { btn.textContent='Get '+planId.charAt(0).toUpperCase()+planId.slice(1)+' →'; btn.disabled=false }
  }

  // ── Competitor scan ───────────────────────────────────────────────
  async function scanCompetitor(name) {
    pushNotif('🕵',`Scanning for "${name}"…`,'Searching Reddit')
    try {
      const r = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(name)}&sort=top&t=week&limit=10`,{headers:{Accept:'application/json'}})
      if (!r.ok) throw new Error('Reddit '+r.status)
      const data = await r.json()
      const newPosts = (data.data?.children||[]).filter(c=>c.kind==='t3').map(c=>{
        const d=c.data
        return {id:d.id,title:d.title,text:d.selftext||'',url:d.url?.startsWith('http')?d.url:'https://reddit.com'+d.permalink,permalink:d.permalink,author:d.author,score:d.ups||0,numComments:d.num_comments||0,subredditName:d.subreddit,created:new Date(d.created_utc*1000).toISOString()}
      })
      if (newPosts.length) {
        setPosts(p=>[...newPosts,...p])
        setActiveTab('feed')
        pushNotif('🕵',`Found ${newPosts.length} posts for "${name}"`)
      } else { pushNotif('🕵',`No recent posts for "${name}"`,'') }
    } catch(e) { pushNotif('⚠','Scan failed: '+e.message,'') }
  }

  // ── Sentiment ─────────────────────────────────────────────────────
  const POS = new Set(['good','great','best','love','amazing','excellent','helpful','useful','recommend','awesome','works','happy','pleased','fast','simple'])
  const NEG = new Set(['bad','worst','hate','terrible','awful','broken','scam','useless','slow','confusing','disappointing','failed','buggy','crash','frustrating'])
  function scoreSentiment(text) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/)
    let pos=0,neg=0
    words.forEach(w=>{if(POS.has(w))pos++;if(NEG.has(w))neg++})
    const total=pos+neg||1
    return {pos:Math.round(pos/total*100),neg:Math.round(neg/total*100),samples:words.length}
  }

  const allPosts = activeTab==='saved' ? bookmarks : filtered
  const displayPosts = allPosts

  // ── Render: PostCard ─────────────────────────────────────────────
  function PostCard({p}) {
    const pid = safeId(p.id||p.url||'')
    const replyS = openReplies[pid]||{}
    const cmtS   = openCmts[pid]||{}
    const bmed   = isBookmarked(p.id)

    function copyAndOpen() {
      const text = replyS.draft||''
      if (!text.trim()) { alert('Generate a reply first'); return }
      navigator.clipboard?.writeText(text).catch(()=>{})
      window.open(p.url,'_blank')
    }

    return (
      <div className="pcard" id={`pcard-${pid}`}>
        <div className="pcard-top">
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
            <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--acc)',background:'var(--adim)',border:'1px solid var(--ab)',padding:'2px 8px',borderRadius:4}}>r/{p.subredditName}</span>
            {p.flair && <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)',background:'var(--surf2)',padding:'2px 7px',borderRadius:4}}>{p.flair}</span>}
          </div>
          <div className="ptitle" dangerouslySetInnerHTML={{__html: hlText(p.title, keywords)}} />
          {p.text && <div className="ptext" dangerouslySetInnerHTML={{__html: hlText(p.text.slice(0,180), keywords)}} />}
        </div>
        <div className="pmeta">
          <span>u/{p.author}</span>
          <span>▲ {fmt(p.score)}</span>
          <span>💬 {fmt(p.numComments)}</span>
          <span>{ago(p.created)}</span>
        </div>
        <div className="pacts">
          <a className="act-btn" href={p.url} target="_blank" rel="noreferrer">Open Reddit ↗</a>
          <button className="act-btn" onClick={()=>loadComments(pid)}>
            {cmtS.loading ? '⏳ Loading…' : cmtS.open ? '💬 Hide' : '💬 Top Comments'}
          </button>
          <button className="act-btn" onClick={()=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],open:!prev[pid]?.open}}))}>✏ Draft Reply</button>
          <button className={`bm-btn${bmed?' saved':''}`} onClick={()=>toggleBookmark(pid)} title={bmed?'Saved':'Bookmark'}>{bmed?'🔖':'🏷'}</button>
        </div>

        {/* Live comments */}
        {cmtS.open && !cmtS.loading && (
          <div className="live-cmts">
            {!cmtS.comments.length ? <div style={{fontSize:13,color:'var(--muted)',padding:'8px 0'}}>No comments yet.</div>
            : cmtS.comments.map((c,i)=>(
              <div key={c.id} className="lcmt">
                <div className="lcmt-meta"><span className="au">u/{c.author}</span><span>▲ {fmt(c.score)}</span><span>{ago(c.created)}</span></div>
                <div className="lcmt-body" dangerouslySetInnerHTML={{__html: hlText(c.body.slice(0,600),keywords)}} />
              </div>
            ))}
          </div>
        )}

        {/* Reply composer */}
        {replyS.open && (
          <div className="reply-wrap" style={{marginTop:10}}>
            <div className="reply-notice"><strong>Review before posting.</strong> ScoutReddit never auto-posts.</div>
            <div className="tonality-wrap">
              <span className="tonality-lbl">Tone</span>
              {TONES.map(t=>(
                <button key={t} className={`tone-btn${(replyS.tone||'Helpful')===t?' on':''}`}
                  onClick={()=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],tone:t}}))}>
                  {t}
                </button>
              ))}
            </div>
            <div className="ctx-wrap">
              <div className="ctx-lbl"><span>Your context</span><span style={{color:'var(--hint)',fontSize:9,letterSpacing:0,textTransform:'none'}}>Add your product angle — the reply will use it</span></div>
              <textarea className="ctx-ta" placeholder="e.g. I run a SaaS tool for freelancers…" value={replyS.ctx||''} onChange={e=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],ctx:e.target.value}}))} />
            </div>
            <textarea className="reply-ta" placeholder="Choose a tone and click AI Draft, or write manually…"
              value={replyS.draft||''} onChange={e=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],draft:e.target.value}}))} />
            <div className="cc">{(replyS.draft||'').length} / 10,000</div>
            <div className="reply-acts">
              <button className="btn-ai" onClick={()=>genReply(pid)} disabled={replyS.generating}>
                <span className={`ai-spin`} style={{display:replyS.generating?'inline-block':'none'}}></span>
                {replyS.generating ? 'Generating…' : '✨ AI Draft'}
              </button>
              <button className="btn-copy-reply" onClick={copyAndOpen}>Copy &amp; Open Reddit ↗</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render: Upgrade modal ─────────────────────────────────────────
  function UpgradeModal() {
    if (!upgradeOpen) return null
    const planDefs = [
      {id:'free',   name:'Free',   price:'$0',  period:'Forever free',         feats:['5 posts per fetch','Basic reply drafts']},
      {id:'starter',name:'Starter',price:'$9',  period:'/month',               feats:['25 posts/fetch','250 AI drafts/month','Watchlist','10 keywords'],},
      {id:'pro',    name:'Pro',    price:'$20', period:'/month',featured:true,  feats:['Unlimited posts','750 AI drafts/month','Competitor monitor','Sentiment','30 keywords']},
    ]
    return (
      <div id="upgrade-overlay" onClick={e=>{if(e.target===e.currentTarget)setUpgradeOpen(false)}}
        style={{display:'flex',position:'fixed',inset:0,zIndex:600,background:'rgba(7,9,15,.9)',backdropFilter:'blur(8px)',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:'var(--surf)',border:'1px solid var(--b2)',borderRadius:'var(--rxl)',padding:36,width:'100%',maxWidth:680,maxHeight:'90vh',overflowY:'auto',position:'relative'}}>
          <button onClick={()=>setUpgradeOpen(false)} style={{position:'absolute',top:14,right:14,background:'none',border:'none',color:'var(--muted)',fontSize:20,cursor:'pointer'}}>✕</button>
          <div className="upgrade-title">Choose your plan</div>
          <div className="upgrade-sub">Upgrade to unlock more posts, AI replies, and advanced features.</div>
          <div className="upgrade-grid">
            {planDefs.map(p=>{
              const isCur = p.id===plan
              return (
                <div key={p.id} className={`upgrade-plan${p.featured?' featured':''}${isCur?' current':''}`}>
                  {p.featured&&!isCur && <div className="up-badge">MOST POPULAR</div>}
                  {isCur && <div className="up-badge up-current-badge">YOUR PLAN</div>}
                  <div className="up-name">{p.name}</div>
                  <div className="up-price">{p.price}</div>
                  <div className="up-period">{p.period}</div>
                  <ul className="up-feats">{p.feats.map(f=><li key={f}>{f}</li>)}</ul>
                  {isCur ? <button className="up-btn current-btn">✓ Current plan</button>
                    : p.id!=='free' ? <button className="up-btn acc" onClick={e=>startCheckout(p.id,e.currentTarget)}>Get {p.name} →</button>
                    : null}
                </div>
              )
            })}
          </div>
          <div style={{fontSize:11,color:'var(--hint)',textAlign:'center',marginTop:16}}>Payments secured by <a href="https://dodopayments.com" target="_blank" rel="noreferrer" style={{color:'var(--blue)'}}>Dodo Payments</a>. Cancel anytime.</div>
        </div>
      </div>
    )
  }

  // ── Render: Notification panel ────────────────────────────────────
  const unreadCount = notifs.filter(n=>!n.read).length

  function markAllRead() {
    const updated = notifs.map(n=>({...n,read:true}))
    setNotifs(updated); store.set('notifs',updated)
  }

  // ── Render: Sentiment ─────────────────────────────────────────────
  function SentimentView() {
    const subjects = [
      ...keywords.map(k=>({name:k,type:'keyword'})),
      ...competitors.map(c=>({name:c,type:'competitor'})),
    ]
    if (!posts.length) return <div className="empty-state"><div className="empty-ico" style={{fontSize:20}}>📊</div><div className="empty-title">Fetch some posts first</div><div className="empty-sub">Then come back to analyse sentiment.</div></div>
    if (!subjects.length) return <div className="empty-state"><div className="empty-title">Add keywords or competitors</div><div className="empty-sub">Use the filters sidebar to add keywords, or add competitors in the Tools tab.</div></div>
    return (
      <div style={{padding:'8px 0'}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:18}}>Sentiment Analysis</div>
        {subjects.map(s=>{
          const relevant = posts.filter(p=>(p.title+' '+(p.text||'')).toLowerCase().includes(s.name.toLowerCase()))
          const combined = relevant.map(p=>p.title+' '+(p.text||'')).join(' ')
          const sc = combined ? scoreSentiment(combined) : {pos:0,neg:0}
          const color = sc.pos>sc.neg ? 'var(--green)' : 'var(--red)'
          return (
            <div key={s.name} className="sent-row">
              <span className="sent-label" style={s.type==='competitor'?{color:'var(--muted)'}:{}}>{s.name}</span>
              <div className="sent-bar-wrap">
                <div className="sent-bar" style={{width:sc.pos+'%',background:'var(--green)',float:'left'}} />
                <div className="sent-bar" style={{width:sc.neg+'%',background:'var(--red)',float:'left'}} />
              </div>
              <span className="sent-score" style={{color}}>{sc.pos>sc.neg?'+':'-'}{Math.abs(sc.pos-sc.neg)}%</span>
              <span className="sent-sample-count">{relevant.length}p</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (!user) return <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>Loading…</div>

  const initials = user.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'U'

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/dodopayments-checkout@latest/dist/index.js" strategy="lazyOnload"
        onLoad={()=>{
          DodoPaymentsCheckout.DodoPayments.Initialize({
            mode:'live',displayType:'overlay',
            onEvent(e){
              if(['payment.succeeded','checkout.completed','subscription.active'].includes(e.type)){
                const p=window._pendingPlan||'starter'
                localStorage.setItem('sr_plan',p); setPlan(p)
                setTimeout(()=>alert('🎉 Plan activated!'),400)
              }
            }
          })
        }}
      />

      {/* APP NAV */}
      <nav id="app-nav">
        <span className="app-logo">Scout<span>Reddit</span></span>
        <span className="app-nav-badge" id="app-mode-badge">{mode==='sub'?'● Subreddit':'🔍 Topic'}</span>
        <div className="spacer" />
        <button className="plan-badge-nav" style={{background: plan==='pro'?'var(--adim)': plan==='starter'?'rgba(92,158,255,.12)':'var(--surf2)',color:plan==='pro'?'var(--acc2)':plan==='starter'?'var(--blue)':'var(--muted)',border:'1px solid '+(plan==='pro'?'var(--ab)':plan==='starter'?'rgba(92,158,255,.3)':'var(--b2)'),fontSize:10,fontFamily:'var(--mono)',padding:'3px 10px',borderRadius:20,cursor:'pointer'}} onClick={()=>setUpgradeOpen(true)}>
          {PLANS[plan]?.label||'Free'}
        </button>
        <button style={{fontSize:12,fontWeight:600,background:'var(--acc)',color:'var(--ink)',border:'none',borderRadius:8,padding:'6px 14px',cursor:'pointer'}} onClick={()=>setUpgradeOpen(true)}>⚡ Upgrade</button>
        <span style={{fontFamily:'var(--mono)',fontSize:10,padding:'3px 9px',borderRadius:20,background:'rgba(167,139,250,.08)',border:'1px solid rgba(167,139,250,.25)',color:'var(--purple)'}}>✦ AI ready</span>
        <button className="notif-btn" onClick={()=>{setNotifOpen(o=>!o);markAllRead()}} title="Notifications">
          🔔{unreadCount>0&&<span className="notif-count">{unreadCount>9?'9+':unreadCount}</span>}
        </button>
        <div className="app-user">
          {user.picture
            ? <div style={{width:28,height:28,borderRadius:'50%',backgroundImage:`url(${user.picture})`,backgroundSize:'cover',flexShrink:0}} />
            : <div className="app-avatar">{initials}</div>
          }
          <span className="app-username">{user.name}</span>
        </div>
        <button className="app-logout" onClick={()=>{ localStorage.removeItem('sr_user'); router.push('/') }}>Log out</button>
      </nav>

      {/* NOTIFICATION PANEL */}
      {notifOpen && (
        <div className="notif-panel open" style={{position:'fixed',top:58,right:16}}>
          <div className="notif-hdr">
            <span className="notif-hdr-title">Notifications</span>
            <button className="notif-clear" onClick={()=>{setNotifs([]);store.set('notifs',[])}}>Clear all</button>
          </div>
          <div className="notif-list">
            {!notifs.length ? <div className="notif-empty">No notifications yet</div>
            : notifs.map(n=>(
              <div key={n.id} className={`notif-item${n.read?'':' unread'}`}>
                <div className="notif-text"><span className="notif-icon">{n.icon}</span>{n.title}</div>
                {n.sub && <div className="notif-sub">{n.sub.slice(0,80)}</div>}
                <div className="notif-sub">{ago(n.ts)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      <UpgradeModal />

      {/* APP BODY */}
      <div id="app-body">
        {/* SIDEBAR */}
        <div id="app-sb">
          {/* Mode switch */}
          <div>
            <div className="mode-sw">
              <div className={`msw${mode==='sub'?' on':''}`} onClick={()=>setMode('sub')}>Subreddit</div>
              <div className={`msw${mode==='topic'?' on':''}`} onClick={()=>setMode('topic')}>Topic</div>
            </div>
            <div className="sb-row" style={{marginTop:8}}>
              {mode==='sub'
                ? <input className="sb-input" placeholder="e.g. SaaS, startups" value={sub} onChange={e=>setSub(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doFetch()} />
                : <input className="sb-input" placeholder="e.g. best CRM tool" value={topicInput} onChange={e=>setTopicInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doFetch()} />
              }
              <button className="btn-fetch" id="fetch-btn" onClick={()=>doFetch()} disabled={loading}>{loading?'…':'Fetch'}</button>
            </div>
          </div>

          {/* Sort */}
          <div>
            <span className="sb-label">Sort by</span>
            <div className="src-g" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              {['hot','new','top','rising'].map(s=>(
                <div key={s} className={`src-b${sort===s?' on':''}`} onClick={()=>setSort(s)} style={{textAlign:'center',padding:'7px 5px',fontSize:11}}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <span className="sb-label">Keyword Filters</span>
            <div className="sb-row">
              <input className="sb-input" placeholder="e.g. Python, AI, help…" value={kwInput} onChange={e=>setKwInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&kwInput.trim()){setKeywords(p=>[...p,kwInput.trim()]);setKwInput('')}}} />
              <button className="btn-kw-add" onClick={()=>{if(kwInput.trim()){setKeywords(p=>[...p,kwInput.trim()]);setKwInput('')}}}>+</button>
            </div>
            <div className="kw-pills">
              {keywords.map(k=>(
                <div key={k} className="kw-pill">{k}<button className="kw-del" onClick={()=>setKeywords(p=>p.filter(x=>x!==k))}>×</button></div>
              ))}
            </div>
          </div>

          {/* Filter mode */}
          <div>
            <span className="sb-label">Filter mode</span>
            <div className="src-g">
              <div className={`src-b${filterMode==='any'?' on':''}`} onClick={()=>setFilterMode('any')}><div className="sbn">Match ANY</div></div>
              <div className={`src-b${filterMode==='all'?' on':''}`} onClick={()=>setFilterMode('all')}><div className="sbn">Match ALL</div></div>
            </div>
          </div>

          {/* Posts limit */}
          <div>
            <span className="sb-label">Posts to fetch</span>
            <input type="range" min="5" max="100" step="5" value={limit} onChange={e=>setLimit(+e.target.value)} style={{width:'100%',accentColor:'var(--acc)'}} />
            <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--muted)',textAlign:'center'}}>{limit} posts</div>
          </div>

          <div className="sep" />

          {/* Data source */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surf2)',border:'1px solid rgba(62,207,142,.2)',borderRadius:'var(--r)',padding:'9px 12px'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',flexShrink:0}} />
              <span style={{fontSize:12,color:'var(--green)'}}>Free Reddit JSON API · No limits</span>
            </div>
          </div>
        </div>

        {/* FEED */}
        <div id="app-feed" ref={feedRef} onClick={e=>{if(notifOpen&&!e.target.closest('.notif-panel')&&!e.target.closest('.notif-btn'))setNotifOpen(false)}}>
          {/* Feed tabs */}
          <div className="feed-tabs">
            {['feed','saved','tools','sentiment'].map(t=>(
              <button key={t} className={`feed-tab${activeTab===t?' on':''}`} onClick={()=>setActiveTab(t)}>
                {t==='feed'?'Feed':t==='saved'?`🔖 Saved ${bookmarks.length>0?`(${bookmarks.length})`:''}`  :t==='tools'?'🛠 Tools':'📊 Sentiment'}
              </button>
            ))}
          </div>

          {/* Feed / Saved content */}
          {(activeTab==='feed'||activeTab==='saved') && (
            <>
              {loading && (
                <div id="feed-loading" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',gap:12}}>
                  <div style={{width:36,height:36,border:'2.5px solid var(--b2)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .8s linear infinite'}} />
                  <div style={{fontSize:13,color:'var(--muted)'}}>{loadMsg}</div>
                </div>
              )}
              {!loading && !displayPosts.length && (
                <div className="empty-state">
                  <div className="empty-ico">{activeTab==='saved'?'🔖':'📡'}</div>
                  <div className="empty-title">{activeTab==='saved'?'No saved posts yet':'Ready to scan Reddit'}</div>
                  <div className="empty-sub">{activeTab==='saved'?'Click 🏷 on any post to save it here.':'Enter a subreddit or topic and click Fetch.'}</div>
                  {activeTab==='feed'&&(
                    <div className="q-chips">
                      {['programming','SaaS','india','startups','technology'].map(q=>(
                        <span key={q} className="qchip" onClick={()=>{setSub(q);setMode('sub');setTimeout(()=>doFetch(),50)}}>r/{q}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!loading && displayPosts.length>0 && (
                <>
                  <div className="feed-hdr">
                    <div className="feed-title">{activeTab==='saved'?`Saved (${bookmarks.length})`:`r/${sub||topicInput} · ${displayPosts.length} posts`}</div>
                  </div>
                  <div id="posts-list">
                    {displayPosts.map(p=><PostCard key={p.id||p.url} p={p} />)}
                  </div>
                  {hasMore&&activeTab==='feed'&&(
                    <div className="load-more-row">
                      <button className="btn-sb-out" onClick={()=>doFetch(true)} disabled={loading}>Load more posts</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Tools tab */}
          {activeTab==='tools' && (
            <div style={{padding:'8px 0'}}>
              {/* Watchlist */}
              <div style={{background:'var(--surf)',border:'1px solid var(--b2)',borderRadius:'var(--rl)',padding:18,marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>🎯 Watchlist Alerts</div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Get notified when posts match your keyword and hit an upvote threshold.</div>
                <div style={{display:'flex',gap:7,marginBottom:6}}>
                  <input className="sb-input" placeholder="Keyword to watch…" value={wlKw} onChange={e=>setWlKw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&wlKw.trim()&&(setWatchlist(p=>{const updated=[...p,{id:Date.now(),kw:wlKw.trim(),thresh:wlThresh}];store.set('watchlist',updated);return updated}),setWlKw(''))} style={{flex:1,fontSize:13}} />
                  <input type="number" className="sb-input" value={wlThresh} onChange={e=>setWlThresh(+e.target.value)} style={{width:72,fontSize:13}} title="Min upvotes" />
                  <button className="btn-fetch" onClick={()=>{if(wlKw.trim()){setWatchlist(p=>{const updated=[...p,{id:Date.now(),kw:wlKw.trim(),thresh:wlThresh}];store.set('watchlist',updated);return updated});setWlKw('')}}}>Add</button>
                </div>
                <div style={{fontSize:10,color:'var(--hint)',fontFamily:'var(--mono)',marginBottom:10}}>second field = min upvotes threshold</div>
                {watchlist.map(w=>(
                  <div key={w.id} className="watchlist-item">
                    <span className="wl-kw">{w.kw}</span>
                    <span className="wl-thresh">≥ {w.thresh} ▲</span>
                    <button className="wl-del" onClick={()=>setWatchlist(p=>{const u=p.filter(x=>x.id!==w.id);store.set('watchlist',u);return u})}>✕</button>
                  </div>
                ))}
                {!watchlist.length&&<div style={{fontSize:11,color:'var(--hint)',fontStyle:'italic'}}>No keywords watched yet</div>}
              </div>

              {/* Competitors */}
              <div style={{background:'var(--surf)',border:'1px solid var(--b2)',borderRadius:'var(--rl)',padding:18}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>🕵 Competitor Monitor</div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Track when competitors are mentioned on Reddit.</div>
                <div style={{display:'flex',gap:7,marginBottom:10}}>
                  <input className="sb-input" placeholder="Competitor name…" value={compInput} onChange={e=>setCompInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&compInput.trim()&&(setCompetitors(p=>{if(p.length>=5||p.includes(compInput.trim()))return p;const u=[...p,compInput.trim()];store.set('competitors',u);return u}),setCompInput(''))} style={{flex:1,fontSize:13}} />
                  <button className="btn-fetch" onClick={()=>{if(compInput.trim()&&competitors.length<5){setCompetitors(p=>{const u=[...p,compInput.trim()];store.set('competitors',u);return u});setCompInput('')}}}>Add</button>
                </div>
                {competitors.map(name=>(
                  <div key={name} className="comp-item">
                    <span className="comp-name">{name}</span>
                    <button className="comp-scan-btn" onClick={()=>scanCompetitor(name)}>Scan</button>
                    <button className="comp-del" onClick={()=>setCompetitors(p=>{const u=p.filter(x=>x!==name);store.set('competitors',u);return u})}>✕</button>
                  </div>
                ))}
                {!competitors.length&&<div style={{fontSize:11,color:'var(--hint)',fontStyle:'italic'}}>No competitors added yet</div>}
              </div>
            </div>
          )}

          {/* Sentiment tab */}
          {activeTab==='sentiment' && <SentimentView />}
        </div>
      </div>
    </>
  )
}

export default function HomepagePage() {
  return <Suspense><AppContent /></Suspense>
}
