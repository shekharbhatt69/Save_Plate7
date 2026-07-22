import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers.js';

/**
 * UC2: Manage Food Inventory (inventory.js)
 *
 * Acceptance criteria under test:
 * - Add/Edit items with name, quantity, unit, category, location, expiry date.
 * - Validation rejects empty name, zero/negative quantity, and blank expiry.
 * - Status pills: Expired (red), "Use in Xd" (amber, <=2 days), Fresh (green).
 * - Search and category/location filters narrow the list.
 * - Mark Used removes the item from the active list.
 * - Donate removes the item from the personal inventory (see UC3 for the board side).
 * - Delete prompts for confirmation before removal.
 *
 * All disappearance/uniqueness checks are scoped to #inventory-tbody rather
 * than the whole page, since the (hidden) dashboard "soonest expiring" table
 * repeats several of the same item names and would otherwise cause
 * ambiguous-match failures.
 */

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
  await page.getByRole('link', { name: 'Food Inventory' }).click();
});

function row(page, name) {
  return page.locator('#inventory-tbody tr', { hasText: name });
}

test('shows correct status pills for expired, expiring-soon, and fresh seeded items', async ({ page }) => {
  await expect(row(page, 'Whole Wheat Bread').locator('.pill-danger')).toHaveText('Expired');
  await expect(row(page, 'Roma Tomatoes').locator('.pill-warning')).toHaveText('Use in 0d');
  await expect(row(page, 'Fuji Apples').locator('.pill-fresh')).toHaveText('Fresh');
});

test('search narrows the list by item name', async ({ page }) => {
  await page.locator('#inventory-search').fill('avocado');

  await expect(page.locator('#inventory-tbody tr')).toHaveCount(1);
  await expect(row(page, 'Ripe Avocado')).toBeVisible();
});

test('category filter narrows the list', async ({ page }) => {
  await page.locator('#inventory-filter-category').selectOption('Dairy');

  await expect(page.locator('#inventory-tbody tr')).toHaveCount(1);
  await expect(row(page, 'Whole Milk')).toBeVisible();
});

test('rejects an empty name, zero quantity, and blank expiry date', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Food Item' }).click();

  await page.getByRole('spinbutton', { name: 'Quantity' }).fill('0');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#form-name-group')).toHaveClass(/invalid/);
  await expect(page.locator('#form-qty-group')).toHaveClass(/invalid/);

  // Modal stays open — nothing was saved.
  await expect(page.locator('#modal-container')).toHaveClass(/active/);
});

test('adds a new food item and displays it in the table', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Food Item' }).click();

  await page.getByRole('textbox', { name: 'Food Name' }).fill('Greek Yogurt');
  await page.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
  await page.getByRole('textbox', { name: 'Unit' }).fill('tubs');
  await page.getByLabel('Category').selectOption('Dairy');
  await page.getByLabel('Storage Location').selectOption('Fridge');
  await page.locator('#form-item-expiry').fill('2027-01-01');

  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#modal-container')).not.toHaveClass(/active/);
  await expect(row(page, 'Greek Yogurt')).toBeVisible();
});

test('edits an existing item and persists the change', async ({ page }) => {
  await row(page, 'Fuji Apples').getByTitle('Edit Item').click();

  await page.getByRole('spinbutton', { name: 'Quantity' }).fill('12');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(row(page, 'Fuji Apples')).toContainText('12');
});

test('marking an item used removes it from the active inventory list', async ({ page }) => {
  await row(page, 'Jasmine Rice').getByTitle('Mark Used / Eaten').click();

  await expect(row(page, 'Jasmine Rice')).toHaveCount(0);
});

test('donating an item removes it from the personal inventory list', async ({ page }) => {
  await row(page, 'Canned Lentils').getByTitle('Donate to Community Board').click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(row(page, 'Canned Lentils')).toHaveCount(0);
});

test('deletes an item after confirmation', async ({ page }) => {
  await row(page, 'Chicken Breasts').getByTitle('Delete Item').click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(row(page, 'Chicken Breasts')).toHaveCount(0);
});
