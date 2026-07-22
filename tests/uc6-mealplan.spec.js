import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers.js';

/**
 * UC6: Weekly Meal Planner (mealplan.js)
 *
 * Acceptance criteria under test:
 * - Renders a 7-column Mon-Sun grid.
 * - Shows a recommendation banner for items expiring within 3 days.
 * - Adding a meal supports either picking from inventory or typing a custom title.
 * - Clicking a scheduled meal deletes it (after confirmation).
 * - Plans persist per user (backed by the seeded demo plan: Mon/Tue/Thu populated).
 */

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
  await page.getByRole('link', { name: 'Meal Planner' }).click();
});

test('shows the expiring-soon recommendation banner from active inventory', async ({ page }) => {
  await expect(page.locator('#planner-suggestion-text')).toContainText(
    'Roma Tomatoes, Ripe Avocado, and 1 other item(s) expiring in the next 3 days'
  );
});

test('adds a meal by picking an item from inventory', async ({ page }) => {
  await page.locator('.btn-add-meal[data-day="Wed"]').click();

  await expect(page.getByRole('heading', { name: 'Add Meal for Wednesday' })).toBeVisible();
  await page.locator('#meal-inventory-select').selectOption('Whole Milk');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#meal-list-Wed')).toContainText('Whole Milk');
});

test('adds a meal by typing a custom title', async ({ page }) => {
  await page.locator('.btn-add-meal[data-day="Fri"]').click();

  await page.getByRole('textbox', { name: 'Method 2: Type Custom Meal Title' }).fill('Leftover Pasta Night');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#meal-list-Fri')).toContainText('Leftover Pasta Night');
});

test('rejects adding a meal with no selection and no custom title', async ({ page }) => {
  await page.locator('.btn-add-meal[data-day="Sat"]').click();

  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#meal-custom-group')).toHaveClass(/invalid/);
  await expect(page.locator('#modal-container')).toHaveClass(/active/);
});

test('deletes a scheduled meal after confirmation', async ({ page }) => {
  await expect(page.locator('#meal-list-Mon')).toContainText('Tomato Toast');

  await page.locator('#meal-list-Mon .planner-meal-card').click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('#meal-list-Mon')).toContainText('No meals planned');
});
