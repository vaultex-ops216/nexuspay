/**
 * NEXUSPAY ROCK-SOLID OPERATIONAL ENGINE
 */

const GATEWAYS = {
  jazzcash: { title: "JazzCash Pakistan", account: "0300-1234567", name: "Nexus Direct" },
  easypaisa: { title: "Easypaisa Pakistan", account: "0345-7654321", name: "Nexus Escrow" },
  usdt: { title: "USDT (TRC-20)", account: "TXn92KsmLK3B91Yhd912Nsd19XzLKqwert", name: "Tron Treasury" }
};

// Global Store
let packages = [
  { id: "free", name: "Free Tier", price: 0, dailyAds: 5, reward: 0.02 },
  { id: "silver", name: "Silver VIP", price: 20, dailyAds: 15, reward: 0.05 },
  { id: "gold", name: "Gold VIP", price: 50, dailyAds: 30, reward: 0.10 }
];

let users = [
  { email: "investor@gmail.com", balance: 10.00, totalDeposit: 0.0, totalWithdraw: 0.0, clicks: 0, package: "free", status: "active" },
  { email: "admin@nexus.io", balance: 500.00, totalDeposit: 1000.0, totalWithdraw: 0.0, clicks: 0, package: "gold", status: "active" }
];

let currentUser = users[0];

let ads = [
  { id: 1, title: "Binance Staking Reward", reward: 0.05, duration: 6 },
  { id: 2, title: "Bybit Launchpool Offer", reward: 0.08, duration: 8 },
  { id: 3, title: "Web3 Crypto Nodes", reward: 0.12, duration: 10 }
];

let txList = [];

// Watch Ad State
let activeAd = null;
let timerObj = null;
let mathResult = 0;
let editEmail = "";

// Init
window.addEventListener("DOMContentLoaded", () => {
  // Check admin url
  const p = new URLSearchParams(window.location.search);
  if (p.get("access") === "admin_secure_key" || p.get("view") === "admin") {
    goView("admin");
  } else {
    goView("dashboard");
  }

  refreshAll();
  renderGatewayInfo();
});

// View Navigation
function goView(viewId) {
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const target = document.getElementById("view-" + viewId);
  if (target) target.classList.add("active");

  const btn = document.getElementById("btn-" + viewId);
  if (btn) btn.classList.add("active");

  if (viewId === "admin") {
    renderAdmin();
  }
}

function refreshAll() {
  // Update dashboard UI
  document.getElementById("uBalance").textContent = "$" + currentUser.balance.toFixed(2);
  document.getElementById("uDeposited").textContent = "$" + currentUser.totalDeposit.toFixed(2);
  document.getElementById("uWithdrawn").textContent = "$" + currentUser.totalWithdraw.toFixed(2);
  document.getElementById("uClicks").textContent = currentUser.clicks;
  document.getElementById("topUserEmail").textContent = currentUser.email;

  const pkg = packages.find(p => p.id === currentUser.package) || packages[0];
  document.getElementById("uTier").textContent = pkg.name.toUpperCase();
  document.getElementById("uMaxClicks").textContent = pkg.dailyAds;
  document.getElementById("ptcLeft").textContent = Math.max(0, pkg.dailyAds - currentUser.clicks);

  renderPTC();
  renderPackages();
  renderLedger();
}

// PTC
function renderPTC() {
  const c = document.getElementById("ptcContainer");
  c.innerHTML = ads.map(a => `
    <div class="glass stat-card">
      <div class="stat-title">${a.duration}s Timer</div>
      <div class="font-bold mt-2">${a.title}</div>
      <div class="stat-value text-emerald">$${a.reward.toFixed(2)}</div>
      <button class="btn btn-emerald w-full mt-2" onclick="watchAd(${a.id})">Watch Ad</button>
    </div>
  `).join("");
}

function watchAd(id) {
  const pkg = packages.find(p => p.id === currentUser.package) || packages[0];
  if (currentUser.clicks >= pkg.dailyAds) {
    notify("Daily click limit reached for your tier!", "error");
    return;
  }

  activeAd = ads.find(a => a.id === id);
  const m = document.getElementById("adModal");
  m.style.display = "flex";
  document.getElementById("adCaptchaBox").style.display = "none";
  document.getElementById("adModalTitle").textContent = activeAd.title;

  let left = activeAd.duration;
  const bar = document.getElementById("adProgress");
  const t = document.getElementById("adTimer");
  bar.style.width = "0%";

  clearInterval(timerObj);
  timerObj = setInterval(() => {
    left -= 0.1;
    bar.style.width = (((activeAd.duration - left) / activeAd.duration) * 100) + "%";
    t.textContent = Math.max(0, Math.ceil(left)) + "s";

    if (left <= 0) {
      clearInterval(timerObj);
      const n1 = Math.floor(Math.random() * 8) + 2;
      const n2 = Math.floor(Math.random() * 8) + 1;
      mathResult = n1 + n2;
      document.getElementById("captchaQ").textContent = `${n1} + ${n2} = ?`;
      document.getElementById("captchaA").value = "";
      document.getElementById("adCaptchaBox").style.display = "block";
    }
  }, 100);
}

function verifyCaptcha() {
  const ans = parseInt(document.getElementById("captchaA").value, 10);
  if (ans === mathResult) {
    currentUser.balance += activeAd.reward;
    currentUser.clicks++;
    document.getElementById("adModal").style.display = "none";
    refreshAll();
    notify(`Earned $${activeAd.reward.toFixed(2)}!`, "success");
  } else {
    notify("Wrong captcha answer!", "error");
  }
}

// Packages
function renderPackages() {
  const c = document.getElementById("pkgContainer");
  c.innerHTML = packages.map(p => `
    <div class="glass stat-card ${p.id === 'gold' ? 'border-amber' : ''}">
      <div class="font-bold text-cyan">${p.name}</div>
      <div class="stat-value text-emerald">${p.price === 0 ? "FREE" : "$" + p.price}</div>
      <div class="text-xs text-muted mt-2">${p.dailyAds} Ads Daily • Earn $${p.reward}/ad</div>
      <button class="btn btn-cyan w-full mt-4" onclick="buyPackage('${p.id}')">
        ${currentUser.package === p.id ? 'Active Plan' : 'Select Plan'}
      </button>
    </div>
  `).join("");
}

function buyPackage(pkgId) {
  const target = packages.find(p => p.id === pkgId);
  if (target.price > currentUser.balance) {
    notify(`Insufficient balance! Deposit $${(target.price - currentUser.balance).toFixed(2)} first.`, "error");
    goView("deposit");
    return;
  }
  currentUser.balance -= target.price;
  currentUser.package = target.id;
  refreshAll();
  notify(`Upgraded to ${target.name}!`, "success");
}

// Deposit
function renderGatewayInfo() {
  const g = document.getElementById("depGateway").value;
  const info = GATEWAYS[g];
  document.getElementById("gatewayInfoBox").innerHTML = `
    <strong>${info.title}</strong><br>
    Account: <span class="text-cyan font-bold">${info.account}</span><br>
    Name: ${info.name}
  `;
}

function onDeposit(e) {
  e.preventDefault();
  const amt = parseFloat(document.getElementById("depAmount").value);
  const tid = document.getElementById("depTID").value.trim();

  txList.unshift({
    id: "DEP-" + Date.now().toString().slice(-4),
    user: currentUser.email,
    type: "deposit",
    method: document.getElementById("depGateway").value.toUpperCase(),
    tid: tid,
    amount: amt,
    status: "pending"
  });

  e.target.reset();
  notify("Deposit submitted for Admin verification!", "success");
  refreshAll();
  goView("dashboard");
}

// Withdraw
function onWithdraw(e) {
  e.preventDefault();
  const amt = parseFloat(document.getElementById("wthAmount").value);
  if (amt > currentUser.balance) {
    notify("Amount exceeds available balance!", "error");
    return;
  }

  currentUser.balance -= amt;
  txList.unshift({
    id: "WTH-" + Date.now().toString().slice(-4),
    user: currentUser.email,
    type: "withdraw",
    method: document.getElementById("wthGateway").value + " (" + document.getElementById("wthAccount").value + ")",
    tid: "REVIEW",
    amount: amt,
    status: "pending"
  });

  e.target.reset();
  notify("Withdrawal submitted! Admin will process payout.", "info");
  refreshAll();
  goView("dashboard");
}

function renderLedger() {
  const b = document.getElementById("userTxBody");
  b.innerHTML = txList.map(t => `
    <tr>
      <td><strong>${t.type.toUpperCase()}</strong></td>
      <td>${t.method}</td>
      <td class="text-cyan">${t.tid}</td>
      <td class="font-bold text-emerald">$${t.amount.toFixed(2)}</td>
      <td><span style="color:${t.status === 'approved' ? '#10b981' : (t.status === 'rejected' ? '#ef4444' : '#f59e0b')}">${t.status.toUpperCase()}</span></td>
    </tr>
  `).join("");
}

// Admin Logic
function adminTab(tabId) {
  document.querySelectorAll(".adm-sub").forEach(s => s.style.display = "none");
  const el = document.getElementById("adm-" + tabId);
  if (el) el.style.display = "block";
}

function renderAdmin() {
  // Users
  document.getElementById("admUsersBody").innerHTML = users.map(u => `
    <tr>
      <td>${u.email}</td>
      <td>${u.status}</td>
      <td class="font-bold text-emerald">$${u.balance.toFixed(2)}</td>
      <td>${u.package.toUpperCase()}</td>
      <td>
        <button class="btn btn-sm btn-cyan" onclick="openBalModal('${u.email}', ${u.balance})">Edit $</button>
      </td>
    </tr>
  `).join("");

  // Deposits
  const deps = txList.filter(t => t.type === "deposit" && t.status === "pending");
  document.getElementById("admDepositsBody").innerHTML = deps.length ? deps.map(d => `
    <tr>
      <td>${d.user}</td>
      <td>${d.method}</td>
      <td class="text-cyan">${d.tid}</td>
      <td class="font-bold text-emerald">$${d.amount.toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-emerald" onclick="approveDeposit('${d.id}', true)">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="approveDeposit('${d.id}', false)">Reject</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="text-muted">No pending deposits</td></tr>`;

  // Withdrawals
  const wths = txList.filter(t => t.type === "withdraw" && t.status === "pending");
  document.getElementById("admWithdrawalsBody").innerHTML = wths.length ? wths.map(w => `
    <tr>
      <td>${w.user}</td>
      <td>${w.method}</td>
      <td class="font-bold text-cyan">$${w.amount.toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-emerald" onclick="approveWithdrawal('${w.id}', true)">Paid</button>
        <button class="btn btn-sm btn-danger" onclick="approveWithdrawal('${w.id}', false)">Refund</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4" class="text-muted">No pending withdrawals</td></tr>`;

  // Packages
  document.getElementById("admPackagesBody").innerHTML = packages.map((p, i) => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><input type="number" id="p_prc_${i}" value="${p.price}" class="input-control" style="max-width:80px;" /></td>
      <td><input type="number" id="p_ads_${i}" value="${p.dailyAds}" class="input-control" style="max-width:80px;" /></td>
      <td><button class="btn btn-sm btn-emerald" onclick="savePkg(${i})">Save</button></td>
    </tr>
  `).join("");

  // Ads
  document.getElementById("admAdsBody").innerHTML = ads.map(a => `
    <tr>
      <td>${a.title}</td>
      <td class="text-emerald font-bold">$${a.reward}</td>
      <td>${a.duration}s</td>
      <td><button class="btn btn-sm btn-danger" onclick="delAd(${a.id})">Delete</button></td>
    </tr>
  `).join("");
}

function openBalModal(email, current) {
  editEmail = email;
  document.getElementById("balTargetEmail").textContent = "Editing for: " + email;
  document.getElementById("balNewAmount").value = current;
  document.getElementById("balModal").style.display = "flex";
}
function closeBalModal() {
  document.getElementById("balModal").style.display = "none";
}
function saveNewBalance() {
  const val = parseFloat(document.getElementById("balNewAmount").value);
  const u = users.find(x => x.email === editEmail);
  if (u) {
    u.balance = val;
    closeBalModal();
    renderAdmin();
    refreshAll();
    notify("Balance updated!", "success");
  }
}

function approveDeposit(txId, ok) {
  const t = txList.find(x => x.id === txId);
  if (!t) return;
  t.status = ok ? "approved" : "rejected";
  if (ok) {
    const u = users.find(x => x.email === t.user);
    if (u) {
      u.balance += t.amount;
      u.totalDeposit += t.amount;
    }
    notify(`Approved! $${t.amount} added.`, "success");
  } else {
    notify("Deposit rejected.", "info");
  }
  renderAdmin();
  refreshAll();
}

function approveWithdrawal(txId, ok) {
  const t = txList.find(x => x.id === txId);
  if (!t) return;
  t.status = ok ? "approved" : "rejected";
  if (!ok) {
    const u = users.find(x => x.email === t.user);
    if (u) u.balance += t.amount; // refund
    notify("Withdrawal rejected & refunded.", "info");
  } else {
    const u = users.find(x => x.email === t.user);
    if (u) u.totalWithdraw += t.amount;
    notify("Withdrawal marked as Paid!", "success");
  }
  renderAdmin();
  refreshAll();
}

function savePkg(i) {
  packages[i].price = parseFloat(document.getElementById(`p_prc_${i}`).value);
  packages[i].dailyAds = parseInt(document.getElementById(`p_ads_${i}`).value, 10);
  renderAdmin();
  refreshAll();
  notify("Package updated!", "success");
}

function onAddAd(e) {
  e.preventDefault();
  ads.push({
    id: Date.now(),
    title: document.getElementById("adTitle").value,
    reward: parseFloat(document.getElementById("adReward").value),
    duration: parseInt(document.getElementById("adDuration").value, 10)
  });
  e.target.reset();
  renderAdmin();
  refreshAll();
  notify("Ad published!", "success");
}

function delAd(id) {
  ads = ads.filter(a => a.id !== id);
  renderAdmin();
  refreshAll();
  notify("Ad deleted.", "info");
}

function notify(txt, type) {
  const box = document.getElementById("toastBox");
  const el = document.createElement("div");
  el.className = `toast ${type === 'error' ? 'toast-error' : (type === 'info' ? 'toast-info' : '')}`;
  el.textContent = txt;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
