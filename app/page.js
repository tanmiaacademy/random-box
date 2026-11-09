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

  return <main className="shell home-shell">
    <header className="topbar home-topbar">
      <Link href="/" className="brand">✦ صندوق الحظ</Link>
      <nav className="navlinks home-nav">
        <Link href="/" aria-current="page">الرئيسية</Link>
        <Link href="/admin">لوحة الإدارة</Link>
      </nav>
    </header>

    <section className="hero home-hero">
      <div className="eyebrow">RANDOM BOX EXPERIENCE</div>
      <h1>افتح الصندوق،<br /><span className="gold">واكتشف مفاجأتك!</span></h1>
      <p className="subtitle">كل صندوق يحمل تجربة مختلفة. اختر صندوقك، اسحب كارتك، ودع المفاجأة تبدأ!</p>
      <div className="home-hero-accent" aria-hidden="true"><span>✦</span><i></i><span>✧</span></div>
    </section>

    <section className="admin-section home-box-section">
      <div className="home-section-heading">
        <div>
          <div className="eyebrow">اختر تجربتك</div>
          <h2>اكتشف الصناديق</h2>
          <p className="muted">أي صندوق ستفتح اليوم؟</p>
        </div>
        <div className="home-heading-actions">
          <span className="home-count">{loading ? "..." : boxes.length + " صناديق متاحة"}</span>
          <Link className="btn secondary home-manage" href="/admin">إدارة الصناديق <span aria-hidden="true">↗</span></Link>
        </div>
      </div>

      {loading && <div className="home-state"><span className="home-loader" /> جارٍ تحميل الصناديق...</div>}
      {error && <div className="notice error">{error}</div>}
      {!loading && !error && boxes.length === 0 && <div className="panel home-empty"><div className="home-empty-icon">🎁</div><h3>مفاجأتك الأولى بانتظارك</h3><p className="muted">سجّل الدخول إلى لوحة الإدارة وأنشئ أول صندوق لك.</p><Link className="btn" href="/login">دخول الإدارة</Link></div>}

      {!loading && !error && boxes.length > 0 && <div className="grid home-grid">{boxes.map((box, index) => <article className="boxcard home-boxcard" key={box.id}>
        <div className="boxcover home-boxcover">
          {box.cover_image_url ? <img src={box.cover_image_url} alt={box.title} /> : <span className="home-gift" aria-hidden="true">🎁</span>}
          <span className="home-card-number">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="boxbody home-boxbody">
          <div className="home-card-kicker">صندوق الحظ · تجربة عشوائية</div>
          <h3>{box.title}</h3>
          <p className="muted">{box.description || "صندوق مليء بالمفاجآت. افتحه واكتشف ما ينتظرك!"}</p>
          <div className="home-card-footer">
            <span className="home-mode"><span className="home-mode-dot" />{box.draw_mode === "shared" ? "سحب مشترك" : "سحب فردي"}</span>
            <Link className="btn home-open-btn" href={"/box/" + box.slug}>افتح الصندوق <span aria-hidden="true">←</span></Link>
          </div>
        </div>
      </article>)}</div>}
    </section>
    <footer className="footer home-footer"><span>✦</span> صندوق الحظ · Random Box <span>✦</span></footer>
  </main>;
}
