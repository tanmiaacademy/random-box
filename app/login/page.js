"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    if (!supabase) { setError("بيانات Supabase غير مضبوطة."); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setBusy(false); return; }
    router.push("/admin"); router.refresh();
  }
  return <main className="shell"><header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link><Link href="/">العودة للرئيسية</Link></header>
    <section className="panel" style={{maxWidth:470,margin:"50px auto"}}>
      <div className="eyebrow">ADMIN ACCESS</div><h1 style={{fontSize:32}}>دخول الإدارة</h1><p className="muted">هذه الصفحة مخصصة لمدير اللعبة فقط.</p>
      <form className="form" onSubmit={submit}>
        <div className="field"><label>البريد الإلكتروني</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div className="field"><label>كلمة المرور</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "جارٍ الدخول..." : "تسجيل الدخول"}</button>
      </form>
    </section></main>;
}