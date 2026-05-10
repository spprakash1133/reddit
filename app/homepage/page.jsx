'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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
const TRIAL_DAYS = 7

function trialState() {
  if (typeof window === 'undefined') return { active: true, daysLeft: TRIAL_DAYS, dayNum: 1 }
  const start = parseInt(localStorage.getItem('sr_trial_start') || '0', 10)
  if (!start) return { active: true, daysLeft: TRIAL_DAYS, dayNum: 1 }
  const elapsedMs = Date.now() - start
  const dayNum = Math.min(TRIAL_DAYS, Math.floor(elapsedMs / 86_400_000) + 1)
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor(elapsedMs / 86_400_000))
  return { active: daysLeft > 0, daysLeft, dayNum }
}

function AppContent() {
  const router = useRouter()

  const [user,       setUser]      = useState(null)
  const [trial,      setTrial]     = useState({ active: true, daysLeft: TRIAL_DAYS, dayNum: 1 })
  const [posts,      setPosts]     = useState([])
  const [filtered,   setFiltered]  = useState([])
  const [sub,        setSub]       = useState('')
  const [topicInput, setTopicInput]= useState('')
  const [sort,       setSort]      = useState('hot')
  const [mode,       setMode]      = useState('sub')
  const [loading,    setLoading]   = useState(false)
  const [loadMsg,    setLoadMsg]   = useState('')
  const [keywords,   setKeywords]  = useState([])
  const [kwInput,    setKwInput]   = useState('')
  const [filterMode, setFilterMode]= useState('any')
  const [searchIn]                 = useState({title:true,body:false})
  const [limit,      setLimit]     = useState(25)
  const [afterToken, setAfterToken]= useState(null)
  const [hasMore,    setHasMore]   = useState(false)
  const [activeTab,  setActiveTab] = useState('feed')
  const [notifs,     setNotifs]    = useState([])
  const [notifOpen,  setNotifOpen] = useState(false)
  const [bookmarks,  setBookmarks] = useState([])
  const [watchlist,  setWatchlist] = useState([])
  const [competitors,setCompetitors]=useState([])
  const [openReplies,setOpenReplies]=useState({})
  const [openCmts,   setOpenCmts]  = useState({})
  const [wlKw,       setWlKw]      = useState('')
  const [wlThresh,   setWlThresh]  = useState(5)
  const [compInput,  setCompInput] = useState('')
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const feedRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sr_user')||'null')
    if (!u) { router.push('/signup'); return }
    setUser(u)
    setBookmarks(store.get('bookmarks',[]))
    setWatchlist(store.get('watchlist',[]))
    setCompetitors(store.get('competitors',[]))
    setNotifs(store.get('notifs',[]))
    setTrial(trialState())
  }, [])

  useEffect(() => {
    if (!keywords.length) { setFiltered(posts); return }
    const kws = keywords.map(k=>k.toLowerCase())
    setFiltered(posts.filter(p => {
      const hay = (p.title+' '+(p.text||'')).toLowerCase()
      return filterMode==='all' ? kws.every(k=>hay.includes(k)) : kws.some(k=>hay.includes(k))
    }))
  }, [posts, keywords, filterMode])

  async function doFetch(append=false) {
    if (!sub && !topicInput) { alert('Enter a subreddit or topic first'); return }
    setLoading(true); setLoadMsg('Fetching posts…')
    setSidebarOpen(false)
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

  function pushNotif(icon, title, sub) {
    const n = {id:Date.now(),icon,title,sub:sub||'',read:false,ts:new Date().toISOString()}
    setNotifs(prev => {
      const updated = [n,...prev].slice(0,50)
      store.set('notifs',updated)
      return updated
    })
  }

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

    await new Promise(r=>setTimeout(r,800))
    try {
      const result = await callAI({model:'local',max_tokens:300,messages:[{role:'user',content:prompt}]})
      const text = result?.content?.[0]?.text||''
      setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],generating:false,draft:text}}))
    } catch(e) {
      setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],generating:false}}))
      alert('Draft failed: '+e.message)
    }
  }

  async function loadComments(pid) {
    const post = [...posts, ...bookmarks].find(p=>safeId(p.id||p.url||'')===pid)
    if (!post) return
    const cur = openCmts[pid]
    if (cur?.open) { setOpenCmts(prev=>({...prev,[pid]:{...prev[pid],open:false}})); return }
    setOpenCmts(prev=>({...prev,[pid]:{open:true,loading:true,comments:[]}}))
    try {
      // post.permalink always points to the Reddit comments page; post.url
      // can be an external link (e.g. github.com/...) for link-type posts.
      let path = post.permalink || ''
      if (!path && post.url) path = new URL(post.url).pathname
      path = path.replace(/\/$/, '')
      if (!path) throw new Error('No Reddit URL on this post')
      const r = await fetch('https://www.reddit.com'+path+'.json?limit=10&sort=top',{headers:{Accept:'application/json'}})
      if (!r.ok) throw new Error('Reddit '+r.status)
      const data = await r.json()
      const cmts = (data[1]?.data?.children||[])
        .filter(c=>c.kind==='t1'&&c.data.body&&c.data.body!=='[deleted]'&&c.data.body!=='[removed]')
        .slice(0,5)
        .map(c=>({id:c.data.id,author:c.data.author,score:c.data.ups,body:c.data.body,created:new Date(c.data.created_utc*1000).toISOString()}))
      setOpenCmts(prev=>({...prev,[pid]:{open:true,loading:false,comments:cmts}}))
    } catch(e) {
      setOpenCmts(prev=>({...prev,[pid]:{open:false,loading:false,comments:[]}}))
      pushNotif('⚠️','Couldn\'t load comments',e.message||'')
    }
  }

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
      <div className="pcard">
        <div className="pcard-top">
          <div className="pcard-tags">
            <span className="p-sub-tag">r/{p.subredditName}</span>
            {p.flair && <span className="p-flair">{p.flair}</span>}
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
          <a className="act-btn" href={p.url} target="_blank" rel="noreferrer">Open ↗</a>
          <button className="act-btn" onClick={()=>loadComments(pid)}>
            {cmtS.loading ? '⏳' : cmtS.open ? '💬 Hide' : '💬 Comments'}
          </button>
          <button className="act-btn" onClick={()=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],open:!prev[pid]?.open}}))}>✏ Draft</button>
          <button className={`bm-btn${bmed?' saved':''}`} onClick={()=>toggleBookmark(pid)} title={bmed?'Saved':'Bookmark'}>{bmed?'🔖':'🏷'}</button>
        </div>

        {cmtS.open && !cmtS.loading && (
          <div className="live-cmts">
            {!cmtS.comments.length ? <div className="lcmt-empty">No comments yet.</div>
            : cmtS.comments.map(c=>(
              <div key={c.id} className="lcmt">
                <div className="lcmt-meta"><span className="au">u/{c.author}</span><span>▲ {fmt(c.score)}</span><span>{ago(c.created)}</span></div>
                <div className="lcmt-body" dangerouslySetInnerHTML={{__html: hlText(c.body.slice(0,600),keywords)}} />
              </div>
            ))}
          </div>
        )}

        {replyS.open && (
          <div className="reply-wrap">
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
              <div className="ctx-lbl"><span>Your context</span><span className="ctx-hint">Add your product angle</span></div>
              <textarea className="ctx-ta" placeholder="e.g. I run a SaaS tool for freelancers…" value={replyS.ctx||''} onChange={e=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],ctx:e.target.value}}))} />
            </div>
            <textarea className="reply-ta" placeholder="Pick a tone and click AI Draft, or write manually…"
              value={replyS.draft||''} onChange={e=>setOpenReplies(prev=>({...prev,[pid]:{...prev[pid],draft:e.target.value}}))} />
            <div className="cc">{(replyS.draft||'').length} / 10,000</div>
            <div className="reply-acts">
              <button className="btn-ai" onClick={()=>genReply(pid)} disabled={replyS.generating}>
                {replyS.generating ? <><span className="ai-spin"></span> Generating…</> : '✨ AI Draft'}
              </button>
              <button className="btn-copy-reply" onClick={copyAndOpen}>Copy &amp; Open ↗</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const unreadCount = notifs.filter(n=>!n.read).length

  function markAllRead() {
    const updated = notifs.map(n=>({...n,read:true}))
    setNotifs(updated); store.set('notifs',updated)
  }

  function SentimentView() {
    const subjects = [
      ...keywords.map(k=>({name:k,type:'keyword'})),
      ...competitors.map(c=>({name:c,type:'competitor'})),
    ]
    if (!posts.length) return <div className="empty-state"><div className="empty-ico">📊</div><div className="empty-title">Fetch some posts first</div><div className="empty-sub">Then come back to analyse sentiment.</div></div>
    if (!subjects.length) return <div className="empty-state"><div className="empty-title">Add keywords or competitors</div><div className="empty-sub">Use the sidebar to add keywords, or add competitors in the Tools tab.</div></div>
    return (
      <div className="sent-wrap">
        <div className="sent-section-title">Sentiment Analysis</div>
        {subjects.map(s=>{
          const relevant = posts.filter(p=>(p.title+' '+(p.text||'')).toLowerCase().includes(s.name.toLowerCase()))
          const combined = relevant.map(p=>p.title+' '+(p.text||'')).join(' ')
          const sc = combined ? scoreSentiment(combined) : {pos:0,neg:0}
          const positive = sc.pos>sc.neg
          return (
            <div key={s.name} className="sent-row">
              <span className="sent-label">{s.name}</span>
              <div className="sent-bar-wrap">
                <div className="sent-bar sent-pos" style={{width:sc.pos+'%'}} />
                <div className="sent-bar sent-neg" style={{width:sc.neg+'%'}} />
              </div>
              <span className={`sent-score ${positive?'sent-pos-score':'sent-neg-score'}`}>{positive?'+':'-'}{Math.abs(sc.pos-sc.neg)}%</span>
              <span className="sent-sample-count">{relevant.length}p</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (!user) return <div className="loading-screen">Loading…</div>

  const initials = user.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'U'

  return (
    <>
      {/* Trial banner */}
      <div className={`trial-banner-app ${trial.active?'':'expired'}`}>
        {trial.active
          ? <>🎁 <strong>Day {trial.dayNum} of {TRIAL_DAYS} — free trial active.</strong> Full access. {trial.daysLeft} day{trial.daysLeft===1?'':'s'} left.</>
          : <>✨ <strong>Trial complete.</strong> You&apos;re on early-access — keep using ScoutReddit free while we polish billing.</>
        }
      </div>

      {/* APP NAV */}
      <nav className="app-nav">
        <button className="sb-toggle" aria-label="Toggle sidebar" onClick={()=>setSidebarOpen(o=>!o)}>
          <span></span><span></span><span></span>
        </button>
        <span className="app-logo">Scout<span>Reddit</span></span>
        <span className="app-mode-badge">{mode==='sub'?'r/sub':'topic'}</span>
        <div className="app-spacer" />
        <button className="notif-btn" onClick={()=>{setNotifOpen(o=>!o);markAllRead()}} title="Notifications">
          🔔{unreadCount>0&&<span className="notif-count">{unreadCount>9?'9+':unreadCount}</span>}
        </button>
        <div className="app-user">
          {user.picture
            ? <div className="app-avatar-img" style={{backgroundImage:`url(${user.picture})`}} />
            : <div className="app-avatar">{initials}</div>
          }
          <span className="app-username">{user.name}</span>
        </div>
        <button className="app-logout" onClick={()=>{ localStorage.removeItem('sr_user'); router.push('/') }}>Log out</button>
      </nav>

      {notifOpen && (
        <div className="notif-panel open">
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

      {sidebarOpen && <div className="sb-backdrop" onClick={()=>setSidebarOpen(false)} />}

      <div className="app-body">
        <aside className={`app-sb ${sidebarOpen?'open':''}`}>
          <div className="sb-section">
            <div className="mode-sw">
              <button className={`msw${mode==='sub'?' on':''}`} onClick={()=>setMode('sub')}>Subreddit</button>
              <button className={`msw${mode==='topic'?' on':''}`} onClick={()=>setMode('topic')}>Topic</button>
            </div>
            <div className="sb-row sb-row-mt">
              {mode==='sub'
                ? <input className="sb-input" placeholder="e.g. SaaS, startups" value={sub} onChange={e=>setSub(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doFetch()} />
                : <input className="sb-input" placeholder="e.g. best CRM tool" value={topicInput} onChange={e=>setTopicInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doFetch()} />
              }
              <button className="btn-fetch" onClick={()=>doFetch()} disabled={loading}>{loading?'…':'Fetch'}</button>
            </div>
          </div>

          <div className="sb-section">
            <span className="sb-label">Sort by</span>
            <div className="src-g sg-4">
              {['hot','new','top','rising'].map(s=>(
                <button key={s} className={`src-b${sort===s?' on':''}`} onClick={()=>setSort(s)}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-section">
            <span className="sb-label">Keyword filters</span>
            <div className="sb-row">
              <input className="sb-input" placeholder="e.g. Python, AI, help…" value={kwInput} onChange={e=>setKwInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&kwInput.trim()){setKeywords(p=>[...p,kwInput.trim()]);setKwInput('')}}} />
              <button className="btn-fetch" onClick={()=>{if(kwInput.trim()){setKeywords(p=>[...p,kwInput.trim()]);setKwInput('')}}}>+</button>
            </div>
            {keywords.length>0 && (
              <div className="kw-pills">
                {keywords.map(k=>(
                  <span key={k} className="kw-pill">{k}<button onClick={()=>setKeywords(p=>p.filter(x=>x!==k))}>×</button></span>
                ))}
              </div>
            )}
          </div>

          <div className="sb-section">
            <span className="sb-label">Filter mode</span>
            <div className="src-g">
              <button className={`src-b${filterMode==='any'?' on':''}`} onClick={()=>setFilterMode('any')}>Match ANY</button>
              <button className={`src-b${filterMode==='all'?' on':''}`} onClick={()=>setFilterMode('all')}>Match ALL</button>
            </div>
          </div>

          <div className="sb-section">
            <span className="sb-label">Posts to fetch</span>
            <input type="range" min="5" max="100" step="5" value={limit} onChange={e=>setLimit(+e.target.value)} className="sb-range" />
            <div className="sb-range-num">{limit} posts</div>
          </div>
        </aside>

        <main className="app-feed" ref={feedRef} onClick={e=>{if(notifOpen&&!e.target.closest('.notif-panel')&&!e.target.closest('.notif-btn'))setNotifOpen(false)}}>
          <div className="feed-tabs">
            {['feed','saved','tools','sentiment'].map(t=>(
              <button key={t} className={`feed-tab${activeTab===t?' on':''}`} onClick={()=>setActiveTab(t)}>
                {t==='feed'?'Feed':t==='saved'?`Saved${bookmarks.length?` (${bookmarks.length})`:''}`:t==='tools'?'Tools':'Sentiment'}
              </button>
            ))}
          </div>

          {(activeTab==='feed'||activeTab==='saved') && (
            <>
              {loading && (
                <div className="feed-loading">
                  <div className="spin" />
                  <div className="load-msg">{loadMsg}</div>
                </div>
              )}
              {!loading && !displayPosts.length && (
                <div className="empty-state">
                  <div className="empty-ico">{activeTab==='saved'?'🔖':'📡'}</div>
                  <div className="empty-title">{activeTab==='saved'?'No saved posts yet':'Ready when you are'}</div>
                  <div className="empty-sub">{activeTab==='saved'?'Tap the 🏷 on any post to save it here.':'Type a subreddit or topic in the sidebar and tap Fetch.'}</div>
                  {activeTab==='feed'&&(
                    <div className="q-chips">
                      {['SaaS','Entrepreneur','startups','programming','technology'].map(q=>(
                        <button key={q} className="qchip" onClick={()=>{setSub(q);setMode('sub');setSidebarOpen(false);setTimeout(()=>doFetch(),50)}}>r/{q}</button>
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
                  <div className="posts-list">
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

          {activeTab==='tools' && (
            <div className="tools-wrap">
              <div className="tool-card">
                <div className="tool-card-title">🎯 Watchlist alerts</div>
                <div className="tool-card-sub">Get notified when posts match your keyword and clear an upvote threshold.</div>
                <div className="thresh-row">
                  <input className="sb-input tool-input" placeholder="Keyword to watch…" value={wlKw} onChange={e=>setWlKw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&wlKw.trim()&&(setWatchlist(p=>{const u=[...p,{id:Date.now(),kw:wlKw.trim(),thresh:wlThresh}];store.set('watchlist',u);return u}),setWlKw(''))} />
                  <input type="number" className="sb-input thresh-input" value={wlThresh} onChange={e=>setWlThresh(+e.target.value)} title="Min upvotes" />
                  <button className="btn-fetch" onClick={()=>{if(wlKw.trim()){setWatchlist(p=>{const u=[...p,{id:Date.now(),kw:wlKw.trim(),thresh:wlThresh}];store.set('watchlist',u);return u});setWlKw('')}}}>Add</button>
                </div>
                <div className="tool-hint">Second field = minimum upvotes</div>
                {watchlist.map(w=>(
                  <div key={w.id} className="watchlist-item">
                    <span className="wl-kw">{w.kw}</span>
                    <span className="wl-thresh">≥ {w.thresh} ▲</span>
                    <button className="wl-del" onClick={()=>setWatchlist(p=>{const u=p.filter(x=>x.id!==w.id);store.set('watchlist',u);return u})}>✕</button>
                  </div>
                ))}
                {!watchlist.length&&<div className="tool-empty">No keywords watched yet</div>}
              </div>

              <div className="tool-card">
                <div className="tool-card-title">🕵 Competitor monitor</div>
                <div className="tool-card-sub">Track when competitors are mentioned on Reddit.</div>
                <div className="sb-row">
                  <input className="sb-input tool-input" placeholder="Competitor name…" value={compInput} onChange={e=>setCompInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&compInput.trim()&&(setCompetitors(p=>{if(p.length>=5||p.includes(compInput.trim()))return p;const u=[...p,compInput.trim()];store.set('competitors',u);return u}),setCompInput(''))} />
                  <button className="btn-fetch" onClick={()=>{if(compInput.trim()&&competitors.length<5){setCompetitors(p=>{const u=[...p,compInput.trim()];store.set('competitors',u);return u});setCompInput('')}}}>Add</button>
                </div>
                {competitors.map(name=>(
                  <div key={name} className="comp-item">
                    <span className="comp-name">{name}</span>
                    <button className="comp-scan-btn" onClick={()=>scanCompetitor(name)}>Scan</button>
                    <button className="comp-del" onClick={()=>setCompetitors(p=>{const u=p.filter(x=>x!==name);store.set('competitors',u);return u})}>✕</button>
                  </div>
                ))}
                {!competitors.length&&<div className="tool-empty">No competitors added yet</div>}
              </div>
            </div>
          )}

          {activeTab==='sentiment' && <SentimentView />}
        </main>
      </div>
    </>
  )
}

export default function HomepagePage() {
  return <Suspense><AppContent /></Suspense>
}
