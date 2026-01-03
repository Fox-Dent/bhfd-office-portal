/**
 * BHFD Office Portal
 * - Calls Office API Worker:
 *    GET /office/bookings?start=YYYY-MM-DD&end=YYYY-MM-DD homologated to DATE BOOKED (created_at)
 *    GET /office/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * IMPORTANT:
 * - Set OFFICE_API_BASE to your Office API Worker URL.
 * - Login uses Basic Auth (prompt).
 * - Date range is based on DATE BOOKED (created_at), not appointment_date.
 */

const OFFICE_API_BASE = "https://foxdentofficeportal.calcifer6456.workers.dev"; // <-- your Office API Worker

let AUTH_HEADER = null;
let lineChart = null;
let pieChart = null;

const els = {
  btnLogin: document.getElementById("btnLogin"),
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

let cachedRows = []; // for search + CSV

function setStatus(text, mode = "") {
  els.statusText.textContent = text;
  els.statusText.classList.remove("ok", "err");
  if (mode) els.statusText.classList.add(mode);
}

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

function promptLogin() {
  const user = prompt("Office user:");
  const pass = prompt("Office password:");
  if (!user || !pass) return null;
  const token = btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}

async function api(path) {
  if (!AUTH_HEADER) {
    AUTH_HEADER = promptLogin();
    if (!AUTH_HEADER) throw new Error("Login cancelled.");
  }

  const res = await fetch(`${OFFICE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: AUTH_HEADER,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    AUTH_HEADER = null;
    throw new Error("Unauthorized (wrong credentials).");
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error((data && data.error) ? data.error : `API error (${res.status})`);
  }
  return data;
}

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

/**
 * TABLE: shows Date Booked from created_at (YYYY-MM-DD)
 */
function renderTable(rows) {
  cachedRows = Array.isArray(rows) ? rows : [];

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
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return blob.includes(q);
      });

  if (!filtered.length) {
    els.bookingsBody.innerHTML = `<tr><td colspan="8" class="empty">No matching bookings.</td></tr>`;
    return;
  }

  els.bookingsBody.innerHTML = filtered
    .map((r) => {
      const booked = String(r.created_at || "").slice(0, 10); // ✅ DATE BOOKED
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

/**
 * LINE CHART: counts bookings per day by DATE BOOKED (created_at)
 */
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
    const d = String(b.created_at || "").slice(0, 10); // ✅ DATE BOOKED
    if (!d || !idx.has(d)) continue;
    counts[idx.get(d)] += 1;
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
      datasets: [
        {
          label: "Bookings (Date Booked)",
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
  const totalNew = Number(newCount || 0);
  const totalRet = Number(returningCount || 0);
  els.newMeta.textContent = `${totalNew} new • ${totalRet} returning`;

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

async function loadAll() {
  setStatus("Loading…", "");
  try {
    const start = (els.startDate.value || "").trim();
    const end = (els.endDate.value || "").trim();
    const qs =
      start && end
        ? `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        : "";

    const [bookings, analytics] = await Promise.all([
      api(`/office/bookings${(qs ? qs + "&" : "?")}limit=250`),
      api(`/office/analytics${qs}`),
    ]);

    // Table
    renderTable(bookings.results || []);

    // Line chart (date booked)
    const series = buildLineSeries(bookings.results || [], start || null, end || null);
    renderLineChart(series.labels, series.counts);

    // Pie (status breakdown in the same filtered range)
    const newCount = Number(analytics?.byStatus?.find?.((x) => x.key === "new")?.count || 0);
    const existingCount = Number(
      analytics?.byStatus?.find?.((x) => x.key === "existing")?.count || 0
    );
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

/* ---------- Events ---------- */
els.btnLogin.addEventListener("click", () => {
  AUTH_HEADER = null;
  setStatus("Not connected", "");
  loadAll();
});

els.btnRefresh.addEventListener("click", () => loadAll());
els.btnExport.addEventListener("click", () => exportCsv());
els.searchInput.addEventListener("input", () => renderTable(cachedRows));

document.querySelectorAll(".pill").forEach((b) => {
  b.addEventListener("click", () => applyRange(b.dataset.range));
});

/* ---------- Default dates ---------- */
(function init() {
  const t = todayYYYYMMDD();
  els.endDate.value = t;
  els.startDate.value = addDays(t, -29); // default last 30
})();
