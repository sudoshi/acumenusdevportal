#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(process.argv[2] || "/home/smudoshi/Github/Parthenon");
const portalRoot = path.resolve(__dirname, "..");
const targetRoot = path.join(portalRoot, "public", "reference");
const generatedRoot = path.join(targetRoot, "generated");
const generatedAt = new Date().toISOString();

const docs = [
  {
    id: "project-readme",
    title: "Project README",
    group: "Start Here",
    sourcePath: "README.md",
    summary: "Top-level product and repository orientation for Parthenon.",
    tags: ["onboarding", "overview", "repository"],
    criticality: "Critical",
    sourceArea: "Root",
    relatedGraphs: ["study-lifecycle", "auth-and-sso"],
    liveRoutes: ["/"],
  },
  {
    id: "agent-instructions",
    title: "AGENTS Instructions",
    group: "Start Here",
    sourcePath: "AGENTS.md",
    summary: "Repository-specific implementation, testing, and graphify update instructions for agents.",
    tags: ["agent", "workflow", "guardrails"],
    criticality: "Critical",
    sourceArea: "Root",
    relatedGraphs: ["frontend-routing-and-layout"],
  },
  {
    id: "contributing",
    title: "Contributing Guide",
    group: "Start Here",
    sourcePath: "CONTRIBUTING.md",
    summary: "Development workflow, contribution rules, and local collaboration conventions.",
    tags: ["workflow", "development", "repository"],
    criticality: "High",
    sourceArea: "Root",
  },
  {
    id: "roadmap",
    title: "Roadmap",
    group: "Start Here",
    sourcePath: "ROADMAP.md",
    summary: "Milestones, product priorities, current direction, and planning context.",
    tags: ["roadmap", "planning", "product"],
    criticality: "Critical",
    sourceArea: "Root",
  },
  {
    id: "app-schema",
    title: "Application Schema Dictionary",
    group: "Architecture",
    sourcePath: "docs/data-dictionary/app-schema.md",
    summary: "Data dictionary for the app schema and durable database concepts.",
    tags: ["database", "schema", "data-dictionary"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["database-schema-and-models"],
  },
  {
    id: "auth-regime",
    title: "Authentication Regime",
    group: "Architecture",
    sourcePath: "docs/devlog/architecture/authregime.md",
    summary: "Authentication architecture notes and identity boundary context.",
    tags: ["auth", "security", "architecture"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["auth-and-sso"],
    relatedScreenshots: ["login", "admin-auth-providers"],
    liveRoutes: ["/login", "/admin/auth-providers"],
  },
  {
    id: "db-landscape",
    title: "Database Landscape",
    group: "Architecture",
    sourcePath: "docs/devlog/architecture/db-landscape.md",
    summary: "Database topology, schema boundaries, and data platform orientation.",
    tags: ["database", "architecture", "operations"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["database-schema-and-models"],
  },
  {
    id: "db-worklist",
    title: "Database Worklist",
    group: "Architecture",
    sourcePath: "docs/devlog/architecture/db-worklist.md",
    summary: "Database remediation and follow-up worklist.",
    tags: ["database", "operations", "backlog"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "ehr-omop-fhir-plan",
    title: "EHR OMOP FHIR Implementation Plan",
    group: "Architecture",
    sourcePath: "docs/devlog/architecture/ehr-omop-fhir-implementation-plan.md",
    summary: "Implementation plan for EHR, OMOP, and FHIR interoperability.",
    tags: ["omop", "fhir", "ehr", "architecture"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["fhir-and-imaging", "ingestion-etl"],
    liveRoutes: ["/ingestion"],
  },
  {
    id: "frontend-readme",
    title: "Frontend README",
    group: "Frontend",
    sourcePath: "frontend/README.md",
    summary: "Frontend app setup and implementation notes.",
    tags: ["frontend", "setup", "vite"],
    criticality: "High",
    sourceArea: "Frontend",
    relatedGraphs: ["frontend-routing-and-layout"],
  },
  {
    id: "frontend-routes",
    title: "Frontend Route Map",
    group: "Frontend",
    sourcePath: "generated/frontend-routes.md",
    generated: true,
    summary: "Generated snapshot of React router declarations and redirects.",
    tags: ["frontend", "routes", "generated"],
    criticality: "Critical",
    sourceArea: "Generated",
    relatedGraphs: ["frontend-routing-and-layout"],
  },
  {
    id: "light-mode-rollout",
    title: "Light Mode Rollout Notes",
    group: "Frontend",
    sourcePath: "docs/devlog/modules/ui/2026-04-12-light-mode-rollout.md",
    summary: "Frontend theme implementation notes and light-mode rollout evidence.",
    tags: ["frontend", "theme", "ui"],
    criticality: "High",
    sourceArea: "Docs",
    relatedScreenshots: ["dashboard", "settings"],
  },
  {
    id: "native-i18n-plan",
    title: "Native i18n Plan",
    group: "Frontend",
    sourcePath: "docs/superpowers/specs/2026-04-17-parthenon-native-i18n-plan.md",
    summary: "Internationalization design notes and implementation context.",
    tags: ["frontend", "i18n", "locales"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "publish-redesign",
    title: "Publish Redesign",
    group: "Frontend",
    sourcePath: "docs/devlog/process/publish-redesign.md",
    summary: "Publish workflow redesign notes and implementation rationale.",
    tags: ["publish", "frontend", "workflow"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["publish-export-full"],
    relatedScreenshots: ["publish"],
    liveRoutes: ["/publish"],
  },
  {
    id: "backend-readme",
    title: "Backend README",
    group: "Backend/API",
    sourcePath: "backend/README.md",
    summary: "Laravel backend notes and service entry points.",
    tags: ["backend", "laravel", "setup"],
    criticality: "High",
    sourceArea: "Backend",
    relatedGraphs: ["api-admin-auth-health"],
  },
  {
    id: "backend-api-routes",
    title: "Backend API Route Snapshot",
    group: "Backend/API",
    sourcePath: "generated/backend-api-routes.md",
    generated: true,
    summary: "Generated snapshot of Laravel route declarations across route files.",
    tags: ["backend", "api", "routes", "generated"],
    criticality: "Critical",
    sourceArea: "Generated",
    relatedGraphs: ["api-admin-auth-health"],
  },
  {
    id: "backend-api-file",
    title: "Laravel API Route Source",
    group: "Backend/API",
    sourcePath: "backend/routes/api.php",
    summary: "Raw Laravel API route declarations for authenticated and public endpoints.",
    tags: ["backend", "api", "routes", "source"],
    criticality: "Critical",
    sourceArea: "Backend",
    relatedGraphs: ["api-admin-auth-health"],
  },
  {
    id: "backend-web-file",
    title: "Laravel Web Route Source",
    group: "Backend/API",
    sourcePath: "backend/routes/web.php",
    summary: "Raw Laravel web routes and legacy Atlas/WebAPI redirects.",
    tags: ["backend", "web", "routes", "source"],
    criticality: "High",
    sourceArea: "Backend",
  },
  {
    id: "package-versions",
    title: "Package Version Summary",
    group: "Backend/API",
    sourcePath: "generated/package-versions.md",
    generated: true,
    summary: "Generated snapshot of package metadata from frontend, backend, e2e, and docs packages.",
    tags: ["dependencies", "versions", "generated"],
    criticality: "High",
    sourceArea: "Generated",
  },
  {
    id: "deploy-script",
    title: "Deploy Script",
    group: "Operations",
    sourcePath: "deploy.sh",
    summary: "Primary Parthenon deployment script.",
    tags: ["deploy", "operations", "shell"],
    criticality: "Critical",
    sourceArea: "Root",
  },
  {
    id: "deploy-summary",
    title: "Deploy Script Summary",
    group: "Operations",
    sourcePath: "generated/deploy-script-summary.md",
    generated: true,
    summary: "Generated summary of high-signal deploy script commands and stages.",
    tags: ["deploy", "operations", "generated"],
    criticality: "Critical",
    sourceArea: "Generated",
  },
  {
    id: "deploy-cache-audit",
    title: "Deploy Cache Audit",
    group: "Operations",
    sourcePath: "docs/ops/deploy-cache-audit.md",
    summary: "Deployment cache and runtime freshness checks.",
    tags: ["deploy", "cache", "operations"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "postgres-host-backups",
    title: "Host PostgreSQL Backups",
    group: "Operations",
    sourcePath: "docs/ops/postgres-host-backups.md",
    summary: "Host-native PostgreSQL backup strategy and restore notes.",
    tags: ["database", "backup", "operations"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "github-project-v2",
    title: "GitHub Project V2 Operations",
    group: "Operations",
    sourcePath: "docs/ops/github-project-v2.md",
    summary: "GitHub Projects operational notes and roadmap management context.",
    tags: ["planning", "github", "operations"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "dev-vhost-snapshot",
    title: "dev.acumenus.net Apache Vhost Snapshot",
    group: "Operations",
    sourcePath: "generated/apache-vhost-dev-acumenus.md",
    generated: true,
    summary: "Generated snapshot of the local Apache HTTP and HTTPS vhost source files.",
    tags: ["apache", "vhost", "ssl", "generated"],
    criticality: "Critical",
    sourceArea: "Generated",
  },
  {
    id: "installer-readme",
    title: "Installer README",
    group: "Install/Release",
    sourcePath: "installer/README.md",
    summary: "Community installer workflow and implementation notes.",
    tags: ["installer", "release", "community"],
    criticality: "Critical",
    sourceArea: "Installer",
    liveRoutes: ["/install/"],
  },
  {
    id: "installer-contract",
    title: "Installer v0.3.0 Design Contract",
    group: "Install/Release",
    sourcePath: "docs/superpowers/specs/2026-04-26-installer-v0.3.0-design-contract.md",
    summary: "Installer contract and expected first-run behavior.",
    tags: ["installer", "contract", "release"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "installer-first-run",
    title: "Installer First-Run Design",
    group: "Install/Release",
    sourcePath: "docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md",
    summary: "Comprehensive first-run installer design and operator flow.",
    tags: ["installer", "first-run", "operator"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "trusted-signing-handoff",
    title: "Trusted Signing Handoff",
    group: "Install/Release",
    sourcePath: "docs/handoffs/2026-04-21-rust-installer-trusted-signing-handoff.md",
    summary: "Signing and release handoff notes for installer distribution.",
    tags: ["signing", "release", "installer"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "authentik-sso-handoff",
    title: "Authentik Parthenon SSO Handoff",
    group: "Auth/SSO",
    sourcePath: "docs/handoffs/2026-04-13-authentik-parthenon-sso-handoff.md",
    summary: "OIDC/AuthentiK handoff, identity normalization, and admin mapping notes.",
    tags: ["auth", "sso", "oidc", "authentik"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["auth-and-sso"],
    relatedScreenshots: ["login", "admin-auth-providers"],
  },
  {
    id: "authentik-bootstrap",
    title: "Authentik SSO Bootstrap Automation",
    group: "Auth/SSO",
    sourcePath: "docs/devlog/process/authentik-sso-bootstrap-automation-2026-04-03.md",
    summary: "Automation notes for Authentik SSO setup.",
    tags: ["auth", "sso", "automation", "authentik"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["auth-and-sso"],
  },
  {
    id: "sso-frontend",
    title: "Authentik SSO Frontend Phase",
    group: "Auth/SSO",
    sourcePath: "docs/devlog/2026-04-13-authentik-sso-phase6-frontend.md",
    summary: "Frontend SSO rollout notes and callback behavior context.",
    tags: ["auth", "sso", "frontend"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["auth-and-sso"],
    liveRoutes: ["/login"],
  },
  {
    id: "study-designer-workflow",
    title: "Study Designer OHDSI Workflow",
    group: "Study/OHDSI",
    sourcePath: "docs/devlog/2026-04-15-study-designer-ohdsi-workflow.md",
    summary: "Study Designer and OHDSI workflow implementation notes.",
    tags: ["study", "ohdsi", "study-designer"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["study-designer", "study-lifecycle"],
    relatedScreenshots: ["studies", "studies-create"],
    liveRoutes: ["/studies", "/studies/create"],
  },
  {
    id: "study-designer-compiler",
    title: "Study Designer Compiler Plan",
    group: "Study/OHDSI",
    sourcePath: "docs/superpowers/plans/2026-04-15-study-designer-ohdsi-compiler-plan.md",
    summary: "Compiler-style Study Designer plan for OHDSI-compatible artifacts.",
    tags: ["study", "compiler", "ohdsi"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["study-designer"],
  },
  {
    id: "ohdsi-integration",
    title: "OHDSI Ecosystem Integration",
    group: "Study/OHDSI",
    sourcePath: "docs/devlog/process/ohdsi-ecosystem-integration.md",
    summary: "OHDSI ecosystem integration notes, parity goals, and workflow context.",
    tags: ["ohdsi", "atlas", "integration"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["atlas-migration-wizard", "study-lifecycle"],
  },
  {
    id: "atlas-migration-wizard",
    title: "Atlas Migration Wizard",
    group: "Study/OHDSI",
    sourcePath: "docs/devlog/process/atlas-migration-wizard.md",
    summary: "ATLAS migration wizard implementation notes and parity context.",
    tags: ["atlas", "ohdsi", "migration"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["atlas-migration-wizard"],
    relatedScreenshots: ["admin-webapi-registry"],
  },
  {
    id: "ohdsi-full-parity",
    title: "OHDSI Full Parity Plan",
    group: "Study/OHDSI",
    sourcePath: "docs/superpowers/plans/2026-04-13-ohdsi-full-parity.md",
    summary: "Plan for closing OHDSI parity gaps across study workflows.",
    tags: ["ohdsi", "parity", "planning"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "testing-phase",
    title: "Testing Phase Notes",
    group: "Testing Evidence",
    sourcePath: "docs/devlog/phases/08-testing.md",
    summary: "Testing strategy and phase notes.",
    tags: ["testing", "e2e", "quality"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "e2e-package",
    title: "E2E Package Metadata",
    group: "Testing Evidence",
    sourcePath: "e2e/package.json",
    summary: "Playwright/E2E package metadata and scripts.",
    tags: ["testing", "playwright", "package"],
    criticality: "High",
    sourceArea: "E2E",
    relatedScreenshots: ["dashboard", "publish", "jobs"],
  },
  {
    id: "import-test-suite",
    title: "Comprehensive Import Test Suite",
    group: "Testing Evidence",
    sourcePath: "docs/devlog/process/comprehensive-import-test-suite.md",
    summary: "Import test strategy and coverage notes.",
    tags: ["testing", "ingestion", "quality"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["ingestion-etl"],
  },
  {
    id: "graphify-screenshot-summary",
    title: "Graphify and Screenshot Evidence Summary",
    group: "Testing Evidence",
    sourcePath: "generated/graphify-and-screenshots.md",
    generated: true,
    summary: "Generated summary of Graphify and screenshot catalogue counts.",
    tags: ["graphify", "screenshots", "generated", "evidence"],
    criticality: "Critical",
    sourceArea: "Generated",
    relatedGraphs: ["frontend-routing-and-layout"],
  },
  {
    id: "demo-script",
    title: "End-to-End Demo Script",
    group: "Demo/Handoff",
    sourcePath: "docs/demo/end-to-end-demo-script.md",
    summary: "Presenter-ready walkthrough of the platform surface.",
    tags: ["demo", "handoff", "presentation"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "finngen-demo",
    title: "FinnGen Demo HOWTO",
    group: "Demo/Handoff",
    sourcePath: "docs/demo/HOWTO-DEMO-FINNGEN.md",
    summary: "FinnGen-specific demo preparation and execution notes.",
    tags: ["demo", "finngen", "howto"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["finngen-workbench"],
  },
  {
    id: "acropolis-handoff",
    title: "Parthenon Acropolis Integration Handoff",
    group: "Demo/Handoff",
    sourcePath: "docs/handoffs/parthenon-acropolis-integration-prompt.md",
    summary: "Integration handoff notes for Parthenon and Acropolis edges.",
    tags: ["handoff", "acropolis", "integration"],
    criticality: "High",
    sourceArea: "Docs",
  },
  {
    id: "security-policies",
    title: "Security Policies",
    group: "Compliance",
    sourcePath: "docs/compliance/security-policies.md",
    summary: "Security policy reference for Parthenon operations.",
    tags: ["security", "compliance", "policy"],
    criticality: "Critical",
    sourceArea: "Docs",
    relatedGraphs: ["auth-and-sso"],
  },
  {
    id: "incident-response",
    title: "Incident Response Plan",
    group: "Compliance",
    sourcePath: "docs/compliance/incident-response-plan.md",
    summary: "Incident response procedure and operational escalation context.",
    tags: ["security", "incident", "operations"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "disaster-recovery",
    title: "Disaster Recovery Plan",
    group: "Compliance",
    sourcePath: "docs/compliance/disaster-recovery-plan.md",
    summary: "Disaster recovery plan and continuity notes.",
    tags: ["backup", "disaster-recovery", "operations"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment",
    group: "Compliance",
    sourcePath: "docs/compliance/risk-assessment.md",
    summary: "Risk assessment and compliance context.",
    tags: ["risk", "compliance", "security"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "audit-controls",
    title: "Audit Controls",
    group: "Compliance",
    sourcePath: "docs/compliance/audit-controls.md",
    summary: "Audit control inventory and compliance evidence notes.",
    tags: ["audit", "compliance", "controls"],
    criticality: "Critical",
    sourceArea: "Docs",
  },
  {
    id: "finngen-runbook",
    title: "FinnGen Runbook",
    group: "Workbench/FinnGen",
    sourcePath: "docs/devlog/modules/finngen/runbook.md",
    summary: "FinnGen module runbook and operational workflow notes.",
    tags: ["finngen", "runbook", "workbench"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["finngen-workbench"],
    liveRoutes: ["/workbench/finngen-analyses", "/workbench/finngen-endpoints"],
  },
  {
    id: "finngen-howto",
    title: "FinnGen Workbench How-To",
    group: "Workbench/FinnGen",
    sourcePath: "docs/devlog/modules/finngen/finngen-workbench-how-to.md",
    summary: "FinnGen Workbench user and developer workflow guide.",
    tags: ["finngen", "howto", "workbench"],
    criticality: "High",
    sourceArea: "Docs",
    relatedGraphs: ["finngen-workbench"],
  },
  {
    id: "community-workbench-sdk",
    title: "Community Workbench SDK",
    group: "Workbench/FinnGen",
    sourcePath: "docs/devlog/process/community-workbench-sdk.md",
    summary: "Community Workbench SDK implementation and integration notes.",
    tags: ["workbench", "sdk", "community"],
    criticality: "High",
    sourceArea: "Docs",
    relatedScreenshots: ["workbench-community-sdk-demo"],
    liveRoutes: ["/workbench/community-sdk-demo"],
  },
];

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function hrefFor(relativePath) {
  return `/reference/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function formatIso(stat) {
  return stat ? stat.mtime.toISOString() : "";
}

function ageDays(stat) {
  if (!stat) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - stat.mtime.getTime()) / 86400000));
}

function lineTableRows(filePath, matcher, mapLine) {
  const text = readText(filePath);
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!matcher(line)) {
      return [];
    }
    return [mapLine(line.trim(), index + 1)];
  });
}

function writeGenerated(relativePath, content) {
  const destination = path.join(targetRoot, relativePath);
  ensureDir(path.dirname(destination));
  fs.writeFileSync(destination, content, "utf8");
  fs.chmodSync(destination, 0o644);
}

function generateFrontendRoutes() {
  const routerPath = path.join(repoRoot, "frontend", "src", "app", "router.tsx");
  const rows = lineTableRows(
    routerPath,
    (line) => /\bpath:\s*["']/.test(line) || /<Navigate\s+to=/.test(line) || /index:\s*true/.test(line),
    (line, number) => `| ${number} | \`${line.replace(/\|/g, "\\|")}\` |`,
  );

  const body = [
    "# Frontend Route Map",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Source: \`frontend/src/app/router.tsx\``,
    "",
    `Route declarations and redirects detected: ${rows.length}`,
    "",
    "| Line | Declaration |",
    "| ---: | --- |",
    ...rows,
    "",
  ].join("\n");

  writeGenerated("generated/frontend-routes.md", body);
}

function generateBackendRoutes() {
  const routeFiles = ["backend/routes/api.php", "backend/routes/web.php", "backend/routes/fhir.php"];
  const rows = [];
  for (const relative of routeFiles) {
    const filePath = path.join(repoRoot, relative);
    rows.push(...lineTableRows(
      filePath,
      (line) => /Route::(get|post|put|patch|delete|any|apiResource|resource|prefix|middleware)/.test(line),
      (line, number) => `| \`${relative}\` | ${number} | \`${line.replace(/\|/g, "\\|")}\` |`,
    ));
  }

  const body = [
    "# Backend API Route Snapshot",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Route declarations detected: ${rows.length}`,
    "",
    "| File | Line | Declaration |",
    "| --- | ---: | --- |",
    ...rows,
    "",
  ].join("\n");

  writeGenerated("generated/backend-api-routes.md", body);
}

function readPackage(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function generatePackageVersions() {
  const packages = [
    ["Frontend", "frontend/package.json", ["react", "vite", "typescript", "lucide-react", "@vitejs/plugin-react"]],
    ["Backend npm", "backend/package.json", ["vite", "laravel-vite-plugin", "typescript"]],
    ["E2E", "e2e/package.json", ["@playwright/test"]],
    ["Docs site", "docs/site/package.json", ["@docusaurus/core", "@docusaurus/preset-classic", "typescript"]],
  ];
  const rows = [];
  for (const [label, relative, keys] of packages) {
    const pkg = readPackage(relative);
    if (!pkg) {
      rows.push(`| ${label} | \`${relative}\` | Missing | |`);
      continue;
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const selected = keys.map((key) => deps[key] ? `${key}: ${deps[key]}` : null).filter(Boolean).join("<br>");
    rows.push(`| ${label} | \`${relative}\` | ${pkg.name || "unnamed"} | ${selected || "No selected packages found"} |`);
  }

  const composerPath = path.join(repoRoot, "backend", "composer.json");
  if (fs.existsSync(composerPath)) {
    const composer = JSON.parse(fs.readFileSync(composerPath, "utf8"));
    const deps = { ...(composer.require || {}), ...(composer["require-dev"] || {}) };
    const selected = ["php", "laravel/framework", "laravel/sanctum", "firebase/php-jwt", "pestphp/pest"]
      .map((key) => deps[key] ? `${key}: ${deps[key]}` : null)
      .filter(Boolean)
      .join("<br>");
    rows.push(`| Backend Composer | \`backend/composer.json\` | ${composer.name || "composer"} | ${selected || "No selected packages found"} |`);
  }

  const body = [
    "# Package Version Summary",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "| Area | File | Package | Selected Versions |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");

  writeGenerated("generated/package-versions.md", body);
}

function generateDeploySummary() {
  const deployPath = path.join(repoRoot, "deploy.sh");
  const text = readText(deployPath);
  const rows = text.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return [];
    }
    if (!/(npm|composer|artisan|rsync|curl|route:list|openapi|swagger|deploy|reload|systemctl|php-fpm|smoke|cache|migrate|vite|build)/i.test(trimmed)) {
      return [];
    }
    return [`| ${index + 1} | \`${trimmed.replace(/\|/g, "\\|")}\` |`];
  }).slice(0, 160);

  const body = [
    "# Deploy Script Summary",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "This snapshot highlights deploy commands that affect builds, generated assets, caches, migrations, service reloads, and smoke checks.",
    "",
    "| Line | Command |",
    "| ---: | --- |",
    ...rows,
    "",
  ].join("\n");

  writeGenerated("generated/deploy-script-summary.md", body);
}

function generateApacheSnapshot() {
  const files = [
    path.join(portalRoot, "apache", "dev.acumenus.net.conf"),
    path.join(portalRoot, "apache", "dev.acumenus.net-le-ssl.conf"),
  ];
  const sections = files.map((filePath) => [
    `## ${path.basename(filePath)}`,
    "",
    "```apache",
    readText(filePath).trimEnd(),
    "```",
    "",
  ].join("\n"));

  const body = [
    "# dev.acumenus.net Apache Vhost Snapshot",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "These files are the source-controlled vhost references for the developer portal.",
    "",
    ...sections,
  ].join("\n");

  writeGenerated("generated/apache-vhost-dev-acumenus.md", body);
}

function generateEvidenceSummary() {
  const graphPath = path.join(portalRoot, "public", "graphify", "catalog.json");
  const screenshotPath = path.join(portalRoot, "public", "screenshots", "application-library", "manifest.json");
  let graphRows = [];
  let screenshotRows = [];
  let graphCount = "Unavailable";
  let screenshotCount = "Unavailable";
  let routeCount = "Unavailable";
  let generated = "Unavailable";

  if (fs.existsSync(graphPath)) {
    const graphs = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    graphCount = String(graphs.length);
    graphRows = graphs
      .slice()
      .sort((a, b) => (b.nodes || 0) - (a.nodes || 0))
      .slice(0, 12)
      .map((graph) => `| ${graph.title} | ${graph.category || ""} | ${graph.nodes || 0} | ${graph.edges || 0} | ${graph.communities || 0} |`);
  }

  if (fs.existsSync(screenshotPath)) {
    const manifest = JSON.parse(fs.readFileSync(screenshotPath, "utf8"));
    screenshotCount = String(manifest.screenshotCount || manifest.entries?.length || 0);
    routeCount = String(manifest.routeCount || 0);
    generated = manifest.generatedAt || "Unavailable";
    const grouped = new Map();
    for (const entry of manifest.entries || []) {
      grouped.set(entry.group, (grouped.get(entry.group) || 0) + 1);
    }
    screenshotRows = [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([group, count]) => `| ${group} | ${count} |`);
  }

  const body = [
    "# Graphify and Screenshot Evidence Summary",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Graph views: ${graphCount}`,
    "",
    `Screenshot captures: ${screenshotCount}`,
    "",
    `UI routes: ${routeCount}`,
    "",
    `Screenshot manifest generated: ${generated}`,
    "",
    "## Highest Node Graphs",
    "",
    "| Graph | Category | Nodes | Edges | Communities |",
    "| --- | --- | ---: | ---: | ---: |",
    ...graphRows,
    "",
    "## Screenshot Groups",
    "",
    "| Group | Captures |",
    "| --- | ---: |",
    ...screenshotRows,
    "",
  ].join("\n");

  writeGenerated("generated/graphify-and-screenshots.md", body);
}

function generateSnapshots() {
  ensureDir(generatedRoot);
  generateFrontendRoutes();
  generateBackendRoutes();
  generatePackageVersions();
  generateDeploySummary();
  generateApacheSnapshot();
  generateEvidenceSummary();
}

function copySource(definition) {
  const source = path.join(repoRoot, definition.sourcePath);
  const destination = path.join(targetRoot, definition.sourcePath);
  if (!fs.existsSync(source)) {
    return { source, destination, missing: true };
  }
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o644);
  return { source, destination, missing: false };
}

function buildManifestEntry(definition) {
  const source = definition.generated
    ? path.join(targetRoot, definition.sourcePath)
    : path.join(repoRoot, definition.sourcePath);
  const destination = path.join(targetRoot, definition.sourcePath);

  let copyResult = { source, destination, missing: false };
  if (!definition.generated) {
    copyResult = copySource(definition);
  }

  const sourceExists = fs.existsSync(copyResult.source);
  const destinationExists = fs.existsSync(copyResult.destination);
  const sourceStat = sourceExists ? fs.statSync(copyResult.source) : null;
  const destinationStat = destinationExists ? fs.statSync(copyResult.destination) : null;
  const sourceChecksum = sourceExists ? sha256(copyResult.source) : "";
  const mirroredChecksum = destinationExists ? sha256(copyResult.destination) : "";
  const status = !sourceExists || !destinationExists
    ? "Missing"
    : sourceChecksum === mirroredChecksum
      ? "Ready"
      : "Stale";
  const daysOld = ageDays(sourceStat);
  const freshnessDays = definition.freshnessDays || (definition.criticality === "Critical" ? 45 : 90);
  const freshness = status !== "Ready"
    ? status
    : daysOld !== null && daysOld > freshnessDays && ["Critical", "High"].includes(definition.criticality)
      ? "Review"
      : "Ready";

  return {
    id: definition.id,
    title: definition.title,
    group: definition.group,
    summary: definition.summary,
    tags: definition.tags || [],
    criticality: definition.criticality || "Normal",
    sourceArea: definition.sourceArea || "Docs",
    sourcePath: definition.sourcePath,
    href: hrefFor(definition.sourcePath),
    fileType: path.extname(definition.sourcePath).replace(".", "") || "text",
    generated: Boolean(definition.generated),
    status,
    freshness,
    sourceLastModified: formatIso(sourceStat),
    mirroredAt: formatIso(destinationStat),
    sourceAgeDays: daysOld,
    sizeBytes: destinationStat ? destinationStat.size : 0,
    checksum: mirroredChecksum,
    sourceChecksum,
    relatedGraphs: definition.relatedGraphs || [],
    relatedScreenshots: definition.relatedScreenshots || [],
    liveRoutes: definition.liveRoutes || [],
  };
}

function main() {
  ensureDir(targetRoot);
  generateSnapshots();

  const entries = docs.map(buildManifestEntry);
  const manifest = {
    generatedAt,
    repoRoot,
    portalRoot,
    count: entries.length,
    readyCount: entries.filter((entry) => entry.status === "Ready").length,
    reviewCount: entries.filter((entry) => entry.freshness === "Review").length,
    missingCount: entries.filter((entry) => entry.status === "Missing").length,
    groups: [...new Set(entries.map((entry) => entry.group))].sort(),
    tags: [...new Set(entries.flatMap((entry) => entry.tags))].sort(),
    sourceAreas: [...new Set(entries.map((entry) => entry.sourceArea))].sort(),
    entries,
  };

  const manifestPath = path.join(targetRoot, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.chmodSync(manifestPath, 0o644);
  console.log(`reference manifest generated: ${manifestPath}`);
  console.log(`reference entries: ${manifest.count}, ready: ${manifest.readyCount}, review: ${manifest.reviewCount}, missing: ${manifest.missingCount}`);
}

main();
