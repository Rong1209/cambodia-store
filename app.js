const API = "https://cambo-store-api.phanhaotdg.workers.dev";
const BASE = location.hostname.includes("github.io") ? "/pinkie/" : "/";

const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem("token") || "";

function go(page) {
  location.href = BASE + page;
}

function pageUrl(page) {
  return BASE + page;
}

function esc(s) {
  return String(s || "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

async function api(path, opt = {}) {
  const isForm = opt.body instanceof FormData;
  const headers = isForm
    ? { authorization: "Bearer " + token() }
    : {
        "content-type": "application/json",
        authorization: "Bearer " + token()
      };

  const r = await fetch(API + path, {
    ...opt,
    headers: {
      ...headers,
      ...(opt.headers || {})
    }
  });

  const j = await r.json().catch(() => ({
    ok: false,
    error: "Bad server response"
  }));

  if (!j.ok) alert(j.error || "Error");
  return j;
}

async function upload(file) {
  if (!file) return "";
  const fd = new FormData();
  fd.append("file", file);
  const j = await api("/api/upload", {
    method: "POST",
    body: fd
  });
  return j.url || "";
}

/* AUTH */

async function register() {
  const name = $("name").value.trim();
  const email = $("email").value.trim();
  const password = $("password").value.trim();

  if (!name || !email || !password) return alert("Fill all fields");

  const j = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });

  if (j.ok) {
    alert("Account created");
    go("login.html");
  }
}

async function login() {
  const email = $("email").value.trim();
  const password = $("password").value.trim();

  if (!email || !password) return alert("Fill all fields");

  const j = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  if (j.ok) {
    localStorage.setItem("token", j.token);
    go("panel.html");
  }
}

function logout() {
  localStorage.removeItem("token");
  go("login.html");
}

/* PANEL */

let currentSite = null;

async function loadPanel() {
  const me = await api("/api/me");
  if (!me.ok) return go("login.html");

  const u = me.user;
  if ($("userName")) $("userName").textContent = u.name;
  if ($("userEmail")) $("userEmail").textContent = u.email;
  if ($("planName")) $("planName").textContent = (u.role === "admin" ? "ADMIN" : u.plan).toUpperCase();

  if ($("adminLink") && u.role === "admin") $("adminLink").style.display = "inline-flex";

  if ($("upgradeBtn")) {
    if (u.role === "admin" || u.plan === "pro") {
      $("upgradeBtn").textContent = "Pro Active";
      $("upgradeBtn").disabled = true;
    } else if (u.plan_request === "pending") {
      $("upgradeBtn").textContent = "Pending Approval";
      $("upgradeBtn").disabled = true;
    }
  }

  const j = await api("/api/sites");
  if (!$("sites")) return;

  $("sites").innerHTML = (j.sites || []).map(s => `
    <div class="dash-row">
      <div>
        <b>${esc(s.title)}</b>
        <p>${esc(s.slug)}</p>
      </div>
      <div class="row-actions">
        <button onclick='editSite(${JSON.stringify(s).replaceAll("'", "&apos;")})'>Builder</button>
        <a href="${pageUrl("site.html?slug=" + s.slug)}" target="_blank">Open</a>
        <button onclick="delSite(${s.id})">Delete</button>
      </div>
    </div>
  `).join("") || "<p>No website yet.</p>";
}

async function requestPro() {
  const proof = $("proProof")?.files?.[0];

  if (proof) {
    const fd = new FormData();
    fd.append("proof", proof);
    const j = await api("/api/upgrade/request", {
      method: "POST",
      body: fd
    });
    if (j.ok) {
      alert("Pro request sent");
      loadPanel();
    }
    return;
  }

  const j = await api("/api/upgrade/request", { method: "POST" });
  if (j.ok) {
    alert("Pro request sent");
    loadPanel();
  }
}

async function createSite() {
  const title = $("siteTitle").value.trim();
  const slug = $("siteSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const template = $("siteTemplate")?.value || "neon";
  const description = $("siteDesc")?.value || "";

  if (!title || !slug) return alert("Title and slug required");

  const j = await api("/api/sites", {
    method: "POST",
    body: JSON.stringify({ title, slug, template, description })
  });

  if (j.ok) {
    alert("Website created");
    loadPanel();
  }
}

async function delSite(id) {
  if (!confirm("Delete this website?")) return;
  const j = await api("/api/sites/" + id, { method: "DELETE" });
  if (j.ok) loadPanel();
}

/* BUILDER */

function editSite(s) {
  currentSite = s;

  if (!$("editor")) return;
  $("editor").style.display = "block";

  $("eTitle").value = s.title || "";
  $("eHero").value = s.hero_name || "";
  $("eDesc").value = s.description || "";
  $("eTemplate").value = s.template || "neon";

  $("eBg").value = s.background_color || "#070713";
  $("eBtn").value = s.button_color || "#ec008c";
  $("eText").value = s.text_color || "#ffffff";
  $("eAccent").value = s.accent_color || "#00e5ff";

  $("notifyType").value = s.notify_type || "off";
  $("discordWebhook").value = s.discord_webhook || "";
  $("telegramChat").value = s.telegram_chat_id || "";

  if ($("openPublic")) $("openPublic").href = pageUrl("site.html?slug=" + s.slug);

  renderPreview();
  loadItems();

  $("editor").scrollIntoView({ behavior: "smooth" });
}

function renderPreview() {
  if (!currentSite || !$("livePreview")) return;

  $("livePreview").innerHTML = `
    <div class="preview-card" style="
      background:${$("eBg").value};
      color:${$("eText").value};
      border-color:${$("eAccent").value};
    ">
      <h2>${esc($("eHero").value || $("eTitle").value || "Cambo Store")}</h2>
      <p>${esc($("eDesc").value || "Minecraft ranks, keys and kits.")}</p>
      <button style="background:${$("eBtn").value};color:${$("eText").value}">
        Add to Cart
      </button>
    </div>
  `;
}

document.addEventListener("input", (e) => {
  if (["eBg", "eBtn", "eText", "eAccent", "eHero", "eDesc"].includes(e.target.id)) {
    renderPreview();
  }
});

async function saveSite() {
  if (!currentSite) return;

  let logo = currentSite.logo_url || "";
  let banner = currentSite.banner_url || "";
  let qr = currentSite.qr_url || "";

  if ($("logoFile")?.files?.[0]) logo = await upload($("logoFile").files[0]);
  if ($("bannerFile")?.files?.[0]) banner = await upload($("bannerFile").files[0]);
  if ($("qrFile")?.files?.[0]) qr = await upload($("qrFile").files[0]);

  const data = {
    title: $("eTitle").value,
    hero_name: $("eHero").value,
    description: $("eDesc").value,
    template: $("eTemplate").value,
    background_color: $("eBg").value,
    button_color: $("eBtn").value,
    text_color: $("eText").value,
    accent_color: $("eAccent").value,
    logo_url: logo,
    banner_url: banner,
    qr_url: qr,
    notify_type: $("notifyType").value,
    discord_webhook: $("discordWebhook").value,
    telegram_chat_id: $("telegramChat").value
  };

  const j = await api("/api/sites/" + currentSite.id, {
    method: "PUT",
    body: JSON.stringify(data)
  });

  if (j.ok) {
    alert("Saved");
    currentSite = { ...currentSite, ...data };
    renderPreview();
    loadPanel();
  }
}

async function addItem() {
  if (!currentSite) return;

  const image = await upload($("itemImage")?.files?.[0]);

  const j = await api(`/api/sites/${currentSite.id}/items`, {
    method: "POST",
    body: JSON.stringify({
      name: $("itemName").value,
      price: $("itemPrice").value,
      description: $("itemDesc").value,
      image_url: image,
      button_text: $("itemButton")?.value || "Add"
    })
  });

  if (j.ok) {
    $("itemName").value = "";
    $("itemPrice").value = "";
    $("itemDesc").value = "";
    loadItems();
  }
}

async function loadItems() {
  if (!currentSite || !$("items")) return;

  const j = await api(`/api/sites/${currentSite.id}/items`);

  $("items").innerHTML = (j.items || []).map(i => `
    <div class="dash-row">
      <div>
        <b>${esc(i.name)}</b>
        <p>$${esc(i.price)} • ${esc(i.description)}</p>
      </div>
      <button onclick="delItem(${i.id})">Delete</button>
    </div>
  `).join("") || "<p>No items yet.</p>";
}

async function delItem(id) {
  const j = await api("/api/items/" + id, { method: "DELETE" });
  if (j.ok) loadItems();
}

/* ADMIN */

async function loadAdmin() {
  const j = await api("/api/admin/users");
  if (!j.ok || !$("users")) return;

  $("users").innerHTML = (j.users || []).map(u => `
    <div class="admin-user-card">
      <div>
        <h3>${esc(u.name)}</h3>
        <p>${esc(u.email)}</p>
        <small>${esc(u.role)} • ${esc(u.plan)} • request: ${esc(u.plan_request)}</small>
        ${u.pro_proof_url ? `<br><a href="${u.pro_proof_url}" target="_blank">View Pro Proof</a>` : ""}
      </div>
      <div>
        <button onclick="setPlan(${u.id}, 'pro')">Approve Pro</button>
        <button onclick="setPlan(${u.id}, 'free')">Set Free</button>
      </div>
    </div>
  `).join("");
}

async function setPlan(id, plan) {
  const j = await api(`/api/admin/users/${id}/plan`, {
    method: "PUT",
    body: JSON.stringify({ plan })
  });

  if (j.ok) loadAdmin();
}

/* PUBLIC STORE */

let publicSite = null;
let publicItems = [];
let cart = [];
let otpToken = "";

function slugFromUrl() {
  const q = new URLSearchParams(location.search).get("slug");
  if (q) return q;
  return location.pathname.split("/").filter(Boolean).pop() || "";
}

async function loadPublic() {
  const slug = slugFromUrl();
  const j = await api("/api/public/" + slug, {
    headers: { authorization: "" }
  });

  if (!j.ok) return;

  publicSite = j.site;
  publicItems = j.items || [];

  document.title = publicSite.title || "Cambo Store";
  renderPublic();
}

function renderPublic() {
  const s = publicSite;

  document.body.className = "neon-body";

  $("publicSite").innerHTML = `
    <div class="store-shell">

      <aside class="store-sidebar">
        <div class="store-logo">
          <div class="logo-icon">👑</div>
          <div>CAMBO<br><span>STORE</span></div>
        </div>

        <nav>
          <a class="active">🏠 Home</a>
          <a>👑 Ranks</a>
          <a>🔑 Keys</a>
          <a>🎁 Kits</a>
          <a>📦 Crates</a>
          <a>⭐ Reviews</a>
          <a>💬 Discord</a>
        </nav>

        <div class="sidebar-profile">
          <b>${esc(s.title)}</b>
          <p>Balance <span>$0.00</span></p>
        </div>
      </aside>

      <main class="store-main">

        <section class="hero-card" style="
          background:
          linear-gradient(90deg, rgba(8,8,20,.95), rgba(20,0,40,.45)),
          ${s.banner_url ? `url('${s.banner_url}')` : "radial-gradient(circle at 70% 30%, #ec008c66, transparent 40%)"};
          background-size:cover;
          background-position:center;
        ">
          <div class="hero-content">
            <span class="pill">⭐ #1 Minecraft Store</span>
            <h1>${esc(s.hero_name || s.title || "POWER UP YOUR GAME")}</h1>
            <p>${esc(s.description || "Get Minecraft ranks, keys, kits and crates.")}</p>

            <div class="hero-actions">
              <button onclick="document.querySelector('.product-grid').scrollIntoView({behavior:'smooth'})">🛒 Shop Now</button>
              <button class="ghost">👑 View Top Ranks</button>
            </div>
          </div>
        </section>

        <section class="stats-row">
          <div>📦 <b>100+</b><span>Products</span></div>
          <div>👥 <b>1K+</b><span>Players</span></div>
          <div>🎧 <b>24/7</b><span>Support</span></div>
          <div>🛡️ <b>99.9%</b><span>Uptime</span></div>
        </section>

        <section class="section-head">
          <h2>🌟 Featured Products</h2>
        </section>

        <section class="product-grid">
          ${publicItems.map(i => `
            <article class="product-card">
              ${i.image_url ? `<img src="${i.image_url}" alt="">` : `<div class="item-placeholder">🎁</div>`}
              <h3>${esc(i.name)}</h3>
              <p>${esc(i.description)}</p>
              <strong>$${Number(i.price || 0).toFixed(2)}</strong>
              <button style="background:${s.button_color || "#ec008c"};color:${s.text_color || "#fff"}" onclick="addCart(${i.id})">
                🛒 ${esc(i.button_text || "Add")}
              </button>
            </article>
          `).join("") || "<p>No products yet.</p>"}
        </section>

        <section class="trust-bar">
          <div>⚡ Instant Delivery</div>
          <div>🔒 100% Safe</div>
          <div>💬 24/7 Support</div>
          <div>⭐ Best Prices</div>
        </section>
      </main>

      <aside class="checkout-card">
        <h2>🛒 Your Cart</h2>
        <div id="cartList"></div>

        <label>Minecraft Name</label>
        <input id="mcName" placeholder="Player name">

        <label>Edition</label>
        <select id="edition">
          <option>Java</option>
          <option>Bedrock</option>
        </select>

        <label>Email Verification</label>
        <input id="buyerEmail" type="email" placeholder="your@gmail.com">
        <button onclick="sendOtp()">Send OTP</button>

        <input id="otp" placeholder="OTP code">
        <button onclick="verifyOtp()">Verify OTP</button>

        ${s.qr_url ? `
          <div class="qr-box">
            <h3>Scan to Pay</h3>
            <img src="${s.qr_url}">
          </div>
        ` : ""}

        <label>Upload Payment Proof</label>
        <input id="proof" type="file" accept="image/*">

        <button class="submit-btn" onclick="submitOrder()">Submit Order</button>
      </aside>

    </div>
  `;

  renderCart();
}

function addCart(id) {
  const item = publicItems.find(x => x.id === id);
  if (!item) return;

  const found = cart.find(x => x.id === id);
  if (found) found.qty++;
  else cart.push({ id, qty: 1 });

  renderCart();
}

function removeCart(id) {
  cart = cart.filter(x => x.id !== id);
  renderCart();
}

function renderCart() {
  const el = $("cartList");
  if (!el) return;

  let total = 0;

  el.innerHTML = cart.map(c => {
    const item = publicItems.find(x => x.id === c.id);
    const price = Number(item?.price || 0);
    const sub = price * c.qty;
    total += sub;

    return `
      <div class="cart-line">
        <span>${esc(item?.name)} x${c.qty}</span>
        <b>$${sub.toFixed(2)}</b>
        <button onclick="removeCart(${c.id})">×</button>
      </div>
    `;
  }).join("") + `
    <hr>
    <div class="cart-total">
      <span>Total</span>
      <b>$${total.toFixed(2)}</b>
    </div>
  `;
}

async function sendOtp() {
  const email = $("buyerEmail").value.trim();

  if (!email) return alert("Enter email first");

  const j = await api("/api/otp/send", {
    method: "POST",
    headers: { authorization: "" },
    body: JSON.stringify({ email })
  });

  if (j.ok) alert("OTP sent to your Gmail");
}

async function verifyOtp() {
  const email = $("buyerEmail").value.trim();
  const code = $("otp").value.trim();

  if (!email || !code) return alert("Enter email and OTP");

  const j = await api("/api/otp/verify", {
    method: "POST",
    headers: { authorization: "" },
    body: JSON.stringify({ email, code })
  });

  if (j.ok) {
    otpToken = j.otp_token;
    alert("Email verified");
  }
}

async function submitOrder() {
  if (!cart.length) return alert("Cart is empty");
  if (!otpToken) return alert("Verify email first");

  let proof = "";

  if ($("proof").files[0]) {
    const fd = new FormData();
    fd.append("file", $("proof").files[0]);

    const r = await fetch(API + "/api/public-upload", {
      method: "POST",
      body: fd
    });

    const j = await r.json();
    proof = j.url || "";
  }

  const j = await api("/api/orders", {
    method: "POST",
    headers: { authorization: "" },
    body: JSON.stringify({
      site_id: publicSite.id,
      cart,
      minecraft_name: $("mcName").value,
      edition: $("edition").value,
      otp_token: otpToken,
      payment_proof_url: proof
    })
  });

  if (j.ok) {
    alert("Order submitted! Total $" + j.total);
    cart = [];
    otpToken = "";
    renderCart();
  }
}
