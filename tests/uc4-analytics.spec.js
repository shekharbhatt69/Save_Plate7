import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers.js';

/**
 * UC4: Food Analytics (analytics.js)
 *
 * Acceptance criteria under test:
 * - Stats: items saved, donated, expired, and total tracked.
 * - Waste reduction rate = (Saved + Donated) / Total Tracked.
 * - "All time" vs "This month" period filter recalculates figures.
 * - Category breakdown renders as a horizontal bar per active category.
 *
 * The seeded demo dataset (storage.js) gives deterministic "All Time" figures:
 * 4 saved (Spinach, Yogurt, Eggs, Tortillas), 1 donated, 3 expired (1
 * historical + 2 currently-expired active items), 6 active fresh/upcoming
 * items -> 14 total tracked -> 36% reduction.
 */

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
  await page.getByRole('link', { name: 'Food Analytics' }).click();
});

test('computes waste-reduction stats from seeded data for "All Time"', async ({ page }) => {
  await expect(page.locator('#analytics-reduction-rate')).toHaveText('36%');
  await expect(page.locator('#analytics-stat-saved')).toHaveText('4');
  await expect(page.locator('#analytics-stat-donated')).toHaveText('1');
  await expect(page.locator('#analytics-stat-expired')).toHaveText('3');
  await expect(page.locator('#analytics-stat-total')).toHaveText('14');
});

test('renders a category bar for the active inventory breakdown', async ({ page }) => {
  const freshRow = page.locator('.chart-bar-row', { hasText: 'Fresh' });
  await expect(freshRow).toContainText('3 items (38%)');

  // One bar per distinct category present in active inventory (6 categories).
  await expect(page.locator('.chart-bar-row')).toHaveCount(6);
});

test('switching to "This Month" recalculates the figures without crashing', async ({ page }) => {
  await page.locator('#analytics-period').selectOption('month');

  await expect(page.locator('#analytics-reduction-rate')).toHaveText(/^\d+%$/);
  await expect(page.locator('#analytics-stat-total')).toHaveText(/^\d+$/);
});
