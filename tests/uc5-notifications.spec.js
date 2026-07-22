import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers.js';

/**
 * UC5: Notifications (notifications.js)
 *
 * Acceptance criteria under test:
 * - Automatically scans inventory and creates alerts for expired/expiring items.
 * - Unread count badge in the sidebar reflects the notification list.
 * - Clicking a notification marks it read; "Mark All as Read" clears the rest.
 *
 * The seeded demo account has 3 manually-seeded notifications plus 4 that get
 * auto-generated on login by scanForExpiryNotifications (2 expired items:
 * Whole Wheat Bread, Whole Milk; 2 expiring within a day: Roma Tomatoes,
 * Ripe Avocado) -> 7 unread on first load.
 */

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
});

test('auto-scans inventory and shows the combined unread count', async ({ page }) => {
  await expect(page.locator('#notif-badge')).toHaveText('7');

  await page.getByRole('link', { name: 'Notifications' }).click();

  await expect(page.getByText('You have 7 unread alerts')).toBeVisible();
  await expect(page.getByText('Expired: Whole Wheat Bread')).toBeVisible();
  await expect(page.getByText('Expiring Soon: Roma Tomatoes')).toBeVisible();
});

test('clicking a notification marks it read and decrements the count', async ({ page }) => {
  await page.getByRole('link', { name: 'Notifications' }).click();

  await page.locator('.notif-item', { hasText: 'Welcome to SavePlate!' }).click();

  await expect(page.getByText('You have 6 unread alerts')).toBeVisible();
  await expect(page.locator('#notif-badge')).toHaveText('6');
});

test('"Mark All as Read" clears the unread count and hides the badge', async ({ page }) => {
  await page.getByRole('link', { name: 'Notifications' }).click();

  await page.getByRole('button', { name: 'Mark All as Read' }).click();

  await expect(page.getByText('You have 0 unread alerts')).toBeVisible();
  await expect(page.locator('#notif-badge')).toBeHidden();
});
