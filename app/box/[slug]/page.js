"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
    await new Promise(resolve=>setTimeout(resolve,850));
    const {data,error} = await supabase.rpc("draw_card",{p_slug:slug,p_participant_key:box.draw_mode==="individual"?participantKey:null});
    setOpening(false); setBusy(false);
    if (error) {setError(error.message);return;}
    if (!data || data.length===0) {setRemaining(0);return;}
    const card = data[0];
    setResult(card); setRemaining(card.remaining_count);
    await refreshHistory();
  }

  async function resetRound() {
    if (!confirm("هل تريد بدء جولة جديدة؟")) return;
    setBusy(true);
    const {error} = await supabase.rpc("reset_box_round",{p_slug:slug,p_participant_key:box.draw_mode==="individual"?participantKey:null});
    setBusy(false);
    if (error) {setError(error.message);return;}
    setResult(null); setDrawn([]); setRemaining(cards.length); setError("");
  }

  if (error && !box) return <main className="shell"><div className="panel">{error}<p><Link href="/">العودة للرئيسية</Link></p></div></main>;
  if (!box) return <main className="shell"><p>جارٍ تحميل الصندوق...</p></main>;

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link><Link href="/">كل الصناديق</Link></header>
    <section className="hero"><div className="eyebrow">YOUR RANDOM MOMENT</div><h1>{box.title}</h1><p className="subtitle">{box.description || "اسحب كارتًا واكتشف مفاجأتك."}</p></section>
    <section className="panel game">
      <div className="stats"><span className="stat">المتبقي: {remaining}</span><span className="stat">تم سحبه: {drawn.length}</span><span className="stat">{box.draw_mode==="shared"?"سحب مشترك":"سحب فردي"}</span></div>
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