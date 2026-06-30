const OFFICE_API_BASE = "https://foxdentofficeportal.calcifer6456.workers.dev";

let AUTH_HEADER = null;

let lineChart = null;
let pieChart = null;
let collectionsChart = null;
let paymentTypeChart = null;
let appointmentStatusChart = null;
let newPatientChart = null;
let existingPatientChart = null;

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

  // delete UI
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

  // analytics controls
  btnAnalyticsRefresh: document.getElementById("btnAnalyticsRefresh"),
  analyticsStartDate: document.getElementById("analyticsStartDate"),
  analyticsEndDate: document.getElementById("analyticsEndDate"),
  analyticsStatusText: document.getElementById("analyticsStatusText"),

  // analytics metric cards
  dailyCollections: document.getElementById("dailyCollections"),
  monthlyCollections: document.getElementById("monthlyCollections"),
  selectedRangeLabel: document.getElementById("selectedRangeLabel"),
  analyticsPaymentCount: document.getElementById("analyticsPaymentCount"),
  analyticsAveragePayment: document.getElementById("analyticsAveragePayment"),

  // analytics lists
  paymentTypeList: document.getElementById("paymentTypeList"),
  appointmentStatusList: document.getElementById("appointmentStatusList"),

  // new patient analytics
  npScheduled: document.getElementById("npScheduled"),
  npShown: document.getElementById("npShown"),
  npCancelled: document.getElementById("npCancelled"),
  npNoShow: document.getElementById("npNoShow"),

  // existing patient analytics
  epScheduled: document.getElementById("epScheduled"),
  epShown: document.getElementById("epShown"),
  epCancelled: document.getElementById("epCancelled"),
  epNoShow: document.getElementById("epNoShow"),

  // insights
  dailySummary: document.getElementById("dailySummary"),
  npShowRate: document.getElementById("npShowRate"),
  epShowRate: document.getElementById("epShowRate"),
  missedAppointments: document.getElementById("missedAppointments"),

  // patient lookup
  patientAnalyticsSearch: document.getElementById("patientAnalyticsSearch"),
  btnPatientSearch: document.getElementById("btnPatientSearch"),
  patientSearchBody: document.getElementById("patientSearchBody"),
  patientDetailCard: document.getElementById("patientDetailCard"),
  patientDetailName: document.getElementById("patientDetailName"),
  patientDetailSub: document.getElementById("patientDetailSub"),
  patientTotalCollected: document.getElementById("patientTotalCollected"),
  patientPaymentCount: document.getElementById("patientPaymentCount"),
  patientBalance: document.getElementById("patientBalance"),
  patientInsuranceEstimate: document.getElementById("patientInsuranceEstimate"),
  patientLastPayment: document.getElementById("patientLastPayment"),
  patientLastPaymentMeta: document.getElementById("patientLastPaymentMeta"),
  patientNextAppointment: document.getElementById("patientNextAppointment"),
  patientNextAppointmentMeta: document.getElementById("patientNextAppointmentMeta"),
  patientPaymentsBody: document.getElementById("patientPaymentsBody"),
};

let cachedRows = [];
let uiWired = false;
let analyticsLoadedOnce = false;

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

function setAnalyticsStatus(text, mode = "") {
  if (!els.analyticsStatusText) return;
  els.analyticsStatusText.textContent = text;
  els.analyticsStatusText.classList.remove("ok", "err");
  if (mode) els.analyticsStatusText.classList.add(mode);
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

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTimeShort(dateTimeStr) {
  if (!dateTimeStr) return "—";
  const d = new Date(String(dateTimeStr).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(dateTimeStr);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------------- Number helpers ---------------- */

function money(n) {
  return Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function num(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function percent(n) {
  return `${Number(n || 0).toFixed(1).replace(".0", "")}%`;
}

function avg(total, count) {
  const c = Number(count || 0);
  if (!c) return 0;
  return Number(total || 0) / c;
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
    throw new Error("Unauthorized. Please log in again.");
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

/* ---------------- Dashboard table render ---------------- */

function renderTable(rows) {
  cachedRows = Array.isArray(rows) ? rows : [];

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
          r.patient_first,
          r.patient_last,
          r.patient_status,
          r.appointment_date,
          r.appointment_time,
          r.appointment_type,
          r.insurance,
          r.insurance_carrier,
          r.carrier,
          r.created_at,
          r.confirmation_id,
        ].map((x) => String(x || "").toLowerCase()).join(" ");

        return blob.includes(q);
      });

  if (!filtered.length) {
    els.bookingsBody.innerHTML = `<tr><td colspan="9" class="empty">No matching bookings.</td></tr>`;
    updateSelectionUI();
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
        <td>${escapeHtml(name || "—")}</td>
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
}

/* ---------------- Dashboard charts ---------------- */

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
  els.scheduledMeta.textContent = `${total} total booked in selected range`;

  if (lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Bookings",
        data: counts,
        borderColor: "#6f8f7a",
        backgroundColor: "rgba(111,143,122,.15)",
        pointBackgroundColor: "#6f8f7a",
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }],
    },
    options: chartOptions(false),
  });
}

function renderPieChart(newCount, returningCount) {
  const ctx = document.getElementById("pieChart");
  if (!ctx) return;

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
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function chartOptions(showLegend = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: showLegend },
    },
    scales: {
      x: {
        ticks: { autoSkip: true, maxTicksLimit: 10 },
        grid: { color: "rgba(0,0,0,.04)" },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: "rgba(0,0,0,.04)" },
      },
    },
  };
}

/* ---------------- Analytics charts ---------------- */

function renderCollectionsChart(dailyRows) {
  const ctx = document.getElementById("collectionsChart");
  if (!ctx) return;

  const rows = Array.isArray(dailyRows) ? dailyRows : [];
  const labels = rows.map((r) => r.date);
  const values = rows.map((r) => Number(r.amount || 0));

  if (collectionsChart) collectionsChart.destroy();

  collectionsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Collections",
        data: values,
        borderColor: "#6f8f7a",
        backgroundColor: "rgba(111,143,122,.15)",
        pointBackgroundColor: "#6f8f7a",
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }],
    },
    options: {
      ...chartOptions(false),
      scales: {
        x: {
          ticks: { autoSkip: true, maxTicksLimit: 10 },
          grid: { color: "rgba(0,0,0,.04)" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `$${Number(value).toLocaleString()}`,
          },
          grid: { color: "rgba(0,0,0,.04)" },
        },
      },
    },
  });
}

function renderSimplePie(canvasId, chartRefName, labels, values) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  if (chartRefName === "paymentTypeChart" && paymentTypeChart) paymentTypeChart.destroy();
  if (chartRefName === "appointmentStatusChart" && appointmentStatusChart) appointmentStatusChart.destroy();

  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#6f8f7a",
          "#2f7c9a",
          "#d98b86",
          "#ed9f64",
          "#c94c4c",
          "#9b8f7a",
          "#b8c6ad",
          "#9bb7c6",
        ],
        borderColor: "rgba(255,255,255,.9)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { display: false },
      },
    },
  });

  if (chartRefName === "paymentTypeChart") paymentTypeChart = chart;
  if (chartRefName === "appointmentStatusChart") appointmentStatusChart = chart;

  return chart;
}

function renderAttendanceChart(canvasId, chartRefName, summary) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartRefName === "newPatientChart" && newPatientChart) newPatientChart.destroy();
  if (chartRefName === "existingPatientChart" && existingPatientChart) existingPatientChart.destroy();

  const data = [
    Number(summary?.showed || 0),
    Number(summary?.stillScheduled || 0),
    Number(summary?.cancelledOrUnscheduled || 0),
    Number(summary?.noShow || 0),
    Number(summary?.other || 0),
  ];

  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Showed", "Still Scheduled", "Cancelled / Unscheduled", "No Show", "Other"],
      datasets: [{
        data,
        backgroundColor: ["#6f8f7a", "#2f7c9a", "#d98b86", "#c94c4c", "#9b8f7a"],
        borderColor: "rgba(255,255,255,.9)",
        borderWidth: 3,
      }],
    },
    options: {
  responsive: false,
  maintainAspectRatio: false,
  cutout: "64%",
  plugins: { legend: { display: false } },
},
  });

  if (chartRefName === "newPatientChart") newPatientChart = chart;
  if (chartRefName === "existingPatientChart") existingPatientChart = chart;
}

/* ---------------- Analytics render ---------------- */

function renderAnalyticsList(container, rows, opts = {}) {
  if (!container) return;

  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    container.innerHTML = `<div class="empty">${opts.empty || "No data found."}</div>`;
    return;
  }

  container.innerHTML = list.map((row) => {
    const label = escapeHtml(row.label || row.type || row.status || "Other");
    const value = opts.money ? money(row.value ?? row.amount ?? 0) : num(row.value ?? row.count ?? 0);

    return `
      <div class="analytics-list-row">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");
}

function renderAnalyticsSummary(data) {
  const collections = data.collections || {};
  const newPatients = data.newPatients || {};
  const existingPatients = data.existingPatients || {};
  const appointments = data.appointments || {};

  const selectedTotal = Number(collections.selectedRange || 0);
  const paymentCount = Number(collections.paymentCount || 0);

  els.dailyCollections.textContent = money(collections.today || 0);
  els.monthlyCollections.textContent = money(selectedTotal);
  els.analyticsPaymentCount.textContent = num(paymentCount);
  els.analyticsAveragePayment.textContent = money(avg(selectedTotal, paymentCount));

  if (els.selectedRangeLabel) {
    els.selectedRangeLabel.textContent =
      `${formatDateShort(data.range?.start)} through ${formatDateShort(data.range?.end)}`;
  }

  renderCollectionsChart(collections.daily || []);

  const paymentRows = (collections.byPayType || [])
    .map((r) => ({
      label: r.type || "Other",
      value: Number(r.amount || 0),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  renderSimplePie(
    "paymentTypeChart",
    "paymentTypeChart",
    paymentRows.map((r) => r.label),
    paymentRows.map((r) => Math.abs(Number(r.value || 0)))
  );

  renderAnalyticsList(els.paymentTypeList, paymentRows, {
    money: true,
    empty: "No payment type data found.",
  });

  const statusRows = (appointments.byStatus || [])
    .map((r) => ({
      label: r.status || "Unknown",
      value: Number(r.count || 0),
    }))
    .sort((a, b) => b.value - a.value);

  renderSimplePie(
    "appointmentStatusChart",
    "appointmentStatusChart",
    statusRows.map((r) => r.label),
    statusRows.map((r) => r.value)
  );

  renderAnalyticsList(els.appointmentStatusList, statusRows, {
    money: false,
    empty: "No appointment status data found.",
  });

  els.npScheduled.textContent = num(newPatients.scheduled || 0);
  els.npShown.textContent = num(newPatients.showed || 0);
  els.npCancelled.textContent = num(newPatients.cancelledOrUnscheduled || 0);
  els.npNoShow.textContent = num(newPatients.noShow || 0);

  els.epScheduled.textContent = num(existingPatients.scheduled || 0);
  els.epShown.textContent = num(existingPatients.showed || 0);
  els.epCancelled.textContent = num(existingPatients.cancelledOrUnscheduled || 0);
  els.epNoShow.textContent = num(existingPatients.noShow || 0);

  renderAttendanceChart("newPatientChart", "newPatientChart", newPatients);
  renderAttendanceChart("existingPatientChart", "existingPatientChart", existingPatients);

  const totalAppts = Number(appointments.total || 0);
  const missedTotal =
    Number(newPatients.cancelledOrUnscheduled || 0) +
    Number(newPatients.noShow || 0) +
    Number(existingPatients.cancelledOrUnscheduled || 0) +
    Number(existingPatients.noShow || 0);

  els.dailySummary.textContent = `${money(collections.today || 0)} today`;
  els.npShowRate.textContent = percent(newPatients.showRate || 0);
  els.epShowRate.textContent = percent(existingPatients.showRate || 0);
  els.missedAppointments.textContent = `${num(missedTotal)} of ${num(totalAppts)}`;

  analyticsLoadedOnce = true;
}

/* ---------------- Analytics load ---------------- */

async function loadAnalytics() {
  if (!els.analyticsStartDate || !els.analyticsEndDate) return;

  setAnalyticsStatus("Loading analytics…", "");

  try {
    const start = (els.analyticsStartDate.value || "").trim();
    const end = (els.analyticsEndDate.value || "").trim();

    const qs = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const data = await api(`/office/analytics/summary${qs}`);

    renderAnalyticsSummary(data);

    const stamp = new Date().toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    setAnalyticsStatus(`Analytics connected • refreshed ${stamp}`, "ok");
  } catch (e) {
    setAnalyticsStatus(String(e), "err");
  }
}

function applyAnalyticsRange(mode) {
  const t = todayYYYYMMDD();

  if (mode === "today") {
    els.analyticsStartDate.value = t;
    els.analyticsEndDate.value = t;
  } else if (mode === "mtd") {
    els.analyticsStartDate.value = monthStart(t);
    els.analyticsEndDate.value = t;
  } else {
    const days = Number(mode);
    if (Number.isFinite(days)) {
      els.analyticsEndDate.value = t;
      els.analyticsStartDate.value = addDays(t, -(days - 1));
    }
  }

  document.querySelectorAll(".analytics-pill").forEach((x) => {
    x.classList.toggle("active", x.dataset.analyticsRange === String(mode));
  });

  loadAnalytics();
}

/* ---------------- Patient search ---------------- */

async function searchPatients() {
  const q = (els.patientAnalyticsSearch?.value || "").trim();

  if (!q || q.length < 2) {
    els.patientSearchBody.innerHTML = `<tr><td colspan="5" class="empty">Type at least 2 characters to search.</td></tr>`;
    return;
  }

  els.patientSearchBody.innerHTML = `<tr class="loading-row"><td colspan="5">Searching patients…</td></tr>`;

  try {
    const data = await api(`/office/analytics/patient-search?q=${encodeURIComponent(q)}&limit=10`);
    const rows = data.results || [];

    if (!rows.length) {
      els.patientSearchBody.innerHTML = `<tr><td colspan="5" class="empty">No matching patients found.</td></tr>`;
      return;
    }

    els.patientSearchBody.innerHTML = rows.map((p) => `
      <tr>
        <td>${escapeHtml(p.name || "—")}</td>
        <td>${escapeHtml(String(p.patNum || "—"))}</td>
        <td>${escapeHtml(p.status || "—")}</td>
        <td class="${Number(p.balance || 0) > 0 ? "money-bad" : "money-good"}">${money(p.balance || 0)}</td>
        <td>
          <button
            class="btn patient-select-btn"
            type="button"
            data-pat-num="${escapeHtml(String(p.patNum || ""))}">
            View
          </button>
        </td>
      </tr>
    `).join("");

    els.patientSearchBody.querySelectorAll(".patient-select-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const patNum = btn.getAttribute("data-pat-num");
        if (patNum) loadPatientDetail(patNum);
      });
    });
  } catch (e) {
    els.patientSearchBody.innerHTML = `<tr><td colspan="5" class="empty">Patient search failed: ${escapeHtml(String(e))}</td></tr>`;
  }
}

async function loadPatientDetail(patNum) {
  if (!patNum) return;

  els.patientDetailCard.classList.remove("hidden");
  els.patientDetailName.textContent = "Loading patient details…";
  els.patientDetailSub.textContent = `PatNum ${patNum}`;

  try {
    const data = await api(`/office/analytics/patient?patNum=${encodeURIComponent(patNum)}`);
    const p = data.patient || {};

    els.patientDetailName.textContent = p.name || "Patient Details";
    els.patientDetailSub.textContent = `PatNum ${p.patNum || patNum} • ${p.status || "Patient"}`;

    els.patientTotalCollected.textContent = money(p.totalCollected || 0);
    els.patientPaymentCount.textContent = `${num(p.paymentCount || 0)} payments`;

    els.patientBalance.textContent = money(p.balance || 0);
    els.patientBalance.classList.toggle("money-bad", Number(p.balance || 0) > 0);
    els.patientBalance.classList.toggle("money-good", Number(p.balance || 0) <= 0);

    els.patientInsuranceEstimate.textContent = `Insurance estimate: ${money(p.estimatedInsurance || 0)}`;

    if (p.lastPayment) {
      els.patientLastPayment.textContent = money(p.lastPayment.amount || 0);
      els.patientLastPaymentMeta.textContent =
        `${formatDateShort(p.lastPayment.payDate || p.lastPayment.dateEntry)} • ${p.lastPayment.type || "Payment"}`;
    } else {
      els.patientLastPayment.textContent = "$0.00";
      els.patientLastPaymentMeta.textContent = "No payments found";
    }

    if (p.nextAppointment) {
      els.patientNextAppointment.textContent = formatDateTimeShort(p.nextAppointment.dateTime);
      els.patientNextAppointmentMeta.textContent =
        `${p.nextAppointment.status || "Scheduled"} • ${p.nextAppointment.description || "Appointment"}`;
    } else {
      els.patientNextAppointment.textContent = "—";
      els.patientNextAppointmentMeta.textContent = "No upcoming appointment found";
    }

    const payments = p.recentPayments || [];
    if (!payments.length) {
      els.patientPaymentsBody.innerHTML = `<tr><td colspan="4" class="empty">No recent payments found.</td></tr>`;
    } else {
      els.patientPaymentsBody.innerHTML = payments.map((pay) => `
        <tr>
          <td>${escapeHtml(formatDateShort(pay.payDate || pay.dateEntry))}</td>
          <td class="${Number(pay.amount || 0) < 0 ? "money-bad" : "money-good"}">${money(pay.amount || 0)}</td>
          <td>${escapeHtml(pay.type || "—")}</td>
          <td>${escapeHtml(pay.source || "—")}</td>
        </tr>
      `).join("");
    }
  } catch (e) {
    els.patientDetailName.textContent = "Patient lookup failed";
    els.patientDetailSub.textContent = String(e);
  }
}

/* ---------------- CSV export ---------------- */

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv() {
  const q = (els.searchInput.value || "").trim().toLowerCase();

  const rows = !q
    ? cachedRows
    : cachedRows.filter((r) => {
        const blob = [
          r.patient_first,
          r.patient_last,
          r.patient_status,
          r.appointment_date,
          r.appointment_time,
          r.appointment_type,
          r.insurance,
          r.insurance_carrier,
          r.carrier,
          r.created_at,
          r.confirmation_id,
        ].map((x) => String(x || "").toLowerCase()).join(" ");

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

  for (const r of rows) {
    const booked = String(r.created_at || "").slice(0, 10);
    const name = `${r.patient_first || ""} ${r.patient_last || ""}`.trim();
    const dob = String(r.patient_dob || r.dob || "").slice(0, 10) || "";
    const pStatus = String(r.patient_status || "");
    const apptDate = String(r.appointment_date || "");
    const apptTime = String(r.appointment_time || "");
    const type = apptTypeLabel(r.appointment_type);
    const ins = insuranceLabel(r);

    const vals = [
      booked,
      name,
      dob,
      pStatus,
      apptDate,
      apptTime,
      type,
      ins,
    ].map(csvEscape);

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

    const newCount = Number(analytics?.byStatus?.find?.((x) => x.key === "new")?.count || 0);
    const existingCount = Number(analytics?.byStatus?.find?.((x) => x.key === "existing")?.count || 0);

    renderPieChart(newCount, existingCount);
    setStatus("Connected", "ok");
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

  if (els.routeDashboard) {
    els.routeDashboard.classList.toggle("hidden", r !== "dashboard");
  }

  if (els.routeAnalytics) {
    els.routeAnalytics.classList.toggle("hidden", r !== "analytics");
  }

  setActiveNav(r);

  if (r === "analytics" && !analyticsLoadedOnce) {
    setTimeout(() => loadAnalytics(), 0);
  }

  if (window.innerWidth <= 900) closeSidebar();
}

function parseHashRoute() {
  const h = (location.hash || "").replace("#/", "").trim();
  if (h === "dashboard" || h === "analytics") return h;
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

  document.querySelectorAll(".analytics-pill").forEach((b) => {
    b.addEventListener("click", () => {
      applyAnalyticsRange(b.dataset.analyticsRange);
    });
  });

  els.btnRefresh?.addEventListener("click", () => loadAll());
  els.btnAnalyticsRefresh?.addEventListener("click", () => loadAnalytics());
  els.btnExport?.addEventListener("click", () => exportCsv());
  els.searchInput?.addEventListener("input", () => renderTable(cachedRows));
  els.btnDeleteSelected?.addEventListener("click", deleteSelected);

  els.btnPatientSearch?.addEventListener("click", searchPatients);
  els.patientAnalyticsSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchPatients();
  });

  const doLogout = () => {
    clearAuth();
    closeSidebar();
    location.hash = "#/dashboard";
    analyticsLoadedOnce = false;
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

    if (els.analyticsEndDate) els.analyticsEndDate.value = t;
    if (els.analyticsStartDate) els.analyticsStartDate.value = monthStart(t);

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

    if (els.analyticsEndDate) els.analyticsEndDate.value = t;
    if (els.analyticsStartDate) els.analyticsStartDate.value = monthStart(t);

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
