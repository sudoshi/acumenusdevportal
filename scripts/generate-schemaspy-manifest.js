#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const portalRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(portalRoot, "public");
const schemaSpyRoot = path.join(publicRoot, "schemaspy");

const dbHost = process.env.SCHEMASPY_DB_HOST || "127.0.0.1";
const dbPort = process.env.SCHEMASPY_DB_PORT || "5432";
const dbName = process.env.SCHEMASPY_DB_NAME || "parthenon";
const dbUser = process.env.SCHEMASPY_DB_USER || "smudoshi";
const schemas = (process.env.SCHEMASPY_SCHEMAS || "app omop vocab")
  .split(/[,\s]+/)
  .map((schema) => schema.trim())
  .filter(Boolean);

if (!process.env.SCHEMASPY_DB_PASSWORD && !process.env.PGPASSWORD) {
  throw new Error("Set SCHEMASPY_DB_PASSWORD or PGPASSWORD before generating database metadata.");
}

const schemaInfo = {
  app: {
    title: "Application Schema",
    purpose:
      "Parthenon application and operations data: auth, studies, publishing, jobs, care gaps, GIS, risk scores, feature vectors, and local workflow state.",
    criticalAssets: [
      "jobs, failed_jobs, and migration state for runtime operations",
      "study, publish, cohort, concept-set, and analysis tables for user workflows",
      "GIS, genomics, imaging, and risk-score tables that connect specialized modules to the application",
    ],
  },
  omop: {
    title: "OMOP CDM Schema",
    purpose:
      "Acumenus patient-level OHDSI CDM surface, including persons, visits, clinical events, measurements, observations, notes, exposures, procedures, and derived visit staging.",
    criticalAssets: [
      "clinical event tables used by OHDSI analytics and cohort construction",
      "high-volume measurement, note, observation, drug exposure, procedure occurrence, and visit tables",
      "derived visit assignment tables that explain how raw events are normalized into analytic visits",
    ],
  },
  vocab: {
    title: "Vocabulary Schema",
    purpose:
      "OHDSI vocabulary reference layer: concepts, relationships, ancestors, domains, classes, vocabularies, and source-to-standard mapping support.",
    criticalAssets: [
      "concept and concept_relationship for code identity and semantic links",
      "concept_ancestor for hierarchy expansion and cohort vocabulary logic",
      "domain, concept_class, vocabulary, and relationship metadata for interpretation and validation",
    ],
  },
};

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPsql(sql) {
  const env = {
    ...process.env,
    PGPASSWORD: process.env.SCHEMASPY_DB_PASSWORD || process.env.PGPASSWORD,
  };
  const wrappedSql = `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (${sql}) t`;
  const output = execFileSync(
    "psql",
    [
      "-h",
      dbHost,
      "-p",
      dbPort,
      "-U",
      dbUser,
      "-d",
      dbName,
      "-X",
      "-q",
      "-A",
      "-t",
      "-c",
      wrappedSql,
    ],
    { env, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  ).trim();
  return output ? JSON.parse(output) : [];
}

function relationSql(schemaName, limit = null) {
  const schema = sqlLiteral(schemaName);
  const limitSql = limit ? `limit ${Number(limit)}` : "";
  return `
    select
      n.nspname as schema_name,
      c.relname as relation_name,
      case c.relkind
        when 'r' then 'table'
        when 'p' then 'partitioned table'
        when 'm' then 'materialized view'
        when 'v' then 'view'
        else c.relkind::text
      end as relation_type,
      greatest(c.reltuples, 0)::bigint as estimated_rows,
      pg_total_relation_size(c.oid)::bigint as total_bytes,
      pg_relation_size(c.oid)::bigint as table_bytes,
      pg_indexes_size(c.oid)::bigint as index_bytes,
      (
        select count(*)::int
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attnum > 0
          and not a.attisdropped
      ) as column_count,
      (
        select count(*)::int
        from pg_index i
        where i.indrelid = c.oid
      ) as index_count,
      (
        select count(*)::int
        from pg_constraint con
        where con.conrelid = c.oid
          and con.contype = 'p'
      ) as primary_key_count,
      (
        select count(*)::int
        from pg_constraint con
        where con.conrelid = c.oid
          and con.contype = 'f'
      ) as outbound_fk_count,
      (
        select count(*)::int
        from pg_constraint con
        where con.confrelid = c.oid
          and con.contype = 'f'
      ) as inbound_fk_count,
      coalesce(obj_description(c.oid, 'pg_class'), '') as comment
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p', 'm', 'v')
    order by pg_total_relation_size(c.oid) desc, c.relname asc
    ${limitSql}
  `;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
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

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function schemaLink(schemaName, href, label) {
  return { href: `/schemaspy/${schemaName}/${href}`, label };
}

function tableHref(schemaName, relationName) {
  return `/schemaspy/${schemaName}/tables/${encodeURIComponent(relationName)}.html`;
}

function makeAnalysisHtml(schema) {
  const largestRows = schema.topRelations.slice(0, 18).map((relation) => `
    <tr>
      <td><a href="${htmlEscape(relation.href)}">${htmlEscape(relation.relationName)}</a></td>
      <td>${htmlEscape(relation.relationType)}</td>
      <td>${formatBytes(relation.totalBytes)}</td>
      <td>${formatNumber(relation.estimatedRows)}</td>
      <td>${formatNumber(relation.columnCount)}</td>
      <td>${formatNumber(relation.indexCount)}</td>
      <td>${formatNumber(relation.outboundFkCount)} out / ${formatNumber(relation.inboundFkCount)} in</td>
    </tr>
  `).join("");

  const noPrimaryKeyRows = schema.noPrimaryKey.slice(0, 16).map((relation) => `
    <tr>
      <td><a href="${htmlEscape(relation.href)}">${htmlEscape(relation.relationName)}</a></td>
      <td>${formatBytes(relation.totalBytes)}</td>
      <td>${formatNumber(relation.estimatedRows)}</td>
      <td>${formatNumber(relation.indexCount)}</td>
    </tr>
  `).join("");

  const fkRows = schema.foreignKeys.slice(0, 16).map((edge) => `
    <tr>
      <td>${htmlEscape(edge.constraintName)}</td>
      <td>${htmlEscape(edge.sourceSchema)}.${htmlEscape(edge.sourceTable)}</td>
      <td>${htmlEscape(edge.targetSchema)}.${htmlEscape(edge.targetTable)}</td>
    </tr>
  `).join("");

  const criticalAssets = schema.criticalAssets.map((asset) => `<li>${htmlEscape(asset)}</li>`).join("");
  const links = schema.links.map((link) => `<a href="${htmlEscape(link.href)}" class="button">${htmlEscape(link.label)}</a>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${htmlEscape(schema.title)} - Parthenon Database Analysis</title>
    <script>
      (function(){
        var stored=localStorage.getItem('parthenon-theme');
        var mode=stored||'system';
        var effective=(mode==='light')?'light':(mode==='dark')?'dark':((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');
        if(effective==='light'){document.documentElement.classList.add('light');}
      })();
    </script>
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Parthenon Developer Portal home">
        <span class="brand-mark">Parthenon</span>
        <span class="brand-context">Developer Portal</span>
      </a>
      <nav class="breadcrumbs" aria-label="Portal context">
        <a href="/#database">Database</a>
        <span class="crumb-sep" aria-hidden="true">›</span>
        <span class="crumb-current">${htmlEscape(schema.name)}</span>
      </nav>
      <div class="header-actions">
        <nav class="quick-actions" aria-label="Schema report links">${links}</nav>
      </div>
    </header>
    <main>
      <div class="page-hero">
        <p class="eyebrow">database analysis</p>
        <h1>${htmlEscape(schema.title)}</h1>
        <p class="lead">${htmlEscape(schema.purpose)}</p>
      </div>
      <section class="reference-summary" aria-label="Schema summary">
        <span>${formatNumber(schema.tables)} tables</span>
        <span>${formatNumber(schema.views)} views</span>
        <span>${formatNumber(schema.matviews)} materialized views</span>
        <span>${formatNumber(schema.indexes)} indexes</span>
        <span>${formatBytes(schema.totalBytes)}</span>
      </section>
      <section class="plain-section">
        <p class="eyebrow">critical assets</p>
        <h2>What This Schema Explains</h2>
        <ul class="schema-notes">${criticalAssets}</ul>
      </section>
      <section class="plain-section">
        <p class="eyebrow">largest relations</p>
        <h2>Size And Shape</h2>
        <div class="table-scroller">
          <table class="schema-table">
            <thead>
              <tr>
                <th>Relation</th>
                <th>Type</th>
                <th>Total</th>
                <th>Estimated rows</th>
                <th>Columns</th>
                <th>Indexes</th>
                <th>Foreign keys</th>
              </tr>
            </thead>
            <tbody>${largestRows}</tbody>
          </table>
        </div>
      </section>
      <section class="two-column">
        <section class="plain-section">
          <p class="eyebrow">integrity signal</p>
          <h2>Tables Without Primary Keys</h2>
          <div class="table-scroller">
            <table class="schema-table compact">
              <thead>
                <tr>
                  <th>Relation</th>
                  <th>Total</th>
                  <th>Estimated rows</th>
                  <th>Indexes</th>
                </tr>
              </thead>
              <tbody>${noPrimaryKeyRows || `<tr><td colspan="4">No primary-key gaps found in this schema.</td></tr>`}</tbody>
            </table>
          </div>
        </section>
        <section class="plain-section">
          <p class="eyebrow">relationships</p>
          <h2>Foreign Key Edges</h2>
          <div class="table-scroller">
            <table class="schema-table compact">
              <thead>
                <tr>
                  <th>Constraint</th>
                  <th>Source</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>${fkRows || `<tr><td colspan="3">No foreign-key constraints were reported by PostgreSQL.</td></tr>`}</tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
    <footer>
      <span>Generated ${htmlEscape(schema.generatedAt)}</span>
      <nav class="footer-links" aria-label="Footer resources">
        <a href="/">Portal</a>
        <a href="/schemaspy/">Database index</a>
        <a href="${htmlEscape(schema.href)}">SchemaSpy</a>
      </nav>
      <span>Catalog data comes from PostgreSQL metadata estimates, not full table scans.</span>
    </footer>
  </body>
</html>
`;
}

function makeIndexHtml(manifest) {
  const schemaCards = manifest.schemas.map((schema) => `
    <article class="doc-card schema-card">
      <div>
        <p class="card-kicker">${htmlEscape(schema.name)}</p>
        <h2>${htmlEscape(schema.title)}</h2>
        <p>${htmlEscape(schema.purpose)}</p>
        <div class="meta-row">
          <span class="pill">${formatNumber(schema.tables)} tables</span>
          <span class="pill">${formatBytes(schema.totalBytes)}</span>
          <span class="pill">${formatNumber(schema.indexes)} indexes</span>
        </div>
      </div>
      <div class="card-actions">
        <a href="${htmlEscape(schema.analysisHref)}">Analysis</a>
        <a href="${htmlEscape(schema.href)}">SchemaSpy</a>
        <a href="${htmlEscape(schema.metadataHref)}">Metadata JSON</a>
      </div>
    </article>
  `).join("");

  const topRows = manifest.topRelations.slice(0, 24).map((relation) => `
    <tr>
      <td>${htmlEscape(relation.schemaName)}</td>
      <td><a href="${htmlEscape(relation.href)}">${htmlEscape(relation.relationName)}</a></td>
      <td>${htmlEscape(relation.relationType)}</td>
      <td>${formatBytes(relation.totalBytes)}</td>
      <td>${formatNumber(relation.estimatedRows)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Parthenon Database Analysis</title>
    <script>
      (function(){
        var stored=localStorage.getItem('parthenon-theme');
        var mode=stored||'system';
        var effective=(mode==='light')?'light':(mode==='dark')?'dark':((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');
        if(effective==='light'){document.documentElement.classList.add('light');}
      })();
    </script>
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Parthenon Developer Portal home">
        <span class="brand-mark">Parthenon</span>
        <span class="brand-context">Developer Portal</span>
      </a>
      <nav class="breadcrumbs" aria-label="Portal context">
        <span class="crumb-current">Database</span>
      </nav>
      <div class="header-actions">
        <nav class="quick-actions" aria-label="Database resources">
          <a href="/schemaspy/manifest.json" class="button">Manifest JSON</a>
          <a href="/" class="button">Portal</a>
        </nav>
      </div>
    </header>
    <main>
      <div class="page-hero">
        <p class="eyebrow">schemaspy</p>
        <h1>Parthenon Database Analysis</h1>
        <p class="lead">SchemaSpy reports and PostgreSQL catalog analysis for the local ${htmlEscape(manifest.database)} database on ${htmlEscape(manifest.host)}:${htmlEscape(manifest.port)}.</p>
      </div>
      <section class="reference-summary" aria-label="Database summary">
        <span>${formatNumber(manifest.schemaCount)} schemas</span>
        <span>${formatNumber(manifest.tableCount)} tables</span>
        <span>${formatNumber(manifest.viewCount)} views</span>
        <span>${formatNumber(manifest.indexCount)} indexes</span>
        <span>${formatBytes(manifest.totalBytes)}</span>
        <span>Generated ${htmlEscape(manifest.generatedAt)}</span>
      </section>
      <section class="data-grid">${schemaCards}</section>
      <section class="plain-section">
        <p class="eyebrow">largest relations</p>
        <h2>Database Footprint</h2>
        <div class="table-scroller">
          <table class="schema-table">
            <thead>
              <tr>
                <th>Schema</th>
                <th>Relation</th>
                <th>Type</th>
                <th>Total</th>
                <th>Estimated rows</th>
              </tr>
            </thead>
            <tbody>${topRows}</tbody>
          </table>
        </div>
      </section>
    </main>
    <footer>
      <span>Parthenon Developer Portal</span>
      <nav class="footer-links" aria-label="Footer resources">
        <a href="/">Portal</a>
        <a href="/graphify/">Graphify</a>
        <a href="/reference/README.md">Reference</a>
      </nav>
      <span>Generated from SchemaSpy plus PostgreSQL catalog metadata.</span>
    </footer>
  </body>
</html>
`;
}

function makeSummaryMarkdown(manifest) {
  const schemaRows = manifest.schemas.map((schema) =>
    `| ${schema.name} | ${schema.title} | ${schema.tables} | ${formatBytes(schema.totalBytes)} | ${schema.indexes} | ${schema.href} |`,
  ).join("\n");
  const topRows = manifest.topRelations.slice(0, 20).map((relation) =>
    `| ${relation.schemaName} | ${relation.relationName} | ${relation.relationType} | ${formatBytes(relation.totalBytes)} | ${relation.estimatedRows} |`,
  ).join("\n");

  return `# Parthenon Database Analysis

Generated: ${manifest.generatedAt}

Database: ${manifest.database} on ${manifest.host}:${manifest.port}

## Schemas

| Schema | Title | Tables | Total size | Indexes | Report |
| --- | --- | ---: | ---: | ---: | --- |
${schemaRows}

## Largest Relations

| Schema | Relation | Type | Total size | Estimated rows |
| --- | --- | --- | ---: | ---: |
${topRows}

Catalog row counts are PostgreSQL estimates. The generator intentionally avoids full table scans.
`;
}

function buildSchema(schemaName) {
  const info = schemaInfo[schemaName] || {
    title: `${schemaName} Schema`,
    purpose: `Database schema ${schemaName}.`,
    criticalAssets: ["PostgreSQL relation metadata and SchemaSpy navigation."],
  };
  const schema = sqlLiteral(schemaName);
  const generatedAt = new Date().toISOString();

  const overview = runPsql(`
    select
      ${schema} as schema_name,
      count(*) filter (where c.relkind in ('r', 'p'))::int as tables,
      count(*) filter (where c.relkind = 'v')::int as views,
      count(*) filter (where c.relkind = 'm')::int as matviews,
      (
        select count(*)::int
        from pg_class i
        join pg_namespace ni on ni.oid = i.relnamespace
        where ni.nspname = ${schema}
          and i.relkind = 'i'
      ) as indexes,
      coalesce(sum(pg_total_relation_size(c.oid)) filter (where c.relkind in ('r', 'p', 'm')), 0)::bigint as total_bytes
    from pg_namespace n
    left join pg_class c on c.relnamespace = n.oid
      and c.relkind in ('r', 'p', 'm', 'v')
    where n.nspname = ${schema}
    group by n.nspname
  `)[0] || {};

  const relations = runPsql(relationSql(schemaName));
  const topRelations = runPsql(relationSql(schemaName, 50));
  const noPrimaryKey = runPsql(`
    select
      n.nspname as schema_name,
      c.relname as relation_name,
      greatest(c.reltuples, 0)::bigint as estimated_rows,
      pg_total_relation_size(c.oid)::bigint as total_bytes,
      (
        select count(*)::int
        from pg_index i
        where i.indrelid = c.oid
      ) as index_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p')
      and not exists (
        select 1
        from pg_constraint con
        where con.conrelid = c.oid
          and con.contype = 'p'
      )
    order by pg_total_relation_size(c.oid) desc, c.relname asc
    limit 50
  `);
  const noIndexes = runPsql(`
    select
      n.nspname as schema_name,
      c.relname as relation_name,
      greatest(c.reltuples, 0)::bigint as estimated_rows,
      pg_total_relation_size(c.oid)::bigint as total_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p')
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.oid
      )
    order by pg_total_relation_size(c.oid) desc, c.relname asc
    limit 50
  `);
  const foreignKeys = runPsql(`
    select
      con.conname as constraint_name,
      src_ns.nspname as source_schema,
      src.relname as source_table,
      tgt_ns.nspname as target_schema,
      tgt.relname as target_table
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_namespace src_ns on src_ns.oid = src.relnamespace
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace tgt_ns on tgt_ns.oid = tgt.relnamespace
    where con.contype = 'f'
      and (src_ns.nspname = ${schema} or tgt_ns.nspname = ${schema})
    order by src_ns.nspname, src.relname, con.conname
    limit 200
  `);

  const normalizeRelation = (relation) => ({
    schemaName: relation.schema_name,
    relationName: relation.relation_name,
    relationType: relation.relation_type,
    estimatedRows: Number(relation.estimated_rows || 0),
    totalBytes: Number(relation.total_bytes || 0),
    totalSize: formatBytes(relation.total_bytes),
    tableBytes: Number(relation.table_bytes || 0),
    indexBytes: Number(relation.index_bytes || 0),
    columnCount: Number(relation.column_count || 0),
    indexCount: Number(relation.index_count || 0),
    primaryKeyCount: Number(relation.primary_key_count || 0),
    outboundFkCount: Number(relation.outbound_fk_count || 0),
    inboundFkCount: Number(relation.inbound_fk_count || 0),
    comment: relation.comment || "",
    href: tableHref(schemaName, relation.relation_name),
  });

  const normalizedRelations = relations.map(normalizeRelation);
  const normalizedTopRelations = topRelations.map(normalizeRelation);
  const normalizedNoPrimaryKey = noPrimaryKey.map((relation) => ({
    schemaName: relation.schema_name,
    relationName: relation.relation_name,
    estimatedRows: Number(relation.estimated_rows || 0),
    totalBytes: Number(relation.total_bytes || 0),
    totalSize: formatBytes(relation.total_bytes),
    indexCount: Number(relation.index_count || 0),
    href: tableHref(schemaName, relation.relation_name),
  }));
  const normalizedNoIndexes = noIndexes.map((relation) => ({
    schemaName: relation.schema_name,
    relationName: relation.relation_name,
    estimatedRows: Number(relation.estimated_rows || 0),
    totalBytes: Number(relation.total_bytes || 0),
    totalSize: formatBytes(relation.total_bytes),
    href: tableHref(schemaName, relation.relation_name),
  }));
  const normalizedForeignKeys = foreignKeys.map((edge) => ({
    constraintName: edge.constraint_name,
    sourceSchema: edge.source_schema,
    sourceTable: edge.source_table,
    targetSchema: edge.target_schema,
    targetTable: edge.target_table,
  }));

  const output = {
    name: schemaName,
    title: info.title,
    purpose: info.purpose,
    criticalAssets: info.criticalAssets,
    generatedAt,
    href: `/schemaspy/${schemaName}/index.html`,
    analysisHref: `/schemaspy/${schemaName}/analysis.html`,
    metadataHref: `/schemaspy/${schemaName}/metadata.json`,
    links: [
      schemaLink(schemaName, "index.html", "SchemaSpy index"),
      schemaLink(schemaName, "relationships.html", "Relationships"),
      schemaLink(schemaName, "columns.html", "Columns"),
      schemaLink(schemaName, "constraints.html", "Constraints"),
      schemaLink(schemaName, "anomalies.html", "Anomalies"),
    ],
    tables: Number(overview.tables || 0),
    views: Number(overview.views || 0),
    matviews: Number(overview.matviews || 0),
    indexes: Number(overview.indexes || 0),
    totalBytes: Number(overview.total_bytes || 0),
    totalSize: formatBytes(overview.total_bytes),
    relationCount: normalizedRelations.length,
    topRelations: normalizedTopRelations,
    relations: normalizedRelations,
    noPrimaryKey: normalizedNoPrimaryKey,
    noIndexes: normalizedNoIndexes,
    foreignKeys: normalizedForeignKeys,
  };

  const schemaDir = path.join(schemaSpyRoot, schemaName);
  fs.mkdirSync(schemaDir, { recursive: true });
  fs.writeFileSync(path.join(schemaDir, "metadata.json"), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(schemaDir, "analysis.html"), makeAnalysisHtml(output));
  return output;
}

fs.mkdirSync(schemaSpyRoot, { recursive: true });

const extensions = runPsql(`
  select
    e.extname as name,
    e.extversion as version,
    n.nspname as schema_name
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  order by e.extname
`);

const schemaManifests = schemas.map(buildSchema);
const generatedAt = new Date().toISOString();
const allTopRelations = schemaManifests
  .flatMap((schema) => schema.topRelations)
  .sort((a, b) => b.totalBytes - a.totalBytes)
  .slice(0, 60);

const manifest = {
  generatedAt,
  generator: "scripts/generate-schemaspy-manifest.js",
  database: dbName,
  host: dbHost,
  port: dbPort,
  schemaCount: schemaManifests.length,
  tableCount: schemaManifests.reduce((sum, schema) => sum + schema.tables, 0),
  viewCount: schemaManifests.reduce((sum, schema) => sum + schema.views + schema.matviews, 0),
  indexCount: schemaManifests.reduce((sum, schema) => sum + schema.indexes, 0),
  totalBytes: schemaManifests.reduce((sum, schema) => sum + schema.totalBytes, 0),
  totalSize: formatBytes(schemaManifests.reduce((sum, schema) => sum + schema.totalBytes, 0)),
  extensions,
  schemas: schemaManifests.map((schema) => ({
    name: schema.name,
    title: schema.title,
    purpose: schema.purpose,
    criticalAssets: schema.criticalAssets,
    generatedAt: schema.generatedAt,
    href: schema.href,
    analysisHref: schema.analysisHref,
    metadataHref: schema.metadataHref,
    links: schema.links,
    tables: schema.tables,
    views: schema.views,
    matviews: schema.matviews,
    indexes: schema.indexes,
    totalBytes: schema.totalBytes,
    totalSize: schema.totalSize,
    relationCount: schema.relationCount,
    noPrimaryKeyCount: schema.noPrimaryKey.length,
    noIndexesCount: schema.noIndexes.length,
    foreignKeyCount: schema.foreignKeys.length,
    topRelations: schema.topRelations.slice(0, 12),
  })),
  topRelations: allTopRelations,
};

fs.writeFileSync(path.join(schemaSpyRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(schemaSpyRoot, "index.html"), makeIndexHtml(manifest));
fs.writeFileSync(path.join(schemaSpyRoot, "summary.md"), makeSummaryMarkdown(manifest));

console.log(`Wrote ${path.join(schemaSpyRoot, "manifest.json")} for ${schemaManifests.length} schemas.`);
