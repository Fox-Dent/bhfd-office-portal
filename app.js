const OFFICE_API_BASE = "https://foxdentofficeportal.calcifer6456.workers.dev";

let AUTH_HEADER = null;
let lineChart = null;
let pieChart = null;

const AUTH_STORAGE_KEY = "bhfd_office_auth_basic";

const els = {
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),

  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  loginRemember: document.getElementById("loginRemember"),
  loginError: document.getElementById("loginError"),
  btnSubmitLogin: document.getElementById("btnSubmitLogin"),

  btnLogout: document.getElementById("btnLogout"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnExport: document.getElementById("btnExport"),

  btnDeleteSelected: document.getElementById("btnDeleteSelected"),
  selectedCount: document.getElementById("selectedCount"),

  statusText: document.getElementById("statusText"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  scheduledMeta: document.getElementById("scheduledMeta"),
  newMeta: document.getElementById("newMeta"),
  bookingsBody: document.getElementById("bookingsBody"),
  searchInput: document.getElementById("searchInput"),

  sidebar: document.getElementById("sidebar"),
  btnMenu: document.getElementById("btnMenu"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  btnLogoutSide: document.getElementById("btnLogoutSide"),

  routeDashboard: document.getElementById("route-dashboard"),
  routeAnalytics: document.getElementById("route-analytics"),
  routeWebforms: document.getElementById("route-webforms"),
  routeCommunication: document.getElementById("route-communication"),

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

  commMessagesBody: document.getElementById("commMessagesBody"),
  btnCommLoad: document.getElementById("btnCommLoad"),
  commThreadList: document.getElementById("commThreadList"),
  commThreadSearch: document.getElementById("commThreadSearch"),
  commInboxMeta: document.getElementById("commInboxMeta"),
  commThreadName: document.getElementById("commThreadName"),
  commThreadPhone: document.getElementById("commThreadPhone"),
  commPatientContext: document.getElementById("commPatientContext"),

  wfTo: document.getElementById("wfTo"),
  wfBody: document.getElementById("wfBody"),
  wfCharCount: document.getElementById("wfCharCount"),
  btnWfSend: document.getElementById("btnWfSend"),
  wfSendStatus: document.getElementById("wfSendStatus"),
};

let cachedRows = [];
let cachedConversations = [];
let selectedThreadPhone = "";
let selectedThreadName = "";
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
  if (!els.statusText) return;
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

function setWfStatus(text, mode = "") {
  if (!els.wfSendStatus) return;
  els.wfSendStatus.textContent = text || "";
  els.wfSendStatus.classList.remove("ok", "err");
  if (mode) els.wfSendStatus.classList.add(mode);
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

/* ---------------- General helpers ---------------- */

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

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function toE164US(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const d = "+" + digitsOnly(raw);
    if (/^\+1\d{10}$/.test(d)) return d;
    return null;
  }

  const d = digitsOnly(raw);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

function prettyPhone(input) {
  const e164 = toE164US(input);
  if (!e164) return input || "—";
  const d = e164.replace("+1", "");
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatMessageDate(value) {
  const raw = String(value || "");
  if (!raw) return "—";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.replace("T", " ").slice(0, 19);

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function messageBody(m) {
  return String(m.body || m.message || m.Body || "").trim();
}

function messageDate(m) {
  return String(m.created_at || m.date || m.createdAt || m.timestamp || "").trim();
}

function messageTo(m) {
  return String(m.to || m.To || m.recipient || "").trim();
}

function messageFrom(m) {
  return String(m.from || m.From || m.sender || "").trim();
}

function messageStatus(m) {
  return String(m.status || m.Status || "").trim() || "sent";
}

function messageDirection(m) {
  const dir = String(m.direction || m.Direction || "").toLowerCase();

  if (dir.includes("in")) return "inbound";
  if (dir.includes("out")) return "outbound";

  const to = toE164US(messageTo(m));
  const from = toE164US(messageFrom(m));
  const selected = toE164US(selectedThreadPhone);

  if (selected && from === selected) return "inbound";
  if (selected && to === selected) return "outbound";

  return "outbound";
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

  const idsInTable = new Set(
    cachedRows.map((r) => String(r.confirmation_id || "").trim()).filter(Boolean)
  );

  for (const id of Array.from(selectedIds)) {
    if (!idsInTable.has(id)) selectedIds.delete(id);
  }

  const q = (els.searchInput?.value || "").trim().toLowerCase();
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

  if (!els.bookingsBody) return;

  if (!filtered.length) {
    els.bookingsBody.innerHTML = `<tr><td colspan="9" class="empty">No matching bookings.</td></tr>`;
    updateSelectionUI();
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
  if (!ctx) return;

  const total = counts.reduce((a, b) => a + b, 0);
  if (els.scheduledMeta) els.scheduledMeta.textContent = `${total} total booked in selected range`;

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
  if (!ctx) return;

  const totalNew = Number(newCount || 0);
  const totalRet = Number(returningCount || 0);
  if (els.newMeta) els.newMeta.textContent = `${totalNew} new • ${totalRet} returning`;

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
  const q = (els.searchInput?.value || "").trim().toLowerCase();
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
    const start = (els.startDate?.value || "").trim();
    const end = (els.endDate?.value || "").trim();
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
    refreshCommPatientSelect();
  } catch (e) {
    setStatus(String(e), "err");
  }
}

/* ---------- Quick range buttons ---------- */

function applyRange(mode) {
  const t = todayYYYYMMDD();

  if (mode === "today") {
    if (els.startDate) els.startDate.value = t;
    if (els.endDate) els.endDate.value = t;
  } else if (mode === "mtd") {
    if (els.startDate) els.startDate.value = monthStart(t);
    if (els.endDate) els.endDate.value = t;
  } else {
    const days = Number(mode);
    if (Number.isFinite(days)) {
      if (els.endDate) els.endDate.value = t;
      if (els.startDate) els.startDate.value = addDays(t, -(days - 1));
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
   COMMUNICATION CENTER
================================== */

function commRowPhone(r) {
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

function findBookingByPhone(phone) {
  const e164 = toE164US(phone);
  if (!e164) return null;

  return (cachedRows || []).find((r) => {
    const rowPhone = toE164US(commRowPhone(r));
    return rowPhone === e164;
  }) || null;
}

function refreshCommPatientSelect() {
  if (!els.commPatientSelect) return;

  const prior = String(els.commPatientSelect.value || "").trim();
  const rows = Array.isArray(cachedRows) ? cachedRows : [];
  const options = [];
  const seen = new Set();

  for (const r of rows) {
    const cid = String(r.confirmation_id || "").trim();
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    options.push({ value: cid, label: commRowLabel(r) });
  }

  els.commPatientSelect.innerHTML = [
    `<option value="">Select from recent bookings…</option>`,
    ...options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
  ].join("");

  if (prior && seen.has(prior)) {
    els.commPatientSelect.value = prior;
  }
}

function clearCommPatientContext() {
  if (els.commSelName) els.commSelName.textContent = "—";
  if (els.commSelPhone) els.commSelPhone.textContent = "—";
  if (els.commSelAppt) els.commSelAppt.textContent = "—";
  if (els.commSelConf) els.commSelConf.textContent = "—";
  els.commPatientContext?.classList.add("hidden");
}

function applySelectedPatientToCommUI(confirmationId) {
  const cid = String(confirmationId || "").trim();
  const row = (cachedRows || []).find(r => String(r.confirmation_id || "").trim() === cid) || null;

  if (!row) {
    clearCommPatientContext();
    return null;
  }

  const name = `${row.patient_first || ""} ${row.patient_last || ""}`.trim() || "—";
  const phone = commRowPhone(row) || "—";
  const e164 = toE164US(phone);
  const appt = `${row.appointment_date || "—"} at ${row.appointment_time || "—"} • ${apptTypeLabel(row.appointment_type || "")}`;
  const conf = String(row.confirmation_id || "").trim() || "—";

  if (els.commSelName) els.commSelName.textContent = name;
  if (els.commSelPhone) els.commSelPhone.textContent = e164 || phone;
  if (els.commSelAppt) els.commSelAppt.textContent = appt;
  if (els.commSelConf) els.commSelConf.textContent = conf;
  els.commPatientContext?.classList.remove("hidden");

  if (els.commTo && e164) els.commTo.value = e164;

  selectedThreadPhone = e164 || "";
  selectedThreadName = name;

  updateThreadHeader(name, e164 || phone);

  return { row, name, phone: e164 || phone };
}

function applyBookingContextByPhone(phone) {
  const row = findBookingByPhone(phone);
  if (!row) {
    clearCommPatientContext();
    return null;
  }

  const cid = String(row.confirmation_id || "").trim();
  if (els.commPatientSelect && cid) els.commPatientSelect.value = cid;
  return applySelectedPatientToCommUI(cid);
}

function updateCharCount() {
  if (!els.commBody || !els.commCharCount) return;
  const n = String(els.commBody.value || "").length;
  els.commCharCount.textContent = String(n);
}

function updateThreadHeader(name, phone) {
  if (els.commThreadName) els.commThreadName.textContent = name || prettyPhone(phone) || "New conversation";
  if (els.commThreadPhone) els.commThreadPhone.textContent = phone ? prettyPhone(phone) : "Choose a recent message or enter a phone number.";
}

function buildConversationMap(messages) {
  const map = new Map();

  for (const m of messages || []) {
    const to = toE164US(messageTo(m));
    const from = toE164US(messageFrom(m));
    const phone = to || from;
    if (!phone) continue;

    const booking = findBookingByPhone(phone);
    const bookingName = booking ? `${booking.patient_first || ""} ${booking.patient_last || ""}`.trim() : "";
    const existing = map.get(phone);

    const created = messageDate(m);
    const body = messageBody(m);
    const status = messageStatus(m);

    if (!existing) {
      map.set(phone, {
        phone,
        name: bookingName || prettyPhone(phone),
        preview: body,
        status,
        lastDate: created,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (String(created || "") >= String(existing.lastDate || "")) {
        existing.preview = body;
        existing.status = status;
        existing.lastDate = created;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => String(b.lastDate || "").localeCompare(String(a.lastDate || "")));
}

function mergeBookingPhonesIntoConversations(conversations) {
  const map = new Map(conversations.map((c) => [c.phone, c]));

  for (const row of cachedRows || []) {
    const phone = toE164US(commRowPhone(row));
    if (!phone || map.has(phone)) continue;

    const name = `${row.patient_first || ""} ${row.patient_last || ""}`.trim() || prettyPhone(phone);
    map.set(phone, {
      phone,
      name,
      preview: `${row.appointment_date || "Upcoming"} • ${apptTypeLabel(row.appointment_type || "Appointment")}`,
      status: "booking",
      lastDate: row.created_at || "",
      count: 0,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(b.lastDate || "").localeCompare(String(a.lastDate || "")));
}

function renderThreadList() {
  if (!els.commThreadList) return;

  const q = String(els.commThreadSearch?.value || "").trim().toLowerCase();

  const filtered = !q
    ? cachedConversations
    : cachedConversations.filter((c) => {
        const blob = `${c.name || ""} ${c.phone || ""} ${c.preview || ""}`.toLowerCase();
        return blob.includes(q);
      });

  if (els.commInboxMeta) {
    els.commInboxMeta.textContent = `${filtered.length} conversation${filtered.length === 1 ? "" : "s"}`;
  }

  if (!filtered.length) {
    els.commThreadList.innerHTML = `<div class="comm-empty-thread">No recent conversations found.</div>`;
    return;
  }

  els.commThreadList.innerHTML = filtered.map((c) => {
    const active = toE164US(selectedThreadPhone) === toE164US(c.phone) ? "active" : "";
    return `
      <button class="comm-thread-item ${active}" type="button" data-phone="${escapeHtml(c.phone)}" data-name="${escapeHtml(c.name)}">
        <div class="comm-thread-line">
          <div class="comm-thread-person">${escapeHtml(c.name || prettyPhone(c.phone))}</div>
          <div class="comm-thread-date">${escapeHtml(formatMessageDate(c.lastDate))}</div>
        </div>
        <div class="comm-thread-preview">${escapeHtml(c.preview || "No message preview")}</div>
        <div class="comm-thread-status">${escapeHtml(c.status || "")}</div>
      </button>
    `;
  }).join("");

  els.commThreadList.querySelectorAll(".comm-thread-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const phone = btn.getAttribute("data-phone") || "";
      const name = btn.getAttribute("data-name") || prettyPhone(phone);
      await selectThread(phone, name);
    });
  });
}

async function loadRecentConversations() {
  if (!els.commThreadList) return;

  if (els.commInboxMeta) els.commInboxMeta.textContent = "Loading conversations…";

  try {
    const data = await api(`/office/messages?limit=250`);
    const messages = data.results || data.messages || [];
    cachedConversations = mergeBookingPhonesIntoConversations(buildConversationMap(messages));
    renderThreadList();
  } catch (e) {
    cachedConversations = mergeBookingPhonesIntoConversations([]);
    renderThreadList();
    setCommStatus(`Recent messages loaded from bookings only. ${String(e)}`, "err");
  }
}

async function selectThread(phone, name = "") {
  const e164 = toE164US(phone);

  if (!e164) {
    setCommStatus("Please enter a valid US phone number.", "err");
    return;
  }

  selectedThreadPhone = e164;
  selectedThreadName = name || prettyPhone(e164);

  if (els.commTo) els.commTo.value = e164;

  updateThreadHeader(selectedThreadName, e164);
  applyBookingContextByPhone(e164);
  renderThreadList();

  await commLoadMessagesForPhone(e164);
}

function renderCommMessages(results) {
  if (!els.commMessagesBody) return;

  const rows = Array.isArray(results) ? results : [];

  if (!rows.length) {
    els.commMessagesBody.innerHTML = `
      <div class="comm-empty-state">
        No messages found for this number yet. Type a message below to start the thread.
      </div>
    `;
    return;
  }

  const sorted = rows.slice().sort((a, b) => String(messageDate(a)).localeCompare(String(messageDate(b))));

  els.commMessagesBody.innerHTML = sorted.map((m) => {
    const dir = messageDirection(m);
    const body = messageBody(m) || "—";
    const date = formatMessageDate(messageDate(m));
    const status = messageStatus(m);

    return `
      <div class="comm-message ${escapeHtml(dir)}">
        <div class="comm-message-body">${escapeHtml(body)}</div>
        <div class="comm-message-meta">
          <span>${escapeHtml(date)}</span>
          <span>${escapeHtml(status)}</span>
        </div>
      </div>
    `;
  }).join("");

  els.commMessagesBody.scrollTop = els.commMessagesBody.scrollHeight;
}

async function commLoadMessagesForPhone(phone) {
  const to = toE164US(phone);

  if (!to) {
    renderCommMessages([]);
    setCommStatus("Enter a valid US phone number.", "err");
    return;
  }

  setCommStatus("Loading thread…", "");

  try {
    const data = await api(`/office/messages?to=${encodeURIComponent(to)}`);
    renderCommMessages(data.results || data.messages || []);
    setCommStatus("Thread loaded", "ok");
  } catch (e) {
    renderCommMessages([]);
    setCommStatus(String(e), "err");
  }
}

async function commLoadMessagesForInput() {
  const raw = (els.commTo?.value || "").trim();
  const to = toE164US(raw);

  if (!to) {
    setCommStatus("Enter a valid US phone number.", "err");
    return;
  }

  const booking = applyBookingContextByPhone(to);
  selectedThreadPhone = to;
  selectedThreadName = booking?.name || prettyPhone(to);
  updateThreadHeader(selectedThreadName, to);
  renderThreadList();

  await commLoadMessagesForPhone(to);
}

async function commSendMessage() {
  const toRaw = (els.commTo?.value || selectedThreadPhone || "").trim();
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
      context: selectedCid ? { confirmationId: selectedCid } : undefined,
    };

    const res = await api("/office/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    selectedThreadPhone = to;
    const booking = applyBookingContextByPhone(to);
    selectedThreadName = booking?.name || selectedThreadName || prettyPhone(to);
    updateThreadHeader(selectedThreadName, to);

    if (els.commBody) {
      els.commBody.value = "";
      updateCharCount();
    }

    await commLoadMessagesForPhone(to);
    await loadRecentConversations();

    setCommStatus("Sent", "ok");
    return res;
  } catch (e) {
    setCommStatus(String(e), "err");
  } finally {
    if (els.btnCommSend) els.btnCommSend.disabled = false;
  }
}

/* ================================
   WEBFORMS
================================== */

const WEBFORMS = [
  {
    key: "new",
    name: "New Patient Forms",
    link: "https://patientviewer.com/WebFormsGWT/GWT/WebForms/WebForms.html?DOID=31638&RKID=9571&WSDID=166700",
    template: (link) =>
      `Hi! Please complete your New Patient Forms before your visit with Brook Hollow Family Dentistry.\n\n${link}`,
  },
  {
    key: "updated",
    name: "Updated Patient Forms",
    link: "https://patientviewer.com/WebFormsGWT/GWT/WebForms/WebForms.html?DOID=31638&RKID=9571&WSDID=189407",
    template: (link) =>
      `Hi! Please complete your Updated Patient Forms before your visit with Brook Hollow Family Dentistry.\n\n${link}`,
  },
];

function wfUpdateCharCount() {
  if (!els.wfBody || !els.wfCharCount) return;
  els.wfCharCount.textContent = String((els.wfBody.value || "").length);
}

function wfSetActiveButton(btn) {
  document.querySelectorAll(".wf-form-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function wfAutoFillFromButton(btn) {
  if (!btn || !els.wfBody) return;

  const name = btn.getAttribute("data-form-name") || "";
  const link = btn.getAttribute("data-form-link") || "";

  const preset = WEBFORMS.find((x) => x.name === name && x.link === link);
  const msg = preset ? preset.template(preset.link) : `Hi! Please complete your forms:\n\n${link}`;

  els.wfBody.value = msg;
  wfUpdateCharCount();

  if (els.btnWfSend) els.btnWfSend.disabled = !String(els.wfTo?.value || "").trim();
  setWfStatus("", "");
}

function wfWireButtons() {
  const btns = document.querySelectorAll(".wf-form-btn");
  btns.forEach((btn) => {
    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      wfSetActiveButton(btn);
      wfAutoFillFromButton(btn);
    });
  });
}

async function wfSendFormText() {
  const toRaw = (els.wfTo?.value || "").trim();
  const body = String(els.wfBody?.value || "").trim();

  const to = toE164US(toRaw);

  if (!to) {
    setWfStatus("Please enter a valid US phone number.", "err");
    return;
  }

  if (!body) {
    setWfStatus("Message cannot be empty.", "err");
    return;
  }

  setWfStatus("Sending…", "");
  if (els.btnWfSend) els.btnWfSend.disabled = true;

  try {
    await api("/office/messages/send", {
      method: "POST",
      body: JSON.stringify({
        to,
        body,
        context: { source: "webforms" },
      }),
    });

    setWfStatus("Sent", "ok");

    selectedThreadPhone = to;
    selectedThreadName = prettyPhone(to);

    if (els.commTo) els.commTo.value = to;

    await loadRecentConversations();

    if (location.hash === "#/communication") {
      await selectThread(to, prettyPhone(to));
    }
  } catch (e) {
    setWfStatus(String(e), "err");
  } finally {
    if (els.btnWfSend) els.btnWfSend.disabled = false;
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
  if (els.routeWebforms) els.routeWebforms.classList.toggle("hidden", r !== "webforms");
  if (els.routeCommunication) els.routeCommunication.classList.toggle("hidden", r !== "communication");
  if (els.routeAnalytics) els.routeAnalytics.classList.toggle("hidden", true);

  setActiveNav(r);

  if (r === "communication") {
    refreshCommPatientSelect();
    updateCharCount();
    setCommStatus("", "");

    if (!cachedConversations.length) {
      loadRecentConversations();
    } else {
      renderThreadList();
    }
  }

  if (r === "webforms") {
    wfWireButtons();
    wfUpdateCharCount();
    setWfStatus("", "");
    if (els.btnWfSend) els.btnWfSend.disabled = !String(els.wfTo?.value || "").trim();
  }

  if (window.innerWidth <= 900) closeSidebar();
}

function parseHashRoute() {
  const h = (location.hash || "").replace("#/", "").trim();
  if (h === "webforms" || h === "communication" || h === "dashboard") return h;
  return "dashboard";
}

/* ---------------- One-time wiring ---------------- */

function wireDashboardOnce() {
  if (uiWired) return;
  uiWired = true;

  els.btnMenu?.addEventListener("click", toggleSidebar);
  els.sidebarOverlay?.addEventListener("click", closeSidebar);

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
  els.btnDeleteSelected?.addEventListener("click", deleteSelected);

  els.btnCommRefresh?.addEventListener("click", async () => {
    try {
      await loadAll();
      await loadRecentConversations();
      if (selectedThreadPhone) await commLoadMessagesForPhone(selectedThreadPhone);
      setCommStatus("Refreshed", "ok");
    } catch (e) {
      setCommStatus(String(e), "err");
    }
  });

  els.commPatientSelect?.addEventListener("change", async () => {
    const cid = String(els.commPatientSelect.value || "").trim();

    if (!cid) {
      clearCommPatientContext();
      return;
    }

    const selected = applySelectedPatientToCommUI(cid);
    if (selected?.phone) {
      await selectThread(selected.phone, selected.name);
    }
  });

  els.commTo?.addEventListener("input", () => {
    const to = toE164US(els.commTo.value);
    if (to) {
      selectedThreadPhone = to;
      const booking = applyBookingContextByPhone(to);
      updateThreadHeader(booking?.name || prettyPhone(to), to);
    }
  });

  els.commBody?.addEventListener("input", updateCharCount);
  els.btnCommSend?.addEventListener("click", commSendMessage);
  els.btnCommLoad?.addEventListener("click", commLoadMessagesForInput);

  els.commTo?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commLoadMessagesForInput();
  });

  els.commThreadSearch?.addEventListener("input", renderThreadList);

  els.wfTo?.addEventListener("input", () => {
    if (els.btnWfSend) els.btnWfSend.disabled = !String(els.wfTo.value || "").trim();
  });

  els.wfBody?.addEventListener("input", wfUpdateCharCount);
  els.btnWfSend?.addEventListener("click", wfSendFormText);

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

els.loginForm?.addEventListener("submit", async (e) => {
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
    if (els.endDate) els.endDate.value = t;
    if (els.startDate) els.startDate.value = addDays(t, -29);

    wireDashboardOnce();
    showRoute(parseHashRoute());

    await loadAll();

    if (parseHashRoute() === "communication") {
      await loadRecentConversations();
    }
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
    if (els.endDate) els.endDate.value = t;
    if (els.startDate) els.startDate.value = addDays(t, -29);

    wireDashboardOnce();
    showRoute(parseHashRoute());

    loadAll()
      .then(() => {
        if (parseHashRoute() === "communication") return loadRecentConversations();
        return null;
      })
      .catch(() => {
        clearAuth();
        showLogin();
      });
  } else {
    showLogin();
  }
})();
