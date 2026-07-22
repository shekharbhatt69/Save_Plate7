import { expect } from '@playwright/test';

/**
 * Logs in as the pre-seeded demo account (no 2FA) and waits for the app
 * shell to render. Used as the shared entry point for UC2-UC6 tests, which
 * all assume an authenticated session and the seeded demo dataset.
 */
export async function loginAsDemo(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email Address' }).fill('demo@saveplate.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('link', { name: 'Food Inventory' })).toBeVisible();
}

/**
 * Computes the current TOTP code for a secret using the app's own totp.js
 * (loaded on the page as plain globals), so tests exercise the exact same
 * RFC 6238 implementation the app uses at login/setup time.
 */
export async function currentCodeFor(page, secret) {
  return page.evaluate((s) => window.generateTOTP(s), secret);
}
