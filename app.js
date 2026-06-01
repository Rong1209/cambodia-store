// =========================
// CAMBO STORE FRONTEND v5
// GitHub Pages + Cloudflare Worker API
// =========================

const API = "https://cambo-store-api.phanhaotdg.workers.dev";
const REPO_BASE = "/pinkie/"; // your GitHub repo path
const BASE = location.hostname.includes("github.io") ? REPO_BASE : "/";

const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem("cambo_token") || localStorage.getItem("token") || "";
const setToken = (t) => { localStorage.setItem("cambo_token", t); localStorage.setItem("token", t); };
const clearToken = () => { localStorage.removeItem("cambo_token"); localStorage.removeItem("token"); };

function go(page="") { location.href = BASE + page; }
function pageUrl(page="") { return BASE + page; }
function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function toast(msg,type="ok"){
  let box=$("toastBox");
  if(!box){box=document.createElement("div");box.id="toastBox";document.body.appendChild(box)}
  const el=document.createElement("div"); el.className="toast "+type; el.textContent=msg; box.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}
function setBtn(btn,loading){ if(!btn)return; btn.disabled=!!loading; if(loading){btn.dataset.old=btn.innerHTML; btn.innerHTML='<span class="spin"></span> Loading...';}else if(btn.dataset.old){btn.innerHTML=btn.dataset.old;} }

async function api(path,opt={}){
  const isForm=opt.body instanceof FormData;
  const headers=isForm?{}:{"Content-Type":"application/json"};
  if(token()) headers.Authorization="Bearer "+token();
  if(opt.headers) Object.assign(headers,opt.headers);
  if(headers.Authorization==="") delete headers.Authorization;
  try{
    const res=await fetch(API+path,{...opt,headers});
    const text=await res.text();
    let json;
    try{json=JSON.parse(text)}catch{json={ok:false,error:text||"Bad server response"}}
    if(!json.ok) toast(json.error||"Request failed","bad");
    return json;
  }catch(e){
    console.error(e);
    toast("Cannot connect to API. Check Worker deploy/API URL.","bad");
    return {ok:false,error:"Cannot connect to API"};
  }
}

async function upload(file,publicUpload=false){
  if(!file)return "";
  const fd=new FormData(); fd.append("file",file);
  const j=await api(publicUpload?"/api/public-upload":"/api/upload",{method:"POST",body:fd});
  return j.url||"";
}

// =========================
// Global page init
// =========================
async function initHome(){
  const t=token();
  const nav=$("authNav");
  if(nav&&t){
    const me=await api("/api/me");
    if(me.ok){
      nav.innerHTML=`<a class="nav-link" href="${pageUrl('panel.html')}">Dashboard</a><button class="btn small" onclick="logout()">Logout</button>`;
    }
  }
}
async function guardAuth(){
  const me=await api("/api/me");
  if(!me.ok){ go("login.html"); return null; }
  return me.user;
}
async function guardAdmin(){
  const u=await guardAuth();
  if(!u)return null;
  if(u.role!=="admin"){ toast("Admin only","bad"); go("panel.html"); return null; }
  return u;
}
function logout(){clearToken(); go("login.html");}

// =========================
// Auth
// =========================
async function register(){
  const btn=event?.currentTarget;
  const name=$("name")?.value.trim();
  const email=$("email")?.value.trim().toLowerCase();
  const password=$("password")?.value.trim();
  if(!name||!email||!password) return toast("Please fill all fields","bad");
  setBtn(btn,true);
  const j=await api("/api/register",{method:"POST",body:JSON.stringify({name,email,password})});
  setBtn(btn,false);
  if(j.ok){ toast("Account created. Please login."); setTimeout(()=>go("login.html"),700); }
}
async function login(){
  const btn=event?.currentTarget;
  const email=$("email")?.value.trim().toLowerCase();
  const password=$("password")?.value.trim();
  if(!email||!password) return toast("Please fill all fields","bad");
  setBtn(btn,true);
  const j=await api("/api/login",{method:"POST",body:JSON.stringify({email,password})});
  setBtn(btn,false);
  if(j.ok){ setToken(j.token); toast("Welcome back!"); setTimeout(()=>go("panel.html"),400); }
}

// Forgot password via Gmail OTP. Backend needs /api/password/forgot and /api/password/reset.
let resetToken="";
async function forgotSend(){
  const email=$("resetEmail")?.value.trim().toLowerCase();
  if(!email)return toast("Enter your Gmail/email","bad");
  const j=await api("/api/password/forgot",{method:"POST",headers:{Authorization:""},body:JSON.stringify({email})});
  if(j.ok)toast("OTP sent to your email");
}
async function forgotVerify(){
  const email=$("resetEmail")?.value.trim().toLowerCase();
  const code=$("resetOtp")?.value.trim();
  const password=$("newPassword")?.value.trim();
  if(!email||!code||!password)return toast("Fill email, OTP and new password","bad");
  const j=await api("/api/password/reset",{method:"POST",headers:{Authorization:""},body:JSON.stringify({email,code,password})});
  if(j.ok){toast("Password changed. Login now."); setTimeout(()=>go("login.html"),700);}
}

// =========================
// User Dashboard + Builder
// =========================
let currentSite=null;
async function loadPanel(){
  const u=await guardAuth(); if(!u)return;
  $("userName") && ($("userName").textContent=u.name);
  $("userEmail") && ($("userEmail").textContent=u.email);
  $("planName") && ($("planName").textContent=(u.role==="admin"?"ADMIN":u.plan).toUpperCase());
  $("adminLink") && ($("adminLink").style.display=u.role==="admin"?"inline-flex":"none");
  const proActive=u.role==="admin"||u.plan==="pro";
  if($("proStatus")) $("proStatus").innerHTML=proActive?"<b class='green'>Pro active</b>":u.plan_request==="pending"?"<b class='yellow'>Pending approval</b>":"<b>Free plan</b>";
  const j=await api("/api/sites");
  if($("sites")){
    $("sites").innerHTML=(j.sites||[]).map(s=>`
      <div class="list-card">
        <div><h3>${esc(s.title)}</h3><p>${esc(s.description||'No description')}</p><small>${esc(s.slug)}</small></div>
        <div class="actions">
          <button class="btn" onclick='editSite(${JSON.stringify(s).replaceAll("'","&apos;")})'>Builder</button>
          <a class="btn ghost" target="_blank" href="${pageUrl('site.html?slug='+s.slug)}">Open</a>
          <button class="btn danger" onclick="delSite(${s.id})">Delete</button>
        </div>
      </div>`).join("")||`<div class="empty">No store yet. Create one below.</div>`;
  }
}
async function requestPro(){
  const file=$("proProof")?.files?.[0];
  if(!file)return toast("Upload $5 QR payment proof first","bad");
  const fd=new FormData(); fd.append("proof",file);
  const j=await api("/api/upgrade/request",{method:"POST",body:fd});
  if(j.ok){toast("Pro request submitted to admin"); loadPanel();}
}
async function createSite(){
  const title=$("siteTitle")?.value.trim();
  let slug=$("siteSlug")?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,"");
  const description=$("siteDesc")?.value.trim();
  const template=$("siteTemplate")?.value||"neon";
  if(!title||!slug)return toast("Store name and slug required","bad");
  const j=await api("/api/sites",{method:"POST",body:JSON.stringify({title,slug,description,template})});
  if(j.ok){toast("Store created"); loadPanel();}
}
async function delSite(id){
  if(!confirm("Delete this store?"))return;
  const j=await api("/api/sites/"+id,{method:"DELETE"});
  if(j.ok)loadPanel();
}
function editSite(s){
  currentSite=s;
  $("editor").style.display="grid";
  const set=(id,v)=>{$(id)&&($(id).value=v??"")};
  set("eTitle",s.title); set("eHero",s.hero_name||s.title); set("eDesc",s.description); set("eTemplate",s.template||"neon");
  set("eBg",s.background_color||"#070713"); set("eBtn",s.button_color||"#ec008c"); set("eText",s.text_color||"#ffffff"); set("eAccent",s.accent_color||"#00e5ff");
  set("notifyType",s.notify_type||"off"); set("discordWebhook",s.discord_webhook||""); set("telegramChat",s.telegram_chat_id||"");
  $("openPublic") && ($("openPublic").href=pageUrl("site.html?slug="+s.slug));
  renderPreview(); loadItems(); $("editor").scrollIntoView({behavior:"smooth"});
}
function renderPreview(){
  if(!currentSite||!$("livePreview"))return;
  const bg=$("eBg").value, btn=$("eBtn").value, text=$("eText").value, accent=$("eAccent").value;
  $("livePreview").innerHTML=`<div class="neon-preview" style="--bg:${bg};--btn:${btn};--text:${text};--accent:${accent};background:${bg};color:${text}">
    <div class="mini-sidebar"></div><div class="mini-main"><span>LIVE STORE</span><h2>${esc($("eHero").value||$("eTitle").value)}</h2><p>${esc($("eDesc").value||"Minecraft store")}</p><button style="background:${btn};color:${text}">Add to Cart</button></div>
  </div>`;
}
document.addEventListener("input",e=>{if(["eBg","eBtn","eText","eAccent","eHero","eDesc"].includes(e.target.id))renderPreview();});
async function saveSite(){
  if(!currentSite)return;
  let logo=currentSite.logo_url||"", banner=currentSite.banner_url||"", qr=currentSite.qr_url||"";
  if($("logoFile")?.files?.[0]) logo=await upload($("logoFile").files[0]);
  if($("bannerFile")?.files?.[0]) banner=await upload($("bannerFile").files[0]);
  if($("qrFile")?.files?.[0]) qr=await upload($("qrFile").files[0]);
  const data={title:$("eTitle").value,hero_name:$("eHero").value,description:$("eDesc").value,template:$("eTemplate").value,background_color:$("eBg").value,button_color:$("eBtn").value,text_color:$("eText").value,accent_color:$("eAccent").value,logo_url:logo,banner_url:banner,qr_url:qr,notify_type:$("notifyType").value,discord_webhook:$("discordWebhook").value,telegram_chat_id:$("telegramChat").value};
  const j=await api("/api/sites/"+currentSite.id,{method:"PUT",body:JSON.stringify(data)});
  if(j.ok){toast("Saved"); currentSite={...currentSite,...data}; renderPreview(); loadPanel();}
}
async function addItem(){
  if(!currentSite)return toast("Open builder first","bad");
  const image=await upload($("itemImage")?.files?.[0]);
  const j=await api(`/api/sites/${currentSite.id}/items`,{method:"POST",body:JSON.stringify({name:$("itemName").value,price:$("itemPrice").value,description:$("itemDesc").value,image_url:image,button_text:$("itemButton")?.value||"Add"})});
  if(j.ok){toast("Item added"); ["itemName","itemPrice","itemDesc"].forEach(id=>$(id)&&($(id).value="")); loadItems();}
}
async function loadItems(){
  if(!currentSite||!$("items"))return;
  const j=await api(`/api/sites/${currentSite.id}/items`);
  $("items").innerHTML=(j.items||[]).map(i=>`<div class="list-card compact"><div><b>${esc(i.name)}</b><p>$${esc(i.price)} • ${esc(i.description)}</p></div><button class="btn danger" onclick="delItem(${i.id})">Delete</button></div>`).join("")||"<p>No items yet.</p>";
}
async function delItem(id){const j=await api("/api/items/"+id,{method:"DELETE"}); if(j.ok)loadItems();}

// =========================
// Admin
// =========================
async function loadAdmin(){
  const u=await guardAdmin(); if(!u)return;
  const j=await api("/api/admin/users");
  if(!$("users"))return;
  $("users").innerHTML=(j.users||[]).map(u=>`<div class="admin-card">
    <div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p><span class="badge">${esc(u.role)} / ${esc(u.plan)}</span> <span class="badge yellow">${esc(u.plan_request)}</span>${u.pro_proof_url?`<br><a target="_blank" href="${u.pro_proof_url}">View $5 proof</a>`:""}</div>
    <div class="actions"><button class="btn" onclick="setPlan(${u.id},'pro')">Approve Pro</button><button class="btn ghost" onclick="setPlan(${u.id},'free')">Set Free</button></div>
  </div>`).join("");
}
async function setPlan(id,plan){const j=await api(`/api/admin/users/${id}/plan`,{method:"PUT",body:JSON.stringify({plan})}); if(j.ok){toast("Updated"); loadAdmin();}}

// =========================
// Public store + Gmail OTP
// =========================
let publicSite=null, publicItems=[], cart=[], otpToken="";
function slugFromUrl(){const q=new URLSearchParams(location.search).get("slug"); if(q)return q; const parts=location.pathname.split('/').filter(Boolean); return parts[parts.length-1]||"";}
async function loadPublic(){
  const slug=slugFromUrl();
  const j=await api("/api/public/"+slug,{headers:{Authorization:""}});
  if(!j.ok){$("publicSite") && ($("publicSite").innerHTML=`<div class="not-found"><h1>Store not found</h1><a href="${pageUrl('index.html')}">Back home</a></div>`); return;}
  publicSite=j.site; publicItems=j.items||[]; document.title=publicSite.title||"Cambo Store"; renderPublic();
}
function renderPublic(){
  const s=publicSite; document.body.className="neon-body";
  $("publicSite").innerHTML=`<div class="store-shell">
    <aside class="store-sidebar"><div class="store-logo"><div class="logo-icon">${s.logo_url?`<img src="${s.logo_url}">`:"👑"}</div><div>CAMBO<br><span>STORE</span></div></div><nav><a class="active">🏠 Home</a><a>👑 Ranks</a><a>🔑 Keys</a><a>🎁 Kits</a><a>📦 Crates</a><a>💬 Support</a></nav><div class="sidebar-profile"><b>${esc(s.title)}</b><p>Secure checkout</p></div></aside>
    <main class="store-main"><section class="hero-card" style="background:linear-gradient(90deg,rgba(6,7,19,.95),rgba(22,0,42,.45)),${s.banner_url?`url('${s.banner_url}')`:`radial-gradient(circle at 70% 20%,${s.accent_color||'#00e5ff'}55,transparent 35%)`};background-size:cover;background-position:center"><div class="hero-content"><span class="pill">⭐ Cambodia Minecraft Store</span><h1>${esc(s.hero_name||s.title||'Power Up Your Game')}</h1><p>${esc(s.description||'Ranks, keys, kits, crates and more.')}</p><div class="hero-actions"><button onclick="document.querySelector('.product-grid').scrollIntoView({behavior:'smooth'})">Shop Now</button><button class="ghost">Join Discord</button></div></div></section><section class="stats-row"><div>⚡ <b>Instant</b><span>Delivery</span></div><div>🔒 <b>Safe</b><span>Payment</span></div><div>💬 <b>24/7</b><span>Support</span></div></section><section class="section-head"><h2>Featured Products</h2></section><section class="product-grid">${publicItems.map(i=>`<article class="product-card">${i.image_url?`<img src="${i.image_url}">`:`<div class="item-placeholder">🎁</div>`}<h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><strong>$${Number(i.price||0).toFixed(2)}</strong><button style="background:${s.button_color||'#ec008c'};color:${s.text_color||'#fff'}" onclick="addCart(${i.id})">🛒 ${esc(i.button_text||'Add')}</button></article>`).join("")||"<p>No products yet.</p>"}</section></main>
    <aside class="checkout-card"><h2>🛒 Cart</h2><div id="cartList"></div><label>Minecraft Name</label><input id="mcName" placeholder="Player name"><label>Edition</label><select id="edition"><option>Java</option><option>Bedrock</option></select><label>Gmail / Email Verification</label><input id="buyerEmail" type="email" placeholder="your@gmail.com"><button onclick="sendOtp()">Send OTP</button><input id="otp" placeholder="OTP code"><button onclick="verifyOtp()">Verify OTP</button>${s.qr_url?`<div class="qr-box"><h3>Scan QR</h3><img src="${s.qr_url}"></div>`:""}<label>Upload Payment Proof</label><input id="proof" type="file" accept="image/*"><button class="submit-btn" onclick="submitOrder()">Submit Order</button></aside>
  </div>`;
  renderCart();
}
function addCart(id){const item=publicItems.find(x=>x.id===id); if(!item)return; const row=cart.find(x=>x.id===id); row?row.qty++:cart.push({id,qty:1}); renderCart(); toast("Added to cart");}
function removeCart(id){cart=cart.filter(x=>x.id!==id); renderCart();}
function renderCart(){const el=$("cartList"); if(!el)return; let total=0; el.innerHTML=cart.map(c=>{const i=publicItems.find(x=>x.id===c.id); const sub=Number(i?.price||0)*c.qty; total+=sub; return `<div class="cart-line"><span>${esc(i?.name)} x${c.qty}</span><b>$${sub.toFixed(2)}</b><button onclick="removeCart(${c.id})">×</button></div>`}).join("")+`<hr><div class="cart-total"><span>Total</span><b>$${total.toFixed(2)}</b></div>`;}
async function sendOtp(){const email=$("buyerEmail").value.trim().toLowerCase(); if(!email)return toast("Enter Gmail/email first","bad"); const j=await api("/api/otp/send",{method:"POST",headers:{Authorization:""},body:JSON.stringify({email})}); if(j.ok)toast("OTP sent to your email");}
async function verifyOtp(){const email=$("buyerEmail").value.trim().toLowerCase(); const code=$("otp").value.trim(); if(!email||!code)return toast("Enter email and OTP","bad"); const j=await api("/api/otp/verify",{method:"POST",headers:{Authorization:""},body:JSON.stringify({email,code})}); if(j.ok){otpToken=j.otp_token; toast("Email verified");}}
async function submitOrder(){if(!cart.length)return toast("Cart is empty","bad"); if(!otpToken)return toast("Verify email first","bad"); let proof=""; if($("proof").files[0]) proof=await upload($("proof").files[0],true); const j=await api("/api/orders",{method:"POST",headers:{Authorization:""},body:JSON.stringify({site_id:publicSite.id,cart,minecraft_name:$("mcName").value,edition:$("edition").value,otp_token:otpToken,payment_proof_url:proof})}); if(j.ok){toast("Order submitted"); cart=[]; otpToken=""; renderCart();}}
