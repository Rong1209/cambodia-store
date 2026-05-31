const API = 'https://cambo-store-api.phanhaotdg.workers.dev';
const REPO_BASE = '/pinkie/';
const BASE = location.hostname.endsWith('github.io') ? REPO_BASE : '/';
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem('token') || '';
function go(page=''){ location.href = BASE + page; }
function pageUrl(page=''){ return BASE + page; }
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function money(n){ return '$' + (Number(n||0)).toFixed(2); }
function toast(msg,type='ok'){
  let box=$('toastBox'); if(!box){box=document.createElement('div');box.id='toastBox';document.body.appendChild(box)}
  const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;box.appendChild(el);setTimeout(()=>el.classList.add('show'),10);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300)},3300);
}
function setLoading(btn, on, text='Loading...'){
  if(!btn)return; if(on){btn.dataset.old=btn.innerHTML;btn.disabled=true;btn.innerHTML=`<span class="spin"></span>${text}`}else{btn.disabled=false;btn.innerHTML=btn.dataset.old||btn.innerHTML}
}
async function api(path,opt={}){
  const isForm=opt.body instanceof FormData;
  const headers=isForm?{'Authorization':'Bearer '+token()}:{'Content-Type':'application/json','Authorization':'Bearer '+token()};
  const res=await fetch(API+path,{...opt,headers:{...headers,...(opt.headers||{})}}).catch(()=>null);
  if(!res){toast('Cannot connect to server','bad');return{ok:false}}
  const j=await res.json().catch(()=>({ok:false,error:'Bad server response'}));
  if(!j.ok)toast(j.error||'Something went wrong','bad');
  return j;
}
async function upload(file, isPublic=false){ if(!file)return''; const fd=new FormData();fd.append('file',file); const j=await api(isPublic?'/api/public-upload':'/api/upload',{method:'POST',body:fd}); return j.url||''; }
function initTheme(){ const t=localStorage.getItem('theme')||'dark'; document.documentElement.dataset.theme=t; }
function toggleTheme(){ const n=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=n;localStorage.setItem('theme',n); }
initTheme();

async function register(){
  const btn=event?.target; setLoading(btn,true,'Creating...');
  const name=$('name')?.value.trim(), email=$('email')?.value.trim(), password=$('password')?.value.trim();
  if(!name||!email||!password){toast('Please fill all fields','bad');setLoading(btn,false);return}
  const j=await api('/api/register',{method:'POST',body:JSON.stringify({name,email,password})});
  setLoading(btn,false); if(j.ok){toast('Account created. Login now.','ok');setTimeout(()=>go('login.html'),700)}
}
async function login(){
  const btn=event?.target; setLoading(btn,true,'Signing in...');
  const email=$('email')?.value.trim(), password=$('password')?.value.trim();
  if(!email||!password){toast('Please fill all fields','bad');setLoading(btn,false);return}
  const j=await api('/api/login',{method:'POST',body:JSON.stringify({email,password})});
  setLoading(btn,false); if(j.ok){localStorage.setItem('token',j.token);toast('Welcome back!','ok');setTimeout(()=>go('panel.html'),500)}
}
function logout(){ localStorage.removeItem('token'); go('login.html'); }
async function hydrateNav(){
  const navUser=$('navUser'); const loginBtn=$('loginBtn');
  if(!token()){ if(loginBtn)loginBtn.style.display='inline-flex'; return; }
  const me=await api('/api/me');
  if(me.ok){ if(loginBtn)loginBtn.style.display='none'; if(navUser){navUser.innerHTML=`<b>${esc(me.user.name)}</b><span>${esc(me.user.plan.toUpperCase())}</span>`;navUser.onclick=()=>go('panel.html')} }
  else localStorage.removeItem('token');
}

async function loadHome(){ hydrateNav(); makeParticles(); }
function makeParticles(){ const p=$('particles'); if(!p)return; p.innerHTML=''; for(let i=0;i<40;i++){const s=document.createElement('span');s.style.left=Math.random()*100+'%';s.style.animationDelay=Math.random()*8+'s';s.style.animationDuration=(5+Math.random()*8)+'s';p.appendChild(s)} }

let currentSite=null;
async function requireMe(){ const me=await api('/api/me'); if(!me.ok){go('login.html');return null} return me.user; }
async function loadPanel(){
  const u=await requireMe(); if(!u)return;
  $('userName').textContent=u.name; $('userEmail').textContent=u.email; $('planName').textContent=(u.role==='admin'?'ADMIN':u.plan).toUpperCase();
  if(u.role==='admin') $('adminLink').style.display='inline-flex';
  if(u.role==='admin'||u.plan==='pro'){ $('proState').innerHTML='<b class="green">Pro Active</b><span>You can publish stores.</span>'; $('proBox').classList.add('active'); }
  else if(u.plan_request==='pending'){ $('proState').innerHTML='<b class="pink">Pending Review</b><span>Admin will approve after checking proof.</span>'; }
  const j=await api('/api/sites');
  $('sites').innerHTML=(j.sites||[]).map(s=>`<div class="dash-row"><div><b>${esc(s.title)}</b><span>${location.origin}${pageUrl('site.html?slug='+s.slug)}</span></div><div class="actions"><button onclick='editSite(${JSON.stringify(s).replaceAll("'","&apos;")})'>Builder</button><a href="${pageUrl('site.html?slug='+s.slug)}" target="_blank">Open</a><button class="danger" onclick="delSite(${s.id})">Delete</button></div></div>`).join('')||'<div class="empty">No store yet. Create your first store.</div>';
  loadOwnerOrders();
}
async function requestPro(){
  const btn=event?.target; setLoading(btn,true,'Uploading...');
  const fd=new FormData(); const file=$('proProof')?.files[0]; if(!file){toast('Upload payment proof first','bad');setLoading(btn,false);return}
  fd.append('proof',file); const j=await api('/api/upgrade/request',{method:'POST',body:fd}); setLoading(btn,false); if(j.ok){toast('Pro request sent to admin','ok');loadPanel()}
}
async function createSite(){
  const title=$('siteTitle').value.trim(), slug=$('siteSlug').value.trim(), description=$('siteDesc').value.trim(), template=$('siteTemplate').value;
  if(!title||!slug){toast('Store name and slug required','bad');return}
  const j=await api('/api/sites',{method:'POST',body:JSON.stringify({title,slug,description,template})}); if(j.ok){toast('Store created','ok');loadPanel()}
}
async function delSite(id){ if(!confirm('Delete website?'))return; const j=await api('/api/sites/'+id,{method:'DELETE'}); if(j.ok)loadPanel(); }
function previewUrl(fileInput, cb){ const f=$(fileInput)?.files[0]; if(!f)return; const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(f); }
function editSite(s){
  currentSite=s; $('editor').classList.add('show');
  $('eTemplate').value=s.template||'neon';$('eTitle').value=s.title||'';$('eHero').value=s.hero_name||s.title||'';$('eDesc').value=s.description||'';
  $('eBg').value=s.background_color||'#070817';$('eBtn').value=s.button_color||'#ec008c';$('eText').value=s.text_color||'#ffffff';$('eAccent').value=s.accent_color||'#00e5ff';
  $('notifyType').value=s.notify_type||'off';$('discordWebhook').value=s.discord_webhook||'';$('telegramChat').value=s.telegram_chat_id||'';$('openPublic').href=pageUrl('site.html?slug='+s.slug);
  renderPreview(); loadItems(); $('editor').scrollIntoView({behavior:'smooth'});
}
function renderPreview(){ if(!currentSite)return; const bg=$('eBg').value, btn=$('eBtn').value, text=$('eText').value, accent=$('eAccent').value; const banner=currentSite.banner_url||'img/neon-preview.png';
  $('livePreview').style.cssText=`--bg:${bg};--btn:${btn};--text:${text};--accent:${accent};background:${bg};color:${text}`;
  $('livePreview').innerHTML=`<div class="mini-hero" style="background-image:linear-gradient(90deg,${bg},transparent),url('${banner}')"><span>#1 Minecraft Store</span><h2>${esc($('eHero').value||'Cambo Store')}</h2><p>${esc($('eDesc').value||'Minecraft ranks, keys, kits and crates.')}</p><button style="background:${btn};color:${text};box-shadow:0 0 28px ${accent}">Add To Cart</button></div>`;
}
document.addEventListener('input',e=>{ if(['eBg','eBtn','eText','eAccent','eHero','eDesc'].includes(e.target.id))renderPreview(); });
async function saveSite(){
  let logo=currentSite.logo_url,banner=currentSite.banner_url,qr=currentSite.qr_url;
  if($('logoFile').files[0])logo=await upload($('logoFile').files[0]); if($('bannerFile').files[0])banner=await upload($('bannerFile').files[0]); if($('qrFile').files[0])qr=await upload($('qrFile').files[0]);
  const data={title:$('eTitle').value,hero_name:$('eHero').value,description:$('eDesc').value,template:$('eTemplate').value,background_color:$('eBg').value,button_color:$('eBtn').value,text_color:$('eText').value,accent_color:$('eAccent').value,logo_url:logo,banner_url:banner,qr_url:qr,notify_type:$('notifyType').value,discord_webhook:$('discordWebhook').value,telegram_chat_id:$('telegramChat').value};
  const j=await api('/api/sites/'+currentSite.id,{method:'PUT',body:JSON.stringify(data)}); if(j.ok){currentSite={...currentSite,...data};toast('Saved','ok');renderPreview();loadPanel();}
}
async function addItem(){ if(!currentSite)return; const img=await upload($('itemImage').files[0]); const j=await api(`/api/sites/${currentSite.id}/items`,{method:'POST',body:JSON.stringify({name:$('itemName').value,price:$('itemPrice').value,description:$('itemDesc').value,image_url:img,button_text:$('itemButton').value||'Add',category:$('itemCat').value})}); if(j.ok){toast('Item added','ok');['itemName','itemPrice','itemDesc','itemButton'].forEach(id=>$(id).value='');loadItems()} }
async function loadItems(){ const j=await api(`/api/sites/${currentSite.id}/items`); $('items').innerHTML=(j.items||[]).map(i=>`<div class="dash-row"><div><b>${esc(i.name)}</b><span>${money(i.price)} • ${esc(i.category||'Item')}</span></div><button class="danger" onclick="delItem(${i.id})">Delete</button></div>`).join('')||'<div class="empty">No items yet.</div>'; }
async function delItem(id){ const j=await api('/api/items/'+id,{method:'DELETE'}); if(j.ok)loadItems(); }

async function loadAdmin(){ const u=await requireMe(); if(!u)return; const j=await api('/api/admin/users'); if(!j.ok)return; $('users').innerHTML=(j.users||[]).map(u=>`<div class="admin-card"><div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p><span class="badge">${esc(u.role)} • ${esc(u.plan)}</span><span class="badge ${u.plan_request==='pending'?'hot':''}">${esc(u.plan_request)}</span>${u.pro_proof_url?`<a class="proof" target="_blank" href="${u.pro_proof_url}">View payment proof</a>`:''}</div><div class="actions"><button onclick="setPlan(${u.id},'pro')">Approve Pro</button><button class="danger" onclick="setPlan(${u.id},'free')">Set Free</button></div></div>`).join(''); }
async function setPlan(id,plan){ const j=await api('/api/admin/users/'+id+'/plan',{method:'PUT',body:JSON.stringify({plan})}); if(j.ok){toast('User updated','ok');loadAdmin()} }

let publicSite=null, publicItems=[], cart=[], otpToken='';
function slugFromUrl(){ return new URLSearchParams(location.search).get('slug') || location.pathname.split('/').filter(x=>x && x!=='pinkie')[0] || ''; }
async function loadPublic(){ const slug=slugFromUrl(); const j=await api('/api/public/'+slug,{headers:{Authorization:''}}); if(!j.ok){$('publicSite').innerHTML='<div class="notfound">Store not found</div>';return} publicSite=j.site; publicItems=j.items||[]; document.title=publicSite.title; renderPublic(); }
function itemIcon(i){ return i.image_url || 'img/neon-preview.png'; }
function renderPublic(){ const s=publicSite; document.body.style.background=s.background_color||''; document.body.style.color=s.text_color||''; const cats=['Ranks','Keys','Kits','Crates','Bundles'];
  $('publicSite').innerHTML=`<div class="store-shell"><aside class="store-side"><div class="brand"><img src="${s.logo_url||'img/neon-preview.png'}"><b>${esc(s.title)}</b></div>${cats.map((c,i)=>`<a href="#items">${['⌂','♕','⚿','⚔','▣'][i]} ${c}</a>`).join('')}<div class="side-user"><b>${esc(s.title)}</b><span>Balance <b>$0.00</b></span></div></aside><main class="store-main"><section class="store-hero" style="background-image:linear-gradient(90deg,rgba(7,8,23,.95),rgba(7,8,23,.25)),url('${s.banner_url||'img/neon-preview.png'}')"><span class="pill">★ #1 Minecraft Store</span><h1>${esc(s.hero_name||s.title)}</h1><p>${esc(s.description||'Minecraft ranks, keys, kits and crates.')}</p><div class="hero-stats"><b>100+<span>Products</span></b><b>1K+<span>Players</span></b><b>24/7<span>Support</span></b></div></section><section id="items" class="product-grid">${publicItems.map(i=>`<article class="product"><img src="${itemIcon(i)}"><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><b>${money(i.price)}</b><button onclick="addCart(${i.id})">🛒 ${esc(i.button_text||'Add')}</button></article>`).join('')||'<div class="empty">No products yet.</div>'}</section></main><aside class="checkout"><h2>Your Cart</h2><div id="cartList"></div><label>Minecraft Name</label><input id="mcName" placeholder="Player name"><label>Edition</label><select id="edition"><option>Java</option><option>Bedrock</option></select><label>Email OTP</label><input id="buyerEmail" placeholder="you@email.com"><button onclick="sendEmailOtp()">Send Email OTP</button><input id="otpCode" placeholder="OTP code"><button onclick="verifyEmailOtp()">Verify OTP</button>${s.qr_url?`<h3>Scan QR to pay</h3><img class="qr" src="${s.qr_url}">`:''}<label>Payment Proof</label><input id="proof" type="file" accept="image/*"><button class="submit" onclick="submitOrder()">Submit Order</button></aside></div>`; renderCart(); }
function addCart(id){ const it=publicItems.find(x=>x.id===id); if(!it)return; const r=cart.find(x=>x.id===id); r?r.qty++:cart.push({id,qty:1}); toast(it.name+' added','ok'); renderCart(); }
function renderCart(){ const el=$('cartList'); if(!el)return; let total=0; el.innerHTML=cart.map(c=>{const i=publicItems.find(x=>x.id===c.id); const sub=Number(i?.price||0)*c.qty; total+=sub; return `<div class="cart-line"><span>${esc(i?.name)} x${c.qty}</span><b>${money(sub)}</b></div>`}).join('') + `<hr><b class="total">Total: ${money(total)}</b>`; }
async function sendEmailOtp(){ const email=$('buyerEmail').value.trim(); if(!email)return toast('Enter email first','bad'); const j=await api('/api/otp/send-email',{method:'POST',headers:{Authorization:''},body:JSON.stringify({email,purpose:'order'})}); if(j.ok)toast('OTP sent to email','ok'); }
async function verifyEmailOtp(){ const email=$('buyerEmail').value.trim(), code=$('otpCode').value.trim(); const j=await api('/api/otp/verify-email',{method:'POST',headers:{Authorization:''},body:JSON.stringify({email,code})}); if(j.ok){otpToken=j.otp_token;toast('Email verified','ok')} }
async function submitOrder(){ if(!cart.length)return toast('Cart is empty','bad'); if(!otpToken)return toast('Verify email OTP first','bad'); let proof=''; if($('proof').files[0])proof=await upload($('proof').files[0],true); const j=await api('/api/orders',{method:'POST',headers:{Authorization:''},body:JSON.stringify({site_id:publicSite.id,cart,minecraft_name:$('mcName').value,edition:$('edition').value,otp_token:otpToken,payment_proof_url:proof})}); if(j.ok){cart=[];otpToken='';toast('Order submitted! Transaction ID: '+j.transaction_id,'ok');renderCart()} }


async function loadOwnerOrders(){
  const box=$('ownerOrders');
  if(!box) return;
  const j=await api('/api/owner/orders');
  if(!j.ok) return;
  box.innerHTML=(j.orders||[]).map(o=>`
    <div class="order-card">
      <div class="order-top">
        <div><b>${esc(o.transaction_id||('TX-'+o.id))}</b><span>${esc(o.created_at||'')}</span></div>
        <span class="status ${esc(o.status)}">${esc(o.status||'pending')}</span>
      </div>
      <div class="order-grid">
        <div><small>Store</small><b>${esc(o.site_title)}</b></div>
        <div><small>Buyer</small><b>${esc(o.buyer_email)}</b></div>
        <div><small>Minecraft</small><b>${esc(o.minecraft_name)} / ${esc(o.edition)}</b></div>
        <div><small>Total</small><b>${money(o.total)}</b></div>
      </div>
      <div class="order-items">${esc(o.items_summary||'No items')}</div>
      <div class="actions">
        ${o.payment_proof_url?`<a target="_blank" href="${o.payment_proof_url}">View Proof</a>`:''}
        <button onclick="setOrderStatus(${o.id},'approved')">Approve</button>
        <button class="danger" onclick="setOrderStatus(${o.id},'rejected')">Reject</button>
        <button class="ghost" onclick="setOrderStatus(${o.id},'pending')">Pending</button>
      </div>
    </div>`).join('') || '<div class="empty">No transactions yet.</div>';
}
async function setOrderStatus(id,status){
  const j=await api('/api/owner/orders/'+id+'/status',{method:'PUT',body:JSON.stringify({status})});
  if(j.ok){toast('Transaction updated','ok');loadOwnerOrders();}
}
