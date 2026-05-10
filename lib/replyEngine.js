// Local reply engine — free, no API, no external calls

// Wraps localReplyEngine so genReply/genLcmtReply can call callAI unchanged
export async function callAI(payload) {
  const userMsg = payload.messages?.find(m=>m.role==='user')?.content || '';
  const text = localReplyEngine(userMsg);
  return { content: [{ type:'text', text }] };
}

// ── Local Reply Engine ──────────────────────────────────────────────────
function localReplyEngine(prompt) {
  // Extract context from prompt
  const postMatch  = prompt.match(/Post:\s*"([^"]{0,300})"/i);
  const bodyMatch  = prompt.match(/Body:\s*"([^"]{0,300})"/i);
  const subMatch   = prompt.match(/Subreddit:\s*r\/(\S+)/i);
  const cmtMatch   = prompt.match(/Comment:\s*"([^"]{0,300})"/i);
  const toneMatch  = prompt.match(/Tone:\s*(\w+)/i);

  const postTitle  = postMatch?.[1]  || '';
  const postBody   = bodyMatch?.[1]  || '';
  const subreddit  = subMatch?.[1]   || '';
  const comment    = cmtMatch?.[1]   || '';
  const tone       = (toneMatch?.[1] || 'Helpful').toLowerCase();

  const source     = comment || postBody || postTitle;
  const isCommentReply = !!comment;

  // Detect intent
  const intent = detectIntent(postTitle + ' ' + source);

  // Extract useful keywords
  const keywords = extractKeywords(postTitle + ' ' + source);

  // Pick tone modifier
  const opener  = pickOpener(tone, intent);
  const closer  = pickCloser(tone, subreddit);
  const body    = buildBody(intent, tone, keywords, postTitle, source, isCommentReply);

  const reply = [opener, body, closer].filter(Boolean).join(' ').trim();
  return reply.charAt(0).toUpperCase() + reply.slice(1);
}

// ── Intent detection ────────────────────────────────────────────────────
function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(recommend|suggest|which|best|alternative|vs|compare|use|tool|app|software|service)/.test(t)) return 'recommendation';
  if (/(how (do|can|to)|what('s| is) the (best|right|proper) way|help me|how should)/.test(t)) return 'howto';
  if (/(why (is|does|do|are|won't|can't)|confused|don't understand|not sure|not working)/.test(t)) return 'explanation';
  if (/(just (launched|released|built|shipped|made|created)|introducing|new project|side project|check (it|this) out)/.test(t)) return 'launch';
  if (/(struggling|frustrated|annoying|hate|problem|issue|stuck|failed|gave up|burned out)/.test(t)) return 'vent';
  if (/(first time|beginner|newbie|starting out|new to|just started|learning)/.test(t)) return 'beginner';
  if (/(what do you|anyone else|share your|thoughts on|opinions on|discussion|debate)/.test(t)) return 'discussion';
  if (/\?/.test(t)) return 'question';
  return 'general';
}

// ── Keyword extraction ──────────────────────────────────────────────────
function extractKeywords(text) {
  const stopwords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','was','are','be','been','have','has','had','do','does','did','will','would','could','should','may','might','this','that','these','those','i','you','he','she','we','they','it','its','my','your','our','their','how','what','why','when','where','who','which','not','no','yes','just','so','if','from','by','about','into','out','up','down','over','after']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w))
    .slice(0, 6);
}

// ── Pick weighted random item ────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const s = [...arr]; const r = [];
  for (let i = 0; i < n && s.length; i++) { const idx = Math.floor(Math.random()*s.length); r.push(s.splice(idx,1)[0]); }
  return r.join(' ');
}

// ── Openers by tone ──────────────────────────────────────────────────────
function pickOpener(tone, intent) {
  const map = {
    helpful:      ["This is something I've thought about a lot.", "Good question —", "Happy to share what's worked for me here.", "This comes up pretty often and there's a solid answer."],
    professional: ["From a practical standpoint,", "The key consideration here is", "Worth addressing this systematically.", "There are a few relevant factors worth highlighting."],
    casual:       ["Oh this one I can help with!", "Yeah, been through exactly this.", "Honestly,", "So here's the thing —"],
    witty:        ["Ah, the eternal Reddit question.", "Plot twist:", "Short answer: it depends. Long answer:", "The real answer might surprise you —"],
    empathetic:   ["I completely get this feeling.", "You're definitely not alone here.", "This is genuinely tough, and I hear you.", "First — it's okay to feel stuck on this."],
    direct:       ["Bottom line:", "Here's what actually works:", "Cut to the chase:", "The answer is straightforward:"],
  };
  const openers = map[tone] || map.helpful;
  return intent === 'vent' ? pick(map.empathetic) : pick(openers);
}

// ── Body builder ────────────────────────────────────────────────────────
function buildBody(intent, tone, keywords, title, source, isComment) {
  const kw = keywords.slice(0, 3);
  const topic = kw[0] || 'this';
  const detail = kw.slice(1).join(' and ') || 'the specifics';

  if (isComment) {
    const commentBodies = [
      `That's a really valid point about ${topic}. The part about ${detail || 'what you mentioned'} resonates — in my experience, the biggest factor is consistency rather than finding the perfect approach. Most people overthink the setup and underinvest in the execution.`,
      `Interesting take. I'd push back slightly on the ${topic} angle — it really depends on context. For most situations, the simpler the approach the better. Have you tried just defaulting to the most boring obvious solution first?`,
      `This is exactly right. The ${topic} piece is what most people miss. Once you get that dialed in, everything else tends to fall into place much more naturally than expected.`,
      `Adding to this — ${detail || 'the point you made'} is key. I'd also factor in how much time you're realistically willing to put in at the start, because that changes the calculus significantly.`,
    ];
    return pick(commentBodies);
  }

  const bodies = {
    recommendation: [
      `For ${topic}, it really depends on your specific situation. The most common mistake is picking based on features rather than fit. What tends to work: start with the most boring, well-documented option and only go fancier if you hit real limitations.`,
      `Spent a while evaluating options around ${topic}. The winner in most cases is the one with the best community support — when you hit edge cases (and you will), having good docs and active forums saves hours. Happy to go deeper on specific options if you share more about your use case.`,
      `For ${topic}: avoid the temptation to go with the newest/shiniest thing. The tools that have been around 3-5 years have the bugs worked out. What's your main constraint — budget, time to set up, or technical complexity?`,
    ],
    howto: [
      `The way I've seen this work best: break it into smaller steps and validate early. With ${topic}, the most common pitfall is trying to get everything perfect before shipping anything. Get a minimal version working, then layer in complexity.`,
      `For ${topic}, the usual approach is to start with the fundamentals — ${detail || 'the core requirements'} — and build from there. Most guides overcomplicate it. What specific part is giving you trouble?`,
      `Step by step with ${topic}: (1) get the basics working on the simplest possible input, (2) test with real data, (3) handle edge cases. People skip step 2 and then wonder why things break in production.`,
    ],
    explanation: [
      `The reason ${topic} works this way is actually pretty logical once you see it from the right angle. The short version: ${detail || 'the underlying system'} is optimized for the common case, not your specific case. The mismatch is usually the source of confusion.`,
      `Confused me too at first. The key insight with ${topic} is that there are two layers at play — what you see on the surface and what's actually happening underneath. Once you separate those mentally, it clicks.`,
      `Good question — ${topic} is genuinely counterintuitive. The mental model that helped me: think of it less as ${detail||'a rule'} and more as a default that can be overridden. That reframe solves most of the confusion.`,
    ],
    launch: [
      `Congrats on shipping! The fact that it's out there puts you ahead of 90% of ideas that stay in notebooks. What's been the biggest surprise in building it?`,
      `This looks solid. For early traction with ${topic}, the move that works better than most people expect: find 3-5 specific subreddits where your exact user hangs out and be genuinely helpful there before ever mentioning your product.`,
      `Nice work getting it live. One thing that might help: narrow your messaging to one very specific problem for one very specific person. The more specific, the more it resonates. What problem does it solve in one sentence?`,
    ],
    vent: [
      `Been there with ${topic}. What helped me was stepping back and asking which part of this is actually a problem vs which part is just friction I haven't gotten used to yet. Sometimes the answer changes what you do next.`,
      `This is a real pattern. The ${topic} frustration usually peaks right before something clicks — not saying push through blindly, but worth identifying whether it's a fundamental blocker or just an unfamiliar workflow.`,
      `Genuinely valid frustration. The thing with ${topic} is it usually gets worse before it gets better, which is terrible design on the universe's part. What would "good enough" look like if perfect isn't available?`,
    ],
    beginner: [
      `Welcome to the ${topic} rabbit hole! Honest advice: don't try to learn everything at once. Pick one thing, build something small with it, then learn the next thing because you actually need it. That loop is 10x more efficient than courses.`,
      `Good instinct starting here. For ${topic} as a beginner: the documentation is actually your friend, even when it looks scary. Most beginner questions are answered there, just not in beginner language. Search "[topic] getting started" + the official docs first.`,
      `The biggest thing I wish I'd known starting out with ${topic}: the goal isn't to understand everything, it's to build your mental model of how the pieces fit together. Start with the simplest working example and work outward from there.`,
    ],
    discussion: [
      `My take on ${topic}: the consensus view is usually right in aggregate but wrong for any specific situation. The interesting question is which factors make your situation different from the average case.`,
      `Worth separating ${topic} into two questions: what's true in general, and what's true for your specific context. Most Reddit debates are people arguing from different contexts without realizing it.`,
      `Genuinely interesting discussion. The nuance that often gets lost with ${topic}: it matters enormously what stage you're at. What's good advice for year 1 can be actively harmful in year 3.`,
    ],
    question: [
      `For ${topic} specifically: the answer depends on context, but the default most people should start with is the simpler option. Complexity should be earned by hitting real limitations, not anticipated upfront.`,
      `${topic.charAt(0).toUpperCase()+topic.slice(1)} is one of those areas where the conventional wisdom is right about 70% of the time. The 30% exception is usually when you have scale, compliance, or unusual technical constraints.`,
      `Short answer: yes, with caveats. The ${topic} approach works well for most standard cases. Where it breaks down: ${detail || 'edge cases and unusual requirements'}. More context on your specific situation would help narrow it down.`,
    ],
    general: [
      `With ${topic}, the thing most people miss is that the first approach rarely survives contact with reality. The value isn't in getting it right the first time — it's in having a process for iterating quickly.`,
      `The ${topic} situation is more nuanced than it looks. The factors that matter most: ${detail || 'your specific constraints and timeline'}. Happy to dig into any of those if useful.`,
      `Good point. ${topic} has gotten a lot better recently but still has real tradeoffs. The people who succeed with it are usually the ones who are clear-eyed about what it's good at vs where you need something else.`,
    ],
  };

  const options = bodies[intent] || bodies.general;
  return pick(options);
}

// ── Closers by tone ──────────────────────────────────────────────────────
function pickCloser(tone, subreddit) {
  const closers = {
    helpful:      ["Hope that helps — happy to go deeper on any part.", "Feel free to drop more context if you want a more specific answer.", "Let me know if that doesn't quite fit your situation."],
    professional: ["Happy to elaborate on any of these points if needed.", "Would be useful to know more specifics to refine this further.", "The right answer depends on context — worth mapping that out first."],
    casual:       ["Anyway, hope that's useful!", "Drop a reply if you want to dig in more.", "Good luck with it!"],
    witty:        ["But what do I know — I'm just a person on the internet.", "Take that with appropriate Reddit seasoning.", "Your mileage may vary, void where prohibited."],
    empathetic:   ["You've got this — it gets clearer as you go.", "Don't hesitate to ask follow-ups.", "Rooting for you on this one."],
    direct:       ["That's the core of it.", "Anything I missed?", "Try that first before adding complexity."],
  };
  const options = closers[tone] || closers.helpful;
  return Math.random() > 0.4 ? pick(options) : '';
}

// ══════════════════════════════════
// AI REPLY
// ══════════════════════════════════
const TONE_PROMPTS={
  Helpful:'Be genuinely helpful and informative. Share real insights or experiences.',
  Professional:'Be polished and professional. Concise, credible, authoritative.',
  Casual:'Sound relaxed and conversational — like a knowledgeable friend.',
  Witty:'Be clever and lightly humorous. Smart, not sarcastic.',
  Empathetic:'Show genuine understanding and warmth. Acknowledge their situation first.',
