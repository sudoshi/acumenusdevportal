const state = {
  graphs: [],
  screenshots: null,
  referenceManifest: null,
  referenceDocs: [],
  schemaSpy: null,
  assetHealth: [],
  globalSearch: "",
  graphSearch: "",
  graphCategory: "all",
  graphSort: "title",
  screenshotSearch: "",
  screenshotGroup: "all",
  screenshotLocale: "all",
  screenshotTheme: "all",
  referenceSearch: "",
  referenceGroup: "all",
  referenceTag: "all",
  referenceCriticality: "all",
  referenceSourceArea: "all",
  referenceStatus: "all",
  referencePreviewCache: new Map(),
  lastFocusedElement: null,
  filteredGraphs: [],
  filteredScreenshots: [],
  filteredReference: [],
  screenshotModalIndex: -1,
  referenceModalIndex: -1,
  screenshotZoom: localStorage.getItem("parthenon-zoom") || "fit",
  themeMode: localStorage.getItem("parthenon-theme") || "system",
  urlSyncing: false,
  keyboardSequence: null,
  keyboardSequenceTimer: null,
  buildInfo: null,
  buildInfoSeenAt: null,
  buildInfoLatestSeen: null,
  buildPollHandle: null,
};

const FILTER_KEYS = {
  graphs: ["graphSearch", "graphCategory", "graphSort"],
  screenshots: ["screenshotSearch", "screenshotGroup", "screenshotLocale", "screenshotTheme"],
  reference: ["referenceSearch", "referenceGroup", "referenceTag", "referenceCriticality", "referenceSourceArea", "referenceStatus"],
};

const FILTER_DEFAULTS = {
  graphSearch: "",
  graphCategory: "all",
  graphSort: "title",
  screenshotSearch: "",
  screenshotGroup: "all",
  screenshotLocale: "all",
  screenshotTheme: "all",
  referenceSearch: "",
  referenceGroup: "all",
  referenceTag: "all",
  referenceCriticality: "all",
  referenceSourceArea: "all",
  referenceStatus: "all",
};

const FILTER_LABELS = {
  graphSearch: "search",
  graphCategory: "category",
  graphSort: "sort",
  screenshotSearch: "search",
  screenshotGroup: "group",
  screenshotLocale: "locale",
  screenshotTheme: "theme",
  referenceSearch: "search",
  referenceGroup: "group",
  referenceTag: "tag",
  referenceCriticality: "criticality",
  referenceSourceArea: "source area",
  referenceStatus: "status",
};

const ASSET_HEALTH_BY_TAB = {
  graphs: "graph-catalog",
  database: "schemaspy-manifest",
  screenshots: "screenshot-manifest",
  reference: "reference-manifest",
};

const runtimeLinks = [
  ["Live app", "https://parthenon.acumenus.net/"],
  ["Documentation", "https://parthenon.acumenus.net/docs/"],
  ["API docs", "https://parthenon.acumenus.net/docs/api"],
  ["Jobs dashboard", "https://parthenon.acumenus.net/jobs"],
  ["Public installer", "https://parthenon.acumenus.net/install/"],
];

const localAssets = [
  { id: "portal", title: "Portal HTML", href: "/", kind: "html", group: "Shell" },
  { id: "styles", title: "Stylesheet", href: "/assets/styles.css", kind: "css", group: "Shell" },
  { id: "app", title: "Landing JavaScript", href: "/assets/app.js", kind: "js", group: "Shell" },
  { id: "graph-catalog", title: "Graphify catalog", href: "/graphify/catalog.json", kind: "json", group: "Graphify" },
  { id: "graphify-index", title: "Graphify index", href: "/graphify/", kind: "html", group: "Graphify" },
  { id: "screenshot-manifest", title: "Screenshot manifest", href: "/screenshots/application-library/manifest.json", kind: "json", group: "Evidence" },
  { id: "screenshot-catalogue", title: "Screenshot catalogue", href: "/screenshots/application-library/", kind: "html", group: "Evidence" },
  { id: "reference-manifest", title: "Reference manifest", href: "/reference/manifest.json", kind: "json", group: "Reference" },
  { id: "reference-readme", title: "Reference README", href: "/reference/README.md", kind: "markdown", group: "Reference" },
  { id: "schemaspy-manifest", title: "Database manifest", href: "/schemaspy/manifest.json", kind: "json", group: "Database" },
  { id: "schemaspy-index", title: "SchemaSpy index", href: "/schemaspy/", kind: "html", group: "Database" },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || size >= 100 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unit]}`;
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function setText(selector, value) {
  const element = $(selector);
  if (element) {
    element.textContent = value;
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function formatShortDateTime(value) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAsset(id) {
  return state.assetHealth.find((asset) => asset.id === id);
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diffMs = Date.now() - then;
  if (diffMs < 0) {
    return "just now";
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function isStale(value, days = 30) {
  if (!value) return false;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return false;
  return (Date.now() - then) > days * 24 * 60 * 60 * 1000;
}

function freshnessBadge(value) {
  if (!value) return "";
  const text = formatRelativeTime(value);
  if (!text) return "";
  const stale = isStale(value);
  return `<span class="freshness ${stale ? "stale" : ""}" title="${escapeAttribute(formatDateTime(value))}">${escapeHtml(text)}</span>`;
}

function timestampForGraph(graph) {
  return graph?.generatedAt || graph?.lastModified || null;
}

function timestampForScreenshot(entry) {
  return entry?.capturedAt || null;
}

function timestampForReference(doc) {
  return doc?.generatedAt || doc?.sourceLastModified || null;
}

function parseUrlHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) {
    return { tab: "overview", filters: new URLSearchParams() };
  }
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) {
    return { tab: raw, filters: new URLSearchParams() };
  }
  return {
    tab: raw.slice(0, queryIndex),
    filters: new URLSearchParams(raw.slice(queryIndex + 1)),
  };
}

function buildUrlHash(tabName, filters) {
  const params = new URLSearchParams();
  const keys = FILTER_KEYS[tabName] || [];
  for (const key of keys) {
    const value = filters?.[key] ?? state[key];
    if (value !== undefined && value !== null && value !== "" && value !== FILTER_DEFAULTS[key]) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `#${tabName}?${query}` : `#${tabName}`;
}

function syncUrl({ replace = true } = {}) {
  if (state.urlSyncing) return;
  const { tab } = parseUrlHash();
  const currentTab = isValidTab(tab) ? tab : "overview";
  const newHash = buildUrlHash(currentTab);
  if (location.hash !== newHash) {
    if (replace) {
      history.replaceState({ tab: currentTab }, "", newHash);
    } else {
      history.pushState({ tab: currentTab }, "", newHash);
    }
  }
}

function applyFiltersFromUrl() {
  state.urlSyncing = true;
  try {
    const { tab, filters } = parseUrlHash();
    const keys = FILTER_KEYS[tab] || [];
    for (const key of keys) {
      const value = filters.get(key);
      if (value !== null) {
        state[key] = value;
      }
    }
    syncFilterInputsToState();
  } finally {
    state.urlSyncing = false;
  }
}

function syncFilterInputsToState() {
  const map = {
    "#graph-search": "graphSearch",
    "#graph-category": "graphCategory",
    "#graph-sort": "graphSort",
    "#screenshot-search": "screenshotSearch",
    "#screenshot-group": "screenshotGroup",
    "#screenshot-locale": "screenshotLocale",
    "#screenshot-theme": "screenshotTheme",
    "#reference-search": "referenceSearch",
    "#reference-group": "referenceGroup",
    "#reference-tag": "referenceTag",
    "#reference-criticality": "referenceCriticality",
    "#reference-source-area": "referenceSourceArea",
    "#reference-status": "referenceStatus",
  };
  for (const [selector, key] of Object.entries(map)) {
    const el = $(selector);
    if (el && el.value !== state[key]) {
      el.value = state[key];
    }
  }
}

function resetPanelFilters(panelId) {
  const keys = FILTER_KEYS[panelId] || [];
  for (const key of keys) {
    state[key] = FILTER_DEFAULTS[key];
  }
  syncFilterInputsToState();
  if (panelId === "graphs") renderGraphs();
  else if (panelId === "screenshots") renderScreenshots();
  else if (panelId === "reference") renderReference();
  syncUrl();
}

function resetSingleFilter(key) {
  state[key] = FILTER_DEFAULTS[key];
  syncFilterInputsToState();
  if (FILTER_KEYS.graphs.includes(key)) renderGraphs();
  else if (FILTER_KEYS.screenshots.includes(key)) renderScreenshots();
  else if (FILTER_KEYS.reference.includes(key)) renderReference();
  syncUrl();
}

function renderFilterChips(panelId) {
  const container = document.querySelector(`[data-panel-chips="${panelId}"]`);
  if (!container) return;
  const keys = FILTER_KEYS[panelId] || [];
  const active = keys.filter((key) => state[key] !== FILTER_DEFAULTS[key] && state[key] !== "");
  if (!active.length) {
    container.innerHTML = "";
    return;
  }
  const chips = active.map((key) => {
    const value = state[key];
    const label = FILTER_LABELS[key] || key;
    return `<span class="filter-chip"><span class="filter-chip-key">${escapeHtml(label)}:</span>${escapeHtml(value)}<button type="button" class="filter-chip-remove" data-clear-filter="${escapeAttribute(key)}" aria-label="Remove ${escapeAttribute(label)} filter">×</button></span>`;
  }).join("");
  container.innerHTML = `${chips}<button type="button" class="filter-chip-clear" data-clear-panel="${escapeAttribute(panelId)}">Clear all</button>`;
}

function setResultCount(panelId, shown, total) {
  const el = $(`#${panelId}-result-count`);
  if (!el) return;
  if (shown === total) {
    el.textContent = total === 0 ? "No matches" : `${formatNumber(total)} ${total === 1 ? "result" : "results"}`;
  } else {
    el.textContent = `${formatNumber(shown)} of ${formatNumber(total)} shown`;
  }
}

async function checkAsset(asset) {
  const startedAt = performance.now();
  try {
    const response = await fetch(asset.href, { cache: "no-store" });
    const elapsedMs = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get("content-type") || "unknown";
    const lastModified = response.headers.get("last-modified") || "";
    const contentLength = response.headers.get("content-length") || "";
    let data = null;
    let ok = response.ok;
    let message = `${response.status} ${contentType}`;

    if (response.ok && asset.kind === "json") {
      try {
        data = await response.clone().json();
      } catch (error) {
        ok = false;
        message = `JSON parse failed: ${error.message}`;
      }
    }

    return {
      ...asset,
      ok,
      statusCode: response.status,
      contentType,
      contentLength,
      lastModified,
      elapsedMs,
      data,
      message,
    };
  } catch (error) {
    return {
      ...asset,
      ok: false,
      statusCode: 0,
      contentType: "",
      contentLength: "",
      lastModified: "",
      elapsedMs: Math.round(performance.now() - startedAt),
      data: null,
      message: error.message,
    };
  }
}

function markAssetBlocked(id, message) {
  const asset = getAsset(id);
  if (asset) {
    asset.ok = false;
    asset.message = message;
  }
}

function applyLoadedData() {
  const graphCatalog = getAsset("graph-catalog");
  if (Array.isArray(graphCatalog?.data)) {
    state.graphs = graphCatalog.data;
    graphCatalog.countLabel = `${formatNumber(state.graphs.length)} graph views`;
  } else {
    state.graphs = [];
    markAssetBlocked("graph-catalog", "Catalog JSON did not contain a graph array.");
  }

  const screenshotManifest = getAsset("screenshot-manifest");
  if (screenshotManifest?.data && Array.isArray(screenshotManifest.data.entries)) {
    state.screenshots = screenshotManifest.data;
    screenshotManifest.generatedAt = screenshotManifest.data.generatedAt;
    screenshotManifest.countLabel = `${formatNumber(screenshotManifest.data.entries.length)} screenshots`;
  } else {
    state.screenshots = null;
    markAssetBlocked("screenshot-manifest", "Manifest JSON did not contain screenshot entries.");
  }

  const referenceManifest = getAsset("reference-manifest");
  if (referenceManifest?.data && Array.isArray(referenceManifest.data.entries)) {
    state.referenceManifest = referenceManifest.data;
    state.referenceDocs = referenceManifest.data.entries;
    referenceManifest.generatedAt = referenceManifest.data.generatedAt;
    referenceManifest.countLabel = `${formatNumber(referenceManifest.data.entries.length)} reference assets`;
  } else {
    state.referenceManifest = null;
    state.referenceDocs = [];
    markAssetBlocked("reference-manifest", "Reference manifest JSON did not contain entries.");
  }

  const schemaSpyManifest = getAsset("schemaspy-manifest");
  if (schemaSpyManifest?.data && Array.isArray(schemaSpyManifest.data.schemas)) {
    state.schemaSpy = schemaSpyManifest.data;
    schemaSpyManifest.generatedAt = schemaSpyManifest.data.generatedAt;
    schemaSpyManifest.countLabel = `${formatNumber(schemaSpyManifest.data.tableCount)} tables / ${schemaSpyManifest.data.totalSize}`;
  } else {
    state.schemaSpy = null;
    markAssetBlocked("schemaspy-manifest", "SchemaSpy manifest JSON did not contain schemas.");
  }
}

function setOptions(select, values, current = "all") {
  if (!select) {
    return;
  }
  const options = ["all", ...values].map((value) => {
    const label = value === "all" ? "All" : value;
    return `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`;
  });
  select.innerHTML = options.join("");
  select.value = current;
}

const TAB_LABELS = {
  overview: "Overview",
  graphs: "Graphs",
  database: "Database",
  screenshots: "Screenshots",
  reference: "Reference",
};

function updateBreadcrumb(tabName) {
  const current = document.getElementById("breadcrumb-current");
  if (!current) {
    return;
  }
  const label = TAB_LABELS[tabName];
  if (!label || tabName === "overview") {
    current.textContent = "";
    current.hidden = true;
  } else {
    current.textContent = label;
    current.hidden = false;
  }
}

function activateTab(tabName, options = {}) {
  // Close any open modal before switching tabs so the user doesn't end
  // up on a different panel hidden behind a stale modal. Each close fn
  // is a no-op if its modal is already hidden, so calling all three is
  // safe and idempotent.
  closeScreenshotModal();
  closeReferenceModal();
  closeHelpModal();
  $$(".tab").forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });
  $$(".panel").forEach((panel) => {
    const isActive = panel.id === tabName;
    panel.classList.toggle("active", isActive);
    if (isActive) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });
  updateBreadcrumb(tabName);
  const targetHash = buildUrlHash(tabName);
  if (options.replace) {
    history.replaceState({ tab: tabName }, "", targetHash);
  } else if (location.hash !== targetHash) {
    history.pushState({ tab: tabName }, "", targetHash);
  }
  if (options.focus) {
    document.getElementById(`tab-${tabName}`)?.focus();
  }
  if (options.scroll !== false) {
    const scrollToPanel = () => $(`#${tabName}`)?.scrollIntoView({ block: "start" });
    scrollToPanel();
    requestAnimationFrame(scrollToPanel);
    window.setTimeout(scrollToPanel, 100);
  }
}

function isValidTab(name) {
  return Object.prototype.hasOwnProperty.call(TAB_LABELS, name);
}

function graphMatches(graph) {
  const term = normalize(state.graphSearch);
  const haystack = normalize([
    graph.title,
    graph.category,
    graph.description,
    ...(graph.paths || []),
  ].join(" "));
  const categoryMatches = state.graphCategory === "all" || graph.category === state.graphCategory;
  return categoryMatches && (!term || haystack.includes(term));
}

function screenshotMatches(entry) {
  const term = normalize(state.screenshotSearch);
  const haystack = normalize([entry.group, entry.label, entry.route, entry.locale, entry.theme].join(" "));
  const groupMatches = state.screenshotGroup === "all" || entry.group === state.screenshotGroup;
  const localeMatches = state.screenshotLocale === "all" || entry.locale === state.screenshotLocale;
  const themeMatches = state.screenshotTheme === "all" || entry.theme === state.screenshotTheme;
  return groupMatches && localeMatches && themeMatches && (!term || haystack.includes(term));
}

function graphSort(a, b) {
  if (state.graphSort === "nodes" || state.graphSort === "edges" || state.graphSort === "communities") {
    return (b[state.graphSort] || 0) - (a[state.graphSort] || 0);
  }
  return String(a.title).localeCompare(String(b.title));
}

function renderStats() {
  const manifest = state.screenshots || {};
  setText("#graph-count", formatNumber(state.graphs.length));
  setText("#screenshot-count", formatNumber(manifest.screenshotCount || manifest.entries?.length));
  setText("#route-count", formatNumber(manifest.routeCount));
  setText("#locale-count", formatNumber(manifest.locales?.length));
  setText("#schema-count", formatNumber(state.schemaSpy?.schemaCount));

  const generatedAt = manifest.generatedAt
    ? new Date(manifest.generatedAt).toLocaleString()
    : "metadata unavailable";
  setText("#last-updated", `Screenshot manifest generated ${generatedAt}`);
}

function renderRuntimeLinks() {
  const container = $("#runtime-links");
  if (!container) {
    return;
  }
  container.innerHTML = runtimeLinks
    .map(([label, href]) => `<a href="${escapeAttribute(href)}" class="button secondary external" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    .join("");
}

function graphCard(graph) {
  const htmlLink = graph.has_html ? `/graphify/${graph.slug}/graph.html` : `/graphify/${graph.slug}/`;
  const reportLink = `/graphify/${graph.slug}/GRAPH_REPORT.md`;
  const graphmlLink = `/graphify/${graph.slug}/graph.graphml`;
  const paths = (graph.paths || []).slice(0, 3);
  const hasIssue = graph.status && graph.status !== "ok";
  const fresh = freshnessBadge(timestampForGraph(graph));
  return `
    <article class="graph-card ${hasIssue ? "is-blocked" : ""}">
      <div>
        <p class="card-kicker">${escapeHtml(graph.category || "Graph")}</p>
        <h3>${escapeHtml(graph.title)}</h3>
        <p>${escapeHtml(graph.description || "Graphify architecture view.")}</p>
        <div class="meta-row">
          <span class="pill">${formatNumber(graph.nodes)} nodes</span>
          <span class="pill">${formatNumber(graph.edges)} edges</span>
          <span class="pill">${formatNumber(graph.communities)} communities</span>
          ${hasIssue ? `<span class="pill danger">${escapeHtml(graph.status)}</span>` : ""}
          ${fresh}
        </div>
        ${paths.length ? `
          <ul class="path-list" aria-label="Representative source paths">
            ${paths.map((path) => `<li>${escapeHtml(path)}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
      <div class="card-actions">
        <a href="${escapeAttribute(htmlLink)}">Interactive graph</a>
        <a href="${escapeAttribute(reportLink)}">Report</a>
        ${graph.has_graphml ? `<a href="${escapeAttribute(graphmlLink)}">GraphML</a>` : ""}
      </div>
    </article>
  `;
}

function renderGraphs() {
  const container = $("#graph-results");
  if (!container) {
    return;
  }
  const results = state.graphs.filter(graphMatches).sort(graphSort);
  state.filteredGraphs = results;
  setResultCount("graph", results.length, state.graphs.length);
  renderFilterChips("graphs");
  container.innerHTML = results.length
    ? results.map(graphCard).join("")
    : `<div class="empty-state">No graph views match the current filters. <button type="button" class="filter-chip-clear" data-clear-panel="graphs">Clear filters</button></div>`;
}

function screenshotCard(entry, compact = false) {
  const imageHref = `/screenshots/application-library/${entry.file}`;
  const catalogueHref = `/screenshots/application-library/#${entry.locale}-${entry.theme}-${entry.label}`;
  const fresh = compact ? "" : freshnessBadge(timestampForScreenshot(entry));
  return `
    <article class="${compact ? "preview-card" : "shot-card"}">
      <a href="${escapeAttribute(imageHref)}" data-shot-preview="${escapeAttribute(entry.file)}" aria-label="Preview ${escapeAttribute(entry.label)} screenshot">
        <img src="${escapeAttribute(imageHref)}" loading="lazy" decoding="async" alt="${escapeAttribute(entry.label)} screenshot in ${escapeAttribute(entry.locale)} ${escapeAttribute(entry.theme)}">
      </a>
      <a href="${escapeAttribute(catalogueHref)}">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(entry.group)} / ${escapeHtml(entry.locale)} / ${escapeHtml(entry.theme)}</span>
        ${fresh}
      </a>
    </article>
  `;
}

function renderScreenshots() {
  const container = $("#screenshot-results");
  if (!container) {
    return;
  }
  const entries = state.screenshots?.entries || [];
  const filtered = entries.filter(screenshotMatches);
  state.filteredScreenshots = filtered;
  const visible = filtered.slice(0, 96);
  const note = $("#screenshot-result-count");
  if (note) {
    if (filtered.length === entries.length) {
      note.textContent = filtered.length > 96
        ? `${formatNumber(filtered.length)} screenshots (showing first 96)`
        : `${formatNumber(filtered.length)} ${filtered.length === 1 ? "screenshot" : "screenshots"}`;
    } else {
      note.textContent = filtered.length > 96
        ? `${formatNumber(filtered.length)} of ${formatNumber(entries.length)} match (showing first 96)`
        : filtered.length === 0
          ? "No matches"
          : `${formatNumber(filtered.length)} of ${formatNumber(entries.length)} shown`;
    }
  }
  renderFilterChips("screenshots");
  container.innerHTML = visible.length
    ? visible.map((entry) => screenshotCard(entry)).join("")
    : `<div class="empty-state">No screenshots match the current filters. <button type="button" class="filter-chip-clear" data-clear-panel="screenshots">Clear filters</button></div>`;
}

function renderOverview() {
  const entries = state.screenshots?.entries || [];
  const preferred = entries
    .filter((entry) => entry.locale === "en-US" && entry.theme === "light")
    .filter((entry) => ["dashboard", "publish", "studies", "jobs"].includes(entry.label))
    .slice(0, 4);
  const overviewScreenshots = $("#overview-screenshots");
  if (overviewScreenshots) {
    overviewScreenshots.innerHTML = preferred.length
      ? preferred.map((entry) => screenshotCard(entry, true)).join("")
      : `<div class="empty-state">Screenshot previews will appear after the manifest loads.</div>`;
  }

  const important = state.graphs
    .filter((graph) => ["study-designer", "study-lifecycle", "publish-export-full", "auth-and-sso", "ingestion-etl"].includes(graph.slug))
    .sort((a, b) => (b.nodes || 0) - (a.nodes || 0))
    .slice(0, 6);
  const overviewGraphs = $("#overview-graphs");
  if (overviewGraphs) {
    overviewGraphs.innerHTML = important.length
      ? important.map((graph) => `
          <a href="/graphify/${escapeAttribute(graph.slug)}/graph.html">
            <strong>${escapeHtml(graph.title)}</strong>
            <span>${formatNumber(graph.nodes)} nodes / ${formatNumber(graph.edges)} edges</span>
          </a>
        `).join("")
      : `<div class="empty-state">Graph previews will appear after the catalog loads.</div>`;
  }
}

function renderRecentCaptures() {
  const container = $("#recent-captures");
  if (!container) {
    return;
  }
  const entries = (state.screenshots?.entries || [])
    .filter((entry) => entry.capturedAt)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    .slice(0, 6);

  container.innerHTML = entries.length
    ? entries.map((entry) => `
        <button class="timeline-item" type="button" data-shot-preview="${escapeAttribute(entry.file)}">
          <span>
            <strong>${escapeHtml(entry.label)}</strong>
            <small>${escapeHtml(entry.group)} / ${escapeHtml(entry.locale)} / ${escapeHtml(entry.theme)}</small>
          </span>
          <time>${escapeHtml(formatShortDateTime(entry.capturedAt))}</time>
        </button>
      `).join("")
    : `<div class="empty-state">Recent captures will appear after the screenshot manifest loads.</div>`;
}

function referenceMatches(doc) {
  const term = normalize(state.referenceSearch);
  const haystack = normalize([
    doc.title,
    doc.group,
    doc.summary,
    doc.sourcePath,
    doc.sourceArea,
    doc.criticality,
    doc.status,
    doc.freshness,
    ...(doc.tags || []),
  ].join(" "));
  const groupMatches = state.referenceGroup === "all" || doc.group === state.referenceGroup;
  const tagMatches = state.referenceTag === "all" || (doc.tags || []).includes(state.referenceTag);
  const criticalityMatches = state.referenceCriticality === "all" || doc.criticality === state.referenceCriticality;
  const sourceAreaMatches = state.referenceSourceArea === "all" || doc.sourceArea === state.referenceSourceArea;
  const statusMatches = state.referenceStatus === "all" || doc.status === state.referenceStatus || doc.freshness === state.referenceStatus;
  return groupMatches && tagMatches && criticalityMatches && sourceAreaMatches && statusMatches && (!term || haystack.includes(term));
}

function referenceStatusClass(doc) {
  if (doc.status === "Missing" || doc.status === "Stale") {
    return "blocked";
  }
  if (doc.freshness === "Review") {
    return "review";
  }
  return "ready";
}

function graphHref(slug) {
  return `/graphify/${slug}/graph.html`;
}

function screenshotHref(label) {
  return `/screenshots/application-library/#${encodeURIComponent(label)}`;
}

function liveHref(route) {
  return `https://parthenon.acumenus.net${route.startsWith("/") ? route : `/${route}`}`;
}

function referenceCard(doc) {
  const related = [
    ...(doc.relatedGraphs || []).slice(0, 2).map((slug) => `<a href="${escapeAttribute(graphHref(slug))}">Graph: ${escapeHtml(slug)}</a>`),
    ...(doc.relatedScreenshots || []).slice(0, 2).map((label) => `<a href="${escapeAttribute(screenshotHref(label))}">Shot: ${escapeHtml(label)}</a>`),
    ...(doc.liveRoutes || []).slice(0, 2).map((route) => `<a href="${escapeAttribute(liveHref(route))}">Live: ${escapeHtml(route)}</a>`),
  ];
  const badges = [
    doc.criticality,
    doc.freshness,
    doc.generated ? "Generated" : doc.sourceArea,
  ].filter(Boolean);

  const fresh = freshnessBadge(timestampForReference(doc));
  return `
    <article class="doc-card reference-card ${referenceStatusClass(doc)}">
      <div>
        <div class="reference-card-topline">
          <p class="card-kicker">${escapeHtml(doc.group || "Reference")}</p>
          <span class="reference-status">${escapeHtml(doc.status || "Unknown")}</span>
        </div>
        <h3>${escapeHtml(doc.title)}</h3>
        <p>${escapeHtml(doc.summary)}</p>
        <div class="meta-row">
          ${badges.map((badge) => `<span class="pill ${badge === "Critical" ? "danger" : ""}">${escapeHtml(badge)}</span>`).join("")}
          <span class="pill">${escapeHtml(formatBytes(doc.sizeBytes))}</span>
          ${fresh}
        </div>
        <div class="reference-source">
          <span>${escapeHtml(doc.sourcePath)}</span>
          <small>${escapeHtml(doc.tags?.slice(0, 5).join(" / ") || "untagged")}</small>
        </div>
        ${related.length ? `<div class="related-links">${related.join("")}</div>` : ""}
      </div>
      <div class="card-actions">
        <button type="button" data-reference-preview="${escapeAttribute(doc.id)}">Preview</button>
        <a href="${escapeAttribute(doc.href)}">Raw asset</a>
      </div>
    </article>
  `;
}

function renderReferenceSummary(results) {
  const summary = $("#reference-summary");
  if (!summary) {
    return;
  }
  const manifest = state.referenceManifest;
  if (!manifest) {
    summary.innerHTML = `<span>Reference metadata unavailable</span>`;
    return;
  }
  summary.innerHTML = `
    <span>${formatNumber(results.length)} shown</span>
    <span>${formatNumber(manifest.count)} total</span>
    <span>${formatNumber(manifest.readyCount)} ready</span>
    <span>${formatNumber(manifest.reviewCount)} review</span>
    <span>Generated ${escapeHtml(formatShortDateTime(manifest.generatedAt))}</span>
  `;
}

function renderReference() {
  const container = $("#reference-results");
  if (!container) {
    return;
  }
  const results = state.referenceDocs.filter(referenceMatches);
  state.filteredReference = results;
  renderReferenceSummary(results);
  setResultCount("reference", results.length, state.referenceDocs.length);
  renderFilterChips("reference");
  container.innerHTML = results.length
    ? results.map(referenceCard).join("")
    : `<div class="empty-state">No reference assets match the current filters. <button type="button" class="filter-chip-clear" data-clear-panel="reference">Clear filters</button></div>`;
}

function schemaCard(schema) {
  const topRelations = (schema.topRelations || []).slice(0, 4)
    .map((relation) => `
      <li>
        <a href="${escapeAttribute(relation.href)}">${escapeHtml(relation.relationName)}</a>
        <span>${escapeHtml(relation.totalSize || formatBytes(relation.totalBytes))}</span>
      </li>
    `).join("");
  const links = [
    `<a href="${escapeAttribute(schema.analysisHref)}">Analysis</a>`,
    `<a href="${escapeAttribute(schema.href)}">SchemaSpy</a>`,
    `<a href="${escapeAttribute(schema.metadataHref)}">JSON</a>`,
  ];

  return `
    <article class="doc-card schema-card">
      <div>
        <p class="card-kicker">${escapeHtml(schema.name)}</p>
        <h3>${escapeHtml(schema.title)}</h3>
        <p>${escapeHtml(schema.purpose)}</p>
        <div class="meta-row">
          <span class="pill">${formatNumber(schema.tables)} tables</span>
          <span class="pill">${formatNumber(schema.indexes)} indexes</span>
          <span class="pill">${escapeHtml(schema.totalSize || formatBytes(schema.totalBytes))}</span>
          ${schema.noPrimaryKeyCount ? `<span class="pill danger">${formatNumber(schema.noPrimaryKeyCount)} PK gaps</span>` : ""}
        </div>
        <ul class="schema-relation-list">${topRelations}</ul>
      </div>
      <div class="card-actions">${links.join("")}</div>
    </article>
  `;
}

function renderDatabaseSummary() {
  const summary = $("#database-summary");
  if (!summary) {
    return;
  }
  const manifest = state.schemaSpy;
  if (!manifest) {
    summary.innerHTML = `<span>Database metadata unavailable</span>`;
    return;
  }
  summary.innerHTML = `
    <span>${formatNumber(manifest.schemaCount)} schemas</span>
    <span>${formatNumber(manifest.tableCount)} tables</span>
    <span>${formatNumber(manifest.viewCount)} views</span>
    <span>${formatNumber(manifest.indexCount)} indexes</span>
    <span>${escapeHtml(manifest.totalSize || formatBytes(manifest.totalBytes))}</span>
    <span>Generated ${escapeHtml(formatShortDateTime(manifest.generatedAt))}</span>
  `;
}

function renderTopDatabaseRelations() {
  const container = $("#database-top-relations");
  if (!container) {
    return;
  }
  const relations = (state.schemaSpy?.topRelations || []).slice(0, 20);
  container.innerHTML = relations.length
    ? `
      <div class="table-scroller">
        <table class="schema-table">
          <thead>
            <tr>
              <th>Schema</th>
              <th>Relation</th>
              <th>Type</th>
              <th>Total</th>
              <th>Estimated rows</th>
              <th>Columns</th>
              <th>Indexes</th>
            </tr>
          </thead>
          <tbody>
            ${relations.map((relation) => `
              <tr>
                <td>${escapeHtml(relation.schemaName)}</td>
                <td><a href="${escapeAttribute(relation.href)}">${escapeHtml(relation.relationName)}</a></td>
                <td>${escapeHtml(relation.relationType)}</td>
                <td>${escapeHtml(relation.totalSize || formatBytes(relation.totalBytes))}</td>
                <td>${formatNumber(relation.estimatedRows)}</td>
                <td>${formatNumber(relation.columnCount)}</td>
                <td>${formatNumber(relation.indexCount)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `
    : `<div class="empty-state">Database relation metadata will appear after SchemaSpy generation runs.</div>`;
}

function renderDatabaseAssets() {
  const container = $("#database-results");
  if (!container) {
    return;
  }
  const schemas = state.schemaSpy?.schemas || [];
  renderDatabaseSummary();
  renderTopDatabaseRelations();
  container.innerHTML = schemas.length
    ? schemas.map(schemaCard).join("")
    : `<div class="empty-state">Run <code>scripts/generate-schemaspy.sh</code> to publish database analysis.</div>`;
}

function buildGlobalResults() {
  const term = normalize(state.globalSearch);
  if (!term) {
    return [];
  }

  const graphResults = state.graphs
    .filter((graph) => normalize([
      graph.title,
      graph.category,
      graph.description,
      ...(graph.paths || []),
    ].join(" ")).includes(term))
    .slice(0, 6)
    .map((graph) => ({
      type: "Graph",
      title: graph.title,
      summary: graph.description || "Graphify architecture view.",
      meta: `${formatNumber(graph.nodes)} nodes / ${formatNumber(graph.edges)} edges`,
      href: graph.has_html ? `/graphify/${graph.slug}/graph.html` : `/graphify/${graph.slug}/`,
      action: "Open graph",
    }));

  const screenshotResults = (state.screenshots?.entries || [])
    .filter((entry) => normalize([entry.group, entry.label, entry.route, entry.locale, entry.theme].join(" ")).includes(term))
    .slice(0, 6)
    .map((entry) => ({
      type: "Screenshot",
      title: entry.label,
      summary: entry.route,
      meta: `${entry.group} / ${entry.locale} / ${entry.theme}`,
      file: entry.file,
      action: "Preview",
    }));

  const docResults = state.referenceDocs
    .filter((doc) => normalize([doc.title, doc.group, doc.summary, doc.sourcePath, ...(doc.tags || [])].join(" ")).includes(term))
    .slice(0, 6)
    .map((doc) => ({
      type: "Reference",
      title: doc.title,
      summary: doc.summary,
      meta: `${doc.group} / ${doc.criticality}`,
      href: doc.href,
      referenceId: doc.id,
      action: "Preview",
    }));

  const schemaResults = (state.schemaSpy?.schemas || [])
    .filter((schema) => normalize([
      schema.name,
      schema.title,
      schema.purpose,
      ...(schema.criticalAssets || []),
      ...(schema.topRelations || []).map((relation) => relation.relationName),
    ].join(" ")).includes(term))
    .slice(0, 4)
    .map((schema) => ({
      type: "Database",
      title: schema.title,
      summary: schema.purpose,
      meta: `${schema.name} / ${formatNumber(schema.tables)} tables / ${schema.totalSize}`,
      href: schema.analysisHref,
      action: "Open analysis",
    }));

  const relationResults = (state.schemaSpy?.topRelations || [])
    .filter((relation) => normalize([
      relation.schemaName,
      relation.relationName,
      relation.relationType,
      relation.comment,
    ].join(" ")).includes(term))
    .slice(0, 5)
    .map((relation) => ({
      type: "Relation",
      title: `${relation.schemaName}.${relation.relationName}`,
      summary: relation.relationType,
      meta: `${relation.totalSize} / ${formatNumber(relation.estimatedRows)} estimated rows`,
      href: relation.href,
      action: "Open table",
    }));

  return [...graphResults, ...screenshotResults, ...docResults, ...schemaResults, ...relationResults].slice(0, 18);
}

function renderGlobalSearch() {
  const container = $("#global-search-results");
  const input = $("#global-search-input");
  if (!container || !input) {
    return;
  }

  if (input.value !== state.globalSearch) {
    input.value = state.globalSearch;
  }

  if (!state.globalSearch.trim()) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const results = buildGlobalResults();
  container.hidden = false;
  container.innerHTML = results.length
    ? `
      <div class="global-result-summary">${formatNumber(results.length)} high-signal matches</div>
      <div class="global-result-grid">
        ${results.map((result) => {
          const inner = `
            <span class="result-type">${escapeHtml(result.type)}</span>
            <strong>${escapeHtml(result.title)}</strong>
            <small>${escapeHtml(result.summary || "")}</small>
            <em>${escapeHtml(result.meta || "")}</em>
          `;
          if (result.file) {
            return `<button class="global-result" type="button" data-shot-preview="${escapeAttribute(result.file)}">${inner}<span>${escapeHtml(result.action)}</span></button>`;
          }
          if (result.referenceId) {
            return `<button class="global-result" type="button" data-reference-preview="${escapeAttribute(result.referenceId)}">${inner}<span>${escapeHtml(result.action)}</span></button>`;
          }
          return `<a class="global-result" href="${escapeAttribute(result.href)}">${inner}<span>${escapeHtml(result.action)}</span></a>`;
        }).join("")}
      </div>
    `
    : `<div class="empty-state">No portal assets match that search.</div>`;
}

function populateFilters() {
  const graphCategories = [...new Set(state.graphs.map((graph) => graph.category).filter(Boolean))].sort();
  setOptions($("#graph-category"), graphCategories, state.graphCategory);

  const entries = state.screenshots?.entries || [];
  const groups = [...new Set(entries.map((entry) => entry.group).filter(Boolean))].sort();
  const locales = [...new Set(entries.map((entry) => entry.locale).filter(Boolean))].sort();
  const themes = [...new Set(entries.map((entry) => entry.theme).filter(Boolean))].sort();
  setOptions($("#screenshot-group"), groups, state.screenshotGroup);
  setOptions($("#screenshot-locale"), locales, state.screenshotLocale);
  setOptions($("#screenshot-theme"), themes, state.screenshotTheme);

  const referenceGroups = [...new Set(state.referenceDocs.map((doc) => doc.group).filter(Boolean))].sort();
  const referenceTags = [...new Set(state.referenceDocs.flatMap((doc) => doc.tags || []))].sort();
  const referenceCriticalities = [...new Set(state.referenceDocs.map((doc) => doc.criticality).filter(Boolean))].sort();
  const referenceSourceAreas = [...new Set(state.referenceDocs.map((doc) => doc.sourceArea).filter(Boolean))].sort();
  const referenceStatuses = [...new Set(state.referenceDocs.flatMap((doc) => [doc.status, doc.freshness]).filter(Boolean))].sort();
  setOptions($("#reference-group"), referenceGroups, state.referenceGroup);
  setOptions($("#reference-tag"), referenceTags, state.referenceTag);
  setOptions($("#reference-criticality"), referenceCriticalities, state.referenceCriticality);
  setOptions($("#reference-source-area"), referenceSourceAreas, state.referenceSourceArea);
  setOptions($("#reference-status"), referenceStatuses, state.referenceStatus);
}

function findScreenshotByFile(file) {
  return (state.screenshots?.entries || []).find((entry) => entry.file === file);
}

function getScreenshotNavList() {
  if (state.filteredScreenshots && state.filteredScreenshots.length) {
    return state.filteredScreenshots;
  }
  return state.screenshots?.entries || [];
}

function setScreenshotZoom(level) {
  state.screenshotZoom = level;
  localStorage.setItem("parthenon-zoom", level);
  const figure = document.querySelector("#screenshot-modal figure");
  if (figure) {
    if (level === "fit") {
      figure.classList.remove("zoomed");
      figure.style.removeProperty("--zoom-width");
    } else {
      figure.classList.add("zoomed");
      figure.style.setProperty("--zoom-width", level === "100" ? "auto" : "200%");
    }
  }
  document.querySelectorAll('#screenshot-modal [data-zoom]').forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.zoom === level ? "true" : "false");
  });
}

function updateScreenshotModalNav() {
  const list = getScreenshotNavList();
  const position = document.querySelector('#screenshot-modal [data-modal-nav-position]');
  const prev = document.querySelector('#screenshot-modal [data-modal-nav-prev]');
  const next = document.querySelector('#screenshot-modal [data-modal-nav-next]');
  if (!position) return;
  if (state.screenshotModalIndex < 0 || !list.length) {
    position.textContent = "—";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }
  position.textContent = `${state.screenshotModalIndex + 1} of ${list.length}`;
  if (prev) prev.disabled = state.screenshotModalIndex <= 0;
  if (next) next.disabled = state.screenshotModalIndex >= list.length - 1;
}

// Focus-trap utilities — keep keyboard focus inside an open modal so
// Tab cycles through the modal's controls instead of leaking back to
// the page behind it. Re-queries focusables on every Tab keydown so
// async-loaded content (markdown link previews, fetched related-link
// blocks) participates correctly.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function trapFocus(modal) {
  if (!modal) return;
  // Idempotent: if already trapped, leave the existing handler in place.
  if (modal._focusTrapHandler) return;
  const handler = (event) => {
    if (event.key !== "Tab") return;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((el) => el.offsetParent !== null && !el.hasAttribute("disabled"));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };
  modal.addEventListener("keydown", handler);
  modal._focusTrapHandler = handler;
}

function releaseFocusTrap(modal) {
  if (!modal || !modal._focusTrapHandler) return;
  modal.removeEventListener("keydown", modal._focusTrapHandler);
  delete modal._focusTrapHandler;
}

function openScreenshotModal(file) {
  const entry = findScreenshotByFile(file);
  const modal = $("#screenshot-modal");
  if (!entry || !modal) {
    return;
  }

  const list = getScreenshotNavList();
  const index = list.findIndex((e) => e.file === file);
  state.screenshotModalIndex = index >= 0 ? index : 0;

  populateScreenshotModal(entry);

  modal.hidden = false;
  document.body.classList.add("modal-open");
  setScreenshotZoom(state.screenshotZoom || "fit");
  updateScreenshotModalNav();
  trapFocus(modal);
  $("#screenshot-modal-close")?.focus();
}

function populateScreenshotModal(entry) {
  const imageHref = `/screenshots/application-library/${entry.file}`;
  const catalogueHref = `/screenshots/application-library/#${entry.locale}-${entry.theme}-${entry.label}`;
  state.lastFocusedElement = state.lastFocusedElement || document.activeElement;

  setText("#screenshot-modal-title", entry.label);
  const image = $("#screenshot-modal-image");
  if (image) {
    image.src = imageHref;
    image.alt = `${entry.label} screenshot in ${entry.locale} ${entry.theme}`;
  }
  setText("#screenshot-modal-route", entry.route || "Unknown");
  setText("#screenshot-modal-locale", entry.locale || "Unknown");
  setText("#screenshot-modal-theme", entry.theme || "Unknown");
  setText("#screenshot-modal-captured", formatDateTime(entry.capturedAt));

  const liveRoute = entry.route ? liveHref(entry.route) : null;
  const actions = $("#screenshot-modal-actions");
  if (actions) {
    actions.innerHTML = `
      <a href="${escapeAttribute(imageHref)}">Open image</a>
      <a href="${escapeAttribute(catalogueHref)}">Open catalogue item</a>
      ${liveRoute ? `<a href="${escapeAttribute(liveRoute)}" class="external" target="_blank" rel="noopener noreferrer">Open live route</a>` : ""}
    `;
  }
}

function navigateScreenshotModal(direction) {
  const list = getScreenshotNavList();
  if (!list.length) return;
  const next = state.screenshotModalIndex + direction;
  if (next < 0 || next >= list.length) return;
  state.screenshotModalIndex = next;
  populateScreenshotModal(list[next]);
  updateScreenshotModalNav();
}

function closeScreenshotModal() {
  const modal = $("#screenshot-modal");
  const image = $("#screenshot-modal-image");
  if (!modal || modal.hidden) {
    return;
  }
  releaseFocusTrap(modal);
  modal.hidden = true;
  if (image) {
    image.src = "";
  }
  state.screenshotModalIndex = -1;
  document.body.classList.remove("modal-open");
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
    state.lastFocusedElement.focus();
  }
  state.lastFocusedElement = null;
}

function findReferenceById(id) {
  return state.referenceDocs.find((doc) => doc.id === id);
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, href) => {
      const safeHref = String(href).startsWith("http") || String(href).startsWith("/") ? href : "#";
      return `<img src="${escapeAttribute(safeHref)}" alt="${alt}" loading="lazy">`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = String(href).startsWith("http") || String(href).startsWith("/") ? href : "#";
      return `<a href="${escapeAttribute(safeHref)}">${label}</a>`;
    });
}

function renderMarkdownTable(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim()))
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  if (!rows.length) {
    return "";
  }
  const [head, ...body] = rows;
  return `
    <table>
      <thead><tr>${head.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
      <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function renderMarkdown(text) {
  const lines = String(text || "").split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let table = [];
  let fence = null;
  let fenceLines = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      html.push(renderMarkdownTable(table));
      table = [];
    }
  };
  const flushBlocks = () => {
    flushParagraph();
    flushList();
    flushTable();
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^```(\w+)?/);
    if (fenceMatch) {
      if (fence) {
        html.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
        fence = null;
        fenceLines = [];
      } else {
        flushBlocks();
        fence = fenceMatch[1] || "text";
        fenceLines = [];
      }
      continue;
    }
    if (fence) {
      fenceLines.push(line);
      continue;
    }
    if (!trimmed) {
      flushBlocks();
      continue;
    }
    if (trimmed.startsWith("|")) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushBlocks();
      const level = Math.min(heading[1].length + 2, 6);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const item = trimmed.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      flushTable();
      list.push(item[1]);
      continue;
    }
    flushList();
    flushTable();
    paragraph.push(trimmed);
  }

  if (fence) {
    html.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
  }
  flushBlocks();
  return html.join("");
}

function referencePreviewHtml(doc, text) {
  if (doc.fileType === "md" || doc.fileType === "markdown") {
    return renderMarkdown(text);
  }
  return `<pre><code>${escapeHtml(text)}</code></pre>`;
}

function getReferenceNavList() {
  if (state.filteredReference && state.filteredReference.length) {
    return state.filteredReference;
  }
  return state.referenceDocs || [];
}

function updateReferenceModalNav() {
  const list = getReferenceNavList();
  const position = document.querySelector('#reference-modal [data-modal-nav-position]');
  const prev = document.querySelector('#reference-modal [data-modal-nav-prev]');
  const next = document.querySelector('#reference-modal [data-modal-nav-next]');
  if (!position) return;
  if (state.referenceModalIndex < 0 || !list.length) {
    position.textContent = "—";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }
  position.textContent = `${state.referenceModalIndex + 1} of ${list.length}`;
  if (prev) prev.disabled = state.referenceModalIndex <= 0;
  if (next) next.disabled = state.referenceModalIndex >= list.length - 1;
}

let referenceFetchSeq = 0;

async function populateReferenceModal(doc) {
  setText("#reference-modal-title", doc.title);
  setText("#reference-modal-summary", doc.summary);
  setText("#reference-modal-source", doc.sourcePath);
  setText("#reference-modal-criticality", doc.criticality || "Unknown");
  setText("#reference-modal-status", `${doc.status || "Unknown"} / ${doc.freshness || "Unknown"}`);
  setText("#reference-modal-updated", doc.sourceLastModified ? formatDateTime(doc.sourceLastModified) : "Unknown");
  setText("#reference-modal-checksum", doc.checksum ? doc.checksum.slice(0, 16) : "Unavailable");

  const tags = $("#reference-modal-tags");
  if (tags) {
    tags.innerHTML = (doc.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
  }

  const related = $("#reference-modal-related");
  if (related) {
    const links = [
      ...(doc.relatedGraphs || []).map((slug) => `<a href="${escapeAttribute(graphHref(slug))}">Graph: ${escapeHtml(slug)}</a>`),
      ...(doc.relatedScreenshots || []).map((label) => `<a href="${escapeAttribute(screenshotHref(label))}">Screenshot: ${escapeHtml(label)}</a>`),
      ...(doc.liveRoutes || []).map((route) => `<a href="${escapeAttribute(liveHref(route))}">Live route: ${escapeHtml(route)}</a>`),
      `<a href="${escapeAttribute(doc.href)}">Raw mirrored asset</a>`,
    ];
    related.innerHTML = links.join("");
  }

  const content = $("#reference-modal-content");
  if (content) {
    content.innerHTML = `<div class="empty-state">Loading reference preview...</div>`;
  }

  const seq = ++referenceFetchSeq;
  try {
    let text = state.referencePreviewCache.get(doc.id);
    if (!text) {
      const response = await fetch(doc.href, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      text = await response.text();
      state.referencePreviewCache.set(doc.id, text);
    }
    if (seq === referenceFetchSeq && content) {
      content.innerHTML = referencePreviewHtml(doc, text);
    }
  } catch (error) {
    if (seq === referenceFetchSeq && content) {
      content.innerHTML = `<div class="load-error">Unable to load reference preview: ${escapeHtml(error.message)}</div>`;
    }
  }
}

async function openReferenceModal(id) {
  const doc = findReferenceById(id);
  const modal = $("#reference-modal");
  if (!doc || !modal) {
    return;
  }
  state.lastFocusedElement = document.activeElement;
  const list = getReferenceNavList();
  const index = list.findIndex((d) => d.id === id);
  state.referenceModalIndex = index >= 0 ? index : 0;

  modal.hidden = false;
  document.body.classList.add("modal-open");
  trapFocus(modal);
  $("#reference-modal-close")?.focus();
  updateReferenceModalNav();
  await populateReferenceModal(doc);
}

function navigateReferenceModal(direction) {
  const list = getReferenceNavList();
  if (!list.length) return;
  const next = state.referenceModalIndex + direction;
  if (next < 0 || next >= list.length) return;
  state.referenceModalIndex = next;
  populateReferenceModal(list[next]);
  updateReferenceModalNav();
}

function closeReferenceModal() {
  const modal = $("#reference-modal");
  if (!modal || modal.hidden) {
    return;
  }
  releaseFocusTrap(modal);
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
    state.lastFocusedElement.focus();
  }
}

function prefersDarkOS() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeMode(mode) {
  state.themeMode = mode;
  localStorage.setItem("parthenon-theme", mode);
  let effective;
  if (mode === "system") {
    effective = prefersDarkOS() ? "dark" : "light";
  } else {
    effective = mode;
  }
  document.documentElement.classList.toggle("light", effective === "light");
  updateThemeToggle();
}

function cycleThemeMode() {
  const order = ["system", "dark", "light"];
  const current = order.indexOf(state.themeMode);
  const next = order[(current + 1) % order.length];
  applyThemeMode(next);
}

function updateThemeToggle() {
  const button = $("#theme-toggle");
  const label = $("#theme-toggle-label");
  const modeLabel = $("#theme-mode-label");
  if (!button || !label) {
    return;
  }
  const isLight = document.documentElement.classList.contains("light");
  label.textContent = isLight ? "Light theme active" : "Dark theme active";
  if (modeLabel) {
    modeLabel.textContent = state.themeMode;
  }
  button.title = `Theme: ${state.themeMode} (resolved: ${isLight ? "light" : "dark"}). Click to cycle (system → dark → light).`;
}

function openHelpModal() {
  const modal = $("#help-modal");
  if (!modal) return;
  state.lastFocusedElement = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  trapFocus(modal);
  $("#help-modal-close")?.focus();
}

function closeHelpModal() {
  const modal = $("#help-modal");
  if (!modal || modal.hidden) return;
  releaseFocusTrap(modal);
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
    state.lastFocusedElement.focus();
  }
}

function renderTabHealth() {
  for (const [tab, assetId] of Object.entries(ASSET_HEALTH_BY_TAB)) {
    const dot = document.querySelector(`[data-tab-health="${tab}"]`);
    if (!dot) continue;
    const asset = getAsset(assetId);
    if (!asset) {
      dot.className = "tab-health";
      continue;
    }
    if (asset.ok) {
      dot.className = "tab-health healthy";
      dot.title = `${asset.title} ready (${asset.message})`;
    } else if (asset.statusCode === 0 || !asset.statusCode) {
      dot.className = "tab-health critical";
      dot.title = `${asset.title} unreachable`;
    } else {
      dot.className = "tab-health warning";
      dot.title = `${asset.title}: ${asset.message}`;
    }
  }
}

async function fetchBuildInfo() {
  try {
    const response = await fetch("/build-info.json", { cache: "no-store" });
    if (response.ok) {
      state.buildInfo = await response.json();
      // Capture the timestamp we initially loaded so the polling pass
      // can detect future changes.
      state.buildInfoSeenAt = state.buildInfo?.generatedAt || null;
    }
  } catch (error) {
    // build-info.json is optional
  }
}

const BUILD_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min

async function pollBuildInfo() {
  if (document.hidden) return;
  if (!state.buildInfoSeenAt) return; // never had a baseline; nothing to compare to
  try {
    const response = await fetch("/build-info.json", { cache: "no-store" });
    if (!response.ok) return;
    const fresh = await response.json();
    if (!fresh || !fresh.generatedAt) return;
    if (fresh.generatedAt > state.buildInfoSeenAt) {
      state.buildInfoLatestSeen = fresh.generatedAt;
      const toast = $("#refresh-toast");
      if (toast) toast.hidden = false;
    }
  } catch (error) {
    // network blip — try again next interval
  }
}

function startBuildInfoPolling() {
  if (state.buildPollHandle) return;
  state.buildPollHandle = window.setInterval(pollBuildInfo, BUILD_POLL_INTERVAL_MS);
}

function dismissRefreshToast() {
  const toast = $("#refresh-toast");
  if (toast) toast.hidden = true;
  // Treat dismissal as acknowledgement of the latest version we saw,
  // so we won't re-show the toast for the same build. A still-newer
  // build later will surface the toast again.
  if (state.buildInfoLatestSeen) {
    state.buildInfoSeenAt = state.buildInfoLatestSeen;
    state.buildInfoLatestSeen = null;
  }
}

function triggerRefresh() {
  window.location.reload();
}

function renderBuildStamp() {
  const el = $("#build-stamp");
  if (!el) return;
  const info = state.buildInfo;
  if (info && (info.gitSha || info.generatedAt)) {
    const dateText = info.generatedAt ? formatShortDateTime(info.generatedAt) : "";
    const sha = info.gitSha ? info.gitSha.slice(0, 8) : "";
    el.innerHTML = [
      dateText ? `Built ${escapeHtml(dateText)}` : "",
      sha ? `from <span title="${escapeAttribute(info.gitSha)}">${escapeHtml(sha)}</span>` : "",
    ].filter(Boolean).join(" ");
    return;
  }
  const manifests = [
    state.screenshots?.generatedAt,
    state.referenceManifest?.generatedAt,
    state.schemaSpy?.generatedAt,
  ].filter(Boolean).map((v) => new Date(v).getTime()).filter((n) => !Number.isNaN(n));
  if (manifests.length) {
    const newest = new Date(Math.max(...manifests));
    el.textContent = `Static portal • newest manifest ${formatShortDateTime(newest)}`;
  } else {
    el.textContent = "Static portal";
  }
}

function evaluateWhatsNew() {
  const banner = $("#whats-new-banner");
  const content = $("#whats-new-content");
  if (!banner || !content) return;
  const lastVisitRaw = localStorage.getItem("parthenon-last-visit");
  const lastVisit = lastVisitRaw ? Number(lastVisitRaw) : 0;
  if (!lastVisit) {
    // First visit — set baseline silently
    localStorage.setItem("parthenon-last-visit", String(Date.now()));
    return;
  }
  const newScreenshots = (state.screenshots?.entries || [])
    .filter((e) => new Date(e.capturedAt || 0).getTime() > lastVisit).length;
  const graphCatalogTs = new Date(state.assetHealth.find((a) => a.id === "graph-catalog")?.lastModified || 0).getTime();
  const newGraphs = !Number.isNaN(graphCatalogTs) && graphCatalogTs > lastVisit ? 1 : 0;
  const newReference = (state.referenceDocs || [])
    .filter((d) => new Date(timestampForReference(d) || 0).getTime() > lastVisit).length;
  const parts = [];
  if (newScreenshots) parts.push(`<strong>${formatNumber(newScreenshots)}</strong> new screenshot${newScreenshots === 1 ? "" : "s"}`);
  if (newReference) parts.push(`<strong>${formatNumber(newReference)}</strong> new reference doc${newReference === 1 ? "" : "s"}`);
  if (newGraphs) parts.push(`refreshed <strong>graph catalog</strong>`);
  if (!parts.length) {
    return;
  }
  content.innerHTML = `Since your last visit: ${parts.join(", ")}.`;
  banner.hidden = false;
}

function dismissWhatsNew() {
  localStorage.setItem("parthenon-last-visit", String(Date.now()));
  const banner = $("#whats-new-banner");
  if (banner) banner.hidden = true;
}

function isEditableTarget(el) {
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function clearKeyboardSequence() {
  state.keyboardSequence = null;
  if (state.keyboardSequenceTimer) {
    clearTimeout(state.keyboardSequenceTimer);
    state.keyboardSequenceTimer = null;
  }
}

function handleGlobalShortcut(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const screenshotModalOpen = !$("#screenshot-modal")?.hidden;
  const referenceModalOpen = !$("#reference-modal")?.hidden;
  const helpModalOpen = !$("#help-modal")?.hidden;
  const anyModalOpen = screenshotModalOpen || referenceModalOpen || helpModalOpen;

  if (event.key === "Escape") {
    if (helpModalOpen) {
      event.preventDefault();
      closeHelpModal();
      return;
    }
    if (screenshotModalOpen) {
      event.preventDefault();
      closeScreenshotModal();
      return;
    }
    if (referenceModalOpen) {
      event.preventDefault();
      closeReferenceModal();
      return;
    }
    if (isEditableTarget(event.target) && event.target.value !== undefined) {
      event.target.value = "";
      event.target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    return;
  }

  if (screenshotModalOpen) {
    if (event.key === "ArrowLeft") { event.preventDefault(); navigateScreenshotModal(-1); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); navigateScreenshotModal(1); return; }
  }
  if (referenceModalOpen) {
    if (event.key === "ArrowLeft") { event.preventDefault(); navigateReferenceModal(-1); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); navigateReferenceModal(1); return; }
  }

  if (anyModalOpen) return;
  if (isEditableTarget(event.target)) return;

  if (event.key === "/") {
    event.preventDefault();
    const input = $("#global-search-input");
    if (input) input.focus();
    return;
  }
  if (event.key === "?") {
    event.preventDefault();
    openHelpModal();
    return;
  }

  if (state.keyboardSequence === "g") {
    const map = { o: "overview", g: "graphs", d: "database", s: "screenshots", r: "reference" };
    if (event.key in map) {
      event.preventDefault();
      activateTab(map[event.key]);
      clearKeyboardSequence();
      return;
    }
    clearKeyboardSequence();
  }
  if (event.key === "g") {
    state.keyboardSequence = "g";
    state.keyboardSequenceTimer = setTimeout(clearKeyboardSequence, 800);
    return;
  }
}

function bindEvents() {
  const tabs = $$(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });
  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    tablist.addEventListener("keydown", (event) => {
      const orderedTabs = $$(".tab");
      const currentIndex = orderedTabs.findIndex((tab) => tab === document.activeElement);
      if (currentIndex === -1) {
        return;
      }
      let nextIndex = null;
      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % orderedTabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + orderedTabs.length) % orderedTabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = orderedTabs.length - 1;
      }
      if (nextIndex !== null) {
        event.preventDefault();
        activateTab(orderedTabs[nextIndex].dataset.tab, { focus: true, scroll: false });
      }
    });
  }
  $$("[data-tab-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(link.dataset.tabLink);
    });
  });
  window.addEventListener("popstate", () => {
    const { tab } = parseUrlHash();
    const target = isValidTab(tab) ? tab : "overview";
    applyFiltersFromUrl();
    if (FILTER_KEYS.graphs) renderGraphs();
    if (FILTER_KEYS.screenshots) renderScreenshots();
    if (FILTER_KEYS.reference) renderReference();
    activateTab(target, { replace: true, scroll: false });
  });

  $("#theme-toggle")?.addEventListener("click", cycleThemeMode);
  if (window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if (state.themeMode === "system") applyThemeMode("system"); };
    if (mql.addEventListener) mql.addEventListener("change", listener);
    else if (mql.addListener) mql.addListener(listener);
  }

  $("#help-toggle")?.addEventListener("click", openHelpModal);
  $("#help-modal-close")?.addEventListener("click", closeHelpModal);
  $("#whats-new-dismiss")?.addEventListener("click", dismissWhatsNew);
  $("#refresh-toast-action")?.addEventListener("click", triggerRefresh);
  $("#refresh-toast-dismiss")?.addEventListener("click", dismissRefreshToast);

  const bindSearchDebounced = (selector, key, render) => {
    const el = $(selector);
    if (!el) return;
    const debounced = debounce(() => { render(); syncUrl(); }, 120);
    el.addEventListener("input", (event) => {
      state[key] = event.target.value;
      debounced();
    });
  };

  $("#global-search-input")?.addEventListener("input", debounce((event) => {
    state.globalSearch = event.target.value;
    renderGlobalSearch();
  }, 120));

  $("#global-search-clear")?.addEventListener("click", () => {
    state.globalSearch = "";
    renderGlobalSearch();
    $("#global-search-input")?.focus();
  });

  bindSearchDebounced("#graph-search", "graphSearch", renderGraphs);
  $("#graph-category")?.addEventListener("change", (event) => {
    state.graphCategory = event.target.value;
    renderGraphs();
    syncUrl();
  });
  $("#graph-sort")?.addEventListener("change", (event) => {
    state.graphSort = event.target.value;
    renderGraphs();
    syncUrl();
  });
  bindSearchDebounced("#screenshot-search", "screenshotSearch", renderScreenshots);
  $("#screenshot-group")?.addEventListener("change", (event) => {
    state.screenshotGroup = event.target.value;
    renderScreenshots();
    syncUrl();
  });
  $("#screenshot-locale")?.addEventListener("change", (event) => {
    state.screenshotLocale = event.target.value;
    renderScreenshots();
    syncUrl();
  });
  $("#screenshot-theme")?.addEventListener("change", (event) => {
    state.screenshotTheme = event.target.value;
    renderScreenshots();
    syncUrl();
  });
  bindSearchDebounced("#reference-search", "referenceSearch", renderReference);
  $("#reference-group")?.addEventListener("change", (event) => {
    state.referenceGroup = event.target.value;
    renderReference();
    syncUrl();
  });
  $("#reference-tag")?.addEventListener("change", (event) => {
    state.referenceTag = event.target.value;
    renderReference();
    syncUrl();
  });
  $("#reference-criticality")?.addEventListener("change", (event) => {
    state.referenceCriticality = event.target.value;
    renderReference();
    syncUrl();
  });
  $("#reference-source-area")?.addEventListener("change", (event) => {
    state.referenceSourceArea = event.target.value;
    renderReference();
    syncUrl();
  });
  $("#reference-status")?.addEventListener("change", (event) => {
    state.referenceStatus = event.target.value;
    renderReference();
    syncUrl();
  });

  document.addEventListener("click", (event) => {
    const clearFilter = event.target.closest("[data-clear-filter]");
    if (clearFilter) {
      event.preventDefault();
      resetSingleFilter(clearFilter.dataset.clearFilter);
      return;
    }
    const clearPanel = event.target.closest("[data-clear-panel]");
    if (clearPanel) {
      event.preventDefault();
      resetPanelFilters(clearPanel.dataset.clearPanel);
      return;
    }

    const navPrev = event.target.closest("[data-modal-nav-prev]");
    if (navPrev) {
      event.preventDefault();
      const nav = navPrev.closest("[data-modal-nav]");
      if (nav?.dataset.modalNav === "screenshot") navigateScreenshotModal(-1);
      else if (nav?.dataset.modalNav === "reference") navigateReferenceModal(-1);
      return;
    }
    const navNext = event.target.closest("[data-modal-nav-next]");
    if (navNext) {
      event.preventDefault();
      const nav = navNext.closest("[data-modal-nav]");
      if (nav?.dataset.modalNav === "screenshot") navigateScreenshotModal(1);
      else if (nav?.dataset.modalNav === "reference") navigateReferenceModal(1);
      return;
    }

    const zoomBtn = event.target.closest("[data-zoom]");
    if (zoomBtn) {
      event.preventDefault();
      setScreenshotZoom(zoomBtn.dataset.zoom);
      return;
    }

    const referenceLink = event.target.closest("[data-reference-preview]");
    if (referenceLink) {
      event.preventDefault();
      openReferenceModal(referenceLink.dataset.referencePreview);
      return;
    }

    const previewLink = event.target.closest("[data-shot-preview]");
    if (previewLink) {
      event.preventDefault();
      openScreenshotModal(previewLink.dataset.shotPreview);
      return;
    }

    if (event.target.id === "screenshot-modal") {
      closeScreenshotModal();
    }

    if (event.target.id === "reference-modal") {
      closeReferenceModal();
    }

    if (event.target.id === "help-modal") {
      closeHelpModal();
    }
  });

  $("#screenshot-modal-close")?.addEventListener("click", closeScreenshotModal);
  $("#reference-modal-close")?.addEventListener("click", closeReferenceModal);

  document.addEventListener("keydown", handleGlobalShortcut);
}

async function loadData() {
  state.assetHealth = await Promise.all(localAssets.map((asset) => checkAsset(asset)));
  applyLoadedData();
}

function renderAll() {
  renderStats();
  renderRuntimeLinks();
  populateFilters();
  applyFiltersFromUrl();
  renderOverview();
  renderRecentCaptures();
  renderGraphs();
  renderScreenshots();
  renderReference();
  renderDatabaseAssets();
  renderGlobalSearch();
  renderTabHealth();
  renderBuildStamp();
}

async function init() {
  // Manage our own scroll position; don't restore prior session scroll.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  applyThemeMode(state.themeMode);
  bindEvents();
  renderRuntimeLinks();
  renderReference();
  try {
    await Promise.all([loadData(), fetchBuildInfo()]);
  } catch (error) {
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      `<div class="load-error">Portal metadata could not be loaded: ${escapeHtml(error.message)}</div>`,
    );
  }
  renderAll();
  evaluateWhatsNew();
  const { tab: requestedTab } = parseUrlHash();
  if (isValidTab(requestedTab)) {
    activateTab(requestedTab, { replace: true, scroll: false });
  } else {
    updateBreadcrumb("overview");
  }
  window.scrollTo(0, 0);
  startBuildInfoPolling();
}

init();

/* ─── Background cycler — slow Parthenon photography rotation ────────── */

const BG_IMAGES = [
  "/assets/backgrounds/bg-01.webp",
  "/assets/backgrounds/bg-02.webp",
  "/assets/backgrounds/bg-03.webp",
  "/assets/backgrounds/bg-04.webp",
  "/assets/backgrounds/bg-05.webp",
  "/assets/backgrounds/bg-06.webp",
  "/assets/backgrounds/bg-07.webp",
  "/assets/backgrounds/bg-08.webp",
];
const BG_HOLD_MS = 30000;
const BG_FADE_MS = 6000;

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function startBackgroundCycle() {
  const layerA = document.querySelector('[data-bg-layer="a"]');
  const layerB = document.querySelector('[data-bg-layer="b"]');
  if (!layerA || !layerB) return;

  // Lock the first frame to bg-01 so the <link rel="preload"> in the
  // document head can warm the cache. Shuffle the remaining 7 so the
  // mid-session cycle still feels random.
  const order = [BG_IMAGES[0], ...shuffled(BG_IMAGES.slice(1))];
  let index = 0;
  let visibleLayer = layerA;
  let hiddenLayer = layerB;

  // Initial paint — preload first image, set on visible layer.
  await preloadImage(order[0]);
  visibleLayer.style.backgroundImage = `url("${order[0]}")`;
  visibleLayer.classList.add("is-visible");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    // Lock to one image — no cycling, no Ken Burns.
    visibleLayer.style.animation = "none";
    return;
  }

  let timeoutId = null;
  let paused = false;

  const advance = async () => {
    if (paused) return;
    index = (index + 1) % order.length;
    const nextSrc = order[index];
    await preloadImage(nextSrc);
    if (paused) return;

    // Stage next image on the hidden layer, then swap visibility.
    hiddenLayer.style.backgroundImage = `url("${nextSrc}")`;
    // Restart Ken Burns animation on the incoming layer.
    hiddenLayer.style.animation = "none";
    // Force reflow so the animation restarts cleanly.
    void hiddenLayer.offsetWidth;
    hiddenLayer.style.animation = "";

    hiddenLayer.classList.add("is-visible");
    visibleLayer.classList.remove("is-visible");

    [visibleLayer, hiddenLayer] = [hiddenLayer, visibleLayer];

    timeoutId = window.setTimeout(advance, BG_HOLD_MS);
  };

  timeoutId = window.setTimeout(advance, BG_HOLD_MS);

  // Pause when tab hidden, resume when shown.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      paused = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    } else {
      paused = false;
      if (!timeoutId) {
        timeoutId = window.setTimeout(advance, BG_FADE_MS);
      }
    }
  });

  // Re-evaluate reduced-motion preference if it changes.
  if (window.matchMedia) {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event) => {
      if (event.matches) {
        paused = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        visibleLayer.style.animation = "none";
        hiddenLayer.style.animation = "none";
      }
    };
    if (mql.addEventListener) mql.addEventListener("change", listener);
    else if (mql.addListener) mql.addListener(listener);
  }
}

startBackgroundCycle();
