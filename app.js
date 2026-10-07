/**
 * ============================================================================
 * NEXUSPAY PLATFORM - COMPLETE OPERATIONAL MASTER ENGINE
 * Full Real-Time State: Balance Adjuster, Deposit & Withdrawal Verifier, 
 * Package/Pricing Manager, and PTC Ad Engine
 * ============================================================================
 */

// Master Security Keys
const MASTER_ADMIN_PIN = "778899";
const MASTER_ADMIN_KEY = "admin_secure_key";

// Local Gateways Data
const GATEWAYS = {
  jazzcash: { title: "JazzCash (Pakistan)", account: "0300-1234567", name: "NexusPay Direct" },
  easypaisa: { title: "Easypaisa (Pakistan)", account: "0345-7654321", name: "NexusPay Escrow" },
  usdt: { title: "USDT (TRC-20 Network)", account: "TXn92KsmLK3B91Yhd912Nsd19XzLKqwert", name: "Binance/Tron Escrow" }
};

// Storage Utilities
function getStorage(key, defaultVal) {
  const data = localStorage.getItem("nexus_" + key);
  return data ? JSON.parse(data) : defaultVal;
}
function saveStorage(key, val) {
  localStorage.setItem("nexus_" + key, JSON.stringify(val));
}

// 1. Packages State (Editable by Admin)
let packagesList = getStorage("packages", [
  { id: "free", name: "Free Tier", price: 0, dailyAds: 5, rewardPerAd: 0.02, roi: "Standard" },
  { id: "silver", name: "Silver VIP", price: 20, dailyAds: 15, rewardPerAd: 0.05, roi: "120% / Mo" },
  { id: "gold", name: "Gold VIP", price: 50, dailyAds: 30, rewardPerAd: 0.10, roi: "150% / Mo" },
  { id: "platinum", name: "Platinum Elite", price: 100, dailyAds: 60, rewardPerAd: 0.20, roi: "200% / Mo" }
]);

// 2. Users State
let currentUser = getStorage("current_user", {
  email: "investor@gmail.com",
  balance: 10.00,
  totalDeposit: 0.00,
  totalWithdraw: 0.00,
  clicksToday: 0,
  package: "free",
  role: "user",
  status: "active"
});

let allUsers = getStorage("all_users", [
  currentUser,
  { email: "admin@nexus.io", balance: 500.00, totalDeposit: 1000.00, totalWithdraw: 50.00, clicksToday: 0, package: "platinum", role: "admin", status: "active" },
  { email: "user2@mail.com", balance: 14.50, totalDeposit: 20.00, totalWithdraw: 0.00, clicksToday: 3, package: "silver", role: "user", status: "active" }
]);

// 3. PTC Ads State
let allAds = getStorage("all_ads", [
  { id: "ad_1", title: "Binance Crypto Staking", duration: 8, reward: 0.05, url: "https://binance.com", active: true },
  { id: "ad_2", title: "Bybit High Yield Earn", duration: 10, reward: 0.08, url: "https://bybit.com", active: true },
  { id: "ad_3", title: "Web3 Decentralized Yield Farms", duration: 12, reward: 0.12, url: "https://ethereum.org", active: true }
]);

// 4. Transactions Ledger (Deposits & Withdrawals)
let transactions = getStorage("transactions", [
  { id: "TX-101", user: "investor@gmail.com", type: "deposit", method: "JazzCash", tid: "JC-987211", amount: 20.00, status: "approved", date: "2026-10-06" }
]);

// State variables for ad timer
let watchingAd = null;
let adTimerInterval = null;
let captchaCorrect = 0;
let secretTapCount = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("currentYear").textContent = new Date().getFullYear();

  // Check URL Parameter for Admin (?access=admin_secure_key)
  const params = new URLSearchParams(window.location.search);
  if (params.get("access") === MASTER_ADMIN_KEY || params.get("view") === "admin") {
    unlockAdminView("Admin Mode Active via URL Key");
  } else {
    switchView("dashboard");
  }

  setupShortcuts();
  updateUI();
  renderPTCAds();
  renderPackages();
  renderTransactionHistory();
  updateGatewayInfo();
});

// View Navigation Switcher
function switchView(viewName) {
  document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  const target = document.getElementById("view-" + viewName);
  if (target) target.classList.add("active");

  const matchingBtn = document.querySelector(`.nav-item[onclick*="${viewName}"]`);
  if (matchingBtn) matchingBtn.classList.add("active");

  if (viewName === "admin") {
    loadAdminDashboard();
  }
}

// Update Dashboard Counters
function updateUI() {
  saveStorage("current_user", currentUser);

  // Sync current user into allUsers list
  const idx = allUsers.findIndex(u => u.email === currentUser.email);
  if (idx > -1) {
    allUsers[idx] = currentUser;
    saveStorage("all_users", allUsers);
  }

  document.getElementById("dashBalance").textContent = "$" + currentUser.balance.toFixed(2);
  document.getElementById("dashTotalDeposit").textContent = "$" + (currentUser.totalDeposit || 0).toFixed(2);
  document.getElementById("dashTotalWithdraw").textContent = "$" + (currentUser.totalWithdraw || 0).toFixed(2);
  document.getElementById("dashTodayClicks").textContent = currentUser.clicksToday;
  document.getElementById("navUserEmail").textContent = currentUser.email;

  const pkg = packagesList.find(p => p.id === currentUser.package) || packagesList[0];
  document.getElementById("dashUserTier").textContent = pkg.name.toUpperCase();
  document.getElementById("dashMaxClicks").textContent = pkg.dailyAds;
  document.getElementById("ptcRemainingClicks").textContent = Math.max(0, pkg.dailyAds - currentUser.clicksToday);
  document.getElementById("withdrawableBalanceSpan").textContent = "$" + currentUser.balance.toFixed(2);
}

// ============================================================================
// PTC ADS ENGINE & ANTI-BOT CAPTCHA
// ============================================================================
function renderPTCAds() {
  const container = document.getElementById("adsContainer");
  if (!container) return;

  container.innerHTML = allAds.filter(a => a.active).map(ad => `
    <div class="ad-card glass-panel">
      <div>
        <h3 class="ad-card-title">${ad.title}</h3>
        <p class="text-xs text-muted mt-1"><i class="fa-solid fa-clock text-cyan"></i> ${ad.duration}s Timer | <i class="fa-solid fa-gift text-emerald"></i> Reward: <strong>$${ad.reward.toFixed(2)}</strong></p>
      </div>
      <button class="btn btn-emerald w-full mt-3" onclick="startAdTimer('${ad.id}')">
        <i class="fa-solid fa-play"></i> Watch Ad
      </button>
    </div>
  `).join("");
}

function startAdTimer(adId) {
  const pkg = packagesList.find(p => p.id === currentUser.package) || packagesList[0];
  if (currentUser.clicksToday >= pkg.dailyAds) {
    showToast("Daily ad limit reached for your plan! Upgrade to watch more.", "error");
    return;
  }

  watchingAd = allAds.find(a => a.id === adId);
  if (!watchingAd) return;

  const modal = document.getElementById("adModal");
  modal.classList.add("active");
  document.getElementById("captchaSection").classList.add("hidden");
  document.getElementById("adModalTitle").textContent = watchingAd.title;

  let timeLeft = watchingAd.duration;
  const timerNum = document.getElementById("adTimerNum");
  const progressBar = document.getElementById("adProgressBar");
  progressBar.style.width = "0%";

  clearInterval(adTimerInterval);
  const total = watchingAd.duration;

  adTimerInterval = setInterval(() => {
    timeLeft -= 0.1;
    const pct = ((total - timeLeft) / total) * 100;
    progressBar.style.width = Math.min(100, pct) + "%";
    timerNum.textContent = Math.max(0, Math.ceil(timeLeft)) + "s";

    if (timeLeft <= 0) {
      clearInterval(adTimerInterval);
      progressBar.style.width = "100%";
      triggerMathCaptcha();
    }
  }, 100);
}

function triggerMathCaptcha() {
  const n1 = Math.floor(Math.random() * 8) + 2;
  const n2 = Math.floor(Math.random() * 8) + 1;
  captchaCorrect = n1 + n2;

  document.getElementById("captchaMathQuestion").textContent = `${n1} + ${n2} = ?`;
  document.getElementById("captchaUserAnswer").value = "";
  document.getElementById("captchaSection").classList.remove("hidden");
  document.getElementById("captchaUserAnswer").focus();
}

function submitCaptchaValidation() {
  const userAns = parseInt(document.getElementById("captchaUserAnswer").value, 10);
  if (userAns === captchaCorrect) {
    currentUser.balance += watchingAd.reward;
    currentUser.clicksToday += 1;
    updateUI();
    document.getElementById("adModal").classList.remove("active");
    clearInterval(adTimerInterval);
    showToast(`Success! $${watchingAd.reward.toFixed(2)} added to balance.`, "success");
  } else {
    showToast("Incorrect math captcha! Please try again.", "error");
  }
}

// ============================================================================
// PACKAGES / VIP TIERS MODULE
// ============================================================================
function renderPackages() {
  const container = document.getElementById("packagesContainer");
  if (!container) return;

  container.innerHTML = packagesList.map(pkg => `
    <div class="package-card glass-panel ${pkg.id === 'gold' ? 'featured' : ''}">
      <div>
        <h3>${pkg.name}</h3>
        <div class="package-price">${pkg.price === 0 ? "FREE" : "$" + pkg.price}</div>
        <p class="text-xs text-muted mb-2">ROI: ${pkg.roi}</p>
        <ul class="text-xs text-muted" style="list-style:none; padding:0; text-align:left; line-height: 1.8;">
          <li><i class="fa-solid fa-check text-emerald"></i> ${pkg.dailyAds} Daily Ads</li>
          <li><i class="fa-solid fa-check text-emerald"></i> $${pkg.rewardPerAd.toFixed(2)} Reward Per Ad</li>
          <li><i class="fa-solid fa-check text-emerald"></i> Priority Payout Queue</li>
        </ul>
      </div>
      <button class="btn btn-cyan w-full mt-4" onclick="upgradePackage('${pkg.id}')">
        ${currentUser.package === pkg.id ? 'Current Active Plan' : 'Upgrade Plan'}
      </button>
    </div>
  `).join("");
}

function upgradePackage(pkgId) {
  const target = packagesList.find(p => p.id === pkgId);
  if (!target) return;

  if (target.price > currentUser.balance) {
    showToast(`Insufficient balance! Deposit $${(target.price - currentUser.balance).toFixed(2)} to upgrade.`, "error");
    switchView("deposit");
    return;
  }

  currentUser.balance -= target.price;
  currentUser.package = target.id;
  updateUI();
  renderPackages();
  showToast(`Congratulations! You upgraded to ${target.name}.`, "success");
}

// ============================================================================
// DEPOSITS & GATEWAYS
// ============================================================================
function updateGatewayInfo() {
  const gwKey = document.getElementById("depositMethodSelect").value;
  const gw = GATEWAYS[gwKey];
  document.getElementById("gatewayInfoBox").innerHTML = `
    <div class="text-cyan font-bold">${gw.title}</div>
    <div class="text-xs text-muted mt-1">Send your deposit payment to:</div>
    <div class="text-lg font-bold text-white mt-1" style="word-break: break-all;">${gw.account}</div>
    <div class="text-xs text-muted mt-1">Account Name: <span class="text-emerald font-semibold">${gw.name}</span></div>
  `;
}

function handleDepositSubmit(e) {
  e.preventDefault();
  const method = document.getElementById("depositMethodSelect").value;
  const amount = parseFloat(document.getElementById("depositAmount").value);
  const tid = document.getElementById("depositTID").value.trim();

  if (!tid || isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid amount and TID.", "error");
    return;
  }

  const newTx = {
    id: "DEP-" + Date.now().toString().slice(-6),
    user: currentUser.email,
    type: "deposit",
    method: GATEWAYS[method].title,
    tid: tid,
    amount: amount,
    status: "pending",
    date: new Date().toISOString().split("T")[0]
  };

  transactions.unshift(newTx);
  saveStorage("transactions", transactions);
  document.getElementById("depositForm").reset();

  showToast("Deposit submitted! Status: Pending Admin Verification.", "success");
  renderTransactionHistory();
  switchView("dashboard");
}

// ============================================================================
// WITHDRAWALS ENGINE
// ============================================================================
function handleWithdrawSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  const method = document.getElementById("withdrawMethodSelect").value;
  const account = document.getElementById("withdrawAccount").value.trim();

  if (amount > currentUser.balance) {
    showToast("Withdrawal amount exceeds your available balance!", "error");
    return;
  }

  currentUser.balance -= amount;
  updateUI();

  const newTx = {
    id: "WTH-" + Date.now().toString().slice(-6),
    user: currentUser.email,
    type: "withdraw",
    method: `${method} (${account})`,
    tid: "PENDING-APPROVAL",
    amount: amount,
    status: "pending",
    date: new Date().toISOString().split("T")[0]
  };

  transactions.unshift(newTx);
  saveStorage("transactions", transactions);
  document.getElementById("withdrawForm").reset();

  showToast("Withdrawal request queued! Funds will be sent after review.", "info");
  renderTransactionHistory();
  switchView("dashboard");
}

function renderTransactionHistory() {
  const tbody = document.getElementById("userTxList");
  if (!tbody) return;

  const myTxs = transactions.filter(t => t.user === currentUser.email);
  if (myTxs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = myTxs.map(t => `
    <tr>
      <td><span class="badge-tier">${t.type.toUpperCase()}</span></td>
      <td>${t.method}<br><span class="text-xs text-muted">${t.tid}</span></td>
      <td class="font-bold ${t.type === 'deposit' ? 'text-emerald' : 'text-cyan'}">$${t.amount.toFixed(2)}</td>
      <td><span class="status-pill status-${t.status}">${t.status.toUpperCase()}</span></td>
      <td class="text-xs text-muted">${t.date}</td>
    </tr>
  `).join("");
}

// ============================================================================
// MASTER ADMIN DASHBOARD - FULL CONTROL ENGINE
// ============================================================================
function unlockAdminView(msg) {
  document.getElementById("adminNavBtn").classList.remove("hidden");
  switchView("admin");
  showToast(msg || "Admin Console Active", "info");
}

function exitAdminView() {
  document.getElementById("adminNavBtn").classList.add("hidden");
  switchView("dashboard");
}

function switchAdminTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach(c => c.style.display = "none");

  const activeBtn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick").includes(tabName));
  if (activeBtn) activeBtn.classList.add("active");

  const activeContent = document.getElementById("adm-tab-" + tabName);
  if (activeContent) activeContent.style.display = "block";
}

function loadAdminDashboard() {
  // Aggregate Metrics
  document.getElementById("admTotalUsers").textContent = allUsers.length;

  const depSum = transactions.filter(t => t.type === 'deposit' && t.status === 'approved').reduce((a, b) => a + b.amount, 0);
  document.getElementById("admTotalDeposits").textContent = "$" + depSum.toFixed(2);

  const wthSum = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending').reduce((a, b) => a + b.amount, 0);
  document.getElementById("admPendingWithdrawals").textContent = "$" + wthSum.toFixed(2);

  document.getElementById("admTotalAds").textContent = allAds.length;

  renderAdminUsers();
  renderAdminDeposits();
  renderAdminWithdrawals();
  renderAdminPackages();
  renderAdminAds();
}

// 1. ADMIN USER MANAGEMENT & DIRECT BALANCE EDIT
function renderAdminUsers() {
  const tbody = document.getElementById("admUsersTableBody");
  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td><strong>${u.email}</strong></td>
      <td><span class="status-pill status-${u.status}">${u.status.toUpperCase()}</span></td>
      <td class="font-bold text-emerald text-base">$${u.balance.toFixed(2)}</td>
      <td><span class="badge-tier">${u.package.toUpperCase()}</span></td>
      <td>
        <button class="btn btn-sm btn-cyan" onclick="openEditBalanceModal('${u.email}', ${u.balance})"><i class="fa-solid fa-pen-to-square"></i> Edit Balance</button>
        ${u.status === 'active' ? `<button class="btn btn-sm btn-outline-danger" onclick="adminToggleUser('${u.email}', 'suspended')">Ban</button>` : `<button class="btn btn-sm btn-emerald" onclick="adminToggleUser('${u.email}', 'active')">Unban</button>`}
      </td>
    </tr>
  `).join("");
}

function openEditBalanceModal(email, currentBal) {
  document.getElementById("editBalanceUserEmail").value = email;
  document.getElementById("editBalanceUserLabel").textContent = `Editing Balance for: ${email}`;
  document.getElementById("editBalanceInput").value = currentBal.toFixed(2);
  document.getElementById("editBalanceModal").classList.add("active");
}

function closeEditBalanceModal() {
  document.getElementById("editBalanceModal").classList.remove("active");
}

function handleEditBalanceSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("editBalanceUserEmail").value;
  const newBal = parseFloat(document.getElementById("editBalanceInput").value);

  if (isNaN(newBal) || newBal < 0) {
    showToast("Please enter a valid positive balance", "error");
    return;
  }

  const user = allUsers.find(u => u.email === email);
  if (user) {
    user.balance = newBal;
    saveStorage("all_users", allUsers);

    if (currentUser.email === email) {
      currentUser.balance = newBal;
      updateUI();
    }

    closeEditBalanceModal();
    loadAdminDashboard();
    showToast(`Updated balance of ${email} to $${newBal.toFixed(2)}`, "success");
  }
}

function adminToggleUser(email, newStatus) {
  const user = allUsers.find(u => u.email === email);
  if (user) {
    user.status = newStatus;
    saveStorage("all_users", allUsers);
    loadAdminDashboard();
    showToast(`User status set to ${newStatus}`, "info");
  }
}

// 2. ADMIN DEPOSITS APPROVAL / REJECTION
function renderAdminDeposits() {
  const tbody = document.getElementById("admDepositsTableBody");
  const pendings = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');

  if (pendings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No pending deposit verification requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendings.map(d => `
    <tr>
      <td>${d.user}</td>
      <td>${d.method}</td>
      <td class="text-cyan font-bold">${d.tid}</td>
      <td class="font-bold text-emerald">$${d.amount.toFixed(2)}</td>
      <td>${d.date}</td>
      <td>
        <button class="btn btn-sm btn-emerald" onclick="adminProcessDeposit('${d.id}', true)"><i class="fa-solid fa-check"></i> Approve</button>
        <button class="btn btn-sm btn-outline-danger" onclick="adminProcessDeposit('${d.id}', false)"><i class="fa-solid fa-xmark"></i> Reject</button>
      </td>
    </tr>
  `).join("");
}

function adminProcessDeposit(txId, isApproved) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  if (isApproved) {
    tx.status = "approved";
    // Credit user's balance
    const user = allUsers.find(u => u.email === tx.user);
    if (user) {
      user.balance += tx.amount;
      user.totalDeposit = (user.totalDeposit || 0) + tx.amount;
      saveStorage("all_users", allUsers);

      if (currentUser.email === user.email) {
        currentUser = user;
        updateUI();
      }
    }
    showToast(`Deposit Approved! $${tx.amount.toFixed(2)} credited to user.`, "success");
  } else {
    tx.status = "rejected";
    showToast("Deposit request rejected.", "info");
  }

  saveStorage("transactions", transactions);
  loadAdminDashboard();
  renderTransactionHistory();
}

// 3. ADMIN WITHDRAWALS APPROVAL / REJECTION (WITH AUTO REFUND)
function renderAdminWithdrawals() {
  const tbody = document.getElementById("admWithdrawalsTableBody");
  const pendings = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending');

  if (pendings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No pending withdrawal requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendings.map(w => `
    <tr>
      <td>${w.user}</td>
      <td>${w.method}</td>
      <td class="font-bold text-cyan">$${w.amount.toFixed(2)}</td>
      <td>${w.date}</td>
      <td>
        <button class="btn btn-sm btn-emerald" onclick="adminProcessWithdrawal('${w.id}', true)"><i class="fa-solid fa-check"></i> Mark Paid</button>
        <button class="btn btn-sm btn-outline-danger" onclick="adminProcessWithdrawal('${w.id}', false)"><i class="fa-solid fa-rotate-left"></i> Reject & Refund</button>
      </td>
    </tr>
  `).join("");
}

function adminProcessWithdrawal(txId, isPaid) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  if (isPaid) {
    tx.status = "completed";
    const user = allUsers.find(u => u.email === tx.user);
    if (user) {
      user.totalWithdraw = (user.totalWithdraw || 0) + tx.amount;
    }
    showToast("Withdrawal marked as completed!", "success");
  } else {
    tx.status = "rejected";
    // Refund the amount back to user's balance
    const user = allUsers.find(u => u.email === tx.user);
    if (user) {
      user.balance += tx.amount;
      if (currentUser.email === user.email) {
        currentUser.balance = user.balance;
        updateUI();
      }
    }
    showToast("Withdrawal rejected. Amount automatically refunded to user balance.", "info");
  }

  saveStorage("transactions", transactions);
  saveStorage("all_users", allUsers);
  loadAdminDashboard();
  renderTransactionHistory();
}

// 4. ADMIN PACKAGES CONFIGURATION MANAGER
function renderAdminPackages() {
  const tbody = document.getElementById("admPackagesTableBody");
  tbody.innerHTML = packagesList.map((pkg, idx) => `
    <tr>
      <td><strong>${pkg.name}</strong></td>
      <td><input type="number" id="pkg_price_${idx}" value="${pkg.price}" class="input-control" style="max-width:90px;" /></td>
      <td><input type="number" id="pkg_ads_${idx}" value="${pkg.dailyAds}" class="input-control" style="max-width:80px;" /></td>
      <td><input type="number" step="0.01" id="pkg_reward_${idx}" value="${pkg.rewardPerAd}" class="input-control" style="max-width:90px;" /></td>
      <td><input type="text" id="pkg_roi_${idx}" value="${pkg.roi}" class="input-control" style="max-width:120px;" /></td>
      <td>
        <button class="btn btn-sm btn-emerald" onclick="adminSavePackage(${idx})">Save</button>
      </td>
    </tr>
  `).join("");
}

function adminSavePackage(idx) {
  const p = packagesList[idx];
  p.price = parseFloat(document.getElementById(`pkg_price_${idx}`).value);
  p.dailyAds = parseInt(document.getElementById(`pkg_ads_${idx}`).value, 10);
  p.rewardPerAd = parseFloat(document.getElementById(`pkg_reward_${idx}`).value);
  p.roi = document.getElementById(`pkg_roi_${idx}`).value;

  saveStorage("packages", packagesList);
  renderPackages();
  loadAdminDashboard();
  updateUI();
  showToast(`Updated settings for ${p.name}!`, "success");
}

// 5. ADMIN PTC ADS MANAGER
function renderAdminAds() {
  const tbody = document.getElementById("admAdsTableBody");
  tbody.innerHTML = allAds.map(ad => `
    <tr>
      <td><strong>${ad.title}</strong></td>
      <td class="text-emerald font-bold">$${ad.reward.toFixed(2)}</td>
      <td>${ad.duration}s</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="adminDeleteAd('${ad.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function handleCreateAdSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("newAdTitle").value.trim();
  const reward = parseFloat(document.getElementById("newAdReward").value);
  const duration = parseInt(document.getElementById("newAdDuration").value, 10);
  const url = document.getElementById("newAdUrl").value.trim();

  allAds.push({ id: "ad_" + Date.now(), title, reward, duration, url, active: true });
  saveStorage("all_ads", allAds);
  document.getElementById("newAdForm").reset();

  showToast("New PTC Ad published successfully!", "success");
  loadAdminDashboard();
  renderPTCAds();
}

function adminDeleteAd(id) {
  allAds = allAds.filter(a => a.id !== id);
  saveStorage("all_ads", allAds);
  loadAdminDashboard();
  renderPTCAds();
  showToast("Ad deleted.", "info");
}

// ============================================================================
// SECRET SHORTCUTS & TRIGGERS
// ============================================================================
function setupShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      document.getElementById("adminPinModal").classList.add("active");
    }
  });
}

function handleSecretFooterClick() {
  secretTapCount++;
  if (secretTapCount >= 5) {
    secretTapCount = 0;
    document.getElementById("adminPinModal").classList.add("active");
  }
}

function handleAdminPinSubmit(e) {
  e.preventDefault();
  const pin = document.getElementById("masterAdminPin").value;
  if (pin === MASTER_ADMIN_PIN) {
    document.getElementById("adminPinModal").classList.remove("active");
    unlockAdminView("PIN Keyhole Verified!");
  } else {
    showToast("Invalid Master Admin PIN!", "error");
  }
}

// Toast Notifier
function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
