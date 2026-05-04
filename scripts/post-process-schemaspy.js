#!/usr/bin/env node
/*
 * Post-process native SchemaSpy-emitted HTML pages so they render
 * with the Parthenon design system: theme preflight, portal stylesheet,
 * AdminLTE retheme overlay, and a slim chrome bar at the top of body
 * with a link back into the portal.
 *
 * Idempotent — running twice produces the same output.
 *
 * Walks: public/schemaspy/{schema}/*.html and tables/*.html and routines/*.html
 * Skips: analysis.html (portal-shell page already wired correctly),
 *        index.html at /schemaspy root (also a portal-shell page).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "public", "schemaspy");

const PREFLIGHT = `<script>
      (function(){
        var stored=localStorage.getItem('parthenon-theme');
        var mode=stored||'system';
        var effective=(mode==='light')?'light':(mode==='dark')?'dark':((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');
        if(effective==='light'){document.documentElement.classList.add('light');}
      })();
    </script>`;

const STYLE_LINKS = `<link rel="stylesheet" href="/assets/styles.css">
    <link rel="stylesheet" href="/assets/schemaspy-portal.css">`;

// Inline self-contained theme toggle. Targets any element with
// [data-parthenon-theme-toggle] and updates html.light + the visible
// mode label. Listens for OS theme changes when in system mode.
const THEME_TOGGLE_SCRIPT = `<script data-parthenon-theme-script>
      (function(){
        function getEffective(mode){
          if(mode==='light')return 'light';
          if(mode==='dark')return 'dark';
          return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
        }
        function apply(mode){
          var eff=getEffective(mode);
          document.documentElement.classList.toggle('light',eff==='light');
          try{localStorage.setItem('parthenon-theme',mode);}catch(e){}
          document.querySelectorAll('[data-parthenon-theme-toggle]').forEach(function(btn){
            var label=btn.querySelector('[data-parthenon-theme-mode]');
            if(label)label.textContent=mode;
            btn.title='Theme: '+mode+' (resolved: '+eff+'). Click to cycle (system → dark → light).';
          });
        }
        var current=(function(){try{return localStorage.getItem('parthenon-theme')||'system';}catch(e){return 'system';}})();
        apply(current);
        document.addEventListener('click',function(e){
          var btn=e.target.closest&&e.target.closest('[data-parthenon-theme-toggle]');
          if(!btn)return;
          e.preventDefault();
          var modes=['system','dark','light'];
          var cur=(function(){try{return localStorage.getItem('parthenon-theme')||'system';}catch(e){return 'system';}})();
          var next=modes[(modes.indexOf(cur)+1)%3];
          apply(next);
        });
        if(window.matchMedia){
          var mql=window.matchMedia('(prefers-color-scheme: dark)');
          var listener=function(){
            var stored=(function(){try{return localStorage.getItem('parthenon-theme')||'system';}catch(e){return 'system';}})();
            if(stored==='system')apply('system');
          };
          if(mql.addEventListener)mql.addEventListener('change',listener);
          else if(mql.addListener)mql.addListener(listener);
        }
      })();
    </script>`;

const SENTINEL = "data-parthenon-themed";

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[c]);
}

function themeToggleButton() {
  return `<button class="parthenon-theme-toggle" type="button" data-parthenon-theme-toggle aria-label="Cycle theme: system, dark, light">
        <span class="parthenon-theme-dot" aria-hidden="true"></span>
        <span data-parthenon-theme-mode>system</span>
      </button>`;
}

function chromeBar(schemaName, pageLabel) {
  return `<div class="parthenon-portal-chrome" data-parthenon-themed="chrome">
      <a class="parthenon-brand" href="/" aria-label="Parthenon Developer Portal home">
        <span class="parthenon-brand-mark">Parthenon</span>
        <span class="parthenon-brand-context">Developer Portal</span>
      </a>
      <nav class="parthenon-crumbs" aria-label="Portal context">
        <a href="/#database">Database</a>
        <span class="parthenon-crumb-sep" aria-hidden="true">›</span>
        <a href="/schemaspy/${htmlEscape(schemaName)}/analysis.html">${htmlEscape(schemaName)}</a>
        <span class="parthenon-crumb-sep" aria-hidden="true">›</span>
        <span class="parthenon-crumb-current">${htmlEscape(pageLabel)}</span>
      </nav>
      ${themeToggleButton()}
    </div>`;
}

function pageLabelFor(file) {
  const base = path.basename(file, ".html");
  if (base === "index") return "Tables";
  if (base === "anomalies") return "Anomalies";
  if (base === "columns") return "Columns";
  if (base === "constraints") return "Constraints";
  if (base === "relationships") return "Relationships";
  if (base === "orphans") return "Orphan tables";
  if (base === "routines") return "Routines";
  if (base === "deletionOrder") return "Deletion order";
  if (base === "insertionOrder") return "Insertion order";
  // Per-table pages live in tables/<name>.html
  return base;
}

function processFile(file, schemaName) {
  const before = fs.readFileSync(file, "utf8");
  let src = before;

  // Insert preflight + portal stylesheets before the existing schemaSpy.css
  // so portal styles cascade after Bootstrap/AdminLTE.
  if (!src.includes("/assets/schemaspy-portal.css")) {
    src = src.replace(
      /(<link rel="stylesheet" href="(?:\.\.\/)*schemaSpy\.css">)/,
      `$1\n        ${PREFLIGHT}\n        ${STYLE_LINKS}`
    );
  }

  // Tag <body> so the override stylesheet activates. Idempotent: only
  // adds the class + sentinel if absent.
  if (!src.match(/<body[^>]*\bparthenon-themed\b/)) {
    src = src.replace(
      /<body class="([^"]*?)"/,
      (_m, cls) => `<body class="${cls} parthenon-themed" ${SENTINEL}="1"`
    );
  }

  // Replace any existing portal chrome bar with the current version
  // (handles upgrades — e.g., adding the theme toggle button to existing
  // themed pages). If absent, insert fresh.
  const label = pageLabelFor(file);
  const bar = chromeBar(schemaName, label);
  if (src.includes('class="parthenon-portal-chrome"')) {
    src = src.replace(
      /<div class="parthenon-portal-chrome"[\s\S]*?<\/div>\s*/,
      `${bar}\n        `
    );
  } else {
    src = src.replace(
      /(<body[^>]*>)/,
      `$1\n        ${bar}`
    );
  }

  // Inject the theme-toggle script before </body>, idempotent.
  if (!src.includes("data-parthenon-theme-script")) {
    src = src.replace(
      /<\/body>/,
      `    ${THEME_TOGGLE_SCRIPT}\n    </body>`
    );
  }

  if (src === before) return false;
  fs.writeFileSync(file, src);
  return true;
}

function isHtmlFile(name) {
  return name.endsWith(".html");
}

function processSchema(schemaDir) {
  const schemaName = path.basename(schemaDir);
  let processed = 0, skipped = 0;

  // Top-level HTML files in the schema dir, excluding analysis.html which is
  // a portal-shell page generated separately.
  for (const entry of fs.readdirSync(schemaDir, { withFileTypes: true })) {
    if (entry.isFile() && isHtmlFile(entry.name) && entry.name !== "analysis.html") {
      const result = processFile(path.join(schemaDir, entry.name), schemaName);
      if (result) processed++; else skipped++;
    }
  }

  // tables/ subdirectory
  const tablesDir = path.join(schemaDir, "tables");
  if (fs.existsSync(tablesDir)) {
    for (const entry of fs.readdirSync(tablesDir, { withFileTypes: true })) {
      if (entry.isFile() && isHtmlFile(entry.name)) {
        const result = processFile(path.join(tablesDir, entry.name), schemaName);
        if (result) processed++; else skipped++;
      }
    }
  }

  // routines/ subdirectory
  const routinesDir = path.join(schemaDir, "routines");
  if (fs.existsSync(routinesDir)) {
    for (const entry of fs.readdirSync(routinesDir, { withFileTypes: true })) {
      if (entry.isFile() && isHtmlFile(entry.name)) {
        const result = processFile(path.join(routinesDir, entry.name), schemaName);
        if (result) processed++; else skipped++;
      }
    }
  }

  return { schemaName, processed, skipped };
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`schemaspy root not found at ${ROOT}`);
    process.exit(1);
  }
  let total = { processed: 0, skipped: 0 };
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const schemaDir = path.join(ROOT, entry.name);
    const result = processSchema(schemaDir);
    console.log(`  ${result.schemaName}: processed=${result.processed} skipped=${result.skipped}`);
    total.processed += result.processed;
    total.skipped += result.skipped;
  }
  console.log(`\ntotal: processed=${total.processed} already-themed=${total.skipped}`);
}

main();
