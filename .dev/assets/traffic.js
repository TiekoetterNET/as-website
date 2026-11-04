"use strict";

const TRAFFIC_ENDPOINTS = {
    summary: "https://data.luna.as.tiekoetter.net/assets/traffic/summary.json",
    hourly: "https://data.luna.as.tiekoetter.net/assets/traffic/hourly.json",
    daily: "https://data.luna.as.tiekoetter.net/assets/traffic/daily.json",
    monthly: "https://data.luna.as.tiekoetter.net/assets/traffic/monthly.json",
    routers: "https://data.luna.as.tiekoetter.net/assets/traffic/routers.json"
};

function byId(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
}

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let value = Number(bytes || 0);

    for (const unit of units) {
        if (Math.abs(value) < 1000 || unit === units[units.length - 1]) {
            if (unit === "B") return `${Math.round(value)} ${unit}`;
            if (value >= 100) return `${value.toFixed(0)} ${unit}`;
            if (value >= 10) return `${value.toFixed(1)} ${unit}`;
            return `${value.toFixed(2)} ${unit}`;
        }
        value /= 1000;
    }

    return `${bytes} B`;
}

function formatTimestamp(ts) {
    if (!ts) return "unknown";

    const date = new Date(Number(ts) * 1000);
    return Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().replace(".000Z", "Z");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
}

function renderSummary(summary) {
    const completed = summary.latest_completed_day;
    const current = summary.current_day;
    const week = summary.last_7_completed_days;

    if (completed) {
        setText("primary-day-label", `Latest completed day (${completed.date})`);
        setText("primary-day-total", completed.human_total || formatBytes(completed.total_bytes));
        setText("primary-day-sub", `${completed.avg_mbps ?? "—"} Mbit/s average`);
    } else {
        setText("primary-day-label", "Latest completed day");
        setText("primary-day-total", "Not available yet");
        setText("primary-day-sub", "A completed day will appear after the first full collection day.");
    }

    if (current) {
        setText("today-total", current.human_total || formatBytes(current.total_bytes));
        setText("today-sub", `${current.date} · ${current.avg_mbps ?? "—"} Mbit/s average`);
    } else {
        setText("today-total", "—");
        setText("today-sub", "No current-day data.");
    }

    if (week) {
        setText("week-total", week.human_total || formatBytes(week.total_bytes));
        setText("week-sub", `${week.days} completed day${week.days === 1 ? "" : "s"} · ${week.avg_mbps ?? "—"} Mbit/s average`);
    }

    const freshness = summary.freshness;
    const status = byId("load-status");

    if (freshness && freshness.all_configured_sources_ok) {
        status.innerHTML = `
            <strong>Data fresh</strong><br>
            ${freshness.ok_sources}/${freshness.configured_sources} sources OK<br>
            <span class="muted">Generated ${escapeHtml(summary.generated_at)}</span>
        `;
        status.className = "info connected";
    } else {
        const ok = freshness?.ok_sources ?? 0;
        const total = freshness?.configured_sources ?? "?";

        status.innerHTML = `
            <strong>Partial data</strong><br>
            ${ok}/${total} sources OK<br>
            <span class="muted">Generated ${escapeHtml(summary.generated_at)}</span>
        `;
        status.className = "info not-connected";
    }

    setText("measurement-note", summary.measurement_note || "Traffic is aggregated from configured router interfaces.");

    if (summary.current_day_warning) {
        const note = byId("measurement-note");
        if (note) note.textContent += ` ${summary.current_day_warning}`;
    }
}

function renderSources(summary, routers) {
    const tbody = byId("sources-table");
    const routerMap = new Map((routers.routers || []).map(router => [router.router_id, router]));

    tbody.innerHTML = "";

    for (const source of summary.sources || []) {
        const router = routerMap.get(source.router_id);
        const label = router?.label || source.router_id;
        const status = Number(source.ok) === 1
            ? '<span class="source-ok">OK</span>'
            : '<span class="source-warn">Error</span>';

        const error = source.error
            ? `<br><span class="muted">${escapeHtml(source.error)}</span>`
            : "";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(label)}<br><span class="muted">${escapeHtml(source.router_id)}</span></td>
            <td>${status}${error}</td>
            <td>${escapeHtml(source.fetched_at || "unknown")}</td>
            <td>${escapeHtml(formatTimestamp(source.source_updated_timestamp))}</td>
        `;
        tbody.appendChild(row);
    }

    if (!tbody.children.length) {
        tbody.innerHTML = '<tr><td colspan="4">No source status available.</td></tr>';
    }
}

function renderInterfaces(daily) {
    const tbody = byId("interfaces-table");
    const rows = daily.interfaces || [];

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8">No interface data available.</td></tr>';
        return;
    }

    const latestDate = rows.reduce((max, row) => row.date > max ? row.date : max, rows[0].date);
    const latestRows = rows
        .filter(row => row.date === latestDate)
        .sort((a, b) => {
            if (a.router_id !== b.router_id) return a.router_id.localeCompare(b.router_id);
            return a.interface_name.localeCompare(b.interface_name);
        });

    tbody.innerHTML = "";

    for (const rowData of latestRows) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(rowData.date)}</td>
            <td>${escapeHtml(rowData.router_id)}</td>
            <td>${escapeHtml(rowData.label)}<br><span class="muted">${escapeHtml(rowData.interface_name)}</span></td>
            <td>${escapeHtml(rowData.category)}</td>
            <td>${formatBytes(rowData.rx_bytes)}</td>
            <td>${formatBytes(rowData.tx_bytes)}</td>
            <td><strong>${formatBytes(rowData.total_bytes)}</strong></td>
            <td>${Number(rowData.aggregate) === 1 ? "yes" : "no"}</td>
        `;
        tbody.appendChild(row);
    }
}

function renderMonthly(monthly) {
    const tbody = byId("monthly-table");
    const rows = (monthly.aggregate || []).slice(-12).reverse();

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4">No monthly aggregate data available.</td></tr>';
        return;
    }

    tbody.innerHTML = "";

    for (const rowData of rows) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(rowData.month)}</td>
            <td>${formatBytes(rowData.rx_bytes)}</td>
            <td>${formatBytes(rowData.tx_bytes)}</td>
            <td><strong>${formatBytes(rowData.total_bytes)}</strong></td>
        `;
        tbody.appendChild(row);
    }
}

function renderDailyChart(daily, todayLocal) {
    const svg = byId("daily-chart");
    const rows = (daily.aggregate || []).slice(-30);

    if (!rows.length) {
        svg.innerHTML = '<text x="20" y="40" class="chart-label">No daily aggregate data available.</text>';
        return;
    }

    const width = 900;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 72, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(...rows.map(row => Number(row.total_bytes || 0)), 1);
    const barGap = 4;
    const barWidth = Math.max(8, (chartWidth / rows.length) - barGap);

    const yTicks = 4;
    let parts = [];

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    for (let i = 0; i <= yTicks; i++) {
        const value = maxValue * (i / yTicks);
        const y = margin.top + chartHeight - (chartHeight * (i / yTicks));
        parts.push(`<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>`);
        parts.push(`<text class="chart-axis" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${formatBytes(value)}</text>`);
    }

    rows.forEach((row, index) => {
        const value = Number(row.total_bytes || 0);
        const x = margin.left + index * (chartWidth / rows.length);
        const barHeight = (value / maxValue) * chartHeight;
        const y = margin.top + chartHeight - barHeight;
        const isCurrent = row.date === todayLocal;
        const cls = isCurrent ? "chart-bar-current" : "chart-bar";

        parts.push(`
            <rect class="${cls}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3">
                <title>${escapeHtml(row.date)}: ${formatBytes(value)}</title>
            </rect>
        `);

        const showLabel = rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0 || index === rows.length - 1;
        if (showLabel) {
            const labelY = height - 44;
            parts.push(`<text class="chart-axis" x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" transform="rotate(-35 ${x + barWidth / 2} ${labelY})">${escapeHtml(row.date.slice(5))}</text>`);
        }
    });

    parts.push(`<text class="chart-label" x="${margin.left}" y="${height - 10}">Last ${rows.length} daily aggregate entries</text>`);
    svg.innerHTML = parts.join("");
}

function renderHourlyChart(hourly) {
    const svg = byId("hourly-chart");
    const rows = (hourly.aggregate || []).slice(-48);
    const now = Date.now() / 1000;

    if (!rows.length) {
        svg.innerHTML = '<text x="20" y="40" class="chart-label">No hourly aggregate data available.</text>';
        return;
    }

    const width = 900;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 86, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(...rows.map(row => Number(row.total_bytes || 0)), 1);
    const barGap = 3;
    const barWidth = Math.max(5, (chartWidth / rows.length) - barGap);

    const yTicks = 4;
    let parts = [];

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    for (let i = 0; i <= yTicks; i++) {
        const value = maxValue * (i / yTicks);
        const y = margin.top + chartHeight - (chartHeight * (i / yTicks));
        parts.push(`<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>`);
        parts.push(`<text class="chart-axis" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${formatBytes(value)}</text>`);
    }

    rows.forEach((row, index) => {
        const value = Number(row.total_bytes || 0);
        const x = margin.left + index * (chartWidth / rows.length);
        const barHeight = (value / maxValue) * chartHeight;
        const y = margin.top + chartHeight - barHeight;

        const date = String(row.date || "");
        const hour = String(row.hour ?? "0").padStart(2, "0");
        const label = `${date} ${hour}:00`;

        const startTs = Number(row.timestamp || 0);
        const endTs = startTs + 3600;
        const isCurrentHour = startTs <= now && now < endTs;
        const cls = isCurrentHour ? "chart-bar-current" : "chart-bar";

        parts.push(`
            <rect class="${cls}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2">
                <title>${escapeHtml(label)}: ${formatBytes(value)} · ${escapeHtml(row.avg_mbps ?? "—")} Mbit/s avg</title>
            </rect>
        `);

        const showLabel = rows.length <= 12 || index % 6 === 0 || index === rows.length - 1;
        if (showLabel) {
            const labelY = height - 48;
            parts.push(`<text class="chart-axis" x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" transform="rotate(-35 ${x + barWidth / 2} ${labelY})">${escapeHtml(date.slice(5))} ${escapeHtml(hour)}:00</text>`);
        }
    });

    parts.push(`<text class="chart-label" x="${margin.left}" y="${height - 10}">Last ${rows.length} hourly aggregate entries</text>`);
    svg.innerHTML = parts.join("");
}

async function loadDashboard() {
    try {
        const [summary, hourly, daily, monthly, routers] = await Promise.all([
            fetchJson(TRAFFIC_ENDPOINTS.summary),
            fetchJson(TRAFFIC_ENDPOINTS.hourly),
            fetchJson(TRAFFIC_ENDPOINTS.daily),
            fetchJson(TRAFFIC_ENDPOINTS.monthly),
            fetchJson(TRAFFIC_ENDPOINTS.routers)
        ]);

        renderSummary(summary);
        renderSources(summary, routers);
        renderInterfaces(daily);
        renderMonthly(monthly);
        renderHourlyChart(hourly);
        renderDailyChart(daily, summary.today_local || daily.today_local);
    } catch (error) {
        const status = byId("load-status");
        status.textContent = `Failed to load traffic statistics: ${error.message}`;
        status.className = "info not-connected";
    }
}

const year = byId("cyear");
if (year) year.textContent = `${new Date().getFullYear()} `;

loadDashboard();
