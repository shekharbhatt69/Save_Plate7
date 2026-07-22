import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers.js';

/**
 * UC3: Browse & Donate (browse.js)
 *
 * Acceptance criteria under test:
 * - Community items render as cards with name, quantity, category, location,
 *   donor, and days-until-expiry.
 * - Search by name and filter by category narrow the grid.
 * - Claiming a donation marks it claimed, removes it from the available
 *   listing, and logs a notification for the claimer.
 * - Users cannot claim their own donations.
 */

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
});

test('renders seeded community donations with donor and details', async ({ page }) => {
  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  await expect(page.getByText('Showing 3 community donations available')).toBeVisible();

  const card = page.locator('.donation-card', { hasText: 'Organic Strawberries' });
  await expect(card).toContainText('Sarah Jenkins');
  await expect(card).toContainText('Fresh');
});

test('search narrows the donation grid by name', async ({ page }) => {
  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  await page.locator('#browse-search').fill('bagels');

  await expect(page.locator('.donation-card')).toHaveCount(1);
  await expect(page.getByText('Bagels (Sesame)')).toBeVisible();
});

test('category filter narrows the donation grid', async ({ page }) => {
  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  await page.locator('#browse-filter-category').selectOption('Canned');

  await expect(page.locator('.donation-card')).toHaveCount(1);
  await expect(page.getByText('Sweet Corn Cans')).toBeVisible();
});

test('claiming a donation removes it from the board and notifies the claimer', async ({ page }) => {
  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  const card = page.locator('.donation-card', { hasText: 'Bagels (Sesame)' });
  await card.getByRole('button', { name: 'Claim Item' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('.donation-card', { hasText: 'Bagels (Sesame)' })).toHaveCount(0);
  await expect(page.getByText('Showing 2 community donations available')).toBeVisible();

  await page.getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByText('Donation Claimed: Bagels (Sesame)')).toBeVisible();
});

test('cannot claim your own donation', async ({ page }) => {
  // Donate an item from inventory first so we have something of our own on the board.
  await page.getByRole('link', { name: 'Food Inventory' }).click();
  const invRow = page.locator('#inventory-tbody tr', { hasText: 'Canned Lentils' });
  await invRow.getByTitle('Donate to Community Board').click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  const ownCard = page.locator('.donation-card', { hasText: 'Canned Lentils' });
  await expect(ownCard).toContainText('You (My Donation)');
  await expect(ownCard.getByRole('button', { name: 'Your Item' })).toBeDisabled();
  await expect(ownCard.getByRole('button', { name: 'Claim Item' })).not.toBeVisible();
});
