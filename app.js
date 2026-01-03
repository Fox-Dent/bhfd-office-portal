/**
 * BHFD Office Portal (FoxDent)
 *
 * UI:
 *  - Login page:  <main id="loginView">...</main>
 *  - Dashboard:   <div id="dashboardView">...</div>
 *
 * API (Office API Worker B):
 *  - GET  /office/bookings?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=250
 *  - GET  /office/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * NOTES:
 *  - Date range filters are based on DATE BOOKED (created_at), not appointment_date.
 *  - Auth uses Basic Auth. If "Remember" is checked, it is stored in localStorage.
 */

const OFFICE_API_BASE = "https://foxdentofficeportal.calcifer6456.workers.dev"; // <-- your Office API worker URL

let AUTH_HEADER = null;
let lineChart = null;
let pieChart = null;

const STORAGE_KEY = "foxdent_office_basic_auth_v1";

const els = {
  // Views
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),

  // Login form
  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  loginRemember: document.getElementById("loginRemember"),
  loginError: document.getElementById("loginError"),
  btnSubmitLogin: document.getElementById("btnSubmitLogin"),

  // Dashboard controls
  btnLogout: document.getElementById("btnLogout"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnExport: document.getElementById("btnExport"),
  statusText: document.getElementById("statusText"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  scheduledMeta: document.getElementById("scheduledMeta"),
  newMeta: document.getElementById("newMeta"),
  bookingsBody: document.getElementById("bookingsBody"),
  searchInput: document.getElementById("searchInput"),
};

let cachedRows = []; // used for search + CSV export

/* ---------------- View helpers ---------------- */

function showLogin() {
  els.loginView?.classList.remove("hidden");
  els.dashboardView?.classList.add("hidden");
}

function showDashboard() {
  els.loginView?.classList.add("hidden");
  els.dashboardView?.classList.remove("hidden");
}

function setLoginError(text) {
  if (!els.loginError) return;
  if (!text) {
    els.loginError.textContent = "";
    els.loginError.classList.add("hidden");
    return;
  }
  els.loginError.textContent = text;
  els.loginError.classList.remove("hidden");
}

function setStatus(text, mode = "") {
  if (!els.statusText) return;
  els.statusText.textContent = text;
  els.statusText.classList.remove("ok", "err");
  if (mode) els.statusText.classList.add(mode);
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

function ymdFromIso(iso) {
  // created_at is ISO like 2026-01-03T17:53:21.337Z -> take YYYY-MM-DD
  return String(iso || "").slice(0, 10);
}

/* ---------------- Auth helpers ---------------- */

function basicAuthHeader(user, pass) {
  const u = String(user || "").trim();
  const p = String(pass || "");
  if (!u || !p) return null;
  return `Basic ${btoa(`${u}:${p}`)}`;
}

function saveAuthIfRemember(remember, header) {
  try {
    if (!remember) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, header);
  } catch {
    // ignore storage errors
  }
}

function loadSavedAuth() {
  try {
    const h = localStorage.getItem(STORAGE_KEY);
    return h && h.startsWith("Basic ") ? h : null;
  } catch {
    return null;
  }
}

function clearSavedAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/* ---------------- API ---------------- */

async function apiGet(path) {
  if (!AUTH_HEADER) throw new Error("Not authenticated.");

  const res = await fetch(`${OFFICE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: AUTH_HEADER,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    throw new Error("Unauthorized (wrong credentials).");
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error((data && data.error) ? data.error : `API error (${res.status})`);
  }
  return data;
}

async function verifyAuth() {
  // hits a simple endpoint (you already confirmed /health works)
  // If your worker doesn't require auth for /health, you can swap to /office/bookings?limit=1
  // We'll use /office/bookings?limit=1 so auth is definitely tested.
  await apiGet(`/office/bookings?limit=1`);
}

/* ---------------- Formatting helpers ---------------- */

function apptTypeLabel(t) {
  const x = String(t || "").toLowerCase();
  if (x === "adult_cleaning") return "Adult Cleaning";
  if (x === "child_cleaning") return "Child Cleaning";
  if (x === "emergency") return "Emergency";
  if (x === "consult") return "Consult";
  return t || "";
}

function insuranceLabel(row) {
  const ins =
    row.insurance ||
    row.insurance_carrier ||
    row.insCarrier ||
    row.carrier ||
    "";

  const noIns = row.no_insurance ?? row.noInsurance ?? null;

  if (String(ins).trim()) return String(ins).trim();
  if (noIns === true) return "Self-Pay";
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

/* ---------------- Table ---------------- */

function renderTable(rows) {
  cachedRows = Array.isArray(rows) ? rows : [];

  const q = (els.searchInput?.value || "").trim().toLowerCase();
  const filtered = !q
    ? cachedRows
    : cachedRows.filter((r) => {
        const blob = [
          r.patient_first, r.patient_last, r.patient_status,
          r.appointment_date, r.appointment_time, r.appointment_type,
          r.insurance, r.insurance_carrier, r.carrier,
          r.created_at
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return blob.includes(q);
      });

  if (!filtered.length) {
    els.bookingsBody.innerHTML = `<tr><td colspan="8" class="empty">No matching bookings.</td></tr>`;
    return;
  }

  // Sort newest booked first
  const sorted = [...filtered].sort((a, b) => {
    const aa = String(a.created_at || "");
    const bb = String(b.created_at || "");
    return bb.localeCompare(aa);
  });

  els.bookingsBody.innerHTML = sorted
    .map((r) => {
      const booked = ymdFromIso(r.created_at);
      const name = `${r.patient_first || ""} ${r.patient_last || ""}`.trim();
      const dob = String(r.patient_dob || r.dob || "").slice(0, 10) || "—";
      const pStatus = statusBadge(r.patient_status);
      const apptDate = r.appointment_date || "—";
      const apptTime = r.appointment_time || "—";
      const type = apptTypeLabel(r.appointment_type);
      const ins = insuranceLabel(r);

      return `
        <tr>
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
    })
    .join("");
}

/* ---------------- Charts (based on DATE BOOKED) ---------------- */

function buildLineSeriesByBooked(bookings, start, end) {
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
    const bookedDay = ymdFromIso(b.created_at);
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
      datasets: [
        {
          label: "Booked Appointments",
          data: counts,
          borderColor: "#6f8f7a",
          backgroundColor: "rgba(111,143,122,.15)",
          pointBackgroundColor: "#6f8f7a",
          pointRadius: 3,
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          grid: { color: "rgba(0,0,0,.04)" },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(0,0,0,.04)" },
        },
      },
    },
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
      datasets: [
        {
          data: [totalNew, totalRet],
          backgroundColor: ["#6f8f7a", "#2f7c9a"],
          borderColor: "rgba(255,255,255,.9)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    },
  });
}

/* ---------------- CSV Export ---------------- */

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv() {
  const q = (els.searchInput?.value || "").trim().toLowerCase();
  const rows = !q
    ? cachedRows
    : cachedRows.filter((r) => {
        const blob = [
          r.patient_first, r.patient_last, r.patient_status,
          r.appointment_date, r.appointment_time, r.appointment_type,
          r.insurance, r.insurance_carrier, r.carrier,
          r.created_at
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return blob.includes(q);
      });

  const header = [
    "Date Booked",
    "Patient Name",
    "Patient DOB",
    "Patient Status",
    "Appt Date",
    "Appt Time",
    "Appointment Type",
    "Insurance",
  ];

  const lines = [header.join(",")];

  // newest first
  const sorted = [...rows].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  for (const r of sorted) {
    const booked = ymdFromIso(r.created_at);
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

/* ---------------- Load dashboard ---------------- */

async function loadAll() {
  setStatus("Loading…", "");

  try {
    const start = (els.startDate?.value || "").trim();
    const end = (els.endDate?.value || "").trim();

    const qs =
      start && end
        ? `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        : "";

    const bookingsPath = `/office/bookings${qs ? qs + "&" : "?"}limit=250`;
    const analyticsPath = `/office/analytics${qs}`;

    const [bookings, analytics] = await Promise.all([
      apiGet(bookingsPath),
      apiGet(analyticsPath),
    ]);

    const rows = bookings.results || [];

    // Table
    renderTable(rows);

    // Line chart (DATE BOOKED)
    const series = buildLineSeriesByBooked(rows, start || null, end || null);
    renderLineChart(series.labels, series.counts);

    // Pie
    const newCount = Number(analytics?.byStatus?.find?.((x) => x.key === "new")?.count || 0);
    const existingCount = Number(analytics?.byStatus?.find?.((x) => x.key === "existing")?.count || 0);
    renderPieChart(newCount, existingCount);

    setStatus("Connected", "ok");
  } catch (e) {
    setStatus(String(e?.message || e), "err");
  }
}

/* ---------------- Quick range buttons ---------------- */

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

/* ---------------- Login flow ---------------- */

async function doLogin(user, pass, remember) {
  const header = basicAuthHeader(user, pass);
  if (!header) throw new Error("Please enter a username and password.");

  AUTH_HEADER = header;

  // Verify credentials before switching views
  await verifyAuth();

  saveAuthIfRemember(remember, header);
  setLoginError("");

  showDashboard();
  setStatus("Connected", "ok");

  await loadAll();
}

function doLogout() {
  AUTH_HEADER = null;
  clearSavedAuth();
  setStatus("Not connected", "");
  showLogin();
}

/* ---------------- Events ---------------- */

if (els.loginForm) {
  els.loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setLoginError("");

    const user = els.loginUser?.value || "";
    const pass = els.loginPass?.value || "";
    const remember = !!els.loginRemember?.checked;

    try {
      // Disable button briefly
      if (els.btnSubmitLogin) {
        els.btnSubmitLogin.disabled = true;
        els.btnSubmitLogin.textContent = "Logging in…";
      }

      await doLogin(user, pass, remember);
    } catch (err) {
      AUTH_HEADER = null;
      const msg = String(err?.message || err);
      setLoginError(msg);
    } finally {
      if (els.btnSubmitLogin) {
        els.btnSubmitLogin.disabled = false;
        els.btnSubmitLogin.textContent = "Login Now";
      }
    }
  });
}

if (els.btnLogout) {
  els.btnLogout.addEventListener("click", () => doLogout());
}

if (els.btnRefresh) {
  els.btnRefresh.addEventListener("click", () => loadAll());
}

if (els.btnExport) {
  els.btnExport.addEventListener("click", () => exportCsv());
}

if (els.searchInput) {
  els.searchInput.addEventListener("input", () => renderTable(cachedRows));
}

document.querySelectorAll(".pill").forEach((b) => {
  b.addEventListener("click", () => applyRange(b.dataset.range));
});

/* ---------------- Init ---------------- */

(function init() {
  // Default dates (last 30 days)
  const t = todayYYYYMMDD();
  if (els.endDate) els.endDate.value = t;
  if (els.startDate) els.startDate.value = addDays(t, -29);

  // Attempt auto-login if remembered
  const saved = loadSavedAuth();
  if (saved) {
    AUTH_HEADER = saved;
    // Start with dashboard, but if verify fails, we revert to login.
    showDashboard();
    setStatus("Connecting…", "");

    verifyAuth()
      .then(() => loadAll())
      .catch(() => {
        AUTH_HEADER = null;
        clearSavedAuth();
        showLogin();
        setLoginError("Session expired. Please log in again.");
      });

    return;
  }

  // Otherwise show login
  showLogin();
})();
