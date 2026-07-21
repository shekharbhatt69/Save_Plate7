import { test, expect } from '@playwright/test';

test('User can manage food inventory, meal planner, donations and notifications', async ({ page }) => {
  // Login
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Email Address' })
    .fill('demo@saveplate.com');

  await page.getByRole('textbox', { name: 'Password' })
    .fill('demo123');

  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByRole('link', { name: 'Food Inventory' })).toBeVisible();

  // Food Inventory
  await page.getByRole('link', { name: 'Food Inventory' }).click();

  await page.locator('#inventory-filter-category')
    .selectOption('Dairy');

  await page.getByRole('button', { name: 'Add Food Item' }).click();

  await page.getByRole('textbox', { name: 'Food Name' })
    .fill('dahi');

  await page.getByRole('spinbutton', { name: 'Quantity' })
    .fill('3');

  await page.getByRole('textbox', { name: 'Unit' })
    .fill('litre');

  await page.getByLabel('Category')
    .selectOption('Dairy');

  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('dahi')).toBeVisible();


  // Meal Planner
  await page.getByRole('link', { name: 'Meal Planner' }).click();

  await page.getByRole('button', { name: '+ Add Meal' })
    .first()
    .click();

  await page.locator('#meal-inventory-select')
    .selectOption('Whole Milk');

  await page.getByRole('textbox', { name: 'Method 2: Type Custom Meal' })
    .fill('breakfast');

  await page.getByRole('button', { name: 'Confirm' }).click();


  // Analytics
  await page.getByRole('link', { name: 'Food Analytics' }).click();

  await expect(page).toHaveURL(/analytics/);


  // Donate / Claim food
  await page.getByRole('link', { name: 'Browse & Donate' }).click();

  await page.getByRole('button', { name: 'Claim Item' })
    .first()
    .click();

  await page.getByRole('button', { name: 'Confirm' }).click();


  // Delete inventory item
  await page.getByRole('link', { name: 'Food Inventory' }).click();

  await page.getByRole('button', { name: 'Delete Item' })
    .first()
    .click();

  await page.getByRole('button', { name: 'Confirm' }).click();


  // Notifications
  await page.getByRole('link', { name: 'Notifications' }).click();

  await page.getByRole('button', { name: 'Mark All as Read' })
    .click();

  await expect(
    page.locator('#page-display-title')
  ).toHaveText('Notifications');
});