// NexusPay App Logic & Security
const MASTER_ADMIN_PIN = "778899";
const MASTER_ADMIN_KEY = "admin_secure_key";

const GATEWAYS = {
  jazzcash: { title: "JazzCash", account: "0300-1234567", name: "Nexus Holdings" },
  easypaisa: { title: "Easypaisa", account: "0345-7654321", name: "Nexus Direct" },
  usdt: { title: "USDT TRC-20", account: "TXn92KsmLK3B91Yhd912Nsd19XzLKqwert", name: "Tron Escrow" }
};

const PACKAGES = [
  { id: "free", name: "Free Tier", price: 0, dailyAds: 5, roi: "Base" },
  { id: "silver", name: "Silver VIP", price: 20, dailyAds: 15, roi: "120% / Month" },
  { id: "gold", name: "Gold VIP", price: 50, dailyAds: 30, roi: "150% / Month" }
];

let currentProfile = {
  email: "investor@gmail.com",
  balance: 25.00,
  clicksToday: 0,
  package: "free",
  role: "user"
};

let mockUsers = [
  currentProfile,
  { email: "admin@nexus.io", balance: 500.0, clicksToday: 0, package: "gold", role: "admin" }
];

let mockAds = [
  { id: "1", title: "Binance Staking Reward", reward: 0.05, duration: 8 },
  { id: "2", title: "Bybit High Yield Earn", reward: 0.08, duration: 10 },
  { id: "3", title: "Web3 Nodes Network", reward: 0.12, duration: 12 }
];

let activeAd = null;
let adInterval = null;
let captchaAnswer = null;
let secretClicks = 0;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("currentYear").textContent = new Date().getFullYear();
  checkURLParams();
  setupKeyboardShortcut();
  renderAds();
  renderPackages();
  updateGatewayInstructions();
  updateUI();
});

// Admin Method 1: URL Parameter (?access=admin_secure_key)
function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get("access") === MASTER_ADMIN_KEY || p.get("view") === "admin") {
    unlockAdminMode("Unlocked via URL Key");
  }
}

// Admin Method 3: Ctrl + Shift + A
function setupKeyboardShortcut() {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      document.getElementById("adminPinModal").classList.add("active");
    }
  });
}

// Admin Method 3 (Hidden 5-Click)
function handleSecretFooterClick() {
  secretClicks++;
  if (secretClicks >= 5) {
    secretClicks = 0;
    document.getElementById("adminPinModal").classList.add("active");
  }
}

function handleAdminPinSubmit(e) {
  e.preventDefault();
  const pin = document.getElementById("masterAdminPin").value;
  if (pin === MASTER_ADMIN_PIN) {
    document.getElementById("adminPinModal").classList.remove("active");
    unlockAdminMode("PIN Verified Successfully");
  } else {
    showToast("Invalid Master PIN!", "error");
  }
}

function unlockAdminMode(msg) {
  document.getElementById("adminNavBtn").classList.remove("hidden");
  switchView("admin");
  loadAdminUsers();
  showToast(msg, "info");
}

function exitAdminView() {
  document.getElementById("adminNavBtn").classList.add("hidden");
  switchView("dashboard");
}

function switchView(viewName) {
  document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  
  const el = document.getElementById("view-" + viewName);
  if (el) el.classList.add("active");
}

function updateUI() {
  document.getElementById("dashBalance").textContent = "$" + currentProfile.balance.toFixed(2);
  document.getElementById("dashTodayClicks").textContent = currentProfile.clicksToday;
  document.getElementById("ptcRemainingClicks").textContent = 10 - currentProfile.clicksToday;
}

function renderAds() {
  const container = document.getElementById("adsContainer");
  container.innerHTML = mockAds.map(ad => `
    <div class="ad-card glass-panel">
      <h4>${ad.title}</h4>
      <p class="text-xs text-muted">Duration: ${ad.duration}s | Earn: $${ad.reward.toFixed(2)}</p>
      <button class="btn btn-emerald w-full" onclick="startWatchingAd('${ad.id}')">Watch Ad</button>
    </div>
  `).join("");
}

function startWatchingAd(adId) {
  if (currentProfile.clicksToday >= 10) {
    showToast("Daily ad limit reached!", "error");
    return;
  }

  activeAd = mockAds.find(a => a.id === adId);
  document.getElementById("adModal").classList.add("active");
  document.getElementById("captchaSection").classList.add("hidden");

  let timeLeft = activeAd.duration;
  const bar = document.getElementById("adProgressBar");
  const num = document.getElementById("adTimerNum");

  clearInterval(adInterval);
  adInterval = setInterval(() => {
    timeLeft -= 0.1;
    bar.style.width = ((activeAd.duration - timeLeft) / activeAd.duration) * 100 + "%";
    num.textContent = Math.max(0, Math.ceil(timeLeft)) + "s";

    if (timeLeft <= 0) {
      clearInterval(adInterval);
      const n1 = Math.floor(Math.random() * 8) + 1;
      const n2 = Math.floor(Math.random() * 8) + 1;
      captchaAnswer = n1 + n2;
      document.getElementById("captchaMathQuestion").textContent = `${n1} + ${n2} = ?`;
      document.getElementById("captchaUserAnswer").value = "";
      document.getElementById("captchaSection").classList.remove("hidden");
    }
  }, 100);
}

function submitCaptchaValidation() {
  const ans = parseInt(document.getElementById("captchaUserAnswer").value, 10);
  if (ans === captchaAnswer) {
    currentProfile.balance += activeAd.reward;
    currentProfile.clicksToday += 1;
    document.getElementById("adModal").classList.remove("active");
    updateUI();
    showToast(`Earned $${activeAd.reward}!`, "success");
  } else {
    showToast("Wrong captcha answer!", "error");
  }
}

function renderPackages() {
  document.getElementById("packagesContainer").innerHTML = PACKAGES.map(p => `
    <div class="package-card glass-panel">
      <h3>${p.name}</h3>
      <p class="text-cyan font-bold text-lg">${p.price === 0 ? "FREE" : "$" + p.price}</p>
      <p class="text-xs text-muted">${p.dailyAds} Ads Daily • ROI: ${p.roi}</p>
      <button class="btn btn-cyan w-full" onclick="showToast('Upgrade Selected', 'info')">Select</button>
    </div>
  `).join("");
}

function updateGatewayInstructions() {
  const m = document.getElementById("depositMethodSelect").value;
  const info = GATEWAYS[m];
  document.getElementById("gatewayInfoBox").innerHTML = `
    <strong>${info.title}</strong><br>
    Account: <span class="text-cyan">${info.account}</span><br>
    Title: ${info.name}
  `;
}

function handleDepositSubmit(e) {
  e.preventDefault();
  showToast("Deposit submitted! Status: Pending", "info");
  switchView("dashboard");
}

function handleWithdrawSubmit(e) {
  e.preventDefault();
  const amt = parseFloat(document.getElementById("withdrawAmount").value);
  if (amt > currentProfile.balance) {
    showToast("Insufficient balance!", "error");
    return;
  }
  currentProfile.balance -= amt;
  updateUI();
  showToast("Withdrawal queued successfully!", "success");
  switchView("dashboard");
}

function loadAdminUsers() {
  document.getElementById("admUsersTableBody").innerHTML = mockUsers.map(u => `
    <tr>
      <td>${u.email}</td>
      <td><span class="status-pill">Active</span></td>
      <td>$${u.balance.toFixed(2)}</td>
      <td>${u.role}</td>
    </tr>
  `).join("");
}

function showToast(msg, type = "info") {
  const box = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}