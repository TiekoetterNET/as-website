"use strict";

// Current year
function updateCurrentYear() {
    const currentdate = new Date();
    const cyear = document.getElementById("cyear");

    if (cyear) {
        cyear.textContent = `${currentdate.getFullYear()} `;
    }
}

updateCurrentYear();

// Helper: generate unique cache-busting request id
function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Helper: add cache buster to dynamic endpoints
function noCacheUrl(url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}rid=${encodeURIComponent(requestId())}`;
}

// Helper: avoid rendering empty fields as blank
function valueOrUnavailable(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return "Not available";
    }

    return String(value).trim();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Special ASN list
const specialAsns = new Set([
    "208694",
    "44354",
    "34927",
    "212895",
    "214675",
    "215828",
    "11967",
    "219235"
]);

function isSpecialAsn(asn) {
    if (asn === undefined || asn === null) {
        return false;
    }

    return specialAsns.has(String(asn).trim());
}

function renderAsn(asn) {
    const value = valueOrUnavailable(asn);
    const safeValue = escapeHtml(value);

    if (value !== "Not available" && isSpecialAsn(value)) {
        return `<span class="asn-highlight" title="Recognized network: AS${safeValue}" tabindex="0">${safeValue}</span>`;
    }

    return safeValue;
}

// Fetch AS208694 anycast connection status
fetch(noCacheUrl("https://connected-via.as.tiekoetter.net/"), {
    signal: AbortSignal.timeout(5000),
    cache: "no-store"
})
    .then(async response => {
        const statusBox = document.getElementById("connection-status");

        if (!statusBox) {
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.ok === true && typeof data.html === "string" && data.html.trim() !== "") {
            const parsedStatus = new DOMParser().parseFromString(data.html, "text/html");
            const statusText = parsedStatus.body.textContent.trim();
            const statusDot = document.createElement("span");
            statusDot.className = "status-dot";
            statusDot.setAttribute("aria-hidden", "true");
            statusBox.replaceChildren(statusDot, ` ${statusText || "Connected via AS208694"}`);
            statusBox.classList.add("connected");
            statusBox.classList.remove("not-connected");

            if (typeof data.node === "string" && data.node.trim() !== "") {
                statusBox.title = `Selected edge router: ${data.node}`;
            }

            return;
        }

        throw new Error("Invalid connection status response");
    })
    .catch(() => {
        const statusBox = document.getElementById("connection-status");

        if (!statusBox) {
            return;
        }

        statusBox.textContent = "AS208694 endpoint unreachable.";
        statusBox.classList.add("not-connected");
        statusBox.classList.remove("connected");
        statusBox.removeAttribute("title");
    });

// Shared function for IPv4 / IPv6 connection detail boxes
async function fetchConnectionDetails(url, elementId, ipLabel) {
    const detailsBox = document.getElementById(elementId);

    if (!detailsBox) {
        return;
    }

    try {
        const res = await fetch(noCacheUrl(url), {
            signal: AbortSignal.timeout(5000),
            cache: "no-store"
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const special = isSpecialAsn(data.asn);

        detailsBox.classList.toggle("special-asn", special);

        detailsBox.innerHTML = `<strong>Your ${ipLabel} connection details:</strong><br>
            ${ipLabel}: ${escapeHtml(valueOrUnavailable(data.ip))}<br>
            ASN: ${renderAsn(data.asn)}<br>
            Organisation: ${escapeHtml(valueOrUnavailable(data.org))}<br>
            Country: ${escapeHtml(valueOrUnavailable(data.country_code))}`;
    } catch {
        detailsBox.classList.remove("special-asn");
        detailsBox.textContent = `Unable to fetch ${ipLabel} connection details.`;
    }
}

// Fetch IPv4 connection details
fetchConnectionDetails(
    "https://v4.user-connection-info.as.tiekoetter.net/",
    "connection-details-v4",
    "IPv4"
);

// Fetch IPv6 connection details
fetchConnectionDetails(
    "https://v6.user-connection-info.as.tiekoetter.net/",
    "connection-details-v6",
    "IPv6"
);

async function loadTrafficTeaser() {
    const labelEl = document.getElementById("traffic-label");
    const valueEl = document.getElementById("traffic-value");

    if (!labelEl || !valueEl) return;

    try {
        const response = await fetch("https://data.luna.as.tiekoetter.net/assets/traffic/summary.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const completed = data.latest_completed_day;
        const current = data.current_day;

        if (completed && completed.human_total) {
            labelEl.textContent = `Latest completed day (${completed.date}):`;
            valueEl.textContent = completed.human_total;
        } else if (current && current.human_total) {
            labelEl.textContent = `Today so far (${current.date}):`;
            valueEl.textContent = current.human_total;
        } else {
            labelEl.textContent = "Traffic data:";
            valueEl.textContent = "unavailable";
        }

        if (data.freshness?.all_configured_sources_ok === false) {
            valueEl.title = "Some traffic sources were unavailable during the latest collection run.";
        }
    } catch {
        labelEl.textContent = "Traffic data:";
        valueEl.textContent = "unavailable";
        valueEl.title = "Could not load traffic statistics.";
    }
}

loadTrafficTeaser();
