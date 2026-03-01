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
  @keyframes tileIn  { 0%{opacity:0;transform:translateY(22px) scale(0.95)} 70%{transform:translateY(-4px) scale(1.02)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes streakPop { 0%{transform:scale(1)} 50%{transform:scale(1.3)} 100%{transform:scale(1)} }
  @keyframes winSlide { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
  @keyframes shimmer { 0%{transform:translateX(-100%) skewX(-15deg)} 100%{transform:translateX(350%) skewX(-15deg)} }
  @keyframes slotRoll { 0%{transform:translateY(-4px);opacity:0.3} 60%{transform:translateY(2px)} 100%{transform:translateY(0);opacity:1} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes fireFloat { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-4px) rotate(3deg)} }
  @keyframes statGlow { 0%{opacity:0;transform:scale(0.85)} 60%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
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
  { id:"work",     emoji:"💼", label:"Work Situation",      sub:"Meetings, emails & decisions",  dotColor:"#6366f1",
    prompt:"You are a sharp, warm work coach inside The Lobby app. The user may have shared context before — use it. Give practical, direct advice in plain language like a smart friend. 2-4 short paragraphs.",
    starters:["I have a tough meeting tomorrow","My boss is being unreasonable","I need to ask for a raise","I'm overwhelmed with work"] },
  { id:"sales",    emoji:"🏆", label:"Sales Strategy",      sub:"Scripts, objections & roleplay",dotColor:"#D4AF37", isSales:true },
  { id:"money",    emoji:"💰", label:"Money Question",      sub:"Bills, savings & advice",       dotColor:"#10b981",
    prompt:"You are a clear-headed money coach inside The Lobby app. The user may have shared financial context before — use it. No jargon. Help them take one clear next step. 2-4 short paragraphs.",
    starters:["Too much month at end of money","How do I start saving?","I have credit card debt","Should I invest right now?"] },
  { id:"doc",      emoji:"📄", label:"Send a Doc",          sub:"I'll read it for you",          dotColor:"#f59e0b",
    prompt:"You are a helpful assistant inside The Lobby app. The user pastes text from a document and you explain it plainly. Flag anything important. 2-4 paragraphs.",
    starters:["Explain this contract clause","What does this report mean?","Is this email a scam?","Break down this legal notice"] },
  { id:"convo",    emoji:"🗣️", label:"Hard Convo",          sub:"Know what to say",              dotColor:"#a855f7",
    prompt:"You are a wise, empathetic communication coach inside The Lobby app. The user may have shared relationship context before — use it. Help them navigate difficult conversations. Include a short script if helpful. 2-4 paragraphs.",
    starters:["I need to confront a friend","Tell my partner something hard","How do I set a boundary?","Hard talk at work"] },
  { id:"handle",   emoji:"⚡", label:"Just Handle It",      sub:"Tell me nothing. Go.",          dotColor:"#06b6d4",
    prompt:"You are the ambient AI inside The Lobby app. The user needs something handled fast. Give a direct answer or next step immediately. No fluff. 1-3 short paragraphs.",
    starters:["I can't decide between two options","Write me a quick email","Give me a to-do list","What should I do right now?"] },
  { id:"health",   emoji:"🏥", label:"Health Check",        sub:"Food, fitness & symptoms",      dotColor:"#f43f5e",
    prompt:"You are a warm, knowledgeable health coach inside The Lobby app. The user may have shared health context before — use it. Give practical guidance like a trusted friend. Always recommend a doctor for serious issues. 2-4 short paragraphs.",
    starters:["I haven't been sleeping well","I want to eat better","I'm always tired by 3pm","I need to start exercising"] },
  { id:"gps",      emoji:"📍", label:"GPS Food Coach",      sub:"Coming soon",                   dotColor:"#f97316", soon:true },
  { id:"wearable", emoji:"⌚", label:"Wearable AI",         sub:"Coming soon",                   dotColor:"#8b5cf6", soon:true },
  { id:"social",   emoji:"📱", label:"Socials Manager",        sub:"Coming soon",                   dotColor:"#ec4899", soon:true },
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

/* ── Sales War Room ── */
const SALES_COLOR = "#D4AF37";
const TRADES = ["HVAC","Roofing","Windows","Kitchen & Bath","Retail Sales"];
const QUOTES = [
  "Confused people don't buy. Clear people do.",
  "Price is only an issue when value is unclear.",
  "You're not selling a product. You're selling certainty.",
  "Leadership closes. Information doesn't.",
  "If you don't control the process, the homeowner will.",
  "Emotion decides. Logic justifies.",
  "Urgency is a gift, not pressure.",
  "The close starts in the first 3 minutes.",
  "Confidence transfers.",
  "The deal is lost when the rep hesitates.",
  "Pre-selling happens before you ring the doorbell.",
  "Most homeowners need a leader — be one.",
  "You were hired to guide decisions, not make presentations.",
  "The rep who assumes the close most often gets it.",
  "Silence after a close is golden. Don't fill it.",
];
const OBJECTIONS = [
  { id:"spouse", emoji:"👫", title:"I need to talk to my spouse.", reality:"One spouse isn't fully convinced. This is a trust gap, not a logistics problem.", meaning:"They're uncertain. They want permission to say yes.", tone:"calm",
    script:`"Of course you do — and let me ask you something. If your spouse was sitting right here right now, what question would they ask me?"\n\n[Pause. Let them answer.]\n\n"Perfect. Let's handle that now so when you talk to them, you're both clear — and they're not making a decision without the full picture."\n\nControl. Calm. Leadership.` },
  { id:"quotes", emoji:"📋", title:"We're getting a few more quotes.", reality:"They're shopping for certainty, not price. They don't trust the decision yet.", meaning:"They're overwhelmed and need someone to lead them.", tone:"controlled",
    script:`"I completely understand — and I respect that.\n\nLet me ask you something though: If all three companies came in at the same price, who would you feel most confident moving forward with?\n\n[Pause.]\n\nBecause here's the truth — confidence matters more than quotes. So before you go anywhere else, let's make sure you feel completely clear about what you're getting and why it makes sense."\n\nShift the game from price to certainty.` },
  { id:"price", emoji:"💰", title:"It's more than we expected.", reality:"The value wasn't tied tightly enough to their pain.", meaning:"They don't fully see the value yet — that's on the rep.", tone:"energetic",
    script:`"I hear you — and I want to make sure we're looking at this the right way.\n\nWhat's it costing you every month this problem goes unresolved?\n\nWhen you look at it that way, what we're really talking about is a few dollars a day — and what that buys you is certainty, comfort, and this never being a problem again.\n\nMost of our customers tell us the only thing they regret is waiting."\n\nPrice is only an issue when value is unclear.` },
  { id:"timing", emoji:"⏰", title:"We're just not ready yet.", reality:"Urgency wasn't established. They don't feel the cost of waiting.", meaning:"They don't trust the timing — they need a reason to move now.", tone:"calm",
    script:`"I completely respect that — can I ask what 'ready' looks like for you?\n\n[Listen.]\n\nThe reason I ask is — most homeowners who wait a season end up dealing with escalating costs or emergency repairs.\n\nI'm not here to pressure you. I'm here to make sure you have the full picture so when you do decide, you're deciding with confidence — not reacting to an emergency."\n\nUrgency is a gift. Not pressure.` },
  { id:"writing", emoji:"📄", title:"Can you send it in writing?", reality:"They're not committed. They're looking for an exit ramp.", meaning:"They're afraid of making a big decision in the moment.", tone:"controlled",
    script:`"Absolutely — I'll make sure you have everything in writing.\n\nBefore I do, I want to make sure what I send you actually makes sense for your situation. Is there anything about what we discussed today that felt unclear or off?\n\n[Listen fully.]\n\nBecause I'd rather resolve that now than have you read a proposal without context. What would need to be true for this to feel like a clear yes?"\n\nNever let them leave without surfacing the real objection.` },
];
const MYTHS = [
  { myth:"Good products sell themselves.", reality:"They don't. Clear leadership closes. Information informs. Leadership sells.", fix:"Lead the homeowner. Don't present to them." },
  { myth:"If they want it, they'll buy.", reality:"Most homeowners need leadership, not options. Indecision is the default.", fix:"Make the decision easy. Remove friction. Create certainty." },
  { myth:"More quotes means they're serious buyers.", reality:"More quotes means they're shopping for confidence, not price. The rep who creates the most certainty wins.", fix:"Stop competing on price. Win on trust." },
  { myth:"The objection is the real reason.", reality:"'I need to think about it' means 'I'm not certain yet.' The objection is a symptom.", fix:"Ask what 'thinking about it' looks like. Surface the real concern." },
  { myth:"A lower price closes more deals.", reality:"Discounting signals desperation and destroys value. Confident reps rarely discount.", fix:"Reinforce value. Never apologize for your price." },
];
const SCENARIOS = {
  "HVAC":["Homeowner says unit works fine but it's 15 years old","Price shock on a full system replacement","Spouse not home during appointment","Competing with a quote $800 cheaper"],
  "Roofing":["Insurance claim situation — they're confused","They want to wait until spring","'My neighbor used someone else and paid less'","They're getting 4 quotes"],
  "Windows":["Sticker shock on whole-home replacement","They want to do 'just a few windows'","'We're thinking of selling in 2 years'","Financing hesitation"],
  "Kitchen & Bath":["Budget is $15k but the job is $28k","'We want to think about the design more'","Spouse loves it, other is hesitant","'Can we phase this over two years?'"],
  "Retail Sales":["Customer comparing to online price","'I can get it cheaper at competitor'","Upsell resistance on protection plan","Customer wants discount before deciding"],
};

function ObjDetail({ obj, onBack }) {
  const toneColor = obj.tone==="calm"?"#6366f1":obj.tone==="energetic"?"#f97316":"#10b981";
  const toneLabel = obj.tone==="calm"?"Calm & Controlled":obj.tone==="energetic"?"High Energy":"Controlled";
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:T.bg,overflowY:"auto",padding:"20px 18px 60px",animation:"slideUp 0.25s ease"}}>
      <style>{STYLES}</style>
      <button onClick={onBack} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:20,display:"flex",alignItems:"center",gap:5}}>← Objections</button>
      <div style={{fontSize:24,marginBottom:6}}>{obj.emoji}</div>
      <div style={{fontSize:18,fontWeight:800,color:T.text,marginBottom:16,letterSpacing:-0.3,lineHeight:1.3}}>"{obj.title}"</div>
      <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#92400e",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>What They Actually Mean</div>
        <div style={{fontSize:13,color:"#78350f",lineHeight:1.6}}>{obj.meaning}</div>
      </div>
      <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#991b1b",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>The Reality</div>
        <div style={{fontSize:13,color:"#7f1d1d",lineHeight:1.6}}>{obj.reality}</div>
      </div>
      <div style={{background:T.surface,border:`1.5px solid ${toneColor}30`,borderRadius:14,padding:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{background:`${toneColor}15`,border:`1px solid ${toneColor}30`,borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,color:toneColor,letterSpacing:"0.06em"}}>{toneLabel}</div>
          <div style={{fontSize:10,fontWeight:600,color:T.textMuted,letterSpacing:"0.06em",textTransform:"uppercase"}}>The Script</div>
        </div>
        {obj.script.split('\n').map((line,i)=>(
          <p key={i} style={{fontSize:13,color:line.startsWith('"')||line.startsWith("[")?T.text:T.textSub,fontWeight:line.startsWith('"')?500:400,lineHeight:1.7,marginBottom:6,fontStyle:line.startsWith("[")?'italic':'normal'}}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function MythDetail({ myth, onBack }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:T.bg,overflowY:"auto",padding:"20px 18px 60px",animation:"slideUp 0.25s ease"}}>
      <style>{STYLES}</style>
      <button onClick={onBack} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:20,display:"flex",alignItems:"center",gap:5}}>← Myths</button>
      <div style={{fontSize:11,fontWeight:700,color:"#dc2626",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>💀 The Myth</div>
      <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:20,lineHeight:1.3,letterSpacing:-0.3}}>"{myth.myth}"</div>
      {!flipped
        ? <button onClick={()=>setFlipped(true)} style={{width:"100%",background:"linear-gradient(135deg,#dc2626,#ef4444)",border:"none",borderRadius:16,padding:"18px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 14px rgba(220,38,38,0.3)"}}>Flip the Myth → See the Truth</button>
        : <>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"16px",marginBottom:12,animation:"pop 0.3s ease"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#166534",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>✅ The Reality</div>
              <div style={{fontSize:14,fontWeight:600,color:"#14532d",lineHeight:1.6}}>{myth.reality}</div>
            </div>
            <div style={{background:`${SALES_COLOR}15`,border:`1px solid ${SALES_COLOR}40`,borderRadius:14,padding:"16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#92400e",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>⚡ What To Do Instead</div>
              <div style={{fontSize:13,fontWeight:500,color:T.text,lineHeight:1.6}}>{myth.fix}</div>
            </div>
          </>
      }
    </div>
  );
}

function RolePlay({ onBack }) {
  const [trade,setTrade]       = useState("");
  const [scenario,setScenario] = useState("");
  const [input,setInput]       = useState("");
  const [messages,setMessages] = useState([]);
  const [loading,setLoading]   = useState(false);
  const [started,setStarted]   = useState(false);

  const startSession = async () => {
    if (!trade||!scenario) return;
    setStarted(true); setLoading(true);
    const sys = `You are playing the role of a skeptical homeowner during an in-home sales appointment for ${trade}. Scenario: ${scenario}. Push back realistically using real objections. Be firm but not rude. Natural conversational language. After 4-5 exchanges give brief coaching feedback. Keep responses 2-4 sentences.`;
    try {
      const text = await askAI(sys, `Start the role play as the homeowner. Open with a natural 1-2 sentence statement that sets up this scenario: "${scenario}"`,[]);
      setMessages([{role:"assistant",content:text}]);
    } catch(e) { setMessages([{role:"assistant",content:"Let's start. Tell me about what you're offering."}]); }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim()||loading) return;
    const sys = `You are a skeptical homeowner in a ${trade} sales appointment. Scenario: ${scenario}. Stay in character. Push back realistically. After 4-5 exchanges give brief coaching feedback on what the rep did well and what to improve. Keep responses short.`;
    const newMsg = {role:"user",content:input.trim()};
    const updated = [...messages,newMsg];
    setMessages(updated); setInput(""); setLoading(true);
    try {
      const text = await askAI(sys, input.trim(), messages);
      setMessages([...updated,{role:"assistant",content:text}]);
    } catch(e) { setMessages([...updated,{role:"assistant",content:"Try again."}]); }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp 0.25s ease"}}>
      <style>{STYLES}</style>
      <div style={{padding:"52px 18px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surface}}>
        <button onClick={onBack} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:14,display:"flex",alignItems:"center",gap:5}}>← Sales Strategy</button>
        <div style={{fontSize:17,fontWeight:800,color:T.text}}>🎭 Role Play</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>The Lobby plays the homeowner. You practice closing.</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 18px 110px"}}>
        {!started ? (
          <>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Choose your trade</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              {TRADES.map(t=>(
                <button key={t} onClick={()=>{setTrade(t);setScenario("");}} style={{background:trade===t?SALES_COLOR:T.surface,border:`1.5px solid ${trade===t?SALES_COLOR:T.border}`,borderRadius:100,padding:"8px 16px",fontSize:13,fontWeight:600,color:trade===t?"#fff":T.text,cursor:"pointer",transition:"all 0.15s"}}>{t}</button>
              ))}
            </div>
            {trade && <>
              <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Choose your scenario</div>
              {(SCENARIOS[trade]||[]).map((s,i)=>(
                <button key={i} onClick={()=>setScenario(s)} style={{display:"block",width:"100%",background:scenario===s?`${SALES_COLOR}15`:T.surface,border:`1.5px solid ${scenario===s?SALES_COLOR:T.border}`,borderRadius:12,padding:"13px 16px",fontSize:13,fontWeight:500,color:T.text,cursor:"pointer",textAlign:"left",marginBottom:8,transition:"all 0.15s"}}>{s}</button>
              ))}
              {scenario && <button onClick={startSession} style={{width:"100%",background:"linear-gradient(135deg,#1a237e,#1565c0,#0277bd)",border:`1px solid ${SALES_COLOR}`,borderRadius:14,padding:"15px",fontSize:14,fontWeight:700,color:SALES_COLOR,cursor:"pointer",marginTop:8,boxShadow:`0 4px 14px rgba(21,101,192,0.4)`}}>🎭 Start Role Play →</button>}
            </>}
          </>
        ) : (
          <>
            <div style={{background:`${SALES_COLOR}15`,border:`1px solid ${SALES_COLOR}30`,borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e",fontWeight:500}}>🎭 {trade} · {scenario}</div>
            {messages.map((m,i)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:4,letterSpacing:"0.06em",textTransform:"uppercase"}}>{m.role==="user"?"You (Rep)":"🏠 Homeowner"}</div>
                <div style={{background:m.role==="user"?"#6366f1":T.surface,border:`1px solid ${m.role==="user"?"transparent":T.border}`,borderRadius:m.role==="user"?"16px 16px 4px 16px":"4px 16px 16px 16px",padding:"12px 16px",fontSize:14,color:m.role==="user"?"#fff":T.text,lineHeight:1.6,maxWidth:"88%",marginLeft:m.role==="user"?"auto":"0"}}>{m.content}</div>
              </div>
            ))}
            {loading && <div style={{fontSize:13,color:T.textMuted,padding:"8px 0",fontStyle:"italic"}}>Homeowner is responding…</div>}
          </>
        )}
      </div>
      {started && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"10px 16px 28px",background:T.surface,borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",gap:10}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send();}} placeholder="Your response to the homeowner…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontSize:14,color:T.text,outline:"none"}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{width:48,height:48,flexShrink:0,background:input.trim()&&!loading?SALES_COLOR:"#e5e7eb",border:"none",borderRadius:14,fontSize:18,color:"#fff",cursor:input.trim()&&!loading?"pointer":"default"}}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrepScreen({ onBack }) {
  const [trade,setTrade]     = useState("");
  const [situation,setSit]   = useState("");
  const [result,setResult]   = useState("");
  const [loading,setLoading] = useState(false);

  const generate = async () => {
    if (!trade||!situation) return;
    setLoading(true); setResult("");
    const sys = `You are an elite in-home sales coach for the home improvement industry. Give a pre-call brief for a ${trade} sales rep. Be specific, sharp, and field-ready. Format your response with these 4 sections: LEAD WITH | EXPECT THIS OBJECTION | YOUR CLOSE | MINDSET REMINDER. Mix calm authority and high energy. Under 150 words total.`;
    try { const text = await askAI(sys,`Trade: ${trade}. Situation: ${situation}. Give me my pre-call brief.`); setResult(text); }
    catch(e) { setResult("Error generating. Check your connection."); }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:T.bg,overflowY:"auto",padding:"20px 18px 60px",animation:"slideUp 0.25s ease"}}>
      <style>{STYLES}</style>
      <button onClick={onBack} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:T.textSub,cursor:"pointer",marginBottom:20,display:"flex",alignItems:"center",gap:5}}>← Sales Strategy</button>
      <div style={{fontSize:17,fontWeight:800,color:T.text,marginBottom:4}}>⚡ Pre-Call Prep</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:20}}>60-second brief before you ring the doorbell.</div>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Your trade</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
        {TRADES.map(t=><button key={t} onClick={()=>setTrade(t)} style={{background:trade===t?SALES_COLOR:T.surface,border:`1.5px solid ${trade===t?SALES_COLOR:T.border}`,borderRadius:100,padding:"7px 14px",fontSize:12,fontWeight:600,color:trade===t?"#fff":T.text,cursor:"pointer",transition:"all 0.15s"}}>{t}</button>)}
      </div>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>The situation</div>
      <textarea value={situation} onChange={e=>setSit(e.target.value)} placeholder="e.g. Couple in their 60s, 20-year-old HVAC, fixed income, already got one quote $200 cheaper…" rows={3}
        style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontSize:14,color:T.text,outline:"none",resize:"none",marginBottom:16,lineHeight:1.5}}/>
      <button onClick={generate} disabled={!trade||!situation||loading} style={{width:"100%",background:trade&&situation?"linear-gradient(135deg,#1a237e,#1565c0,#0277bd)":"#e5e7eb",border:`1px solid ${trade&&situation?SALES_COLOR:"transparent"}`,borderRadius:14,padding:"15px",fontSize:14,fontWeight:700,color:trade&&situation?SALES_COLOR:"#9ca3af",cursor:trade&&situation?"pointer":"default",marginBottom:20,boxShadow:trade&&situation?`0 4px 14px rgba(21,101,192,0.35)`:"none"}}>
        {loading?"Generating brief…":"⚡ Generate My Brief"}
      </button>
      {result && (
        <div style={{background:T.surface,border:`1.5px solid ${SALES_COLOR}40`,borderRadius:16,padding:"18px",animation:"fadeUp 0.3s ease"}}>
          <div style={{fontSize:10,fontWeight:700,color:SALES_COLOR,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>⚡ Your Pre-Call Brief</div>
          {result.split('\n').filter(l=>l.trim()).map((line,i)=>(
            <p key={i} style={{fontSize:14,color:T.text,lineHeight:1.7,marginBottom:8,fontWeight:line.includes("|")||line.toUpperCase()===line?600:400}}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function SalesTile({ onBack }) {
  const [view,setView]           = useState("home");
  const [activeObj,setActiveObj] = useState(null);
  const [activeMyth,setActiveMyth] = useState(null);
  const [quoteIdx,setQuoteIdx]   = useState(()=>Math.floor(Math.random()*QUOTES.length));

  const WEAPONS = [
    { id:"objections", emoji:"🎯", label:"Objection Crusher",  sub:"5 objections. Real scripts.", color:"#6366f1" },
    { id:"scripts",    emoji:"📜", label:"Script Library",     sub:"Word-for-word closes.",       color:"#10b981" },
    { id:"myths",      emoji:"💀", label:"Myth Buster",        sub:"Flip 5 deal-killing myths.", color:"#f43f5e" },
    { id:"prep",       emoji:"⚡", label:"Pre-Call Prep",      sub:"60-sec brief. Walk in ready.",color:SALES_COLOR },
    { id:"quote",      emoji:"💬", label:"Fire Quotes",        sub:"Shot of clarity. Tap for next.",color:"#a855f7" },
    { id:"roleplay",   emoji:"🎭", label:"Role Play",          sub:"Practice the hard scenarios.", color:"#f97316" },
  ];

  if (view==="objections"&&activeObj) return <ObjDetail obj={activeObj} onBack={()=>{setActiveObj(null);setView("objections");}}/>;
  if (view==="myths"&&activeMyth)     return <MythDetail myth={activeMyth} onBack={()=>{setActiveMyth(null);setView("myths");}}/>;
  if (view==="prep")     return <PrepScreen onBack={()=>setView("home")}/>;
  if (view==="roleplay") return <RolePlay onBack={()=>setView("home")}/>;

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <style>{STYLES}</style>
      <div style={{padding:"52px 18px 16px",borderBottom:`1px solid rgba(212,175,55,0.4)`,flexShrink:0,background:"linear-gradient(135deg,#1a237e 0%,#1565c0 50%,#0277bd 100%)",position:"sticky",top:0,zIndex:10}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:100,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",marginBottom:14,display:"flex",alignItems:"center",gap:5}}>← The Lobby</button>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.15)",border:`1.5px solid ${SALES_COLOR}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏆</div>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:-0.3}}>Sales Strategy</div>
            <div style={{fontSize:11,color:SALES_COLOR,fontWeight:600,marginTop:1}}>The Sales Professional's Tool for Success</div>
          </div>
        </div>
      </div>
      <div style={{padding:"20px 18px 80px",background:T.bg,flex:1}}>
        {/* Fire Quote card */}
        {view==="home" && (
          <div onClick={()=>setQuoteIdx(i=>(i+1)%QUOTES.length)} style={{background:"linear-gradient(135deg,#1565c0,#0277bd,#00838f)",border:`1.5px solid ${SALES_COLOR}60`,borderRadius:18,padding:"20px",marginBottom:20,cursor:"pointer",boxShadow:`0 6px 24px rgba(21,101,192,0.35)`}}>
            <div style={{fontSize:10,fontWeight:700,color:SALES_COLOR,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>💬 Field Quote · Tap for next</div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",lineHeight:1.55,letterSpacing:-0.2}}>"{QUOTES[quoteIdx]}"</div>
          </div>
        )}
        {view==="home" && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Choose Your Weapon</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {WEAPONS.map(w=>(
                <div key={w.id} onClick={()=>setView(w.id)} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px",cursor:"pointer",transition:"all 0.18s",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",minHeight:110}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=`${w.color}60`;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${w.color}18`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                  <div style={{width:40,height:40,borderRadius:12,background:`${w.color}12`,border:`1.5px solid ${w.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:10}}>{w.emoji}</div>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:3,letterSpacing:-0.2}}>{w.label}</div>
                  <div style={{fontSize:11,color:T.textSub,lineHeight:1.4}}>{w.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {view==="objections" && (
          <>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#6366f1",fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Back</button>
            <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:4}}>🎯 Objection Crusher</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Tap any objection for the word-for-word script.</div>
            {OBJECTIONS.map(obj=>(
              <div key={obj.id} onClick={()=>setActiveObj(obj)} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#6366f160";e.currentTarget.style.transform="translateX(3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="translateX(0)";}}>
                <span style={{fontSize:24,flexShrink:0}}>{obj.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,lineHeight:1.4}}>"{obj.title}"</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>{obj.meaning}</div>
                </div>
                <span style={{color:T.textMuted,fontSize:16}}>→</span>
              </div>
            ))}
          </>
        )}
        {view==="scripts" && (
          <>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#10b981",fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Back</button>
            <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:4}}>📜 Script Library</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Word-for-word. Field-tested. Read before you dial.</div>
            {OBJECTIONS.map(obj=>(
              <div key={obj.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:18}}>{obj.emoji}</span>
                  <div style={{fontSize:13,fontWeight:700,color:T.text}}>"{obj.title}"</div>
                </div>
                {obj.script.split('\n').map((line,li)=>(
                  <p key={li} style={{fontSize:12,color:line.startsWith('"')||line.startsWith("[")?T.text:T.textSub,fontWeight:line.startsWith('"')?500:400,lineHeight:1.65,marginBottom:4,fontStyle:line.startsWith("[")?'italic':'normal'}}>{line}</p>
                ))}
              </div>
            ))}
          </>
        )}
        {view==="myths" && (
          <>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#f43f5e",fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Back</button>
            <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:4}}>💀 Myth Buster</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Tap any myth to flip it and see the truth.</div>
            {MYTHS.map((m,i)=>(
              <div key={i} onClick={()=>setActiveMyth(m)} style={{background:T.surface,border:"1px solid #fecaca",borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#fef2f2";e.currentTarget.style.transform="translateX(3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.surface;e.currentTarget.style.transform="translateX(0)";}}>
                <span style={{fontSize:22,flexShrink:0}}>💀</span>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:"#7f1d1d",lineHeight:1.4}}>"{m.myth}"</div>
                <span style={{color:"#f43f5e",fontSize:16,fontWeight:700}}>Flip →</span>
              </div>
            ))}
          </>
        )}
        {view==="quote" && (
          <>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#a855f7",fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Back</button>
            <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:16}}>💬 Fire Quotes</div>
            {QUOTES.map((q,i)=>(
              <div key={i} style={{background:`linear-gradient(135deg,#1a237e,#1565c0)`,border:`1px solid ${SALES_COLOR}30`,borderRadius:14,padding:"16px 18px",marginBottom:10,boxShadow:`0 2px 10px rgba(21,101,192,0.2)`}}>
                <div style={{fontSize:14,fontWeight:600,color:"#fff",lineHeight:1.6}}>"{q}"</div>
              </div>
            ))}
          </>
        )}
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
  const [showSales,setShowSales]   = useState(false);
  const [unlocked,setUnlocked]     = useState(null);
  const [activeNav,setActiveNav]   = useState("lobby");
  const [greeting,setGreeting]     = useState("Good morning");
  const [streakAnim,setStreakAnim] = useState(false);

  // Animation states
  const [displayedStreak, setDisplayedStreak] = useState(0);
  const [displayedDollars, setDisplayedDollars] = useState(0);
  const [typedText, setTypedText]   = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const BOSS_TEXT = "Hey, Boss. 👊";

  useEffect(()=>{
    const h = new Date().getHours();
    setGreeting(h<12?"Good morning":h<17?"Good afternoon":"Good evening");
    bumpStreak(false);
    setStreak(getStreak());
    addWin(`🚀 Opened The Lobby`);
    setWins(getWins());

    const s = getStreak();
    const targetStreak  = s.count || 0;
    const targetDollars = Math.round((s.totalUses||0) * MINS_PER_USE * (HOURLY_RATE/60));

    // Typewriter: "Hey, Boss. 👊"
    let charIdx = 0;
    const typeTimer = setInterval(()=>{
      charIdx++;
      setTypedText(BOSS_TEXT.slice(0, charIdx));
      if (charIdx >= BOSS_TEXT.length) clearInterval(typeTimer);
    }, 55);

    // Blink cursor then stop
    const cursorTimer = setTimeout(()=> setShowCursor(false), BOSS_TEXT.length * 55 + 600);

    // Streak count-up
    if (targetStreak > 0) {
      let cur = 0;
      const step = Math.max(1, Math.ceil(targetStreak / 20));
      const t = setInterval(()=>{
        cur = Math.min(cur + step, targetStreak);
        setDisplayedStreak(cur);
        if (cur >= targetStreak) clearInterval(t);
      }, 40);
    }

    // Dollar roll-up
    if (targetDollars > 0) {
      let cur = 0;
      const step = Math.max(1, Math.ceil(targetDollars / 25));
      const t = setInterval(()=>{
        cur = Math.min(cur + step, targetDollars);
        setDisplayedDollars(cur);
        if (cur >= targetDollars) clearInterval(t);
      }, 35);
    }

    return () => { clearInterval(typeTimer); clearTimeout(cursorTimer); };
  },[]);

  const refreshStats = () => {
    setUses(getUses());
    setStreak(getStreak());
    setGoals(getGoals());
    setWins(getWins());
  };

  const handleTile = (tile) => {
    if (tile.soon) return;
    if (tile.isSales) { setShowSales(true); bumpStreak(true); setStreak(getStreak()); return; }
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

      {showSales && (
        <SalesTile onBack={()=>{ setShowSales(false); refreshStats(); }} onWin={refreshStats}/>
      )}
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
          <div style={{fontSize:26,fontWeight:800,color:T.text,letterSpacing:-0.7,lineHeight:1.2,marginBottom:4,minHeight:36}}>
            {typedText}
            {showCursor && <span style={{animation:"blink 0.7s infinite",color:"#6366f1"}}>|</span>}
          </div>
          <div style={{fontSize:14,fontWeight:600,color:"#6366f1"}}>Let's Make It Happen.</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:3}}>{streakLabel} · {totalUses} situations handled</div>
        </div>

        {/* Stats bar — Streak | Time Saved | Goals */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",marginBottom:22,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",animation:"fadeUp 0.5s 0.05s both"}}>
          {/* Streak */}
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#f97316",letterSpacing:-0.5,animation:"statGlow 0.6s 0.3s both"}}>
              {displayedStreak}
              <span style={{display:"inline-block",animation:"fireFloat 1.8s ease-in-out infinite",marginLeft:2}}>🔥</span>
            </div>
            <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>Streak</div>
          </div>
          {/* Time Saved */}
          <div style={{textAlign:"center",borderLeft:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`}}>
            <div style={{fontSize:22,fontWeight:800,color:"#10b981",letterSpacing:-0.5,animation:"statGlow 0.6s 0.5s both"}}>${displayedDollars}</div>
            <div style={{fontSize:9.5,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:3}}>Time Saved</div>
          </div>
          {/* Goals */}
          <div style={{textAlign:"center",cursor:"pointer",animation:"statGlow 0.6s 0.7s both"}} onClick={()=>{ setShowGoals(true); setActiveNav("goals"); }}>
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
              style={{background:tile.soon?"rgba(248,249,250,0.5)":T.surface,border:tile.soon?`1.5px dashed ${T.border}`:`1px solid ${T.border}`,borderRadius:18,padding:"18px 16px 20px",cursor:tile.soon?"default":"pointer",position:"relative",overflow:"hidden",opacity:tile.soon?0.38:1,animation:`tileIn 0.55s cubic-bezier(0.34,1.56,0.64,1) ${i*0.07+0.1}s both`,transition:"transform 0.18s,box-shadow 0.18s,border-color 0.18s",minHeight:128,boxShadow:tile.soon?"none":"0 1px 4px rgba(0,0,0,0.06)"}}
              onMouseEnter={e=>{ if(!tile.soon){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=tile.isSales?`0 6px 24px rgba(212,175,55,0.45)`:`0 6px 20px ${tile.dotColor}22`;e.currentTarget.style.borderColor=tile.isSales?"#D4AF37":`${tile.dotColor}60`;e.currentTarget.style.background=tile.isSales?"#fffbeb":T.surface;}}}
              onMouseLeave={e=>{ if(!tile.soon){e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}}
            >
              {tile.soon && <div style={{position:"absolute",top:11,right:11,background:"transparent",border:"1.5px dashed #c4b5fd",borderRadius:20,padding:"3px 9px",fontSize:9,fontWeight:800,color:"#7c3aed",letterSpacing:"0.08em"}}>SOON</div>}
              {tile.isSales && (
                <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:18,pointerEvents:"none"}}>
                  <div style={{position:"absolute",top:0,left:0,width:"40%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.18),transparent)",animation:"shimmer 2.8s ease-in-out infinite",animationDelay:"1s"}}/>
                </div>
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
