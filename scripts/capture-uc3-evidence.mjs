#!/usr/bin/env node
/**
 * One-off evidence capture for UC3 (Browse & Donate), mirroring how the
 * UC1 test-evidence/system_TC*.png screenshots were produced. Drives the
 * real app with Playwright and saves named screenshots into test-evidence/
 * for scripts/build-test-report-xlsx.py to embed into the workbook.
 *
 * Usage: node scripts/capture-uc3-evidence.mjs
 * (assumes `python3 -m http.server 8000` is NOT already required -- this
 * script starts/stops its own server on port 8000, same as playwright.config.js)
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'test-evidence');
const BASE_URL = 'http://localhost:8000';

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - start > timeoutMs) reject(new Error('server did not start'));
          else setTimeout(tryFetch, 300);
        });
    };
    tryFetch();
  });
}

async function loginAsDemo(page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('demo@saveplate.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByRole('link', { name: 'Food Inventory' }).waitFor();
}

async function main() {
  const server = spawn('python3', ['-m', 'http.server', '8000'], { cwd: ROOT, stdio: 'ignore' });
  try {
    await waitForServer(`${BASE_URL}/index.html`);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // TC1: renders seeded community donations with donor and details
    await loginAsDemo(page);
    await page.getByRole('link', { name: 'Browse & Donate' }).click();
    await page.getByText('Showing 3 community donations available').waitFor();
    await page.waitForTimeout(700); // let the .app-view fadeIn animation and login toast finish
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC1_uc3_browse_grid.png') });
    console.log('Saved system_TC1_uc3_browse_grid.png');

    // TC2: search narrows the donation grid by name
    await page.locator('#browse-search').fill('bagels');
    await page.getByText('Bagels (Sesame)').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC2_uc3_search_filter.png') });
    console.log('Saved system_TC2_uc3_search_filter.png');
    await page.locator('#browse-search').fill('');

    // TC3: category filter narrows the donation grid
    await page.locator('#browse-filter-category').selectOption('Canned');
    await page.getByText('Sweet Corn Cans').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC3_uc3_category_filter.png') });
    console.log('Saved system_TC3_uc3_category_filter.png');
    await page.locator('#browse-filter-category').selectOption('');

    // TC4: claiming a donation removes it from the board and notifies the claimer
    const card = page.locator('.donation-card', { hasText: 'Bagels (Sesame)' });
    await card.getByRole('button', { name: 'Claim Item' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByText('Showing 2 community donations available').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC4a_uc3_claim_confirmed.png') });
    await page.getByRole('link', { name: 'Notifications' }).click();
    await page.getByText('Donation Claimed: Bagels (Sesame)').waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC4b_uc3_claim_notification.png') });
    console.log('Saved system_TC4a_uc3_claim_confirmed.png, system_TC4b_uc3_claim_notification.png');

    // TC5: cannot claim your own donation
    await page.getByRole('link', { name: 'Food Inventory' }).click();
    const invRow = page.locator('#inventory-tbody tr', { hasText: 'Canned Lentils' });
    await invRow.getByTitle('Donate to Community Board').click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('link', { name: 'Browse & Donate' }).click();
    const ownCard = page.locator('.donation-card', { hasText: 'Canned Lentils' });
    await ownCard.getByRole('button', { name: 'Your Item' }).waitFor();
    await ownCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC5_uc3_own_donation_disabled.png') });
    console.log('Saved system_TC5_uc3_own_donation_disabled.png');

    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
