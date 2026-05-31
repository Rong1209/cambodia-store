const API = 'https://cambo-store-api.phanhaotdg.workers.dev';
const BASE = location.hostname.includes('github.io') ? '/pinkie/' : '/';

const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem('token') || '';

function go(page) {
  location.href = BASE + page;
}

function pageUrl(page) {
  return BASE + page;
}

function setBtnLoading(btn, loading, text = 'Loading...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = text;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.oldText || btn.innerHTML;
  }
}

async function api(path, opt = {}) {
  const isForm = opt.body instanceof FormData;
  const headers = isForm
    ? { authorization: 'Bearer ' + token() }
    : { 'content-type': 'application/json', authorization: 'Bearer ' + token() };

  try {
    const r = await fetch(API + path, {
      ...opt,
      headers: { ...headers, ...(opt.headers || {}) }
    });

    const j = await r.json().catch(() => ({ ok: false, error: 'Bad server response' }));
    if (!j.ok) alert(j.error || 'Request failed');
    return j;
  } catch (err) {
    console.error(err);
    alert('Cannot connect to server');
    return { ok: false, error: 'Cannot connect to server' };
  }
}

async function upload(file) {
  if (!file) return '';
  const fd = new FormData();
  fd.append('file', file);
  const j = await api('/api/upload', { method: 'POST', body: fd });
  return j.url || '';
}

async function publicUpload(file) {
  if (!file) return '';
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(API + '/api/public-upload', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({ ok: false }));
  return j.url || '';
}

const esc = (s) => String(s || '').replace(/[&<>'"]/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[c]));

function initAuthNav() {
  const logged = !!token();
  document.querySelectorAll('[data-auth="logged-out"]').forEach(el => el.style.display = logged ? 'none' : '');
  document.querySelectorAll('[data-auth="logged-in"]').forEach(el => el.style.display = logged ? '' : 'none');
}

async function register() {
  const btn = event?.target;
  const name = $('name')?.value.trim();
  const email = $('email')?.value.trim().toLowerCase();
  const password = $('password')?.value.trim();

  if (!name || !email || !password) return alert('Please fill all fields');

  setBtnLoading(btn, true, 'Creating...');
  const j = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });
  setBtnLoading(btn, false);

  if (j.ok) {
    localStorage.setItem('last_email', email);
    alert('Account created successfully. Please login.');
    go('login.html');
  }
}

async function login() {
  const btn = event?.target;
  const email = $('email')?.value.trim().toLowerCase();
  const password = $('password')?.value.trim();

  if (!email || !password) return alert('Please fill all fields');

  setBtnLoading(btn, true, 'Signing in...');
  const j = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setBtnLoading(btn, false);

  if (j.ok) {
    localStorage.setItem('token', j.token);
    go('panel.html');
  }
}

function logout() {
  localStorage.removeItem('token');
  go('login.html');
}

function fillLoginEmail() {
  if ($('email') && localStorage.getItem('last_email')) {
    $('email').value = localStorage.getItem('last_email');
  }
}

let currentSite = null;

async function loadPanel() {
  const me = await api('/api/me');
  if (!me.ok) return go('login.html');

  const u = me.user;
  if ($('userName')) $('userName').textContent = u.name;
  if ($('userEmail')) $('userEmail').textContent = u.email;
  if ($('planName')) $('planName').textContent = (u.role === 'admin' ? 'ADMIN' : u.plan).toUpperCase();

  if ($('adminLink') && u.role === 'admin') $('adminLink').style.display = 'inline-flex';

  if ($('upgradeBtn')) {
    if (u.role === 'admin' || u.plan === 'pro') {
      $('upgradeBtn').textContent = 'Pro Active';
      $('upgradeBtn').disabled = true;
    } else if (u.plan_request === 'pending') {
      $('upgradeBtn').textContent = 'Waiting Admin Approval';
      $('upgradeBtn').disabled = true;
    }
  }

  if ($('createHint')) {
    $('createHint').textContent = (u.role === 'admin' || u.plan === 'pro')
      ? 'You can create and publish store websites.'
      : 'Buy Pro for $5 to unlock website builder.';
  }

  const j = await api('/api/sites');
  if (!$('sites')) return;

  $('sites').innerHTML = (j.sites || []).map((s) => `
    <div class="dash-row neon-card">
      <div>
        <b>${esc(s.title)}</b>
        <span class="small">${location.hostname.includes('github.io') ? location.origin + BASE + 'site.html?slug=' + esc(s.slug) : 'khstore.online/' + esc(s.slug)}</span>
      </div>
      <div class="row-actions">
        <button class="mini-btn" onclick='editSite(${JSON.stringify(s).replaceAll("'", '&apos;')})'>Builder</button>
        <a class="mini-btn ghost" href="${pageUrl('site.html?slug=' + s.slug)}" target="_blank">Open</a>
        <button class="mini-btn danger" onclick="delSite(${s.id})">Delete</button>
      </div>
    </div>
  `).join('') || '<p class="muted">No site yet. Create your first Cambo Store.</p>';
}

async function requestPro() {
  const btn = event?.target;
  setBtnLoading(btn, true, 'Uploading...');

  const fd = new FormData();
  const proof = $('proProof')?.files?.[0];
  if (proof) fd.append('proof', proof);

  const j = await api('/api/upgrade/request', { method: 'POST', body: fd });
  setBtnLoading(btn, false);

  if (j.ok) {
    alert('Pro request sent. Admin will approve after checking payment proof.');
    loadPanel();
  }
}

async function createSite() {
  const title = $('siteTitle')?.value.trim();
  const slug = $('siteSlug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const template = $('siteTemplate')?.value || 'neon';
  const description = $('siteDesc')?.value.trim() || '';

  if (!title || !slug) return alert('Please fill title and slug');

  const j = await api('/api/sites', {
    method: 'POST',
    body: JSON.stringify({ title, slug, template, description })
  });

  if (j.ok) {
    alert('Website created');
    loadPanel();
  }
}

async function delSite(id) {
  if (!confirm('Delete this website?')) return;
  const j = await api('/api/sites/' + id, { method: 'DELETE' });
  if (j.ok) loadPanel();
}

function bindDrop(dropId, inputId, labelId) {
  const drop = $(dropId);
  const input = $(inputId);
  const label = $(labelId);
  if (!drop || !input) return;

  drop.onclick = () => input.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag'); };
  drop.ondragleave = () => drop.classList.remove('drag');
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    input.files = e.dataTransfer.files;
    if (label && input.files[0]) label.textContent = input.files[0].name;
  };
  input.onchange = () => {
    if (label && input.files[0]) label.textContent = input.files[0].name;
  };
}

async function editSite(s) {
  currentSite = s;
  if (!$('editor')) return;

  $('editor').style.display = 'block';
  $('eTemplate').value = s.template || 'neon';
  $('eTitle').value = s.title || '';
  $('eHero').value = s.hero_name || s.title || '';
  $('eDesc').value = s.description || '';
  $('eBg').value = s.background_color || '#080817';
  $('eBtn').value = s.button_color || '#ec008c';
  $('eText').value = s.text_color || '#ffffff';
  $('eAccent').value = s.accent_color || '#00e5ff';
  $('notifyType').value = s.notify_type || 'discord';
  $('discordWebhook').value = s.discord_webhook || '';
  $('telegramChat').value = s.telegram_chat_id || '';
  if ($('openPublic')) $('openPublic').href = pageUrl('site.html?slug=' + s.slug);

  renderPreview();
  loadItems();
  bindDrop('logoDrop', 'logoFile', 'logoLabel');
  bindDrop('bannerDrop', 'bannerFile', 'bannerLabel');
  bindDrop('qrDrop', 'qrFile', 'qrLabel');
  $('editor').scrollIntoView({ behavior: 'smooth' });
}

function renderPreview() {
  if (!currentSite || !$('livePreview')) return;
  const bg = $('eBg').value;
  const btn = $('eBtn').value;
  const text = $('eText').value;
  const accent = $('eAccent').value;
  const tpl = $('eTemplate').value;

  $('livePreview').className = 'live-preview ' + tpl;
  $('livePreview').style.background = bg;
  $('livePreview').style.color = text;
  $('livePreview').innerHTML = `
    ${currentSite.banner_url ? `<img class="preview-banner" src="${currentSite.banner_url}">` : ''}
    <div class="preview-glow"></div>
    <h2>${esc($('eHero').value || 'Cambo Store')}</h2>
    <p>${esc($('eDesc').value || 'Minecraft rank and item store')}</p>
    <button style="background:${btn};color:${text};box-shadow:0 0 24px ${accent}">Add to Cart</button>
  `;
}

document.addEventListener('input', (e) => {
  if (['eBg', 'eBtn', 'eText', 'eAccent', 'eHero', 'eDesc', 'eTemplate'].includes(e.target.id)) renderPreview();
});

async function saveSite() {
  if (!currentSite) return;
  const btn = event?.target;
  setBtnLoading(btn, true, 'Saving...');

  let logo = currentSite.logo_url || '';
  let banner = currentSite.banner_url || '';
  let qr = currentSite.qr_url || '';

  if ($('logoFile')?.files?.[0]) logo = await upload($('logoFile').files[0]);
  if ($('bannerFile')?.files?.[0]) banner = await upload($('bannerFile').files[0]);
  if ($('qrFile')?.files?.[0]) qr = await upload($('qrFile').files[0]);

  const data = {
    template: $('eTemplate').value,
    title: $('eTitle').value,
    hero_name: $('eHero').value,
    description: $('eDesc').value,
    background_color: $('eBg').value,
    button_color: $('eBtn').value,
    text_color: $('eText').value,
    accent_color: $('eAccent').value,
    logo_url: logo,
    banner_url: banner,
    qr_url: qr,
    notify_type: $('notifyType').value,
    discord_webhook: $('discordWebhook').value,
    telegram_chat_id: $('telegramChat').value
  };

  const j = await api('/api/sites/' + currentSite.id, { method: 'PUT', body: JSON.stringify(data) });
  setBtnLoading(btn, false);

  if (j.ok) {
    currentSite = { ...currentSite, ...data };
    alert('Saved');
    renderPreview();
    loadPanel();
  }
}

async function addItem() {
  if (!currentSite) return alert('Open a website builder first');
  const img = await upload($('itemImage')?.files?.[0]);
  const j = await api(`/api/sites/${currentSite.id}/items`, {
    method: 'POST',
    body: JSON.stringify({
      name: $('itemName').value,
      price: $('itemPrice').value,
      description: $('itemDesc').value,
      image_url: img,
      button_text: $('itemButton').value || 'Add to Cart'
    })
  });
  if (j.ok) {
    $('itemName').value = '';
    $('itemPrice').value = '';
    $('itemDesc').value = '';
    $('itemButton').value = '';
    if ($('itemImage')) $('itemImage').value = '';
    loadItems();
  }
}

async function loadItems() {
  if (!currentSite || !$('items')) return;
  const j = await api(`/api/sites/${currentSite.id}/items`);
  $('items').innerHTML = (j.items || []).map(i => `
    <div class="dash-row neon-card">
      <div>
        <b>${esc(i.name)}</b>
        <span class="small">$${esc(i.price)} • ${esc(i.description)}</span>
      </div>
      <button class="mini-btn danger" onclick="delItem(${i.id})">Delete</button>
    </div>
  `).join('') || '<p class="muted">No items yet.</p>';
}

async function delItem(id) {
  const j = await api('/api/items/' + id, { method: 'DELETE' });
  if (j.ok) loadItems();
}

async function loadAdmin() {
  const j = await api('/api/admin/users');
  if (!j.ok || !$('users')) return;

  $('users').innerHTML = (j.users || []).map(u => `
    <div class="admin-user neon-card">
      <div>
        <b>${esc(u.name)}</b>
        <span>${esc(u.email)}</span>
        <small>Role: ${esc(u.role)} • Plan: ${esc(u.plan)} • Request: ${esc(u.plan_request)}</small>
        ${u.pro_proof_url ? `<a href="${u.pro_proof_url}" target="_blank" class="proof-link">View Pro Proof</a>` : ''}
      </div>
      <div class="row-actions">
        <button class="mini-btn" onclick="setPlan(${u.id}, 'pro')">Approve Pro</button>
        <button class="mini-btn ghost" onclick="setPlan(${u.id}, 'free')">Set Free</button>
      </div>
    </div>
  `).join('');
}

async function setPlan(id, plan) {
  const j = await api('/api/admin/users/' + id + '/plan', {
    method: 'PUT',
    body: JSON.stringify({ plan })
  });
  if (j.ok) loadAdmin();
}

let publicSite = null;
let publicItems = [];
let cart = [];
let otpToken = '';

function slugFromUrl() {
  const q = new URLSearchParams(location.search).get('slug');
  if (q) return q;
  return location.pathname.split('/').filter(Boolean).pop() || '';
}

async function loadPublic() {
  const slug = slugFromUrl();
  if (!slug) return;
  const j = await api('/api/public/' + slug, { headers: { authorization: '' } });
  if (!j.ok) return;

  publicSite = j.site;
  publicItems = j.items || [];
  document.title = publicSite.title || 'Cambo Store';
  document.body.style.background = publicSite.background_color || '#070814';
  document.body.style.color = publicSite.text_color || '#fff';
  renderPublic();
}

function renderPublic() {
  if (!publicSite || !$('publicSite')) return;
  const s = publicSite;
  $('publicSite').innerHTML = `
    <div class="particles"></div>
    <section class="store-shell">
      <aside class="store-sidebar">
        ${s.logo_url ? `<img class="store-logo" src="${s.logo_url}">` : '<div class="store-logo-fallback">CS</div>'}
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.description)}</p>
        <button onclick="document.querySelector('.checkout-panel').scrollIntoView({behavior:'smooth'})">Checkout</button>
      </aside>

      <main class="store-main">
        <section class="store-hero ${esc(s.template)}">
          <div>
            <span class="pill">Minecraft Community Store</span>
            <h1>${esc(s.hero_name || s.title)}</h1>
            <p>${esc(s.description)}</p>
          </div>
          ${s.banner_url ? `<img src="${s.banner_url}" class="hero-img">` : ''}
        </section>

        <section class="store-grid">
          ${publicItems.map(i => `
            <article class="store-card">
              ${i.image_url ? `<img src="${i.image_url}">` : '<div class="item-placeholder">⛏️</div>'}
              <h3>${esc(i.name)}</h3>
              <p>${esc(i.description)}</p>
              <div class="card-bottom">
                <b>$${esc(i.price)}</b>
                <button style="background:${s.button_color};color:${s.text_color}" onclick="addCart(${i.id})">${esc(i.button_text || 'Add')}</button>
              </div>
            </article>
          `).join('') || '<p>No items yet.</p>'}
        </section>
      </main>

      <aside class="checkout-panel">
        <h2>Checkout</h2>
        <div id="cartList"></div>

        <label>Minecraft Name</label>
        <input id="mcName" placeholder="Your player name">

        <label>Edition</label>
        <select id="edition"><option>Java</option><option>Bedrock</option></select>

        <label>Gmail / Email OTP</label>
        <input id="buyerEmail" type="email" placeholder="your@gmail.com">
        <button class="ghost-action" onclick="sendOtp()">Send OTP to Email</button>

        <input id="otp" placeholder="Enter OTP code">
        <button class="ghost-action" onclick="verifyOtp()">Verify Email</button>

        ${s.qr_url ? `<h3>Scan QR to Pay</h3><img class="qr-img" src="${s.qr_url}">` : ''}

        <label>Payment Screenshot</label>
        <input id="proof" type="file" accept="image/*">
        <button class="submit-order" onclick="submitOrder()">Submit Order</button>
      </aside>
    </section>
  `;
  renderCart();
}

function addCart(id) {
  const item = publicItems.find(x => x.id === id);
  if (!item) return;
  const row = cart.find(x => x.id === id);
  row ? row.qty++ : cart.push({ id, qty: 1 });
  renderCart();
}

function removeCart(id) {
  cart = cart.filter(x => x.id !== id);
  renderCart();
}

function renderCart() {
  const el = $('cartList');
  if (!el) return;
  let total = 0;
  el.innerHTML = cart.map(c => {
    const i = publicItems.find(x => x.id === c.id);
    const sub = (Number(i?.price) || 0) * c.qty;
    total += sub;
    return `
      <div class="cart-line">
        <span>${esc(i?.name)} x${c.qty}</span>
        <b>$${sub.toFixed(2)}</b>
        <button onclick="removeCart(${c.id})">×</button>
      </div>
    `;
  }).join('') + `<div class="cart-total">Total: $${total.toFixed(2)}</div>`;
}

async function sendOtp() {
  const email = $('buyerEmail')?.value.trim().toLowerCase();
  if (!email) return alert('Enter your Gmail/email first');

  const btn = event?.target;
  setBtnLoading(btn, true, 'Sending...');
  const j = await api('/api/otp/send', {
    method: 'POST',
    headers: { authorization: '' },
    body: JSON.stringify({ email })
  });
  setBtnLoading(btn, false);

  if (j.ok) alert('OTP sent to your email. Check inbox or spam.');
}

async function verifyOtp() {
  const email = $('buyerEmail')?.value.trim().toLowerCase();
  const code = $('otp')?.value.trim();
  if (!email || !code) return alert('Enter email and OTP code');

  const j = await api('/api/otp/verify', {
    method: 'POST',
    headers: { authorization: '' },
    body: JSON.stringify({ email, code })
  });

  if (j.ok) {
    otpToken = j.otp_token;
    alert('Email verified');
  }
}

async function submitOrder() {
  if (!publicSite) return;
  if (!cart.length) return alert('Cart is empty');
  if (!otpToken) return alert('Verify email first');
  if (!$('mcName')?.value.trim()) return alert('Enter Minecraft name');

  const btn = event?.target;
  setBtnLoading(btn, true, 'Submitting...');

  const proof = await publicUpload($('proof')?.files?.[0]);
  const j = await api('/api/orders', {
    method: 'POST',
    headers: { authorization: '' },
    body: JSON.stringify({
      site_id: publicSite.id,
      cart,
      minecraft_name: $('mcName').value.trim(),
      edition: $('edition').value,
      otp_token: otpToken,
      payment_proof_url: proof
    })
  });

  setBtnLoading(btn, false);

  if (j.ok) {
    alert('Order submitted successfully! Total $' + j.total);
    cart = [];
    otpToken = '';
    renderCart();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initAuthNav();
  fillLoginEmail();
});
