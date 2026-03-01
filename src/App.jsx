import { useState, useEffect } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f6fa; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  input, button { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 2px; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes pop     { 0%{transform:scale(0)} 60%{transform:scale(1.12)} 100%{transform:scale(1)} }
  @keyframes tileIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;

/* Light theme tokens */
const T = {
  bg:        "#f5f6fa",
  surface:   "#ffffff",
  border:    "#e8eaed",
  borderMd:  "#d1d5db",
  text:      "#111827",
  textSub:   "#6b7280",
  textMuted: "#9ca3af",
  navBg:     "#ffffff",
  inputBg:   "#f9fafb",
};

const TILES = [
  { id:"work",     emoji:"💼", label:"Work Situation",  sub:"Meetings, emails & decisions",  dotColor:"#6366f1",
    prompt:"You are a sharp, warm work coach inside The Lobby app. Give practical, direct advice in plain language — like a smart friend who has seen everything. 2-4 short paragraphs.",
    starters:["I have a tough meeting tomorrow","My boss is being unreasonable","I need to ask for a raise","I'm overwhelmed with work"] },
  { id:"health",   emoji:"🏥", label:"Health Check",    sub:"Food, fitness & symptoms",      dotColor:"#f43f5e",
    prompt:"You are a warm, knowledgeable health coach inside The Lobby app. Give practical health guidance like a trusted friend. Not clinical, not preachy. Always recommend a doctor for serious issues. 2-4 short paragraphs.",
    starters:["I haven't been sleeping well","I want to eat better","I'm always tired by 3pm","I need to start exercising"] },
  { id:"money",    emoji:"💰", label:"Money Question",  sub:"Bills, savings & advice",       dotColor:"#10b981",
    prompt:"You are a clear-headed money coach inside The Lobby app. No jargon. Practical guidance like a smart friend who's good with finances. Help the user take one clear next step. 2-4 short paragraphs.",
    starters:["Too much month at end of money","How do I start saving?","I have credit card debt","Should I invest right now?"] },
  { id:"doc",      emoji:"📄", label:"Send a Doc",      sub:"I'll read it for you",          dotColor:"#f59e0b",
    prompt:"You are a helpful assistant inside The Lobby app. The user pastes text from a document — contract, email, legal notice, medical report — and you explain it plainly. Flag anything important. 2-4 paragraphs.",
    starters:["Explain this contract clause","What does this report mean?","Is this email a scam?","Break down this legal notice"] },
  { id:"convo",    emoji:"🗣️", label:"Hard Convo",      sub:"Know what to say",              dotColor:"#a855f7",
    prompt:"You are a wise, empathetic communication coach inside The Lobby app. Help the user navigate a difficult conversation. What to say, how to say it. Be warm and real. Include a short script if helpful. 2-4 paragraphs.",
    starters:["I need to confront a friend","Tell my partner something hard","How do I set a boundary?","Hard talk at work"] },
  { id:"handle",   emoji:"⚡", label:"Just Handle It",  sub:"Tell me nothing. Go.",          dotColor:"#06b6d4",
    prompt:"You are the ambient AI inside The Lobby app. The user needs something handled — fast. Give a direct answer or next step immediately. No fluff. 1-3 short paragraphs.",
    starters:["I can't decide between two options","Write me a quick email","Give me a to-do list","What should I do right now?"] },
  { id:"gps",      emoji:"📍", label:"GPS Food Coach",  sub:"Knows where you are",           dotColor:"#f97316", soon:true },
  { id:"wearable", emoji:"⌚", label:"Wearable AI",     sub:"Always working for you",        dotColor:"#8b5cf6", soon:true },
];

const PLANS = [
  { id:"personal", name:"Personal",     price:"$15",  period:"/mo",      emoji:"🌱", tagline:"Life, handled.",
    color:"#64748b", border:"#e2e8f0", bg:"#f8fafc", ctaBg:"#f1f5f9", ctaColor:"#334155",
    features:["All 6 Life Tiles","GPS Food Coach","Ambient AI nudges","3 platforms · 10 posts/mo","Calendar + Spotify + Plaid"] },
  { id:"growth",   name:"Growth",       price:"$79",  period:"/mo",      emoji:"🚀", tagline:"Business, handled.",
    color:"#16a34a", border:"#bbf7d0", bg:"#f0fdf4", ctaBg:"linear-gradient(135deg,#166534,#16a34a,#22c55e)", ctaColor:"#fff",
    recommended:true, badge:"MOST POPULAR",
    features:["Everything in Personal","Wearable AI (Apple Watch, Fitbit)","13 platforms · Unlimited posts","Invoicing + CRM + AI Scripts","Unlimited image generation"] },
  { id:"pro",      name:"Professional", price:"$299", period:"/seat/mo", emoji:"⚡", tagline:"Team, handled.",
    color:"#4f46e5", border:"#c7d2fe", bg:"#eef2ff", ctaBg:"linear-gradient(135deg,#3730a3,#4f46e5,#818cf8)", ctaColor:"#fff",
    features:["Everything in Growth","Advanced wearables + HRV","Full HubSpot CRM sync","Agency client portals","Multi-seat + white-label"] },
];

const FREE_LIMIT = 2;
const SK = "lobby_v4";
const getUses = () => { try { return parseInt(localStorage.getItem(SK)||"0"); } catch { return 0; } };
const addUse  = () => { try { localStorage.setItem(SK,String(getUses()+1)); } catch {} };
const resetU  = () => { try { localStorage.setItem(SK,"0"); } catch {} };

async function askAI(sys, msg) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: sys + "\n\n" + msg }],
    }),
  });
  const data = await response.json();
  const text = data.content
    .map(item => (item.type === "text" ? item.text : ""))
    .filter(Boolean).join("\n");
  if (!text) throw new Error("No text in response");
  return text;
}

/* ── Paywall ── */
function Paywall({ onBack, onUnlock }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,background:T.bg,overflowY:"auto",padding:"20px 18px 70px",animation:"slideUp 0.3s ease"}}>
      <style>{STYLES}</style>
      <button onClick={onBack} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:100,padding:"7px 16px",fontSize:13,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:28,display:"flex",alignItems:"center",gap:6,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
        ← Back
      </button>

      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:100,padding:"5px 16px",marginBottom:14,fontSize:11,fontWeight:700,color:"#dc2626",letterSpacing:"0.06em",animation:"pulse 2s infinite"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
          2 FREE USES COMPLETE
        </div>
        <div style={{fontSize:25,fontWeight:800,color:T.text,lineHeight:1.2,marginBottom:8,letterSpacing:-0.5}}>
          You've seen what it can do.<br/>
          <span style={{background:"linear-gradient(90deg,#16a34a,#22c55e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Now make it yours.</span>
        </div>
        <div style={{fontSize:13,color:T.textSub,lineHeight:1.65}}>
          Calendar · Spotify · Plaid · GPS · Wearables<br/>
          <span style={{color:"#16a34a",fontWeight:600}}>Connected at every level.</span>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:400,margin:"0 auto"}}>
        {PLANS.map((p,i)=>(
          <div key={p.id} style={{background:p.bg,border:`1.5px solid ${p.border}`,borderRadius:18,padding:"18px",position:"relative",overflow:"hidden",animation:`fadeUp 0.4s ${i*0.08}s both`,boxShadow:p.recommended?"0 4px 20px rgba(34,197,94,0.15)":"0 1px 4px rgba(0,0,0,0.06)"}}>
            {p.badge && (
              <div style={{position:"absolute",top:-1,right:16,background:"linear-gradient(135deg,#166534,#22c55e)",borderRadius:"0 0 10px 10px",padding:"3px 10px",fontSize:9,fontWeight:800,color:"#fff",letterSpacing:"0.1em"}}>{p.badge}</div>
            )}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:p.color,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>{p.emoji} {p.name}</div>
              <div style={{fontSize:27,fontWeight:800,color:T.text,letterSpacing:-1,lineHeight:1}}>{p.price}<span style={{fontSize:12,fontWeight:400,color:T.textMuted}}>{p.period}</span></div>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:2}}>{p.tagline}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {p.features.map((f,fi)=>(
                <div key={fi} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:p.color,fontWeight:700,flexShrink:0}}>✓</span>
                  <span style={{fontSize:12,color:T.textSub,fontWeight:400}}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>onUnlock(p)} style={{width:"100%",background:p.ctaBg,border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:p.ctaColor,cursor:"pointer",boxShadow:p.recommended?"0 4px 14px rgba(34,197,94,0.35)":"0 1px 3px rgba(0,0,0,0.1)",transition:"transform 0.15s"}}
            onMouseDown={e=>e.currentTarget.style.transform="scale(0.97)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
              Get {p.name} — {p.price}/mo
            </button>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:18,fontSize:11,color:T.textMuted}}>Cancel anytime · No contracts · Replaces 10+ subscriptions</div>
    </div>
  );
}

/* ── Tile Screen ── */
function TileScreen({ tile, onBack, onPaywall }) {
  const [input,setInput]       = useState("");
  const [response,setResponse] = useState("");
  const [loading,setLoading]   = useState(false);
  const [error,setError]       = useState("");
  const [asked,setAsked]       = useState(false);
  const [lastQ,setLastQ]       = useState("");

  const go = async (q) => {
    const question = q || input.trim();
    if (!question) return;
    if (getUses() >= FREE_LIMIT) { onPaywall(); return; }
    setLoading(true); setError(""); setResponse(""); setAsked(true); setLastQ(question);
    if (q) setInput(q);
    try {
      const t = await askAI(tile.prompt, question);
      addUse();
      setResponse(t);
    } catch(e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp 0.28s ease"}}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surface,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <button onClick={onBack} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:5}}>
          ← The Lobby
        </button>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:14,background:T.bg,border:`1.5px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,position:"relative",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
            {tile.emoji}
            <span style={{position:"absolute",bottom:2,right:2,width:9,height:9,borderRadius:"50%",background:tile.dotColor,border:`1.5px solid ${T.surface}`}}/>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:-0.3}}>{tile.label}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{Math.max(0,FREE_LIMIT-getUses())} free use{FREE_LIMIT-getUses()!==1?"s":""} left</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 18px 110px",background:T.bg}}>

        {/* Starters */}
        {!asked && (
          <div style={{animation:"fadeUp 0.35s ease"}}>
            <div style={{fontSize:11,fontWeight:600,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Quick start</div>
            {tile.starters.map((s,i)=>(
              <button key={i} onClick={()=>go(s)} style={{display:"block",width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 16px",fontSize:14,fontWeight:400,color:T.text,cursor:"pointer",textAlign:"left",marginBottom:8,transition:"all 0.15s",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=tile.dotColor;e.currentTarget.style.boxShadow=`0 0 0 3px ${tile.dotColor}18`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";}}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"48px 0",animation:"fadeIn 0.3s ease"}}>
            <div style={{position:"relative",width:44,height:44}}>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid ${tile.dotColor}30`}}/>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",borderTop:`2px solid ${tile.dotColor}`,animation:"spin 0.8s linear infinite"}}/>
            </div>
            <div style={{fontSize:13,color:T.textSub}}>Thinking…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"14px",fontSize:13,color:"#dc2626",animation:"fadeUp 0.3s ease",lineHeight:1.5}}>{error}</div>
        )}

        {/* Response */}
        {response && (
          <div style={{animation:"fadeUp 0.4s ease"}}>
            {/* User bubble */}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <div style={{background:tile.dotColor,borderRadius:"16px 16px 4px 16px",padding:"12px 16px",maxWidth:"80%",fontSize:14,color:"#fff",lineHeight:1.5,fontWeight:400}}>
                {lastQ}
              </div>
            </div>
            {/* AI bubble */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"4px 16px 16px 16px",padding:"16px 18px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:22,height:22,borderRadius:7,background:`${tile.dotColor}15`,border:`1px solid ${tile.dotColor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{tile.emoji}</div>
                <span style={{fontSize:10,fontWeight:700,color:tile.dotColor,letterSpacing:"0.08em",textTransform:"uppercase"}}>The Lobby</span>
              </div>
              {response.split('\n').filter(p=>p.trim()).map((p,i,arr)=>(
                <p key={i} style={{fontSize:14,color:T.text,lineHeight:1.75,fontWeight:400,marginBottom:i<arr.length-1?12:0}}>{p}</p>
              ))}
            </div>
            <div style={{textAlign:"center",fontSize:11,color:T.textMuted}}>Ask a follow-up below</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"10px 16px 28px",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",gap:10,maxWidth:500,margin:"0 auto"}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go();}}}
            placeholder={`Ask about ${tile.label.toLowerCase()}…`}
            style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontSize:14,color:T.text,outline:"none",caretColor:tile.dotColor}}
          />
          <button onClick={()=>go()} disabled={loading||!input.trim()}
            style={{width:48,height:48,flexShrink:0,background:input.trim()&&!loading?tile.dotColor:"#e5e7eb",border:"none",borderRadius:14,fontSize:18,color:"#fff",cursor:input.trim()&&!loading?"pointer":"default",transition:"all 0.2s"}}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── HOME ── */
export default function App() {
  const [uses,setUses]             = useState(getUses());
  const [activeTile,setActiveTile] = useState(null);
  const [showPaywall,setShowPaywall] = useState(false);
  const [unlocked,setUnlocked]     = useState(null);
  const [activeNav,setActiveNav]   = useState("lobby");
  const [greeting,setGreeting]     = useState("Good morning");
  const [userName,setUserName]     = useState(() => { try { return localStorage.getItem("lobby_name") || ""; } catch { return ""; } });
  const [nameInput,setNameInput]   = useState("");
  const [showNamePrompt,setShowNamePrompt] = useState(false);

  useEffect(()=>{
    const h = new Date().getHours();
    setGreeting(h<12?"Good morning":h<17?"Good afternoon":"Good evening");
    try { if (!localStorage.getItem("lobby_name")) setShowNamePrompt(true); } catch {}
  },[]);

  const saveName = () => {
    const n = nameInput.trim();
    if (!n) return;
    try { localStorage.setItem("lobby_name", n); } catch {}
    setUserName(n);
    setShowNamePrompt(false);
  };

  const handleTile = (tile) => {
    if (tile.soon) return;
    if (uses >= FREE_LIMIT) { setShowPaywall(true); return; }
    setActiveTile(tile);
  };

  return (
    <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",background:T.bg,position:"relative",overflowX:"hidden"}}>
      <style>{STYLES}</style>

      {activeTile && (
        <TileScreen tile={activeTile}
          onBack={()=>{setUses(getUses());setActiveTile(null);}}
          onPaywall={()=>{setActiveTile(null);setShowPaywall(true);}}
        />
      )}
      {showPaywall && (
        <Paywall onBack={()=>setShowPaywall(false)}
          onUnlock={p=>{setUnlocked(p);setShowPaywall(false);resetU();setUses(0);}}
        />
      )}

      <div style={{padding:"52px 18px 100px",position:"relative",zIndex:1}}>

        {/* Name prompt — first launch only */}
      {showNamePrompt && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:T.surface,borderRadius:24,padding:"32px 24px",width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",animation:"pop 0.35s ease"}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:12}}>👋</div>
            <div style={{fontSize:20,fontWeight:800,color:T.text,textAlign:"center",marginBottom:6,letterSpacing:-0.4}}>Welcome to The Lobby</div>
            <div style={{fontSize:13,color:T.textSub,textAlign:"center",marginBottom:24,lineHeight:1.6}}>What should we call you?</div>
            <input
              autoFocus
              value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") saveName(); }}
              placeholder="Your first name"
              style={{width:"100%",background:T.inputBg,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"13px 16px",fontSize:15,color:T.text,outline:"none",marginBottom:12,textAlign:"center"}}
            />
            <button onClick={saveName} style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 14px rgba(99,102,241,0.35)"}}>
              Let's go →
            </button>
          </div>
        </div>
      )}
        {unlocked && (
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:20,animation:"pop 0.4s ease",boxShadow:"0 1px 4px rgba(34,197,94,0.15)"}}>
            <span style={{fontSize:22}}>🎉</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#15803d"}}>{unlocked.name} unlocked!</div>
              <div style={{fontSize:11,color:"#4ade80AA",color:"#16a34a"}}>Full access activated. Welcome.</div>
            </div>
          </div>
        )}

        {/* Greeting */}
        <div style={{marginBottom:22,animation:"fadeUp 0.5s ease"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#6366f1",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5}}>{greeting.toUpperCase()}</div>
          <div style={{fontSize:28,fontWeight:800,color:T.text,letterSpacing:-0.7,lineHeight:1.2,marginBottom:5}}>Hey {userName || "there"}. 👋</div>
          <div style={{fontSize:13,color:T.textSub,fontWeight:400}}>3 wins this week · You're on track</div>
        </div>

        {/* Stats bar */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",marginBottom:22,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",animation:"fadeUp 0.5s 0.05s both"}}>
          {[{v:"83%",l:"Health",c:"#f43f5e"},{v:"$214↑",l:"Saved",c:"#10b981"},{v:"6/7",l:"Goals",c:"#6366f1"}].map((s,i)=>(
            <div key={i} style={{textAlign:"center",borderLeft:i>0?`1px solid ${T.border}`:"none"}}>
              <div style={{fontSize:22,fontWeight:800,color:s.c,letterSpacing:-0.5}}>{s.v}</div>
              <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Free bar */}
        {!unlocked && (
          <div style={{marginBottom:16,animation:"fadeUp 0.4s 0.1s both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:10.5,fontWeight:600,color:T.textMuted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Free uses</span>
              <span style={{fontSize:10.5,fontWeight:700,color:uses>=FREE_LIMIT?"#ef4444":"#16a34a"}}>{uses}/{FREE_LIMIT}</span>
            </div>
            <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,width:`${Math.min((uses/FREE_LIMIT)*100,100)}%`,background:uses>=FREE_LIMIT?"linear-gradient(90deg,#f87171,#ef4444)":"linear-gradient(90deg,#22c55e,#4ade80)",transition:"width 0.5s ease"}}/>
            </div>
          </div>
        )}

        {/* Section label */}
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,animation:"fadeUp 0.4s 0.12s both"}}>
          What do you need?
        </div>

        {/* Locked warning */}
        {uses >= FREE_LIMIT && !unlocked && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"11px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:9,animation:"fadeUp 0.3s ease"}}>
            <span style={{fontSize:17}}>🔒</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#dc2626"}}>Free limit reached</div>
              <div style={{fontSize:10.5,color:"#ef4444"}}>Tap any tile to unlock unlimited access</div>
            </div>
          </div>
        )}

        {/* Tiles grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {TILES.map((tile,i)=>(
            <div key={tile.id} onClick={()=>handleTile(tile)}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius:18, padding:"18px 16px 20px",
                cursor: tile.soon?"default":"pointer",
                position:"relative", overflow:"hidden",
                opacity: tile.soon ? 0.65 : 1,
                animation:`tileIn 0.4s ${i*0.06}s both`,
                transition:"transform 0.18s,box-shadow 0.18s,border-color 0.18s",
                minHeight:128,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={e=>{ if(!tile.soon){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${tile.dotColor}22`;e.currentTarget.style.borderColor=`${tile.dotColor}60`;}}}
              onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor=T.border;}}
            >
              {tile.soon && (
                <div style={{position:"absolute",top:11,right:11,background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:20,padding:"3px 9px",fontSize:9,fontWeight:800,color:"#7c3aed",letterSpacing:"0.08em"}}>SOON</div>
              )}
              <div style={{width:44,height:44,borderRadius:13,background:`${tile.dotColor}12`,border:`1.5px solid ${tile.dotColor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:12,position:"relative",flexShrink:0}}>
                {tile.emoji}
                <span style={{position:"absolute",bottom:1,right:1,width:9,height:9,borderRadius:"50%",background:tile.dotColor,border:`1.5px solid ${T.surface}`}}/>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:4,letterSpacing:-0.2}}>{tile.label}</div>
              <div style={{fontSize:11.5,color:T.textSub,lineHeight:1.4,fontWeight:400}}>{tile.sub}</div>
            </div>
          ))}
        </div>

        {/* Connections */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",animation:"fadeUp 0.5s 0.35s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:10}}>
            Connect to unlock full power
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{icon:"📅",label:"Calendar",c:"#3b82f6"},{icon:"🎵",label:"Spotify",c:"#a855f7"},{icon:"🏦",label:"Plaid",c:"#10b981"},{icon:"📍",label:"GPS",c:"#f97316"},{icon:"⌚",label:"Wearable",c:"#6366f1"}].map((c,i)=>(
              <div key={i}
                style={{display:"flex",alignItems:"center",gap:5,background:`${c.c}0f`,border:`1px solid ${c.c}30`,borderRadius:100,padding:"5px 11px",fontSize:11,fontWeight:600,color:c.c,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${c.c}18`;e.currentTarget.style.borderColor=`${c.c}55`;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${c.c}0f`;e.currentTarget.style.borderColor=`${c.c}30`;}}
              >
                <span style={{fontSize:12}}>{c.icon}</span>{c.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.navBg,borderTop:`1px solid ${T.border}`,padding:"10px 0 22px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",zIndex:30,boxShadow:"0 -2px 10px rgba(0,0,0,0.06)"}}>
        {[{id:"lobby",icon:"⬡",label:"Lobby"},{id:"wins",icon:"📈",label:"Wins"},{id:"goals",icon:"🎯",label:"Goals"},{id:"setup",icon:"⚙️",label:"Setup"}].map(nav=>(
          <button key={nav.id} onClick={()=>setActiveNav(nav.id)}
            style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"4px 0"}}>
            <span style={{fontSize:18}}>{nav.icon}</span>
            <span style={{fontSize:10,fontWeight:activeNav===nav.id?700:500,color:activeNav===nav.id?"#6366f1":T.textMuted,letterSpacing:"0.04em",textTransform:"uppercase"}}>
              {nav.label}
            </span>
            {activeNav===nav.id && <div style={{width:4,height:4,borderRadius:"50%",background:"#6366f1",marginTop:-2}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}
