# dev.acumenus.net Improvement TODO

This TODO tracks the next practical improvements for the Parthenon developer
portal at `https://dev.acumenus.net/`.

## Implemented in this pass

### 1. Theme Control

- Add a visible dark/light theme toggle to the main landing page.
- Reuse the existing `localStorage.parthenon-theme` key so the portal stays in
  sync with Graphify pages.
- Apply the theme class before the stylesheet loads to avoid a visible theme
  flash.
- Acceptance criteria:
  - Toggle updates the page immediately.
  - Toggle persists across reloads.
  - Browser checks confirm dark and light token values.

### 2. Global Search

- Add one search box that spans graph views, screenshot evidence, and reference
  documents.
- Show typed result groups with direct actions:
  - Open graph.
  - Preview screenshot.
  - Open reference markdown.
- Keep existing tab-specific filters for deep browsing.
- Acceptance criteria:
  - Searching for a graph title returns the Graphify item.
  - Searching for a route or label returns screenshot entries.
  - Searching for a doc title or group returns reference docs.

### 3. Asset Health Panel

- Show live status for key local portal assets:
  - Portal HTML.
  - CSS.
  - JavaScript.
  - Graphify catalog.
  - Screenshot manifest.
  - Reference docs.
- Include generated timestamps and asset counts where available.
- Surface failures in the page instead of making users infer broken state from
  missing cards.
- Acceptance criteria:
  - Healthy assets display as `Ready`.
  - JSON manifest failures display as `Blocked`.
  - Counts and generation times are visible from the overview.

### 4. Screenshot Preview Modal

- Let users preview screenshots directly from the landing page.
- Modal should show:
  - Screenshot image.
  - Route.
  - Locale.
  - Theme.
  - Capture timestamp.
  - Links to the raw image and screenshot catalogue anchor.
- Keep the modal responsive and keyboard dismissible.
- Acceptance criteria:
  - Clicking a screenshot card opens the modal.
  - Close button, backdrop click, and `Escape` dismiss it.
  - Modal fits desktop and mobile viewports.

### 5. Graph Detail Summaries

- Add richer graph cards with high-signal metrics and path previews.
- Keep direct links to interactive graph, report, and GraphML where available.
- Highlight status errors if a generated graph is not healthy.
- Acceptance criteria:
  - Graph cards show nodes, edges, communities, and representative paths.
  - Error states are visually distinct.

### 6. Recent Changes

- Surface the newest screenshot captures and recently generated portal assets.
- Make the page act as an operational dashboard, not only a directory.
- Acceptance criteria:
  - Overview shows a recent-captures list sorted by capture timestamp.
  - Asset timestamps are visible in the health panel.

### 7. Operational Guard

- Add a repeatable smoke script that checks:
  - Web-readable permissions.
  - Required JSON parses.
  - Local HTTPS responses for `/`, CSS, JS, graph catalog, screenshot manifest,
    Graphify index, and screenshot catalogue.
- Use the guard after asset syncs and style changes.
- Acceptance criteria:
  - Script exits non-zero on unreadable assets, invalid JSON, or failed HTTP
    checks.
  - Script repairs public file/directory modes before smoke checks.

### 8. Page Framing

- Add consistent portal navigation and breadcrumbs so users can move between the
  landing page, Graphify, screenshots, docs, and live Parthenon without losing
  context.
- Acceptance criteria:
  - Header exposes primary resource links and current portal context.
  - Links remain usable on mobile.

## Follow-up Backlog

### Graph-to-Source Deep Links

- Extend landing-page graph summaries with direct links into source modal
  support when a graph exposes file-path metadata in a stable manifest.

### Reference Markdown Viewer

- Add an in-page markdown preview modal for the curated reference shelf.
- Keep raw markdown links available for copy/paste workflows.

### Automated Visual Regression

- Add Playwright smoke coverage for the static portal itself:
  - Desktop dark.
  - Desktop light.
  - Mobile dark.
  - Global search.
  - Screenshot modal.

### Staleness Policy

- Define freshness thresholds for screenshots and Graphify output.
- Show warning badges when screenshots or graph catalog data are older than the
  expected refresh window.

## Reference Tab Deepening Plan

The Reference tab should be the primary developer knowledge shelf for
Parthenon, not a short collection of markdown links. It needs generated
metadata, operational context, and direct preview workflows.

### 1. Reference Manifest

- Generate `/reference/manifest.json` from the local Parthenon checkout.
- Replace hardcoded reference document data in the landing-page JavaScript.
- Include metadata for each asset:
  - Stable id.
  - Title.
  - Group.
  - Summary.
  - Source path.
  - Portal href.
  - File type.
  - Tags.
  - Criticality.
  - Source area.
  - Related graph slugs.
  - Related screenshot labels.
  - Related live app routes.
  - Source and mirrored timestamps.
  - Size.
  - SHA-256 checksum.
  - Status and freshness label.
- Acceptance criteria:
  - Reference tab renders from manifest data.
  - Missing or stale assets are visible.
  - Manifest generation is repeatable from `scripts/sync-reference.sh`.

### 2. Critical Reference Coverage

- Mirror the most important Parthenon developer assets:
  - Start-here docs: README, AGENTS, CONTRIBUTING, ROADMAP.
  - Architecture docs: auth regime, DB landscape, app schema, EHR/OMOP/FHIR.
  - Frontend docs: frontend README, router snapshot, theme/i18n notes.
  - Backend/API docs: backend README, route files, API route snapshot.
  - Operations docs: deploy audit, host backups, GitHub project ops, deploy
    script summary, dev vhost config.
  - Installer/release docs: installer README and signing/install contracts.
  - Auth/SSO docs: Authentik handoff and bootstrap notes.
  - Study/OHDSI docs: Study Designer, OHDSI parity, Atlas migration.
  - Testing evidence docs: E2E/package context, testing phase notes, Graphify
    and screenshot manifest summary.
  - Demo/handoff docs: demo script, FinnGen HOWTO, integration handoffs.
  - Compliance docs: security, incident response, disaster recovery, risk, audit
    controls.
  - Workbench/FinnGen docs: runbooks and how-to assets.
- Acceptance criteria:
  - Reference manifest contains a broad critical shelf, not only 12 links.
  - Critical assets are badged distinctly.

### 3. Generated Operational Snapshots

- Generate markdown snapshots under `/reference/generated/`:
  - Frontend route map.
  - Backend/API route declaration snapshot.
  - Package version summary.
  - Deploy script summary.
  - Apache vhost snapshot for `dev.acumenus.net`.
  - Graphify/screenshot evidence summary.
- Acceptance criteria:
  - Generated snapshots appear in the Reference tab.
  - Snapshots refresh when `sync-reference.sh` runs.

### 4. Reference Filtering

- Add Reference-specific filters:
  - Search.
  - Group.
  - Tag.
  - Criticality.
  - Source area.
  - Status/freshness.
- Acceptance criteria:
  - Filtering works without affecting other tabs.
  - Counts update after filters are applied.

### 5. Markdown Preview Modal

- Add an in-page preview modal for markdown, shell, PHP, JSON, and text assets.
- Show metadata alongside the preview:
  - Source path.
  - Portal href.
  - Criticality.
  - Status.
  - Tags.
  - Related graphs.
  - Related screenshots.
  - Live routes.
  - Checksum.
- Render common markdown features safely:
  - Headings.
  - Paragraphs.
  - Lists.
  - Code fences.
  - Links.
- Acceptance criteria:
  - Preview opens from Reference cards.
  - Raw file links remain available.
  - Close button, backdrop, and `Escape` dismiss the modal.

### 6. Related Assets

- Add related links from Reference cards:
  - Graphify graph pages.
  - Screenshot catalogue filters/anchors.
  - Live Parthenon routes.
  - Raw mirrored file.
- Acceptance criteria:
  - Related graph and live-route links are visible where metadata exists.
  - Links remain usable on mobile.

### 7. Guardrails

- Extend portal smoke checks to validate `/reference/manifest.json`.
- Confirm the Reference tab loads without console errors.
- Acceptance criteria:
  - Smoke script fails on invalid or missing reference manifest.
  - Browser verification covers filters and markdown preview.

## SchemaSpy Database Augmentation

### 1. Tooling And Repeatable Generation

- [x] Use SchemaSpy for PostgreSQL schema documentation instead of ad hoc HTML.
- [x] Download/cache SchemaSpy and the PostgreSQL JDBC driver under
  `tools/schemaspy/`.
- [x] Add `scripts/generate-schemaspy.sh` with environment-driven database
  settings and no generated password artifacts.
- [x] Run SchemaSpy with `-norows` so the OMOP footprint is documented without
  full table scans.
- [x] Generate separate reports for `app`, `omop`, and `vocab`.

### 2. PostgreSQL Catalog Analysis

- [x] Add a catalog metadata generator for:
  - Schema table/view/materialized-view/index counts.
  - Total relation footprint.
  - Largest relations by total size.
  - Estimated row counts from PostgreSQL statistics.
  - Primary-key gaps.
  - No-index tables.
  - Foreign-key edges.
- [x] Write `/schemaspy/manifest.json` for the landing page.
- [x] Write `/schemaspy/summary.md` for quick terminal or browser review.
- [x] Write per-schema `/schemaspy/{schema}/analysis.html`.
- [x] Write per-schema `/schemaspy/{schema}/metadata.json`.

### 3. Developer Portal UI

- [x] Add a Database tab to the landing page.
- [x] Add a SchemaSpy resource card to the overview.
- [x] Add database asset health checks to portal readiness.
- [x] Show schema-level cards for `app`, `omop`, and `vocab`.
- [x] Show largest database relations in a scannable table.
- [x] Add database schemas and top relations to unified search.
- [x] Keep the page aligned with the Parthenon visual system.

### 4. Validation And Operations

- [x] Extend `scripts/smoke-portal.sh` to require SchemaSpy manifests and
  report indexes.
- [x] Document the refresh command in `README.md`.
- [x] Verify generated output is web-readable.
- [ ] Add an optional scheduled refresh once the desired cadence is clear.
- [ ] Add table-comment enrichment from Laravel model/doc metadata where useful.

## Authentik SSO Gate

- [x] Register a dedicated Authentik OIDC application/provider for the portal.
- [x] Protect `dev.acumenus.net` with Apache `mod_auth_openidc`.
- [x] Store OIDC client secret material outside the repository under
  `/etc/apache2/dev-portal-oidc/`.
- [x] Update the SSL vhost source and live Apache vhost to include the OIDC gate.
- [x] Update smoke checks to verify unauthenticated requests redirect to
  Authentik.
