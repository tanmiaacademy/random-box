"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function BoxGamePage() {
  const {slug} = useParams();
  const [box,setBox] = useState(null);
  const [cards,setCards] = useState([]);
  const [drawn,setDrawn] = useState([]);
  const [result,setResult] = useState(null);
  const [remaining,setRemaining] = useState(0);
  const [busy,setBusy] = useState(false);
  const [opening,setOpening] = useState(false);
  const [error,setError] = useState("");
  const [participantKey,setParticipantKey] = useState(null);
  const [soundEnabled,setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);

  useEffect(()=>{
    const saved = window.localStorage.getItem("rb-sound");
    if (saved !== null) setSoundEnabled(saved === "on");
  },[]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem("rb-sound",next?"on":"off");
    if (next) playSound("flip");
  }

  function playSound(kind) {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") context.resume();

      const noiseAt = (start, duration, volume, cutoff) => {
        const length = Math.max(1,Math.floor(context.sampleRate*duration));
        const buffer = context.createBuffer(1,length,context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i=0;i<length;i+=1) samples[i] = Math.random()*2-1;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = buffer;
        filter.type = "highpass";
        filter.frequency.setValueAtTime(cutoff,start);
        gain.gain.setValueAtTime(0.0001,start);
        gain.gain.exponentialRampToValueAtTime(volume,start+0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start(start);
        source.stop(start+duration);
      };
      const toneAt = (frequency,endFrequency,start,duration,volume) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency,start);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
        gain.gain.setValueAtTime(0.0001,start);
        gain.gain.exponentialRampToValueAtTime(volume,start+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start+duration);
      };

      const now = context.currentTime;
      if (kind === "shuffle") {
        for (let i=0;i<6;i+=1) noiseAt(now+i*0.085,0.11,0.045,850+i*90);
        toneAt(480,720,now+0.48,0.22,0.035);
      } else if (kind === "draw") {
        noiseAt(now,0.16,0.05,1050);
        noiseAt(now+0.18,0.13,0.04,1500);
      } else {
        noiseAt(now,0.09,0.045,1800);
        toneAt(760,460,now+0.025,0.15,0.035);
      }
    } catch {
      // Audio is optional; playback must never interrupt a draw.
    }
  }

  const load = useCallback(async () => {
    if (!supabase || !slug) return;
    const {data:boxData,error:boxError} = await supabase.from("boxes").select("*").eq("slug",slug).eq("is_active",true).maybeSingle();
    if (boxError || !boxData) { setError("الصندوق غير موجود أو غير متاح."); return; }
    setBox(boxData);
    const {data:cardData,error:cardError} = await supabase.from("cards").select("id,title,description,image_url").eq("box_id",boxData.id).eq("is_active",true);
    if (cardError) {setError(cardError.message);return;}
    setCards(cardData||[]);
    if (boxData.draw_mode === "individual") {
      let key = localStorage.getItem("rb-participant-"+boxData.id);
      if (!key) { key = crypto.randomUUID(); localStorage.setItem("rb-participant-"+boxData.id,key); }
      setParticipantKey(key);
    }
    setRemaining((cardData||[]).length);
  },[slug]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    if (!supabase || !box || box.draw_mode!=="shared") return;
    const channel = supabase.channel("shared-box-"+box.id).on("postgres_changes",{event:"*",schema:"public",table:"draws"},async()=>{ 
      const {data} = await supabase.rpc("get_draw_history",{p_slug:slug});
      if (data) { setDrawn(data); setRemaining(Math.max(cards.length-data.length,0)); }
    }).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[box,slug,cards.length]);

  async function refreshHistory() {
    const {data,error} = await supabase.rpc("get_draw_history",{p_slug:slug,p_participant_key:box.draw_mode==="individual"?participantKey:null});
    if (error) { setError(error.message); return; }
    setDrawn(data||[]);
    setRemaining(Math.max(cards.length-(data||[]).length,0));
  }

  useEffect(()=>{ if(box && (box.draw_mode==="shared" || participantKey)) refreshHistory(); },[box,participantKey,cards.length]);

  async function draw() {
    if (busy || remaining<=0) return;
    setBusy(true); setError(""); setResult(null); setOpening(true);
    playSound("draw");
    await new Promise(resolve=>setTimeout(resolve,850));
    const {data,error} = await supabase.rpc("draw_card",{p_slug:slug,p_participant_key:box.draw_mode==="individual"?participantKey:null});
    setOpening(false); setBusy(false);
    if (error) {setError(error.message);return;}
    if (!data || data.length===0) {setRemaining(0);return;}
    const card = data[0];
    playSound("flip");
    setResult(card); setRemaining(card.remaining_count);
    await refreshHistory();
  }

  async function resetRound() {
    if (!confirm("هل تريد بدء جولة جديدة؟")) return;
    setBusy(true);
    const {error} = await supabase.rpc("reset_box_round",{p_slug:slug,p_participant_key:box.draw_mode==="individual"?participantKey:null});
    setBusy(false);
    if (error) {setError(error.message);return;}
    playSound("shuffle");
    setResult(null); setDrawn([]); setRemaining(cards.length); setError("");
  }

  if (error && !box) return <main className="shell"><div className="panel">{error}<p><Link href="/">العودة للرئيسية</Link></p></div></main>;
  if (!box) return <main className="shell"><p>جارٍ تحميل الصندوق...</p></main>;

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link><Link href="/">كل الصناديق</Link></header>
    <section className="hero box-page-hero">{box.cover_image_url && <div className="box-page-cover"><img src={box.cover_image_url} alt={"غلاف "+box.title}/></div>}<div className="eyebrow">YOUR RANDOM MOMENT</div><h1>{box.title}</h1><p className="subtitle">{box.description || "اسحب كارتًا واكتشف مفاجأتك."}</p></section>
    <section className="panel game">
      <div className="stats"><span className="stat">المتبقي: {remaining}</span><span className="stat">تم سحبه: {drawn.length}</span><span className="stat">{box.draw_mode==="shared"?"سحب مشترك":"سحب فردي"}</span><button type="button" className="btn secondary sound-toggle" onClick={toggleSound} aria-pressed={soundEnabled}>{soundEnabled?"🔊 كتم الصوت":"🔇 تشغيل الصوت"}</button></div>
      <div className="chest-stage"><div className={"chest"+(opening?" opening":"")}>🎁</div></div>
      <div className="actions"><button className="btn" onClick={draw} disabled={busy||remaining===0}>{busy?"يفتح الصندوق...":"اسحب كارتك"}</button></div>
      {error && <div className="notice error">{error}</div>}
      {result && <article className="result-card">
        {result.image_url ? <img src={result.image_url} alt={result.title}/> : <div style={{height:180,display:"grid",placeItems:"center",fontSize:64}}>🎴</div>}
        <div className="result-copy"><div className="eyebrow">YOUR CARD</div><h2>{result.title}</h2><p>{result.description}</p></div>
      </article>}
      {remaining===0 && <div className="notice" style={{marginTop:24}}><h3>انتهت الكروت! 🎉</h3><p>اختر ما تريد فعله الآن:</p><div className="actions"><button className="btn" onClick={resetRound} disabled={busy}>إعادة خلط وبدء جولة جديدة</button><button className="btn secondary" onClick={()=>document.getElementById("history")?.scrollIntoView({behavior:"smooth"})}>عرض النتائج</button><Link className="btn ghost" href="/">إنهاء اللعبة</Link></div></div>}
    </section>
    <section className="panel admin-section" id="history"><h2>سجل السحوبات</h2>{drawn.length===0?<p className="muted">لم يتم سحب أي كارت بعد.</p>:<div className="grid">{drawn.map((item,index)=><article className="boxcard" key={item.draw_id||item.card_id+index}><div className="boxcover">{item.image_url?<img src={item.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎴"}</div><div className="boxbody"><h3>{item.title}</h3><p className="muted">{new Date(item.created_at).toLocaleString("ar-EG")}</p></div></article>)}</div>}</section>
  </main>;
}