/* ═══════════════════════════════════════════════════════════════
   InvenTrack — script.js
   Firebase Firestore · Full Inventory Management System
   ═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   FIREBASE CONFIGURATION
   Replace the values below with YOUR Firebase project credentials.
   See the setup guide at the bottom of this file.
────────────────────────────────────────────────────────────────*/
const firebaseConfig = {
  apiKey: "AIzaSyAXTDq6uNyf4XuhDjWGkf13uDC3qszrWg0",
  authDomain: "mnlinventory-29f86.firebaseapp.com",
  projectId: "mnlinventory-29f86",
  storageBucket: "mnlinventory-29f86.firebasestorage.app",
  messagingSenderId: "937435974366",
  appId: "1:937435974366:web:aa520ddbb205e43bca904f",
  measurementId: "G-7WWXT1KG77"
};

/* ──────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────*/
const CORRECT_PIN       = "070602";
const SESSION_KEY       = "inventrack_auth";
const DEFAULT_THRESHOLD = 5;
const MAX_ACTIVITY      = 20;   // keep last 20 activity entries

/* ──────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────────*/
let db             = null;
let products       = [];        // live array from Firestore
let activityLog    = [];        // live array from Firestore
let threshold      = DEFAULT_THRESHOLD;
let currentPage    = "dashboard";
let unsubProducts  = null;
let unsubActivity  = null;
let unsubSettings  = null;
let deleteTargetId = null;
let pinBuffer      = "";

/* ──────────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", () => {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase init error:", e);
    showToast("Firebase configuration error — check the console.", "error");
  }

  bindStaticEvents();
  checkSession();
});

/* ──────────────────────────────────────────────────────────────
   SESSION / PIN
────────────────────────────────────────────────────────────────*/
function checkSession() {
  const auth = localStorage.getItem(SESSION_KEY);
  if (auth === "1") {
    enterApp();
  } else {
    showPinScreen();
  }
}

function showPinScreen() {
  el("pin-screen").classList.remove("hidden");
  el("app").classList.add("hidden");
  pinBuffer = "";
  updatePinDisplay();
  el("pin-error").classList.add("hidden");
}

function enterApp() {
  el("pin-screen").classList.add("hidden");
  el("app").classList.remove("hidden");
  startListeners();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  stopListeners();
  products = [];
  activityLog = [];
  showPinScreen();
}

/* PIN keypad logic */
function handlePinKey(val) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += val;
  updatePinDisplay();
  if (pinBuffer.length === 6) {
    verifyPin();
  }
}

function handlePinClear() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDisplay();
  el("pin-error").classList.add("hidden");
}

function updatePinDisplay() {
  for (let i = 0; i < 6; i++) {
    const dot = el(`dot-${i}`);
    dot.classList.toggle("filled", i < pinBuffer.length);
  }
}

function verifyPin() {
  if (pinBuffer === CORRECT_PIN) {
    localStorage.setItem(SESSION_KEY, "1");
    enterApp();
  } else {
    el("pin-error").classList.remove("hidden");
    // shake animation
    el("pin-display").style.animation = "none";
    requestAnimationFrame(() => {
      el("pin-display").style.animation = "shake .35s ease";
    });
    setTimeout(() => { pinBuffer = ""; updatePinDisplay(); }, 700);
  }
}

/* ──────────────────────────────────────────────────────────────
   FIRESTORE LISTENERS
────────────────────────────────────────────────────────────────*/
function startListeners() {
  if (!db) return;

  // Products
  unsubProducts = db.collection("products")
    .orderBy("updatedAt", "desc")
    .onSnapshot(snap => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, err => console.error("products listener:", err));

  // Activity
  unsubActivity = db.collection("activity")
    .orderBy("timestamp", "desc")
    .limit(MAX_ACTIVITY)
    .onSnapshot(snap => {
      activityLog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderActivity();
    }, err => console.error("activity listener:", err));

  // Settings (threshold)
  unsubSettings = db.collection("settings").doc("general")
    .onSnapshot(snap => {
      if (snap.exists) {
        threshold = snap.data().lowStockThreshold || DEFAULT_THRESHOLD;
      } else {
        threshold = DEFAULT_THRESHOLD;
      }
      el("threshold-input").value = threshold;
      renderAll();
    }, err => console.error("settings listener:", err));
}

function stopListeners() {
  if (unsubProducts) { unsubProducts(); unsubProducts = null; }
  if (unsubActivity) { unsubActivity(); unsubActivity = null; }
  if (unsubSettings) { unsubSettings(); unsubSettings = null; }
}

/* ──────────────────────────────────────────────────────────────
   RENDER ALL
────────────────────────────────────────────────────────────────*/
function renderAll() {
  renderKPI();
  renderAlerts();
  renderLowStockTable();
  renderOutStockTable();
  renderInventoryTable();
  updateCategoryFilter();
}

/* ──────────────────────────────────────────────────────────────
   KPI CARDS
────────────────────────────────────────────────────────────────*/
function renderKPI() {
  const totalProducts   = products.length;
  const totalValue      = products.reduce((s, p) => s + inventoryValue(p), 0);
  const totalStock      = products.reduce((s, p) => s + (Number(p.stockQty) || 0), 0);
  const lowStock        = products.filter(p => isLowStock(p)).length;
  const outOfStock      = products.filter(p => isOutOfStock(p)).length;
  const recentlyUpdated = recentlyUpdatedCount();

  el("kpi-total-products").textContent   = totalProducts;
  el("kpi-total-value").textContent      = formatCurrency(totalValue);
  el("kpi-total-stock").textContent      = totalStock.toLocaleString();
  el("kpi-low-stock").textContent        = lowStock;
  el("kpi-out-of-stock").textContent     = outOfStock;
  el("kpi-recently-updated").textContent = recentlyUpdated;

  // badge
  const badgeCount = lowStock + outOfStock;
  const badge = el("alert-badge");
  badge.textContent = badgeCount;
  badge.dataset.count = badgeCount;
  badge.classList.toggle("hidden", badgeCount === 0);
}

function recentlyUpdatedCount() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // last 24 h
  return products.filter(p => {
    const ts = p.updatedAt?.toMillis ? p.updatedAt.toMillis() : 0;
    return ts > cutoff;
  }).length;
}

/* ──────────────────────────────────────────────────────────────
   ALERTS
────────────────────────────────────────────────────────────────*/
function renderAlerts() {
  const alertBar = el("alert-bar");
  alertBar.innerHTML = "";

  const low    = products.filter(p => isLowStock(p)).length;
  const out    = products.filter(p => isOutOfStock(p)).length;

  const alerts = [];
  if (low  > 0) alerts.push({ type: "warn",   msg: `⚠ ${low} product${low>1?"s":""} ${low>1?"are":"is"} low on stock` });
  if (out  > 0) alerts.push({ type: "danger", msg: `⚠ ${out} product${out>1?"s":""} ${out>1?"are":"is"} out of stock` });
  if (low === 0 && out === 0) {
    alerts.push({ type: "info", msg: "✓ All products are sufficiently stocked" });
  }

  alerts.forEach(a => {
    const div = document.createElement("div");
    div.className = `alert-item alert-item--${a.type}`;
    div.textContent = a.msg;
    alertBar.appendChild(div);
  });
}

/* ──────────────────────────────────────────────────────────────
   LOW STOCK TABLE
────────────────────────────────────────────────────────────────*/
function renderLowStockTable() {
  const tbody = el("low-stock-tbody");
  const emptyEl = el("low-stock-empty");
  const items = products.filter(p => isLowStock(p));

  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  tbody.innerHTML = items.map(p => `
    <tr>
      <td data-label="Product">${escHtml(p.name)}</td>
      <td data-label="Stock">${p.stockQty}</td>
      <td data-label="Threshold">${threshold}</td>
      <td data-label="Status">${badgeHtml("Low Stock")}</td>
    </tr>
  `).join("");
}

/* ──────────────────────────────────────────────────────────────
   OUT OF STOCK TABLE
────────────────────────────────────────────────────────────────*/
function renderOutStockTable() {
  const tbody = el("out-stock-tbody");
  const emptyEl = el("out-stock-empty");
  const items = products.filter(p => isOutOfStock(p));

  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  tbody.innerHTML = items.map(p => `
    <tr>
      <td data-label="Product">${escHtml(p.name)}</td>
      <td data-label="Last Updated">${formatDate(p.updatedAt)}</td>
      <td data-label="Status">${badgeHtml("Out of Stock")}</td>
    </tr>
  `).join("");
}

/* ──────────────────────────────────────────────────────────────
   INVENTORY TABLE
────────────────────────────────────────────────────────────────*/
function renderInventoryTable() {
  const tbody    = el("inv-tbody");
  const emptyEl  = el("inv-empty");
  const search   = el("search-input").value.toLowerCase().trim();
  const statFilt = el("filter-status").value;
  const catFilt  = el("filter-category").value;

  let items = products.filter(p => {
    const matchSearch = !search ||
      (p.name     || "").toLowerCase().includes(search) ||
      (p.category || "").toLowerCase().includes(search);
    const status = getStatus(p);
    const matchStat = statFilt === "all" || status === statFilt;
    const matchCat  = catFilt  === "all" || (p.category || "") === catFilt;
    return matchSearch && matchStat && matchCat;
  });

  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  tbody.innerHTML = items.map(p => {
    const status  = getStatus(p);
    const invVal  = inventoryValue(p);
    return `
      <tr>
        <td data-label="Name"><bold>${escHtml(p.name)}</bold></td>
        <td data-label="Category">${escHtml(p.category || "—")}</td>
        <td data-label="Cost">${formatCurrency(p.costPrice || 0)}</td>
        <td data-label="Sell">${formatCurrency(p.sellPrice || 0)}</td>
        <td data-label="Stock">${Number(p.stockQty) || 0}</td>
        <td data-label="Inv. Value">${formatCurrency(invVal)}</td>
        <td data-label="Status">${badgeHtml(status)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-icon--edit"   onclick="openEditModal('${p.id}')">✎ Edit</button>
            <button class="btn-icon btn-icon--stock"  onclick="openStockModal('${p.id}')">▲ Stock</button>
            <button class="btn-icon btn-icon--delete" onclick="confirmDelete('${p.id}')">✕ Del</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ──────────────────────────────────────────────────────────────
   ACTIVITY FEED
────────────────────────────────────────────────────────────────*/
function renderActivity() {
  const feed    = el("activity-feed");
  const emptyEl = el("activity-empty");

  if (activityLog.length === 0) {
    feed.innerHTML = "";
    feed.appendChild(emptyEl);
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  const typeMap = { add: "add", update: "update", delete: "delete" };
  feed.innerHTML = activityLog.map(a => {
    const dotClass = `activity-dot--${typeMap[a.type] || "update"}`;
    return `
      <div class="activity-item">
        <div class="activity-dot ${dotClass}"></div>
        <div class="activity-content">
          <div class="activity-text">${escHtml(a.message || "")}</div>
          <div class="activity-time">${formatDate(a.timestamp)}</div>
        </div>
      </div>
    `;
  }).join("");
}

/* ──────────────────────────────────────────────────────────────
   CATEGORY FILTER
────────────────────────────────────────────────────────────────*/
function updateCategoryFilter() {
  const sel  = el("filter-category");
  const curr = sel.value;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  sel.innerHTML = `<option value="all">All Categories</option>` +
    cats.map(c => `<option value="${escHtml(c)}"${c===curr?" selected":""}>${escHtml(c)}</option>`).join("");
}

/* ──────────────────────────────────────────────────────────────
   PRODUCT MODAL (Add / Edit)
────────────────────────────────────────────────────────────────*/
function openAddModal() {
  el("modal-title").textContent = "Add Product";
  el("product-id").value = "";
  clearForm();
  showModal("product-modal-backdrop");
}

function openEditModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  el("modal-title").textContent = "Edit Product";
  el("product-id").value = id;
  el("f-name").value      = p.name      || "";
  el("f-category").value  = p.category  || "";
  el("f-supplier").value  = p.supplier  || "";
  el("f-cost").value      = p.costPrice || "";
  el("f-sell").value      = p.sellPrice || "";
  el("f-stock").value     = p.stockQty  || 0;
  el("f-min-stock").value = p.minStock  || "";
  el("f-desc").value      = p.description || "";
  showModal("product-modal-backdrop");
}

function clearForm() {
  ["f-name","f-category","f-supplier","f-cost","f-sell","f-stock","f-min-stock","f-desc"]
    .forEach(id => { el(id).value = ""; });
}

async function saveProduct() {
  const id       = el("product-id").value;
  const name     = el("f-name").value.trim();
  const category = el("f-category").value.trim();
  const cost     = parseFloat(el("f-cost").value) || 0;
  const sell     = parseFloat(el("f-sell").value) || 0;
  const stock    = parseInt(el("f-stock").value)  || 0;
  const minStock = parseInt(el("f-min-stock").value) || 0;

  if (!name)     { showToast("Product name is required.", "error"); return; }
  if (!category) { showToast("Category is required.", "error"); return; }
  if (cost < 0)  { showToast("Cost price cannot be negative.", "error"); return; }
  if (sell < 0)  { showToast("Selling price cannot be negative.", "error"); return; }
  if (stock < 0) { showToast("Stock quantity cannot be negative.", "error"); return; }

  const data = {
    name,
    category,
    supplier:    el("f-supplier").value.trim(),
    costPrice:   cost,
    sellPrice:   sell,
    stockQty:    stock,
    minStock,
    description: el("f-desc").value.trim(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  showLoading();
  try {
    if (id) {
      await db.collection("products").doc(id).update(data);
      await logActivity("update", `Updated product <bold>${name}</bold>`);
      showToast(`"${name}" updated successfully.`, "success");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("products").add(data);
      await logActivity("add", `Added new product <bold>${name}</bold>`);
      showToast(`"${name}" added successfully.`, "success");
    }
    hideModal("product-modal-backdrop");
  } catch (e) {
    console.error(e);
    showToast("Error saving product. Check console.", "error");
  }
  hideLoading();
}

/* ──────────────────────────────────────────────────────────────
   STOCK UPDATE MODAL (quick update)
────────────────────────────────────────────────────────────────*/
function openStockModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const newQty = prompt(
    `Update stock for "${p.name}"\nCurrent stock: ${p.stockQty}\n\nEnter new quantity:`,
    p.stockQty
  );

  if (newQty === null) return; // cancelled
  const qty = parseInt(newQty);
  if (isNaN(qty) || qty < 0) { showToast("Invalid quantity.", "error"); return; }

  showLoading();
  db.collection("products").doc(id).update({
    stockQty:  qty,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    logActivity("update", `Stock updated for <bold>${p.name}</bold>: ${p.stockQty} → ${qty}`);
    showToast(`Stock updated to ${qty} for "${p.name}".`, "success");
  })
  .catch(e => { console.error(e); showToast("Error updating stock.", "error"); })
  .finally(() => hideLoading());
}

/* ──────────────────────────────────────────────────────────────
   DELETE
────────────────────────────────────────────────────────────────*/
function confirmDelete(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  el("confirm-message").textContent = `Are you sure you want to delete "${p.name}"? This action cannot be undone.`;
  showModal("confirm-modal-backdrop");
}

async function executeDelete() {
  if (!deleteTargetId) return;
  const p = products.find(x => x.id === deleteTargetId);
  const name = p ? p.name : "Unknown";
  showLoading();
  try {
    await db.collection("products").doc(deleteTargetId).delete();
    await logActivity("delete", `Deleted product <bold>${name}</bold>`);
    showToast(`"${name}" deleted.`, "success");
  } catch (e) {
    console.error(e);
    showToast("Error deleting product.", "error");
  }
  deleteTargetId = null;
  hideModal("confirm-modal-backdrop");
  hideLoading();
}

/* ──────────────────────────────────────────────────────────────
   THRESHOLD
────────────────────────────────────────────────────────────────*/
async function saveThreshold() {
  const val = parseInt(el("threshold-input").value);
  if (isNaN(val) || val < 1) { showToast("Threshold must be at least 1.", "error"); return; }

  showLoading();
  try {
    await db.collection("settings").doc("general").set(
      { lowStockThreshold: val },
      { merge: true }
    );
    showToast(`Low stock threshold set to ${val}.`, "success");
  } catch (e) {
    console.error(e);
    showToast("Error saving threshold.", "error");
  }
  hideLoading();
}

/* ──────────────────────────────────────────────────────────────
   ACTIVITY LOG
────────────────────────────────────────────────────────────────*/
async function logActivity(type, message) {
  if (!db) return;
  try {
    await db.collection("activity").add({
      type,
      message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Prune old entries (keep 20)
    const snap = await db.collection("activity")
      .orderBy("timestamp", "desc")
      .offset(MAX_ACTIVITY)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  } catch (e) {
    // non-critical, don't surface
    console.warn("logActivity error:", e);
  }
}

/* ──────────────────────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────────────────────────*/
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  el(`page-${page}`).classList.remove("hidden");
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add("active");
  el("page-title").textContent = page === "dashboard" ? "Dashboard" : "Inventory Management";

  // re-render when switching to inventory to apply any cached filter
  if (page === "inventory") renderInventoryTable();

  closeSidebar();
}

/* ──────────────────────────────────────────────────────────────
   SIDEBAR MOBILE
────────────────────────────────────────────────────────────────*/
function openSidebar() {
  el("sidebar").classList.add("open");
  el("sidebar-overlay").classList.remove("hidden");
}
function closeSidebar() {
  el("sidebar").classList.remove("open");
  el("sidebar-overlay").classList.add("hidden");
}

/* ──────────────────────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────────────────────────*/
function showModal(id)  { el(id).classList.remove("hidden"); }
function hideModal(id)  { el(id).classList.add("hidden"); }

/* ──────────────────────────────────────────────────────────────
   LOADING
────────────────────────────────────────────────────────────────*/
function showLoading() { el("loading-overlay").classList.remove("hidden"); }
function hideLoading() { el("loading-overlay").classList.add("hidden"); }

/* ──────────────────────────────────────────────────────────────
   TOAST
────────────────────────────────────────────────────────────────*/
function showToast(msg, type = "info") {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const container = el("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 220);
  }, 3500);
}

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────────*/
function el(id) { return document.getElementById(id); }

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(val) {
  return "₱" + Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function inventoryValue(p) {
  return (Number(p.costPrice) || 0) * (Number(p.stockQty) || 0);
}

function isOutOfStock(p) { return (Number(p.stockQty) || 0) === 0; }
function isLowStock(p)   {
  const qty = Number(p.stockQty) || 0;
  return qty > 0 && qty <= threshold;
}
function isInStock(p)    {
  return (Number(p.stockQty) || 0) > threshold;
}

function getStatus(p) {
  if (isOutOfStock(p)) return "Out of Stock";
  if (isLowStock(p))   return "Low Stock";
  return "In Stock";
}

function badgeHtml(status) {
  const cls = {
    "In Stock":     "badge--green",
    "Low Stock":    "badge--orange",
    "Out of Stock": "badge--red"
  }[status] || "badge--green";
  return `<span class="badge ${cls}">${status}</span>`;
}

/* ──────────────────────────────────────────────────────────────
   BIND STATIC EVENTS
────────────────────────────────────────────────────────────────*/
function bindStaticEvents() {
  /* PIN keypad */
  document.querySelectorAll(".pin-key[data-val]").forEach(btn => {
    btn.addEventListener("click", () => handlePinKey(btn.dataset.val));
  });
  el("pin-clear").addEventListener("click", handlePinClear);
  el("pin-enter").addEventListener("click", verifyPin);

  // Keyboard support for PIN
  document.addEventListener("keydown", e => {
    if (!el("pin-screen").classList.contains("hidden")) {
      if (/^[0-9]$/.test(e.key)) handlePinKey(e.key);
      else if (e.key === "Backspace") handlePinClear();
      else if (e.key === "Enter") verifyPin();
    }
  });

  /* Navigation */
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });

  /* Sidebar mobile */
  el("hamburger").addEventListener("click", openSidebar);
  el("sidebar-close").addEventListener("click", closeSidebar);
  el("sidebar-overlay").addEventListener("click", closeSidebar);

  /* Logout */
  el("logout-btn").addEventListener("click", logout);

  /* Add product */
  el("add-product-btn").addEventListener("click", openAddModal);

  /* Product modal actions */
  el("modal-save").addEventListener("click", saveProduct);
  el("modal-cancel").addEventListener("click", () => hideModal("product-modal-backdrop"));
  el("modal-close").addEventListener("click",  () => hideModal("product-modal-backdrop"));
  el("product-modal-backdrop").addEventListener("click", e => {
    if (e.target === el("product-modal-backdrop")) hideModal("product-modal-backdrop");
  });

  /* Confirm modal actions */
  el("confirm-ok").addEventListener("click", executeDelete);
  el("confirm-cancel").addEventListener("click", () => hideModal("confirm-modal-backdrop"));
  el("confirm-modal-backdrop").addEventListener("click", e => {
    if (e.target === el("confirm-modal-backdrop")) hideModal("confirm-modal-backdrop");
  });

  /* Threshold */
  el("save-threshold-btn").addEventListener("click", saveThreshold);
  el("threshold-input").addEventListener("keydown", e => {
    if (e.key === "Enter") saveThreshold();
  });

  /* Search & filters */
  el("search-input").addEventListener("input", renderInventoryTable);
  el("filter-status").addEventListener("change", renderInventoryTable);
  el("filter-category").addEventListener("change", renderInventoryTable);
}

/* ──────────────────────────────────────────────────────────────
   SHAKE ANIMATION (for wrong PIN)
────────────────────────────────────────────────────────────────*/
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: none; }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-5px); }
  80%      { transform: translateX(5px); }
}`;
document.head.appendChild(shakeStyle);
