"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!supabase) { setError("أضف بيانات Supabase في إعدادات البيئة أولًا."); setLoading(false); return; }
      const { data, error } = await supabase.from("boxes").select("id,title,slug,description,cover_image_url,draw_mode").eq("is_active", true).order("created_at", { ascending: false });
      if (error) setError(error.message); else setBoxes(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link><nav className="navlinks"><Link href="/">الرئيسية</Link><Link href="/admin">لوحة الإدارة</Link></nav></header>
    <section className="hero">
      <div className="eyebrow">RANDOM BOX EXPERIENCE</div>
      <h1>افتح الصندوق، <span className="gold">واكتشف مفاجأتك</span></h1>
      <p className="subtitle">اختر صندوقًا، ثم اسحب كارتًا عشوائيًا. كل كارت يحمل صورة أو عنوانًا جديدًا، والمفاجأة دائمًا في الاختيار!</p>
    </section>
    <section className="admin-section">
      <div className="row" style={{justifyContent:"space-between"}}><h2>الصناديق المتاحة</h2><Link className="btn secondary" href="/admin">إدارة الصناديق</Link></div>
      {loading && <p className="muted">جارٍ تحميل الصناديق...</p>}
      {error && <div className="notice error">{error}</div>}
      {!loading && !error && boxes.length === 0 && <div className="panel" style={{textAlign:"center"}}><div style={{fontSize:48}}>🎁</div><h3>لا توجد صناديق منشورة بعد</h3><p className="muted">سجّل الدخول إلى لوحة الإدارة وأنشئ أول صندوق لك.</p><Link className="btn" href="/login">دخول الإدارة</Link></div>}
      <div className="grid">{boxes.map(box => <article className="boxcard" key={box.id}>
        <div className="boxcover">{box.cover_image_url ? <img src={box.cover_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : "🎁"}</div>
        <div className="boxbody"><h3>{box.title}</h3><p className="muted">{box.description || "صندوق مليء بالمفاجآت."}</p><div className="row" style={{justifyContent:"space-between",marginTop:14}}><span className="muted">{box.draw_mode === "shared" ? "سحب مشترك" : "سحب فردي"}</span><Link className="btn" href={"/box/"+box.slug}>افتح الصندوق</Link></div></div>
      </article>)}</div>
    </section>
    <footer className="footer">صندوق الحظ · Random Box</footer>
  </main>;
}