#!/usr/bin/env node
/**
 * One-off evidence capture for UC2 (Food Inventory), mirroring how the
 * UC1/UC3 test-evidence/system_TC*.png screenshots were produced. Drives the
 * real app with Playwright and saves named screenshots into test-evidence/
 * for scripts/build-test-report-xlsx.py to embed into the workbook.
 *
 * Usage: node scripts/capture-uc2-evidence.mjs
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

function row(page, name) {
  return page.locator('#inventory-tbody tr', { hasText: name });
}

async function main() {
  const server = spawn('python3', ['-m', 'http.server', '8000'], { cwd: ROOT, stdio: 'ignore' });
  try {
    await waitForServer(`${BASE_URL}/index.html`);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await loginAsDemo(page);
    await page.getByRole('link', { name: 'Food Inventory' }).click();
    await page.waitForTimeout(700);

    // TC1: status pills for expired / expiring-soon / fresh seeded items
    await row(page, 'Whole Wheat Bread').locator('.pill-danger').waitFor();
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC1_uc2_status_pills.png') });
    console.log('Saved system_TC1_uc2_status_pills.png');

    // TC2: search narrows the list by item name
    await page.locator('#inventory-search').fill('avocado');
    await row(page, 'Ripe Avocado').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC2_uc2_search_filter.png') });
    console.log('Saved system_TC2_uc2_search_filter.png');
    await page.locator('#inventory-search').fill('');

    // TC3: category filter narrows the list
    await page.locator('#inventory-filter-category').selectOption('Dairy');
    await row(page, 'Whole Milk').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC3_uc2_category_filter.png') });
    console.log('Saved system_TC3_uc2_category_filter.png');
    await page.locator('#inventory-filter-category').selectOption('');

    // TC4: validation rejects empty name, zero quantity, blank expiry
    await page.getByRole('button', { name: 'Add Food Item' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('spinbutton', { name: 'Quantity' }).fill('0');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.locator('#form-name-group.invalid').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC4_uc2_add_validation_errors.png') });
    console.log('Saved system_TC4_uc2_add_validation_errors.png');
    await page.locator('#modal-cancel-btn').click();
    await page.waitForTimeout(400);

    // TC5: adds a new food item and displays it in the table
    await page.getByRole('button', { name: 'Add Food Item' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('textbox', { name: 'Food Name' }).fill('Greek Yogurt');
    await page.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
    await page.getByRole('textbox', { name: 'Unit' }).fill('tubs');
    await page.getByLabel('Category').selectOption('Dairy');
    await page.getByLabel('Storage Location').selectOption('Fridge');
    await page.locator('#form-item-expiry').fill('2027-01-01');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await row(page, 'Greek Yogurt').waitFor();
    await row(page, 'Greek Yogurt').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC5_uc2_add_item_success.png') });
    console.log('Saved system_TC5_uc2_add_item_success.png');

    // TC6: marking an item used removes it from the active inventory list
    await row(page, 'Jasmine Rice').getByTitle('Mark Used / Eaten').click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC6_uc2_mark_used.png') });
    console.log('Saved system_TC6_uc2_mark_used.png');

    // TC7: donating an item removes it from the personal inventory list
    await row(page, 'Canned Lentils').getByTitle('Donate to Community Board').click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC7_uc2_donate_item.png') });
    console.log('Saved system_TC7_uc2_donate_item.png');

    // TC8: deletes an item after confirmation
    await row(page, 'Chicken Breasts').getByTitle('Delete Item').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC8a_uc2_delete_confirm_dialog.png') });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCE, 'system_TC8b_uc2_delete_success.png') });
    console.log('Saved system_TC8a_uc2_delete_confirm_dialog.png, system_TC8b_uc2_delete_success.png');

    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
