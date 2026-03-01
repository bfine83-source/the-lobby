import { useState, useEffect, useRef } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f6fa; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  input, button, textarea { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 2px; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes pop     { 0%{transform:scale(0)} 60%{transform:scale(1.12)} 100%{transform:scale(1)} }
  @keyframes tileIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes streakPop { 0%{transform:scale(1)} 50%{transform:scale(1.3)} 100%{transform:scale(1)} }
  @keyframes winSlide { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
`;

const T = {
  bg:"#f5f6fa", surface:"#ffffff", border:"#e8eaed",
  text:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  navBg:"#ffffff", inputBg:"#f9fafb",
};

/* ── Storage helpers ── */
const store = {
  get: (k, def=null) => { try { const v=localStorage.getItem(k); return v!==null?JSON.parse(v):def; } catch { return def; } },
  set: (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const FREE_LIMIT   = 10;
const MINS_PER_USE = 8; // each AI use = ~8 mins saved = $X value
const HOURLY_RATE  = 75; // $75/hr baseline "time is money"

const getUses  = ()  => store.get("lobby_uses_v5", 0);
const addUse   = ()  => store.set("lobby_uses_v5", getUses()+1);
const resetU   = ()  => store.set("lobby_uses_v5", 0);

/* Streak: increments on app open each new day + each tile use */
const getStreak = () => store.get("lobby_streak", { count:0, lastDate:"", totalUses:0, connections:0 });
const bumpStreak = (isTileUse=false) => {
  const s = getStreak();
  const today = new Date().toDateString();
  let newCount = s.count;
  if (s.lastDate !== today) newCount = s.count + 1; // new day = streak +1
  const newTotalUses = s.totalUses + (isTileUse ? 1 : 0);
  store.set("lobby_streak", { ...s, count:newCount, lastDate:today, totalUses:newTotalUses });
  return newCount;
};
const addConnection = () => {
  const s = getStreak();
  store.set("lobby_streak", { ...s, connections: (s.connections||0)+1 });
};

/* Goals */
const getGoals  = () => store.get("lobby_goals", [{ id:1, text:"Complete my first AI session", done:false }]);
const saveGoals = (g) => store.set("lobby_goals", g);

/* Wins feed */
const getWins  = () => store.get("lobby_wins", []);
const addWin   = (text) => {
  const wins = getWins();
  wins.unshift({ id:Date.now(), text, time:new Date().toLocaleString() });
  store.set("lobby_wins", wins.slice(0,50)); // keep last 50
};

/* Memory per tile */
const getMemory  = (tileId) => store.get(`lobby_mem_${tileId}`, []);
const saveMemory = (tileId, history) => store.set(`lobby_mem_${tileId}`, history.slice(-6)); // last 3 exchanges

const TILES = [
  { id:"work",     emoji:"💼", label:"Work Situation",  sub:"Meetings, emails & decisions",  dotColor:"#6366f1",
    prompt:"You are a sharp, warm work coach inside The Lobby app. The user may have shared context before — use it. Give practical, direct advice in plain language like a smart friend. 2-4 short paragraphs.",
    starters:["I have a tough meeting tomorrow","My boss is being unreasonable","I need to ask for a raise","I'm overwhelmed with work"] },
  { id:"health",   emoji:"🏥", label:"Health Check",    sub:"Food, fitness & symptoms",      dotColor:"#f43f5e",
    prompt:"You are a warm, knowledgeable health coach inside The Lobby app. The user may have shared health context before — use it. Give practical guidance like a trusted friend. Always recommend a doctor for serious issues. 2-4 short paragraphs.",
    starters:["I haven't been sleeping well","I want to eat better","I'm always tired by 3pm","I need to start exercising"] },
  { id:"money",    emoji:"💰", label:"Money Question",  sub:"Bills, savings & advice",       dotColor:"#10b981",
    prompt:"You are a clear-headed money coach inside The Lobby app. The user may have shared financial context before — use it. No jargon. Help them take one clear next step. 2-4 short paragraphs.",
    starters:["Too much month at end of money","How do I start saving?","I have credit card debt","Should I invest right now?"] },
  { id:"doc",      emoji:"📄", label:"Send a Doc",      sub:"I'll read it for you",          dotColor:"#f59e0b",
    prompt:"You are a helpful assistant inside The Lobby app. The user pastes text from a document and you explain it plainly. Flag anything important. 2-4 paragraphs.",
    starters:["Explain this contract clause","What does this report mean?","Is this email a scam?","Break down this legal notice"] },
  { id:"convo",    emoji:"🗣️", label:"Hard Convo",      sub:"Know what to say",              dotColor:"#a855f7",
    prompt:"You are a wise, empathetic communication coach inside The Lobby app. The user may have shared relationship context before — use it. Help them navigate difficult conversations. Include a short script if helpful. 2-4 paragraphs.",
    starters:["I need to confront a friend","Tell my partner something hard","How do I set a boundary?","Hard talk at work"] },
  { id:"handle",   emoji:"⚡", label:"Just Handle It",  sub:"Tell me nothing. Go.",          dotColor:"#06b6d4",
    prompt:"You are the ambient AI inside The Lobby app. The user needs something handled fast. Give a direct answer or next step immediately. No fluff. 1-3 short paragraphs.",
    starters:["I can't decide between two options","Write me a quick email","Give me a to-do list","What should I do right now?"] },
  { id:"gps",      emoji:"📍", label:"GPS Food Coach",  sub:"Knows where you are",           dotColor:"#f97316", soon:true },
  { id:"wearable", emoji:"⌚", label:"Wearable AI",     sub:"Always working for you",        dotColor:"#8b5cf6", soon:true },
];

const PLANS = [
  { id:"personal", name:"Personal", price:"$15", period:"/mo", emoji:"🌱", tagline:"Life, handled.",
    color:"#64748b", border:"#e2e8f0", bg:"#f8fafc", ctaBg:"#f1f5f9", ctaColor:"#334155",
    features:["All 6 Life Tiles · 10 free uses","GPS Food Coach","Ambient AI nudges","3 platforms · 10 posts/mo","Calendar + Spotify + Plaid"] },
  { id:"growth", name:"Growth", price:"$79", period:"/mo", emoji:"🚀", tagline:"Business, handled.",
    color:"#16a34a", border:"#bbf7d0", bg:"#f0fdf4", ctaBg:"linear-gradient(135deg,#166534,#16a34a,#22c55e)", ctaColor:"#fff",
    recommended:true, badge:"MOST POPULAR",
    features:["Everything in Personal","Wearable AI (Apple Watch, Fitbit)","13 platforms · Unlimited posts","Invoicing + CRM + AI Scripts","Unlimited image generation"] },
  { id:"pro", name:"Professional", price:"$299", period:"/seat/mo", emoji:"⚡", tagline:"Team, handled.",
    color:"#4f46e5", border:"#c7d2fe", bg:"#eef2ff", ctaBg:"linear-gradient(135deg,#3730a3,#4f46e5,#818cf8)", ctaColor:"#fff",
    features:["Everything in Growth","Advanced wearables + HRV","Full HubSpot CRM sync","Agency client portals","Multi-seat + white-label"] },
];

async function askAI(sys, msg, history=[]) {
  const res = await fetch("/api/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ system:sys, message:msg, history }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data.text) throw new Error("No response from AI");
  return data.text;
}

/* ── Paywall ── */
function Paywall({ onBack, onUnlock }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,background:T.bg,overflowY:"auto",padding:"20px 18px 70px",animation:"slideUp 0.3s ease"}}>
      <style>{STYLES}</style>
      <button onClick={onBack} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:100,padding:"7px 16px",fontSize:13,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:28,display:"flex",alignItems:"center",gap:6,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>← Back</button>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:100,padding:"5px 16px",marginBottom:14,fontSize:11,fontWeight:700,color:"#dc2626",letterSpacing:"0.06em",animation:"pulse 2s infinite"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/> FREE USES COMPLETE
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
            {p.badge && <div style={{position:"absolute",top:-1,right:16,background:"linear-gradient(135deg,#166534,#22c55e)",borderRadius:"0 0 10px 10px",padding:"3px 10px",fontSize:9,fontWeight:800,color:"#fff",letterSpacing:"0.1em"}}>{p.badge}</div>}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:p.color,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>{p.emoji} {p.name}</div>
              <div style={{fontSize:27,fontWeight:800,color:T.text,letterSpacing:-1,lineHeight:1}}>{p.price}<span style={{fontSize:12,fontWeight:400,color:T.textMuted}}>{p.period}</span></div>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:2}}>{p.tagline}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {p.features.map((f,fi)=>(
                <div key={fi} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:p.color,fontWeight:700,flexShrink:0}}>✓</span>
                  <span style={{fontSize:12,color:T.textSub}}>{f}</span>
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

/* ── Goals Screen ── */
function GoalsScreen({ onBack, onGoalComplete }) {
  const [goals, setGoals] = useState(getGoals());
  const [newText, setNewText] = useState("");

  const addGoal = () => {
    if (!newText.trim()) return;
    const updated = [...goals, { id:Date.now(), text:newText.trim(), done:false }];
    setGoals(updated); saveGoals(updated); setNewText("");
  };

  const toggleGoal = (id) => {
    const updated = goals.map(g => {
      if (g.id === id) {
        if (!g.done) {
          addWin(`✅ Goal completed: "${g.text}"`);
          onGoalComplete && onGoalComplete();
        }
        return { ...g, done:!g.done };
      }
      return g;
    });
    setGoals(updated); saveGoals(updated);
  };

  const deleteGoal = (id) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated); saveGoals(updated);
  };

  const done = goals.filter(g=>g.done).length;

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp 0.28s ease"}}>
      <style>{STYLES}</style>
      <div style={{padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surface,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <button onClick={onBack} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:5}}>← The Lobby</button>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:T.text,letterSpacing:-0.4}}>🎯 Goals</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{done}/{goals.length} completed</div>
          </div>
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"6px 14px",fontSize:13,fontWeight:700,color:"#16a34a"}}>
            {done}/{goals.length}
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 18px 120px"}}>
        {goals.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0",color:T.textMuted,fontSize:14}}>No goals yet. Add one below 👇</div>
        )}
        {goals.map((g,i)=>(
          <div key={g.id} style={{background:T.surface,border:`1px solid ${g.done?"#bbf7d0":T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12,animation:`tileIn 0.3s ${i*0.05}s both`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
            <button onClick={()=>toggleGoal(g.id)} style={{width:26,height:26,borderRadius:8,border:`2px solid ${g.done?"#22c55e":"#d1d5db"}`,background:g.done?"#22c55e":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
              {g.done && <span style={{color:"#fff",fontSize:13,fontWeight:800}}>✓</span>}
            </button>
            <div style={{flex:1,fontSize:14,color:g.done?T.textMuted:T.text,fontWeight:g.done?400:500,textDecoration:g.done?"line-through":"none",lineHeight:1.4}}>{g.text}</div>
            <button onClick={()=>deleteGoal(g.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:T.textMuted,padding:"2px 4px",opacity:0.5}}>×</button>
          </div>
        ))}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 18px 30px",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",gap:10,maxWidth:500,margin:"0 auto"}}>
          <input value={newText} onChange={e=>setNewText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addGoal();}}
            placeholder="Add a new goal…"
            style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontSize:14,color:T.text,outline:"none"}}/>
          <button onClick={addGoal} disabled={!newText.trim()} style={{width:48,height:48,flexShrink:0,background:newText.trim()?"#6366f1":"#e5e7eb",border:"none",borderRadius:14,fontSize:18,color:"#fff",cursor:newText.trim()?"pointer":"default",transition:"all 0.2s"}}>+</button>
        </div>
      </div>
    </div>
  );
}

/* ── Wins Screen ── */
function WinsScreen({ onBack }) {
  const wins = getWins();
  const streak = getStreak();
  const timeSaved = Math.round((streak.totalUses || 0) * MINS_PER_USE * (HOURLY_RATE/60));

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp 0.28s ease"}}>
      <style>{STYLES}</style>
      <div style={{padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surface,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <button onClick={onBack} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:5}}>← The Lobby</button>
        <div style={{fontSize:20,fontWeight:800,color:T.text,letterSpacing:-0.4}}>📈 Wins Feed</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Every win logged. Every move counted.</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 18px 40px"}}>
        <div style={{background:"linear-gradient(135deg,#fef9c3,#fef08a)",border:"1px solid #fde047",borderRadius:16,padding:"16px",marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
          <div style={{fontSize:36}}>🔥</div>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#92400e"}}>{streak.count} Day Streak</div>
            <div style={{fontSize:12,color:"#a16207"}}>{streak.totalUses || 0} total uses · ${timeSaved} estimated value</div>
          </div>
        </div>
        {wins.length === 0 && (
          <div style={{textAlign:"center",padding:"40px 0",color:T.textMuted,fontSize:14}}>
            Your wins will appear here.<br/>Complete goals or use the app to start your feed. 💪
          </div>
        )}
        {wins.map((w,i)=>(
          <div key={w.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 16px",marginBottom:8,animation:`winSlide 0.3s ${i*0.04}s both`,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:13,fontWeight:500,color:T.text,lineHeight:1.4}}>{w.text}</div>
            <div style={{fontSize:10,color:T.textMuted,marginTop:4}}>{w.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tile Screen ── */
function TileScreen({ tile, onBack, onPaywall, onWin }) {
  const [input,setInput]       = useState("");
  const [response,setResponse] = useState("");
  const [loading,setLoading]   = useState(false);
  const [error,setError]       = useState("");
  const [asked,setAsked]       = useState(false);
  const [lastQ,setLastQ]       = useState("");
  const [history,setHistory]   = useState(()=>getMemory(tile.id));

  const go = async (q) => {
    const question = q||input.trim();
    if (!question) return;
    if (getUses() >= FREE_LIMIT) { onPaywall(); return; }
    setLoading(true); setError(""); setResponse(""); setAsked(true); setLastQ(question);
    if (q) setInput(q);
    try {
      const text = await askAI(tile.prompt, question, history);
      addUse();
      bumpStreak(true);
      const newHistory = [...history, {role:"user",content:question}, {role:"assistant",content:text}];
      setHistory(newHistory);
      saveMemory(tile.id, newHistory);
      setResponse(text);
      addWin(`💬 ${tile.label}: "${question.slice(0,60)}${question.length>60?"…":""}"`);
      onWin && onWin();
    } catch(e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp 0.28s ease"}}>
      <style>{STYLES}</style>
      <div style={{padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surface,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <button onClick={onBack} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:5}}>← The Lobby</button>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${tile.dotColor}12`,border:`1.5px solid ${tile.dotColor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,position:"relative",flexShrink:0}}>
            {tile.emoji}
            <span style={{position:"absolute",bottom:2,right:2,width:9,height:9,borderRadius:"50%",background:tile.dotColor,border:`1.5px solid ${T.surface}`}}/>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:-0.3}}>{tile.label}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>
              {history.length > 0 ? `Remembers your last ${Math.floor(history.length/2)} exchange${history.length>2?"s":""}` : `${Math.max(0,FREE_LIMIT-getUses())} free uses left`}
            </div>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 18px 110px"}}>
        {history.length > 0 && !asked && (
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#1d4ed8",lineHeight:1.5}}>
            🧠 <strong>Memory active</strong> — The Lobby remembers your previous conversations here.
          </div>
        )}
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
        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"48px 0",animation:"fadeIn 0.3s ease"}}>
            <div style={{position:"relative",width:44,height:44}}>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid ${tile.dotColor}30`}}/>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",borderTop:`2px solid ${tile.dotColor}`,animation:"spin 0.8s linear infinite"}}/>
            </div>
            <div style={{fontSize:13,color:T.textSub}}>Thinking…</div>
          </div>
        )}
        {error && <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"14px",fontSize:13,color:"#dc2626",animation:"fadeUp 0.3s ease",lineHeight:1.5}}>{error}</div>}
        {response && (
          <div style={{animation:"fadeUp 0.4s ease"}}>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <div style={{background:tile.dotColor,borderRadius:"16px 16px 4px 16px",padding:"12px 16px",maxWidth:"80%",fontSize:14,color:"#fff",lineHeight:1.5}}>{lastQ}</div>
            </div>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"4px 16px 16px 16px",padding:"16px 18px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:22,height:22,borderRadius:7,background:`${tile.dotColor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{tile.emoji}</div>
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

      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"10px 16px 28px",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",gap:10,maxWidth:500,margin:"0 auto"}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go();}}}
            placeholder={`Ask about ${tile.label.toLowerCase()}…`}
            style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontSize:14,color:T.text,outline:"none",caretColor:tile.dotColor}}/>
          <button onClick={()=>go()} disabled={loading||!input.trim()}
            style={{width:48,height:48,flexShrink:0,background:input.trim()&&!loading?tile.dotColor:"#e5e7eb",border:"none",borderRadius:14,fontSize:18,color:"#fff",cursor:input.trim()&&!loading?"pointer":"default",transition:"all 0.2s"}}>↑</button>
        </div>
      </div>
    </div>
  );
}

/* ── HOME ── */
export default function App() {
  const [uses,setUses]             = useState(getUses());
  const [streak,setStreak]         = useState(getStreak());
  const [goals,setGoals]           = useState(getGoals());
  const [wins,setWins]             = useState(getWins());
  const [activeTile,setActiveTile] = useState(null);
  const [showPaywall,setShowPaywall] = useState(false);
  const [showGoals,setShowGoals]   = useState(false);
  const [showWins,setShowWins]     = useState(false);
  const [unlocked,setUnlocked]     = useState(null);
  const [activeNav,setActiveNav]   = useState("lobby");
  const [greeting,setGreeting]     = useState("Good morning");
  const [streakAnim,setStreakAnim] = useState(false);

  useEffect(()=>{
    const h = new Date().getHours();
    setGreeting(h<12?"Good morning":h<17?"Good afternoon":"Good evening");
    // bump streak on app open
    const newStreak = bumpStreak(false);
    setStreak(getStreak());
    addWin(`🚀 Opened The Lobby`);
    setWins(getWins());
  },[]);

  const refreshStats = () => {
    setUses(getUses());
    setStreak(getStreak());
    setGoals(getGoals());
    setWins(getWins());
  };

  const handleTile = (tile) => {
    if (tile.soon) return;
    if (uses >= FREE_LIMIT && !unlocked) { setShowPaywall(true); return; }
    setActiveTile(tile);
  };

  const handleNav = (id) => {
    setActiveNav(id);
    if (id==="goals") setShowGoals(true);
    else if (id==="wins") setShowWins(true);
  };

  // Computed stats
  const streakCount = streak.count || 0;
  const totalUses   = streak.totalUses || 0;
  const timeSavedDollars = Math.round(totalUses * MINS_PER_USE * (HOURLY_RATE/60));
  const doneGoals   = goals.filter(g=>g.done).length;
  const totalGoals  = goals.length;

  // Streak label
  const streakLabel = streakCount === 0 ? "Start streak" : streakCount < 3 ? "Building 🔥" : streakCount < 7 ? "On fire 🔥" : "Unstoppable 🔥";

  return (
    <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",background:T.bg,position:"relative",overflowX:"hidden"}}>
      <style>{STYLES}</style>

      {activeTile && (
        <TileScreen tile={activeTile}
          onBack={()=>{ refreshStats(); setActiveTile(null); setActiveNav("lobby"); }}
          onPaywall={()=>{ setActiveTile(null); setShowPaywall(true); }}
          onWin={()=>{ refreshStats(); }}
        />
      )}
      {showPaywall && (
        <Paywall onBack={()=>setShowPaywall(false)}
          onUnlock={p=>{ setUnlocked(p); setShowPaywall(false); resetU(); setUses(0); addWin(`🔓 Unlocked ${p.name} plan`); setWins(getWins()); }}
        />
      )}
      {showGoals && (
        <GoalsScreen onBack={()=>{ setShowGoals(false); setActiveNav("lobby"); refreshStats(); }}
          onGoalComplete={refreshStats}
        />
      )}
      {showWins && (
        <WinsScreen onBack={()=>{ setShowWins(false); setActiveNav("lobby"); }}/>
      )}

      <div style={{padding:"52px 18px 100px",position:"relative",zIndex:1}}>

        {/* Unlock banner */}
        {unlocked && (
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:20,animation:"pop 0.4s ease",boxShadow:"0 1px 4px rgba(34,197,94,0.15)"}}>
            <span style={{fontSize:22}}>🎉</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#15803d"}}>{unlocked.name} unlocked!</div>
              <div style={{fontSize:11,color:"#16a34a"}}>Full access activated. Welcome.</div>
            </div>
          </div>
        )}

        {/* Greeting */}
        <div style={{marginBottom:22,animation:"fadeUp 0.5s ease"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#6366f1",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5}}>{greeting.toUpperCase()}</div>
          <div style={{fontSize:26,fontWeight:800,color:T.text,letterSpacing:-0.7,lineHeight:1.2,marginBottom:4}}>Hey, Boss. 👊</div>
          <div style={{fontSize:14,fontWeight:600,color:"#6366f1"}}>Let's Make It Happen.</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:3}}>{streakLabel} · {totalUses} situations handled</div>
        </div>

        {/* Stats bar — Streak | Time Saved | Goals */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",marginBottom:22,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",animation:"fadeUp 0.5s 0.05s both"}}>
          {/* Streak */}
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#f97316",letterSpacing:-0.5,animation:streakAnim?"streakPop 0.4s ease":""}}>{streakCount}🔥</div>
            <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>Streak</div>
          </div>
          {/* Time Saved */}
          <div style={{textAlign:"center",borderLeft:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`}}>
            <div style={{fontSize:22,fontWeight:800,color:"#10b981",letterSpacing:-0.5}}>${timeSavedDollars}</div>
            <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>Time Saved</div>
          </div>
          {/* Goals */}
          <div style={{textAlign:"center",cursor:"pointer"}} onClick={()=>{ setShowGoals(true); setActiveNav("goals"); }}>
            <div style={{fontSize:22,fontWeight:800,color:"#6366f1",letterSpacing:-0.5}}>{doneGoals}/{totalGoals}</div>
            <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>Goals</div>
          </div>
        </div>

        {/* Free use bar */}
        {!unlocked && (
          <div style={{marginBottom:16,animation:"fadeUp 0.4s 0.1s both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:10.5,fontWeight:600,color:T.textMuted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Free uses</span>
              <span style={{fontSize:10.5,fontWeight:700,color:uses>=FREE_LIMIT?"#ef4444":"#16a34a"}}>{uses}/{FREE_LIMIT}</span>
            </div>
            <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,width:`${Math.min((uses/FREE_LIMIT)*100,100)}%`,background:uses>=FREE_LIMIT?"linear-gradient(90deg,#f87171,#ef4444)":"linear-gradient(90deg,#6366f1,#818cf8)",transition:"width 0.5s ease"}}/>
            </div>
          </div>
        )}

        {/* Section label */}
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,animation:"fadeUp 0.4s 0.12s both"}}>What do you need?</div>

        {/* Locked */}
        {uses >= FREE_LIMIT && !unlocked && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"11px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:9,animation:"fadeUp 0.3s ease"}}>
            <span style={{fontSize:17}}>🔒</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#dc2626"}}>Free limit reached</div>
              <div style={{fontSize:10.5,color:"#ef4444"}}>Tap any tile to unlock unlimited access</div>
            </div>
          </div>
        )}

        {/* Tiles */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {TILES.map((tile,i)=>(
            <div key={tile.id} onClick={()=>handleTile(tile)}
              style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"18px 16px 20px",cursor:tile.soon?"default":"pointer",position:"relative",overflow:"hidden",opacity:tile.soon?0.65:1,animation:`tileIn 0.4s ${i*0.06}s both`,transition:"transform 0.18s,box-shadow 0.18s,border-color 0.18s",minHeight:128,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}
              onMouseEnter={e=>{ if(!tile.soon){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${tile.dotColor}22`;e.currentTarget.style.borderColor=`${tile.dotColor}60`;}}}
              onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor=T.border;}}
            >
              {tile.soon && <div style={{position:"absolute",top:11,right:11,background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:20,padding:"3px 9px",fontSize:9,fontWeight:800,color:"#7c3aed",letterSpacing:"0.08em"}}>SOON</div>}
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
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",animation:"fadeUp 0.5s 0.35s both",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:10}}>Connect to unlock full power</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{icon:"📅",label:"Calendar",c:"#3b82f6"},{icon:"🎵",label:"Spotify",c:"#a855f7"},{icon:"🏦",label:"Plaid",c:"#10b981"},{icon:"📍",label:"GPS",c:"#f97316"},{icon:"⌚",label:"Wearable",c:"#6366f1"}].map((c,i)=>(
              <div key={i} onClick={()=>{ addConnection(); setStreak(getStreak()); addWin(`🔗 Connected ${c.label}`); setWins(getWins()); }}
                style={{display:"flex",alignItems:"center",gap:5,background:`${c.c}0f`,border:`1px solid ${c.c}30`,borderRadius:100,padding:"5px 11px",fontSize:11,fontWeight:600,color:c.c,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${c.c}18`;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${c.c}0f`;}}
              ><span style={{fontSize:12}}>{c.icon}</span>{c.label}</div>
            ))}
          </div>
        </div>

        {/* Wins Feed Preview */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",animation:"fadeUp 0.5s 0.4s both"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:"0.09em",textTransform:"uppercase"}}>📈 Wins Feed</div>
            <button onClick={()=>{ setShowWins(true); setActiveNav("wins"); }} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:"#6366f1"}}>See all →</button>
          </div>
          {wins.length===0 && <div style={{fontSize:12,color:T.textMuted,textAlign:"center",padding:"8px 0"}}>Your wins appear here. Start using the app! 💪</div>}
          {wins.slice(0,3).map((w,i)=>(
            <div key={w.id} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:i<2?10:0,animation:`winSlide 0.3s ${i*0.06}s both`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",flexShrink:0,marginTop:5}}/>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.text,lineHeight:1.4}}>{w.text}</div>
                <div style={{fontSize:10,color:T.textMuted}}>{w.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.navBg,borderTop:`1px solid ${T.border}`,padding:"10px 0 22px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",zIndex:30,boxShadow:"0 -2px 10px rgba(0,0,0,0.06)"}}>
        {[{id:"lobby",icon:"⬡",label:"Lobby"},{id:"wins",icon:"📈",label:"Wins"},{id:"goals",icon:"🎯",label:"Goals"},{id:"setup",icon:"⚙️",label:"Setup"}].map(nav=>(
          <button key={nav.id} onClick={()=>handleNav(nav.id)}
            style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"4px 0"}}>
            <span style={{fontSize:18}}>{nav.icon}</span>
            <span style={{fontSize:10,fontWeight:activeNav===nav.id?700:500,color:activeNav===nav.id?"#6366f1":T.textMuted,letterSpacing:"0.04em",textTransform:"uppercase"}}>{nav.label}</span>
            {activeNav===nav.id && <div style={{width:4,height:4,borderRadius:"50%",background:"#6366f1",marginTop:-2}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}
