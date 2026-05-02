const OFFICE_API_BASE = "https://foxdentofficeportal.calcifer6456.workers.dev";

let AUTH_HEADER = null;
let lineChart = null;
let pieChart = null;

const AUTH_STORAGE_KEY = "bhfd_office_auth_basic";

const els = {
  // views
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),

  // login
  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  loginRemember: document.getElementById("loginRemember"),
  loginError: document.getElementById("loginError"),
  btnSubmitLogin: document.getElementById("btnSubmitLogin"),

  // dashboard actions
  btnLogout: document.getElementById("btnLogout"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnExport: document.getElementById("btnExport"),

  // NEW delete UI
  btnDeleteSelected: document.getElementById("btnDeleteSelected"),
  selectedCount: document.getElementById("selectedCount"),

  // dashboard fields
  statusText: document.getElementById("statusText"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  scheduledMeta: document.getElementById("scheduledMeta"),
  newMeta: document.getElementById("newMeta"),
  bookingsBody: document.getElementById("bookingsBody"),
  searchInput: document.getElementById("searchInput"),

  // sidebar
  sidebar: document.getElementById("sidebar"),
  btnMenu: document.getElementById("btnMenu"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  btnLogoutSide: document.getElementById("btnLogoutSide"),

  // route sections
  routeDashboard: document.getElementById("route-dashboard"),
  routeAnalytics: document.getElementById("route-analytics"),
  routeCommunication: document.getElementById("route-communication"),

  // communication UI
  btnCommRefresh: document.getElementById("btnCommRefresh"),
  commPatientSelect: document.getElementById("commPatientSelect"),
  commTo: document.getElementById("commTo"),
  commBody: document.getElementById("commBody"),
  commCharCount: document.getElementById("commCharCount"),
  btnCommSend: document.getElementById("btnCommSend"),
  commSendStatus: document.getElementById("commSendStatus"),

  commSelName: document.getElementById("commSelName"),
  commSelPhone: document.getElementById("commSelPhone"),
  commSelAppt: document.getElementById("commSelAppt"),
  commSelConf: document.getElementById("commSelConf"),

  commSearchTo: document.getElementById("commSearchTo"),
  btnCommLoad: document.getElementById("btnCommLoad"),
  commMessagesBody: document.getElementById("commMessagesBody"),
};

let cachedRows = [];
let uiWired = false;

const selectedIds = new Set();

/* ---------------- View helpers ---------------- */

function showLogin() {
  els.dashboardView.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  setLoginError("");
  setStatus("Not connected", "");
  setTimeout(() => {
    if (els.loginUser.value) els.loginPass.focus();
    else els.loginUser.focus();
  }, 0);
}

function showDashboard() {
  els.loginView.classList.add("hidden");
  els.dashboardView.classList.remove("hidden");
}

function setLoginError(msg) {
  els.loginError.textContent = msg || "";
  els.loginError.classList.toggle("hidden", !msg);
}

function setStatus(text, mode = "") {
  els.statusText.textContent = text;
  els.statusText.classList.remove("ok", "err");
  if (mode) els.statusText.classList.add(mode);
}

function setCommStatus(text, mode = "") {
  if (!els.commSendStatus) return;
  els.commSendStatus.textContent = text || "";
  els.commSendStatus.classList.remove("ok", "err");
  if (mode) els.commSendStatus.classList.add(mode);
}

/* ---------------- Date helpers ---------------- */

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/* ---------------- Auth helpers ---------------- */

function makeBasicAuth(user, pass) {
  const token = btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}

function loadRememberedAuth() {
  const v = sessionStorage.getItem(AUTH_STORAGE_KEY);
  return v && v.startsWith("Basic ") ? v : null;
}

function rememberAuthIfWanted(authHeader, remember) {
  if (remember) sessionStorage.setItem(AUTH_STORAGE_KEY, authHeader);
  else sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function clearAuth() {
  AUTH_HEADER = null;
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/* ---------------- API ---------------- */

async function api(path, init = {}) {
  if (!AUTH_HEADER) throw new Error("Not authenticated. Please login.");

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", AUTH_HEADER);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${OFFICE_API_BASE}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body,
  });

  if (res.status === 401) {
    clearAuth();
    throw new Error("Unauthorized (wrong credentials).");
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error((data && data.error) ? data.error : `API error (${res.status})`);
  }
  return data;
}

/* ---------------- Render helpers ---------------- */

function apptTypeLabel(t) {
  const x = String(t || "").toLowerCase();
  if (x === "adult_cleaning") return "Adult Cleaning";
  if (x === "child_cleaning") return "Child Cleaning";
  if (x === "emergency") return "Emergency";
  if (x === "consult") return "Consult";
  return t || "";
}

function insuranceLabel(row) {
  const ins = row.insurance || row.insurance_carrier || row.insCarrier || row.carrier || "";
  const noIns = row.no_insurance ?? row.noInsurance ?? null;
  if (String(ins).trim()) return String(ins).trim();
  if (noIns === true || noIns === 1) return "Self-Pay";
  return "—";
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("new")) return `<span class="badge badge-new">New Patient</span>`;
  return `<span class="badge badge-existing">Existing</span>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------------- Selection UI ---------------- */

function updateSelectionUI() {
  const n = selectedIds.size;

  if (els.selectedCount) {
    els.selectedCount.textContent = `${n} selected`;
    els.selectedCount.classList.toggle("hidden", n === 0);
  }

  if (els.btnDeleteSelected) {
    els.btnDeleteSelected.disabled = n === 0;
  }
}

function clearSelection() {
  selectedIds.clear();
  updateSelectionUI();
}

/* ---------------- Table render ---------------- */

function renderTable(rows) {
  cachedRows = Array.isArray(rows) ? rows : [];

  // Drop selections no longer present
  const idsInTable = new Set(
    cachedRows.map((r) => String(r.confirmation_id || "").trim()).filter(Boolean)
  );
  for (const id of Array.from(selectedIds)) {
    if (!idsInTable.has(id)) selectedIds.delete(id);
  }

  const q = (els.searchInput.value || "").trim().toLowerCase();
  const filtered = !q
    ? cachedRows
    : cachedRows.filter((r) => {
        const blob = [
          r.patient_first, r.patient_last, r.patient_status,
          r.appointment_date, r.appointment_time, r.appointment_type,
          r.insurance, r.insurance_carrier, r.carrier, r.created_at,
          r.confirmation_id
        ].map((x) => String(x || "").toLowerCase()).join(" ");
        return blob.includes(q);
      });

  if (!filtered.length) {
    els.bookingsBody.innerHTML = `<tr><td colspan="9" class="empty">No matching bookings.</td></tr>`;
    updateSelectionUI();
    // also refresh comm patients list if you're on comm route
    refreshCommPatientSelect();
    return;
  }

  els.bookingsBody.innerHTML = filtered.map((r) => {
    const booked = String(r.created_at || "").slice(0, 10);
    const name = `${r.patient_first || ""} ${r.patient_last || ""}`.trim();
    const dob = String(r.patient_dob || r.dob || "").slice(0, 10) || "—";
    const pStatus = statusBadge(r.patient_status);
    const apptDate = r.appointment_date || "—";
    const apptTime = r.appointment_time || "—";
    const type = apptTypeLabel(r.appointment_type);
    const ins = insuranceLabel(r);

    const cid = String(r.confirmation_id || "").trim();
    const canDelete = !!cid;
    const checked = canDelete && selectedIds.has(cid) ? "checked" : "";

    return `
      <tr data-confirmation-id="${escapeHtml(cid)}">
        <td class="col-select">
          ${canDelete
            ? `<input class="row-select" type="checkbox" ${checked} aria-label="Select row to delete" />`
            : `<span title="Missing confirmation_id">—</span>`
          }
        </td>
        <td>${escapeHtml(booked || "—")}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(dob)}</td>
        <td>${pStatus}</td>
        <td>${escapeHtml(apptDate)}</td>
        <td>${escapeHtml(apptTime)}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(ins)}</td>
      </tr>
    `;
  }).join("");

  // Checkbox wiring
  els.bookingsBody.querySelectorAll("tr").forEach((tr) => {
    const cid = String(tr.getAttribute("data-confirmation-id") || "").trim();
    const cb = tr.querySelector(".row-select");
    if (!cb || !cid) return;

    cb.addEventListener("change", () => {
      if (cb.checked) selectedIds.add(cid);
      else selectedIds.delete(cid);
      updateSelectionUI();
    });
  });

  updateSelectionUI();
  refreshCommPatientSelect();
}

/* ---------------- Charts ---------------- */

function buildLineSeries(bookings, start, end) {
  const s = start || addDays(todayYYYYMMDD(), -29);
  const e = end || todayYYYYMMDD();

  const labels = [];
  const counts = [];
  let cur = s;
  while (cur <= e) {
    labels.push(cur);
    counts.push(0);
    cur = addDays(cur, 1);
  }

  const idx = new Map(labels.map((d, i) => [d, i]));

  for (const b of bookings || []) {
    const bookedDay = String(b.created_at || "").slice(0, 10);
    if (!bookedDay || !idx.has(bookedDay)) continue;
    counts[idx.get(bookedDay)] += 1;
  }

  return { labels, counts };
}

function renderLineChart(labels, counts) {
  const ctx = document.getElementById("lineChart");

  const total = counts.reduce((a, b) => a + b, 0);
  els.scheduledMeta.textContent = `${total} total booked in selected range`;

  if (lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Bookings (Date Booked)",
        data: counts,
        borderColor: "#6f8f7a",
        backgroundColor: "rgba(111,143,122,.15)",
        pointBackgroundColor: "#6f8f7a",
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 10 }, grid: { color: "rgba(0,0,0,.04)" } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.04)" } },
      }
    }
  });
}

function renderPieChart(newCount, returningCount) {
  const ctx = document.getElementById("pieChart");
  const totalNew = Number(newCount || 0);
  const totalRet = Number(returningCount || 0);
  els.newMeta.textContent = `${totalNew} new • ${totalRet} returning`;

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["New Patients", "Returning Patients"],
      datasets: [{
        data: [totalNew, totalRet],
        backgroundColor: ["#6f8f7a", "#2f7c9a"],
        borderColor: "rgba(255,255,255,.9)",
        borderWidth: 2
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

/* ---------------- CSV export ---------------- */

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv() {
  const q = (els.searchInput.value || "").trim().toLowerCase();
  const rows = !q ? cachedRows : cachedRows.filter((r) => {
    const blob = [
      r.patient_first, r.patient_last, r.patient_status,
      r.appointment_date, r.appointment_time, r.appointment_type,
      r.insurance, r.insurance_carrier, r.carrier, r.created_at,
      r.confirmation_id
    ].map((x) => String(x || "").toLowerCase()).join(" ");
    return blob.includes(q);
  });

  const header = ["Date Booked","Patient Name","Patient DOB","Patient Status","Appt Date","Appt Time","Appointment Type","Insurance"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const booked = String(r.created_at || "").slice(0, 10);
    const name = `${r.patient_first || ""} ${r.patient_last || ""}`.trim();
    const dob = String(r.patient_dob || r.dob || "").slice(0, 10) || "";
    const pStatus = String(r.patient_status || "");
    const apptDate = String(r.appointment_date || "");
    const apptTime = String(r.appointment_time || "");
    const type = apptTypeLabel(r.appointment_type);
    const ins = insuranceLabel(r);

    const vals = [booked, name, dob, pStatus, apptDate, apptTime, type, ins].map(csvEscape);
    lines.push(vals.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bhfd_online_bookings_${todayYYYYMMDD()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Load dashboard data ---------------- */

async function loadAll() {
  setStatus("Loading…", "");
  try {
    const start = (els.startDate.value || "").trim();
    const end = (els.endDate.value || "").trim();
    const qs = (start && end) ? `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` : "";

    const [bookings, analytics] = await Promise.all([
      api(`/office/bookings${(qs ? qs + "&" : "?")}limit=250`),
      api(`/office/analytics${qs}`),
    ]);

    renderTable(bookings.results || []);

    const series = buildLineSeries(bookings.results || [], start || null, end || null);
    renderLineChart(series.labels, series.counts);

    const newCount = Number(analytics?.byStatus?.find?.(x => x.key === "new")?.count || 0);
    const existingCount = Number(analytics?.byStatus?.find?.(x => x.key === "existing")?.count || 0);
    renderPieChart(newCount, existingCount);

    setStatus("Connected", "ok");

    // if you're on comm page, make sure its dropdown reflects latest cached rows
    refreshCommPatientSelect();
  } catch (e) {
    setStatus(String(e), "err");
  }
}

/* ---------- Quick range buttons ---------- */
function applyRange(mode) {
  const t = todayYYYYMMDD();
  if (mode === "today") {
    els.startDate.value = t;
    els.endDate.value = t;
  } else if (mode === "mtd") {
    els.startDate.value = monthStart(t);
    els.endDate.value = t;
  } else {
    const days = Number(mode);
    if (Number.isFinite(days)) {
      els.endDate.value = t;
      els.startDate.value = addDays(t, -(days - 1));
    }
  }
  loadAll();
}

/* ---------------- Delete selected ---------------- */

async function deleteSelected() {
  const ids = Array.from(selectedIds);
  if (!ids.length) return;

  const ok = confirm(`Hard delete ${ids.length} booking(s) from the log?\n\nThis cannot be undone.`);
  if (!ok) return;

  try {
    els.btnDeleteSelected.disabled = true;
    els.btnDeleteSelected.textContent = "Deleting…";

    await api("/office/bookings/delete", {
      method: "POST",
      body: JSON.stringify({ confirmationIds: ids }),
    });

    clearSelection();
    await loadAll();
  } catch (e) {
    alert(`Delete failed: ${String(e)}`);
  } finally {
    els.btnDeleteSelected.textContent = "Delete Selected";
    updateSelectionUI();
  }
}

/* ================================
   COMMUNICATION (Portal texting)
================================== */

// NOTE: Your bookings table currently does NOT include phone.
// If you later add `patient_phone` to the D1 table + endpoint, this UI will auto-fill it.
// Otherwise staff can type/paste a number manually.

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

// US-only E.164 helper
function toE164US(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const d = "+" + digitsOnly(raw);
    // +1 + 10 digits => length 12 including +
    if (/^\+1\d{10}$/.test(d)) return d;
    return null;
  }

  const d = digitsOnly(raw);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

function commRowPhone(r) {
  // support future columns without breaking today
  return (
    r.patient_phone ||
    r.phone ||
    r.patientPhone ||
    r.patient_wireless ||
    r.wireless_phone ||
    r.wirelessPhone ||
    ""
  );
}

function commRowLabel(r) {
  const name = `${r.patient_first || ""} ${r.patient_last || ""}`.trim() || "—";
  const appt = `${r.appointment_date || "—"} • ${r.appointment_time || "—"}`;
  const type = apptTypeLabel(r.appointment_type || "");
  return `${name} — ${appt} — ${type}`;
}

function refreshCommPatientSelect() {
  if (!els.commPatientSelect) return;

  // keep existing selection if possible
  const prior = String(els.commPatientSelect.value || "").trim();

  const rows = Array.isArray(cachedRows) ? cachedRows : [];
  const options = [];

  // Deduplicate by confirmation_id (best unique for a booking row)
  const seen = new Set();
  for (const r of rows) {
    const cid = String(r.confirmation_id || "").trim();
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    options.push({ value: cid, label: commRowLabel(r) });
  }

  const html = [
    `<option value="">Select from recent bookings…</option>`,
    ...options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
  ].join("");

  els.commPatientSelect.innerHTML = html;

  if (prior && seen.has(prior)) {
    els.commPatientSelect.value = prior;
  }

  // If an option is selected, ensure patient panel stays in sync
  if (els.commPatientSelect.value) {
    applySelectedPatientToCommUI(els.commPatientSelect.value);
  }
}

function applySelectedPatientToCommUI(confirmationId) {
  const cid = String(confirmationId || "").trim();
  const row = (cachedRows || []).find(r => String(r.confirmation_id || "").trim() === cid) || null;

  if (!row) {
    if (els.commSelName) els.commSelName.textContent = "—";
    if (els.commSelPhone) els.commSelPhone.textContent = "—";
    if (els.commSelAppt) els.commSelAppt.textContent = "—";
    if (els.commSelConf) els.commSelConf.textContent = "—";
    return;
  }

  const name = `${row.patient_first || ""} ${row.patient_last || ""}`.trim() || "—";
  const phone = commRowPhone(row) || "—";
  const appt = `${row.appointment_date || "—"} at ${row.appointment_time || "—"} • ${apptTypeLabel(row.appointment_type || "")}`;
  const conf = String(row.confirmation_id || "").trim() || "—";

  if (els.commSelName) els.commSelName.textContent = name;
  if (els.commSelPhone) els.commSelPhone.textContent = phone;
  if (els.commSelAppt) els.commSelAppt.textContent = appt;
  if (els.commSelConf) els.commSelConf.textContent = conf;

  // Try to auto-fill To if we have a phone
  if (els.commTo) {
    const e164 = toE164US(phone);
    if (e164) els.commTo.value = e164;
    // also prime message log search box
    if (els.commSearchTo && e164) els.commSearchTo.value = e164;
  }
}

function updateCharCount() {
  if (!els.commBody || !els.commCharCount) return;
  const n = String(els.commBody.value || "").length;
  els.commCharCount.textContent = String(n);
}

function renderCommMessagesTable(results) {
  if (!els.commMessagesBody) return;

  const rows = Array.isArray(results) ? results : [];
  if (!rows.length) {
    els.commMessagesBody.innerHTML = `<tr><td colspan="4" class="empty">No messages found for this number.</td></tr>`;
    return;
  }

  els.commMessagesBody.innerHTML = rows.map((m) => {
    const date = String(m.created_at || m.date || m.createdAt || "").replace("T", " ").slice(0, 19) || "—";
    const to = String(m.to || m.To || m.recipient || "").trim() || "—";
    const body = String(m.body || m.message || m.Body || "").trim() || "—";
    const status = String(m.status || m.Status || "").trim() || "—";

    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(to)}</td>
        <td>${escapeHtml(body)}</td>
        <td>${escapeHtml(status)}</td>
      </tr>
    `;
  }).join("");
}

async function commLoadMessagesForInput() {
  const raw = (els.commSearchTo?.value || "").trim();
  const to = toE164US(raw);
  if (!to) {
    renderCommMessagesTable([]);
    setCommStatus("Enter a valid US phone (10 digits or +1…)", "err");
    return;
  }

  setCommStatus("Loading messages…", "");
  try {
    const data = await api(`/office/messages?to=${encodeURIComponent(to)}`);
    renderCommMessagesTable(data.results || data.messages || []);
    setCommStatus("Loaded", "ok");
  } catch (e) {
    setCommStatus(String(e), "err");
  }
}

async function commSendMessage() {
  const toRaw = (els.commTo?.value || "").trim();
  const body = String(els.commBody?.value || "").trim();

  const to = toE164US(toRaw);
  if (!to) {
    setCommStatus("Please enter a valid US phone number.", "err");
    return;
  }
  if (!body) {
    setCommStatus("Message cannot be empty.", "err");
    return;
  }
  if (body.length > 1000) {
    setCommStatus("Message is too long.", "err");
    return;
  }

  const selectedCid = String(els.commPatientSelect?.value || "").trim() || null;

  setCommStatus("Sending…", "");
  if (els.btnCommSend) els.btnCommSend.disabled = true;

  try {
    const payload = {
      to,
      body,
      // optional context for your backend logging
      context: selectedCid ? { confirmationId: selectedCid } : undefined,
    };

    // Your worker should implement this endpoint:
    // POST /office/messages/send  { to:"+1...", body:"..." }
    const res = await api("/office/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setCommStatus("Sent", "ok");

    // auto-load log for that number
    if (els.commSearchTo) els.commSearchTo.value = to;
    await commLoadMessagesForInput();

    // clear message body (keep the To)
    if (els.commBody) {
      els.commBody.value = "";
      updateCharCount();
    }

    return res;
  } catch (e) {
    setCommStatus(String(e), "err");
  } finally {
    if (els.btnCommSend) els.btnCommSend.disabled = false;
  }
}

/* ---------------- Sidebar helpers ---------------- */

function openSidebar() {
  els.sidebar?.classList.add("open");
  els.sidebarOverlay?.classList.remove("hidden");
}

function closeSidebar() {
  els.sidebar?.classList.remove("open");
  els.sidebarOverlay?.classList.add("hidden");
}

function toggleSidebar() {
  if (!els.sidebar) return;
  els.sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.route === route);
  });
}

/* ---------------- Routing ---------------- */

function showRoute(route) {
  const r = route || "dashboard";

  if (els.routeDashboard) els.routeDashboard.classList.toggle("hidden", r !== "dashboard");
  if (els.routeAnalytics) els.routeAnalytics.classList.toggle("hidden", r !== "analytics");
  if (els.routeCommunication) els.routeCommunication.classList.toggle("hidden", r !== "communication");

  setActiveNav(r);

  // route-specific init
  if (r === "communication") {
    refreshCommPatientSelect();
    updateCharCount();
    setCommStatus("", "");
  }

  if (window.innerWidth <= 900) closeSidebar();
}

function parseHashRoute() {
  const h = (location.hash || "").replace("#/", "").trim();
  if (h === "analytics" || h === "communication" || h === "dashboard") return h;
  return "dashboard";
}

/* ---------------- One-time wiring ---------------- */

function wireDashboardOnce() {
  if (uiWired) return;
  uiWired = true;

  // sidebar controls
  els.btnMenu?.addEventListener("click", toggleSidebar);
  els.sidebarOverlay?.addEventListener("click", closeSidebar);

  // nav click (route)
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const route = item.dataset.route || "dashboard";
      location.hash = `#/${route}`;
    });
  });

  window.addEventListener("hashchange", () => showRoute(parseHashRoute()));

  document.querySelectorAll(".pill").forEach((b) => {
    b.addEventListener("click", () => applyRange(b.dataset.range));
  });

  els.btnRefresh?.addEventListener("click", () => loadAll());
  els.btnExport?.addEventListener("click", () => exportCsv());
  els.searchInput?.addEventListener("input", () => renderTable(cachedRows));

  // delete
  els.btnDeleteSelected?.addEventListener("click", deleteSelected);

  // communication wiring
  els.btnCommRefresh?.addEventListener("click", () => {
    // refresh dashboard data so comm has newest bookings
    loadAll().then(() => {
      refreshCommPatientSelect();
      setCommStatus("Refreshed", "ok");
    }).catch((e) => setCommStatus(String(e), "err"));
  });

  els.commPatientSelect?.addEventListener("change", () => {
    const cid = String(els.commPatientSelect.value || "").trim();
    if (!cid) {
      applySelectedPatientToCommUI(null);
      return;
    }
    applySelectedPatientToCommUI(cid);

    // Auto-load message log if we have a valid number
    const maybeTo = toE164US(els.commTo?.value || "");
    if (maybeTo) {
      if (els.commSearchTo) els.commSearchTo.value = maybeTo;
      commLoadMessagesForInput();
    }
  });

  els.commBody?.addEventListener("input", updateCharCount);
  els.btnCommSend?.addEventListener("click", commSendMessage);

  els.btnCommLoad?.addEventListener("click", commLoadMessagesForInput);
  els.commSearchTo?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commLoadMessagesForInput();
  });

  const doLogout = () => {
    clearAuth();
    closeSidebar();
    location.hash = "#/dashboard";
    showLogin();
  };

  els.btnLogout?.addEventListener("click", doLogout);
  els.btnLogoutSide?.addEventListener("click", doLogout);
}

/* ---------------- Login submit ---------------- */

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = (els.loginUser.value || "").trim();
  const pass = (els.loginPass.value || "").trim();
  const remember = !!els.loginRemember.checked;

  if (!user || !pass) {
    setLoginError("Please enter both username and password.");
    return;
  }

  setLoginError("");
  els.btnSubmitLogin.disabled = true;
  els.btnSubmitLogin.textContent = "Signing in…";

  try {
    const candidate = makeBasicAuth(user, pass);
    AUTH_HEADER = candidate;

    await api(`/office/bookings?limit=1`);
    rememberAuthIfWanted(candidate, remember);

    showDashboard();

    const t = todayYYYYMMDD();
    els.endDate.value = t;
    els.startDate.value = addDays(t, -29);

    wireDashboardOnce();

    showRoute(parseHashRoute());

    await loadAll();
  } catch (err) {
    clearAuth();
    setLoginError("Authentication required to access this page.");
    showLogin();
  } finally {
    els.btnSubmitLogin.disabled = false;
    els.btnSubmitLogin.textContent = "Login Now";
  }
});

/* ---------------- Init ---------------- */

(function init() {
  const remembered = loadRememberedAuth();

  if (remembered) {
    AUTH_HEADER = remembered;
    showDashboard();

    const t = todayYYYYMMDD();
    els.endDate.value = t;
    els.startDate.value = addDays(t, -29);

    wireDashboardOnce();
    showRoute(parseHashRoute());

    loadAll().catch(() => {
      clearAuth();
      showLogin();
    });
  } else {
    showLogin();
  }
})();
