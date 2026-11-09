"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [user,setUser] = useState(null);
  const [allowed,setAllowed] = useState(false);
  const [boxes,setBoxes] = useState([]);
  const [selected,setSelected] = useState("");
  const [cards,setCards] = useState([]);
  const [title,setTitle] = useState("");
  const [slug,setSlug] = useState("");
  const [description,setDescription] = useState("");
  const [mode,setMode] = useState("shared");
  const [cardTitle,setCardTitle] = useState("");
  const [cardDescription,setCardDescription] = useState("");
  const [image,setImage] = useState(null);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);

  async function refreshBoxes() {
    const {data} = await supabase.from("boxes").select("*").order("created_at",{ascending:false});
    setBoxes(data||[]);
    if (!selected && data?.length) setSelected(data[0].id);
  }
  async function refreshCards(boxId) {
    if (!boxId) { setCards([]); return; }
    const {data} = await supabase.from("cards").select("*").eq("box_id",boxId).order("created_at",{ascending:false});
    setCards(data||[]);
  }
  useEffect(() => {
    async function init() {
      if (!supabase) { router.push("/login"); return; }
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      const {data:admin} = await supabase.from("admins").select("user_id").eq("user_id",user.id).maybeSingle();
      if (!admin) { setMessage("هذا الحساب غير مصرح له بإدارة اللعبة."); return; }
      setAllowed(true);
      await refreshBoxes();
    }
    init();
  }, []);
  useEffect(()=>{ if (selected) refreshCards(selected); },[selected]);

  async function createBox(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");
    const {error} = await supabase.from("boxes").insert({title,slug:cleanSlug,description,draw_mode:mode});
    setBusy(false);
    if (error) setMessage(error.message); else { setMessage("تم إنشاء الصندوق بنجاح."); setTitle("");setSlug("");setDescription("");await refreshBoxes(); }
  }
  async function addCard(e) {
    e.preventDefault(); if (!selected) return;
    setBusy(true); setMessage("");
    let imageUrl = null;
    if (image) {
      const ext = image.name.split(".").pop().toLowerCase();
      const path = selected+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError} = await supabase.storage.from("card-images").upload(path,image,{upsert:false,contentType:image.type});
      if (uploadError) { setBusy(false); setMessage(uploadError.message); return; }
      const {data} = supabase.storage.from("card-images").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }
    const {error} = await supabase.from("cards").insert({box_id:selected,title:cardTitle,description:cardDescription,image_url:imageUrl});
    setBusy(false);
    if (error) setMessage(error.message); else { setMessage("تمت إضافة الكارت.");setCardTitle("");setCardDescription("");setImage(null);await refreshCards(selected); }
  }
  async function deleteCard(id) {
    if (!confirm("هل تريد حذف هذا الكارت؟")) return;
    const {error} = await supabase.from("cards").delete().eq("id",id);
    if (error) setMessage(error.message); else refreshCards(selected);
  }
  async function toggleBox(box) {
    const {error} = await supabase.from("boxes").update({is_active:!box.is_active}).eq("id",box.id);
    if (error) setMessage(error.message); else refreshBoxes();
  }
  async function logout() { await supabase.auth.signOut(); router.push("/"); }
  if (!allowed) return <main className="shell"><header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link></header><div className="panel">{message || "جارٍ التحقق من صلاحيات المدير..."}</div></main>;

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">✦ صندوق الحظ</Link><div className="row"><span className="muted">{user?.email}</span><button className="btn ghost" onClick={logout}>تسجيل الخروج</button></div></header>
    <div className="hero" style={{paddingTop:5}}><div className="eyebrow">CONTROL CENTER</div><h1 style={{fontSize:38}}>لوحة <span className="gold">الإدارة</span></h1><p className="subtitle">أنشئ الصناديق وأضف الصور والعناوين وتحكم في ظهورها.</p></div>
    {message && <div className="notice">{message}</div>}
    <section className="panel admin-section">
      <h2>إنشاء صندوق جديد</h2>
      <form className="form" onSubmit={createBox}>
        <div className="field"><label>اسم الصندوق</label><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: صندوق الأفلام"/></div>
        <div className="field"><label>الرابط المختصر (إنجليزي)</label><input required pattern="[A-Za-z0-9-]+" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="movies"/></div>
        <div className="field"><label>وصف الصندوق</label><textarea value={description} onChange={e=>setDescription(e.target.value)}/></div>
        <div className="field"><label>نظام السحب</label><select value={mode} onChange={e=>setMode(e.target.value)}><option value="shared">مشترك – نفس السحوبات للجميع</option><option value="individual">فردي – لكل مشارك سحوباته</option></select></div>
        <button className="btn" disabled={busy}>إنشاء الصندوق</button>
      </form>
    </section>
    <section className="panel admin-section">
      <h2>إدارة الصناديق</h2>
      {boxes.map(box=><div className="admin-item" key={box.id}><div><strong>{box.title}</strong><div className="muted">/box/{box.slug} · {box.draw_mode==="shared"?"مشترك":"فردي"}</div></div><div className="row"><Link className="btn secondary" href={"/box/"+box.slug}>معاينة</Link><button className="btn ghost" onClick={()=>toggleBox(box)}>{box.is_active?"إيقاف":"تفعيل"}</button></div></div>)}
    </section>
    <section className="panel admin-section">
      <h2>إضافة كارت إلى صندوق</h2>
      <form className="form" onSubmit={addCard}>
        <div className="field"><label>اختر الصندوق</label><select value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">اختر صندوقًا</option>{boxes.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></div>
        <div className="field"><label>عنوان الكارت</label><input required value={cardTitle} onChange={e=>setCardTitle(e.target.value)} placeholder="اسم الفيلم أو الكتاب"/></div>
        <div className="field"><label>وصف اختياري</label><textarea value={cardDescription} onChange={e=>setCardDescription(e.target.value)}/></div>
        <div className="field"><label>صورة الكارت</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)}/></div>
        <button className="btn" disabled={busy||!selected}>إضافة الكارت</button>
      </form>
      <div className="admin-section"><h3>الكروت الحالية ({cards.length})</h3>
        {cards.map(card=><div className="admin-item" key={card.id}><div className="row">{card.image_url&&<img src={card.image_url} alt="" style={{width:48,height:60,objectFit:"cover",borderRadius:7}}/>}<div><strong>{card.title}</strong><div className="muted">{card.description}</div></div></div><button className="btn danger" onClick={()=>deleteCard(card.id)}>حذف</button></div>)}
      </div>
    </section>
  </main>;
}