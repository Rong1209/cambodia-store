const API = "https://cambo-store-api.phanhaotdg.workers.dev";
const BASE = location.hostname.includes("github.io") ? "/pinkie/" : "/";
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem("token") || "";
let meCache = null, currentSite = null, publicSite = null, publicItems = [], cart = [], otpToken = "";

function go(page){ location.href = BASE + page; }
function pageUrl(page){ return BASE + page; }
function esc(s){ return String(s||"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function toast(msg,type="ok"){ const box=$("toastBox")||document.body.appendChild(Object.assign(document.createElement("div"),{id:"toastBox"})); const t=document.createElement("div"); t.className="toast "+type; t.textContent=msg; box.appendChild(t); setTimeout(()=>t.remove(),3300); }
function setLoading(btn,on,text="Loading..."){ if(!btn)return; if(on){btn.dataset.old=btn.innerHTML;btn.disabled=true;btn.innerHTML=text}else{btn.disabled=false;btn.innerHTML=btn.dataset.old||btn.innerHTML} }

async function api(path,opt={}){
  const isForm = opt.body instanceof FormData;
  const headers = isForm ? {authorization:"Bearer "+token()} : {"content-type":"application/json",authorization:"Bearer "+token()};
  if(opt.headers && opt.headers.authorization === "") delete headers.authorization;
  try{
    const r = await fetch(API+path,{...opt,headers:{...headers,...(opt.headers||{})}});
    const j = await r.json().catch(()=>({ok:false,error:"Bad server response"}));
    if(!j.ok) toast(j.error||"Request failed","err");
    return j;
  }catch(e){ console.error(e); toast("Cannot connect to API","err"); return {ok:false,error:"Network error"}; }
}
async function upload(file, pub=false){ if(!file)return""; const fd=new FormData(); fd.append("file",file); const j=await api(pub?"/api/public-upload":"/api/upload",{method:"POST",body:fd,headers:pub?{authorization:""}:{}}); return j.url||""; }
async function requireMe(){ const me=await api("/api/me"); if(!me.ok){go("login.html");return null} meCache=me.user; return me.user; }

/* AUTH + EMAIL VERIFY */
async function register(){
  const btn=event?.target; setLoading(btn,true,"Creating...");
  const name=$("name").value.trim(), email=$("email").value.trim().toLowerCase(), password=$("password").value.trim();
  if(!name||!email||!password){toast("Fill all fields","err");setLoading(btn,false);return}
  const j=await api("/api/register",{method:"POST",body:JSON.stringify({name,email,password})});
  setLoading(btn,false); if(j.ok){toast("Account created. Check Gmail to verify."); localStorage.setItem("pending_email",email); go("verify.html");}
}
async function login(){
  const btn=event?.target; setLoading(btn,true,"Signing in...");
  const email=$("email").value.trim().toLowerCase(), password=$("password").value.trim();
  if(!email||!password){toast("Fill all fields","err");setLoading(btn,false);return}
  const j=await api("/api/login",{method:"POST",body:JSON.stringify({email,password})});
  setLoading(btn,false); if(j.ok){localStorage.setItem("token",j.token);go("panel.html");}
}
function logout(){localStorage.removeItem("token");go("login.html")}
async function sendAccountVerify(){
  const email=($("verifyEmail")?.value||localStorage.getItem("pending_email")||"").trim().toLowerCase();
  if(!email)return toast("Email required","err");
  const j=await api("/api/auth/send-email-otp",{method:"POST",headers:{authorization:""},body:JSON.stringify({email,purpose:"account_verify"})});
  if(j.ok)toast("OTP sent to Gmail");
}
async function verifyAccountEmail(){
  const email=($("verifyEmail")?.value||localStorage.getItem("pending_email")||"").trim().toLowerCase(), code=$("verifyCode").value.trim();
  const j=await api("/api/auth/verify-email-otp",{method:"POST",headers:{authorization:""},body:JSON.stringify({email,code,purpose:"account_verify"})});
  if(j.ok){toast("Email verified. Please login.");go("login.html")}
}
async function forgotPassword(){
  const email=$("forgotEmail").value.trim().toLowerCase(); if(!email)return toast("Email required","err");
  const j=await api("/api/auth/send-email-otp",{method:"POST",headers:{authorization:""},body:JSON.stringify({email,purpose:"reset_password"})});
  if(j.ok)toast("Reset OTP sent to Gmail");
}
async function resetPassword(){
  const email=$("forgotEmail").value.trim().toLowerCase(), code=$("forgotCode").value.trim(), password=$("newPassword").value.trim();
  const j=await api("/api/auth/reset-password",{method:"POST",headers:{authorization:""},body:JSON.stringify({email,code,password})});
  if(j.ok){toast("Password changed");go("login.html")}
}

/* PANEL */
async function loadPanel(){
  const u=await requireMe(); if(!u)return;
  $("userName")&&( $("userName").textContent=u.name ); $("userEmail")&&( $("userEmail").textContent=u.email ); $("planName")&&( $("planName").textContent=(u.role==='admin'?'ADMIN':u.plan).toUpperCase());
  if($("adminLink")&&u.role==='admin')$("adminLink").style.display="inline-flex";
  if($("verifyNotice")) $("verifyNotice").style.display = u.email_verified ? "none" : "block";
  const ub=$("upgradeBtn"); if(ub){ if(!u.email_verified){ub.disabled=true;ub.textContent="Verify Gmail First"} else if(u.role==='admin'||u.plan==='pro'){ub.disabled=true;ub.textContent="Pro Active"} else if(u.plan_request==='pending'){ub.disabled=true;ub.textContent="Pending Approval"}}
  const j=await api("/api/sites");
  if($("sites")) $("sites").innerHTML=(j.sites||[]).map(s=>`<div class="dash-row"><div><b>${esc(s.title)}</b><p>${esc(s.slug)}</p></div><div class="row-actions"><button onclick='editSite(${JSON.stringify(s).replaceAll("'","&apos;")})'>Builder</button><a href="${pageUrl("site.html?slug="+s.slug)}" target="_blank">Open</a><button onclick="delSite(${s.id})">Delete</button></div></div>`).join("")||"<p>No website yet.</p>";
}
async function requestPro(){
  const u=meCache||await requireMe(); if(!u?.email_verified)return toast("Verify Gmail before buying Pro","err");
  const file=$("proProof")?.files?.[0]; if(!file)return toast("Upload payment proof first","err");
  const fd=new FormData(); fd.append("proof",file); const j=await api("/api/upgrade/request",{method:"POST",body:fd}); if(j.ok){toast("Pro request sent to admin");loadPanel()}
}
async function createSite(){
  const title=$("siteTitle").value.trim(), slug=$("siteSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,""), template=$("siteTemplate")?.value||"neon", description=$("siteDesc")?.value||"";
  if(!title||!slug)return toast("Title and slug required","err");
  const j=await api("/api/sites",{method:"POST",body:JSON.stringify({title,slug,template,description})}); if(j.ok){toast("Website created");loadPanel()}
}
async function delSite(id){ if(confirm("Delete website?")){const j=await api("/api/sites/"+id,{method:"DELETE"});if(j.ok)loadPanel()} }
function editSite(s){
  currentSite=s; $("editor").style.display="block";
  ["Title","Hero","Desc","Bg","Btn","Text","Accent"].forEach(()=>{});
  $("eTitle").value=s.title||""; $("eHero").value=s.hero_name||""; $("eDesc").value=s.description||""; $("eTemplate").value=s.template||"neon";
  $("eBg").value=s.background_color||"#070713"; $("eBtn").value=s.button_color||"#ec008c"; $("eText").value=s.text_color||"#ffffff"; $("eAccent").value=s.accent_color||"#00e5ff";
  $("notifyType").value=s.notify_type||"off"; $("discordWebhook").value=s.discord_webhook||""; $("telegramChat").value=s.telegram_chat_id||"";
  $("openPublic")&&( $("openPublic").href=pageUrl("site.html?slug="+s.slug) ); renderPreview(); loadItems(); $("editor").scrollIntoView({behavior:"smooth"});
}
function renderPreview(){ if(!currentSite||!$("livePreview"))return; $("livePreview").innerHTML=`<div class="mini-store" style="background:${$("eBg").value};color:${$("eText").value};border-color:${$("eAccent").value}"><span class="pill">Live Preview</span><h2>${esc($("eHero").value||$("eTitle").value||"Cambo Store")}</h2><p>${esc($("eDesc").value||"Minecraft shop")}</p><button style="background:${$("eBtn").value};color:${$("eText").value}">Add to Cart</button></div>`; }
document.addEventListener("input",e=>{if(["eBg","eBtn","eText","eAccent","eHero","eDesc"].includes(e.target.id))renderPreview()});
async function saveSite(){
  if(!currentSite)return; let logo=currentSite.logo_url||"",banner=currentSite.banner_url||"",qr=currentSite.qr_url||"";
  if($("logoFile")?.files?.[0])logo=await upload($("logoFile").files[0]); if($("bannerFile")?.files?.[0])banner=await upload($("bannerFile").files[0]); if($("qrFile")?.files?.[0])qr=await upload($("qrFile").files[0]);
  const data={title:$("eTitle").value,hero_name:$("eHero").value,description:$("eDesc").value,template:$("eTemplate").value,background_color:$("eBg").value,button_color:$("eBtn").value,text_color:$("eText").value,accent_color:$("eAccent").value,logo_url:logo,banner_url:banner,qr_url:qr,notify_type:$("notifyType").value,discord_webhook:$("discordWebhook").value,telegram_chat_id:$("telegramChat").value};
  const j=await api("/api/sites/"+currentSite.id,{method:"PUT",body:JSON.stringify(data)}); if(j.ok){currentSite={...currentSite,...data};toast("Saved");renderPreview();loadPanel()}
}
async function addItem(){const img=await upload($("itemImage")?.files?.[0]); const j=await api(`/api/sites/${currentSite.id}/items`,{method:"POST",body:JSON.stringify({name:$("itemName").value,price:$("itemPrice").value,description:$("itemDesc").value,image_url:img,button_text:$("itemButton")?.value||"Add"})}); if(j.ok){toast("Item added");loadItems()}}
async function loadItems(){ if(!currentSite||!$("items"))return; const j=await api(`/api/sites/${currentSite.id}/items`); $("items").innerHTML=(j.items||[]).map(i=>`<div class="dash-row"><div><b>${esc(i.name)}</b><p>$${esc(i.price)} • ${esc(i.description)}</p></div><button onclick="delItem(${i.id})">Delete</button></div>`).join("")||"<p>No items yet.</p>"; }
async function delItem(id){const j=await api("/api/items/"+id,{method:"DELETE"});if(j.ok)loadItems()}

/* ADMIN */
async function loadAdmin(){const j=await api("/api/admin/users"); if(!j.ok||!$("users"))return; $("users").innerHTML=(j.users||[]).map(u=>`<div class="admin-card"><div><h3>${esc(u.name)}</h3><p>${esc(u.email)} ${u.email_verified?"✅":"❌"}</p><small>${esc(u.role)} • ${esc(u.plan)} • ${esc(u.plan_request)}</small>${u.pro_proof_url?`<br><a href="${u.pro_proof_url}" target="_blank">View Pro Proof</a>`:""}</div><div><button onclick="setPlan(${u.id},'pro')">Approve Pro</button><button onclick="setPlan(${u.id},'free')">Set Free</button><button onclick="makeAdmin(${u.id})">Admin</button></div></div>`).join("");}
async function setPlan(id,plan){const j=await api(`/api/admin/users/${id}/plan`,{method:"PUT",body:JSON.stringify({plan})}); if(j.ok)loadAdmin()}
async function makeAdmin(id){const j=await api(`/api/admin/users/${id}/role`,{method:"PUT",body:JSON.stringify({role:"admin"})}); if(j.ok)loadAdmin()}

/* PUBLIC STORE */
function slugFromUrl(){const q=new URLSearchParams(location.search).get("slug"); return q||location.pathname.split("/").filter(Boolean).pop()||"";}
async function loadPublic(){const slug=slugFromUrl(); const j=await api("/api/public/"+slug,{headers:{authorization:""}}); if(!j.ok)return; publicSite=j.site; publicItems=j.items||[]; document.title=publicSite.title||"Cambo Store"; renderPublic();}
function renderPublic(){
  const s=publicSite; document.body.className="neon-body";
  $("publicSite").innerHTML=`<div class="store-app">
    <aside class="store-sidebar"><div class="store-logo"><div class="logo-icon">👑</div><div>CAMBO<br><span>STORE</span></div></div><nav><a class="active">🏠 Home</a><a>👑 Ranks</a><a>🔑 Keys</a><a>🎁 Kits</a><a>📦 Crates</a><a>⭐ Reviews</a><a>💬 Discord</a></nav><div class="sidebar-profile"><b>${esc(s.title)}</b><p>Balance <span>$0.00</span></p></div></aside>
    <main class="store-content"><header class="topbar"><div class="search">🔎 Search ranks, keys, kits...</div><div class="cart-pill">🛒 Cart <b>${cart.reduce((a,b)=>a+b.qty,0)}</b></div></header><section class="hero-neon" style="background:linear-gradient(90deg,rgba(8,8,20,.96),rgba(20,0,40,.35)),${s.banner_url?`url('${s.banner_url}')`:"radial-gradient(circle at 70% 30%,#ec008caa,transparent 45%)"};background-size:cover;background-position:center"><span class="pill">⭐ #1 Minecraft Store</span><h1>${esc(s.hero_name||s.title||"POWER UP YOUR GAME")}</h1><p>${esc(s.description||"Get the best ranks, keys, kits and crates.")}</p><button onclick="document.querySelector('.product-grid').scrollIntoView({behavior:'smooth'})">🛒 Shop Now</button><button class="ghost">👑 View Top Ranks</button></section><section class="stats-row"><div>📦 <b>100+</b><span>Products</span></div><div>👥 <b>1K+</b><span>Players</span></div><div>🎧 <b>24/7</b><span>Support</span></div><div>🛡️ <b>99.9%</b><span>Uptime</span></div></section><h2 class="section-title">🌟 Featured Products</h2><section class="product-grid">${publicItems.map(i=>`<article class="product-card">${i.image_url?`<img src="${i.image_url}">`:`<div class="item-placeholder">🎁</div>`}<h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><strong>$${Number(i.price||0).toFixed(2)}</strong><button style="background:${s.button_color||"#ec008c"};color:${s.text_color||"#fff"}" onclick="addCart(${i.id})">🛒 ${esc(i.button_text||"Add")}</button></article>`).join("")||"<p>No products yet.</p>"}</section><section class="trust-bar"><div>⚡ Instant Delivery</div><div>🔒 100% Safe</div><div>💬 24/7 Support</div><div>⭐ Best Prices</div></section></main>
    <aside class="checkout-card"><h2>🛒 Your Cart</h2><div id="cartList"></div><label>Minecraft Name</label><input id="mcName" placeholder="Player name"><label>Edition</label><select id="edition"><option>Java</option><option>Bedrock</option></select><label>Email Verification</label><input id="buyerEmail" type="email" placeholder="your@gmail.com"><button onclick="sendOtp()">Send OTP</button><input id="otp" placeholder="OTP code"><button onclick="verifyOtp()">Verify OTP</button>${s.qr_url?`<div class="qr-box"><h3>Scan to Pay</h3><img src="${s.qr_url}"></div>`:""}<label>Upload Payment Proof</label><input id="proof" type="file" accept="image/*"><button class="submit-btn" onclick="submitOrder()">Submit Order</button></aside>
  </div>`; renderCart();
}
function addCart(id){const it=publicItems.find(x=>x.id===id); if(!it)return; const row=cart.find(x=>x.id===id); row?row.qty++:cart.push({id,qty:1}); renderPublic();}
function removeCart(id){cart=cart.filter(x=>x.id!==id); renderCart();}
function renderCart(){const el=$("cartList"); if(!el)return; let total=0; el.innerHTML=cart.map(c=>{const i=publicItems.find(x=>x.id===c.id), sub=Number(i?.price||0)*c.qty; total+=sub; return `<div class="cart-line"><span>${esc(i?.name)} x${c.qty}</span><b>$${sub.toFixed(2)}</b><button onclick="removeCart(${c.id})">×</button></div>`}).join("")+`<hr><div class="cart-total"><span>Total</span><b>$${total.toFixed(2)}</b></div>`;}
async function sendOtp(){const email=$("buyerEmail").value.trim().toLowerCase(); if(!email)return toast("Enter Gmail first","err"); const j=await api("/api/otp/send",{method:"POST",headers:{authorization:""},body:JSON.stringify({email})}); if(j.ok)toast("OTP sent to Gmail");}
async function verifyOtp(){const email=$("buyerEmail").value.trim().toLowerCase(), code=$("otp").value.trim(); if(!email||!code)return toast("Enter Gmail and OTP","err"); const j=await api("/api/otp/verify",{method:"POST",headers:{authorization:""},body:JSON.stringify({email,code})}); if(j.ok){otpToken=j.otp_token;toast("Gmail verified")}}
async function submitOrder(){if(!cart.length)return toast("Cart empty","err"); if(!otpToken)return toast("Verify Gmail first","err"); const proof=await upload($("proof")?.files?.[0],true); if(!proof)return toast("Upload payment proof","err"); const j=await api("/api/orders",{method:"POST",headers:{authorization:""},body:JSON.stringify({site_id:publicSite.id,cart,minecraft_name:$("mcName").value,edition:$("edition").value,otp_token:otpToken,payment_proof_url:proof})}); if(j.ok){toast("Order submitted");cart=[];otpToken="";renderPublic()}}
