#!/usr/bin/env node
/**
 * Runs the Playwright suite and archives the result as its own dated report
 * under playwright-report/runs/<timestamp>/, instead of letting each run
 * overwrite the previous one. Rebuilds playwright-report/index.html as a
 * history page linking to every archived run.
 *
 * Usage: node scripts/record-test-run.mjs [any extra `playwright test` args]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportRoot = path.join(root, 'playwright-report');
const runsDir = path.join(reportRoot, 'runs');
const historyFile = path.join(runsDir, 'history.json');

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-'); // filesystem-safe, e.g. 2026-07-22T10-15-30-123Z
const runDir = path.join(runsDir, stamp);
mkdirSync(runDir, { recursive: true });

const jsonReportPath = path.join(runDir, 'results.json');

const env = {
  ...process.env,
  PLAYWRIGHT_HTML_REPORT: runDir,
  PLAYWRIGHT_JSON_REPORT: jsonReportPath,
};

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

const summary = { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
if (existsSync(jsonReportPath)) {
  try {
    const report = JSON.parse(readFileSync(jsonReportPath, 'utf-8'));
    (report.suites || []).forEach((suite) => tallySuite(suite, summary));
  } catch (err) {
    console.error('Could not parse results.json for the run summary:', err.message);
  }
} else {
  console.error('No results.json produced — Playwright may have failed to start.');
}

function tallySuite(suite, tally) {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      tally.total++;
      if (t.status === 'expected') tally.passed++;
      else if (t.status === 'unexpected') tally.failed++;
      else if (t.status === 'flaky') tally.flaky++;
      else if (t.status === 'skipped') tally.skipped++;
    }
  }
  for (const child of suite.suites || []) tallySuite(child, tally);
}

let history = [];
if (existsSync(historyFile)) {
  try {
    history = JSON.parse(readFileSync(historyFile, 'utf-8'));
  } catch {
    history = [];
  }
}

history.unshift({
  timestamp: now.toISOString(),
  folder: stamp,
  exitCode: result.status,
  ...summary,
});

writeFileSync(historyFile, JSON.stringify(history, null, 2));
writeFileSync(path.join(reportRoot, 'index.html'), renderIndexHtml(history));

console.log(`\nArchived report -> playwright-report/runs/${stamp}/index.html`);
console.log('Run history      -> playwright-report/index.html');

process.exit(result.status ?? 1);

function renderIndexHtml(runs) {
  const rows = runs
    .map((run) => {
      const date = new Date(run.timestamp).toLocaleString();
      const failed = run.failed > 0 || run.exitCode !== 0;
      const statusLabel = failed ? 'FAILED' : 'PASSED';
      const statusClass = failed ? 'fail' : 'pass';
      return `
      <tr class="${statusClass}">
        <td>${date}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>${run.passed}</td>
        <td>${run.failed}</td>
        <td>${run.flaky}</td>
        <td>${run.skipped}</td>
        <td>${run.total}</td>
        <td><a href="runs/${run.folder}/index.html">View report</a></td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SavePlate — Playwright Run History</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; background: #f7f7f5; color: #222; }
  h1 { margin-bottom: 4px; font-size: 22px; }
  p.sub { color: #666; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 6px; overflow: hidden; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background: #fafafa; font-weight: 600; }
  tr.fail { background: #fff5f5; }
  .badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; }
  .badge.pass { background: #e6f4ea; color: #1e7d34; }
  .badge.fail { background: #fdecea; color: #c0392b; }
  a { color: #2b6cb0; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <h1>SavePlate — Playwright Run History</h1>
  <p class="sub">${runs.length} recorded run${runs.length === 1 ? '' : 's'}, newest first.</p>
  <table>
    <thead>
      <tr><th>Date</th><th>Result</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Skipped</th><th>Total</th><th></th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}
