import { test, expect } from '@playwright/test';

/**
 * Computes the current TOTP code for a secret using the app's own totp.js
 * (loaded on the page as plain globals), so the test exercises the exact
 * same RFC 6238 implementation the app uses at login time.
 */
async function currentCodeFor(page, secret) {
  return page.evaluate((s) => window.generateTOTP(s), secret);
}

test('new user can enable authenticator 2FA at registration and log in with it', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Register here' }).click();

  const email = `totp_${Date.now()}@saveplate.com`;

  await page.getByRole('textbox', { name: 'Full Name' }).fill('TOTP Test User');
  await page.getByRole('textbox', { name: 'Email Address' }).fill(email);
  await page.getByLabel('Password (min 6 chars)').fill('demo123');
  await page.getByLabel('Confirm Password').fill('demo123');
  await page.getByLabel('Enable Two-Factor Authentication (2FA)').check();

  await page.getByRole('button', { name: 'Register Account' }).click();

  // Setup modal appears with the generated secret key.
  await expect(page.getByRole('heading', { name: 'Set Up Authenticator App' })).toBeVisible();
  const rawSecret = await page.locator('#totp-secret-display').textContent();
  const secret = rawSecret.replace(/\s+/g, '');
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  // Confirm setup with a code computed the same way an authenticator app would.
  const setupCode = await currentCodeFor(page, secret);
  await page.locator('#totp-verify-input').fill(setupCode);
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Modal closes and we're back on the login box with the email prefilled.
  await expect(page.locator('#modal-container')).not.toHaveClass(/active/);
  await expect(page.getByRole('textbox', { name: 'Email Address' })).toHaveValue(email);

  await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
  await page.getByRole('button', { name: 'Log In' }).click();

  // Password alone isn't enough — the app should now demand a TOTP code.
  await expect(page.getByRole('heading', { name: '2FA Verification' })).toBeVisible();

  const loginCode = await currentCodeFor(page, secret);
  await page.locator('#verification-code').fill(loginCode);
  await page.getByRole('button', { name: 'Verify & Log In' }).click();

  await expect(page.getByRole('link', { name: 'Food Inventory' })).toBeVisible();
});

test('rejects an incorrect authenticator code at login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Email Address' }).fill('demo2fa@saveplate.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByRole('heading', { name: '2FA Verification' })).toBeVisible();

  await page.locator('#verification-code').fill('000000');
  await page.getByRole('button', { name: 'Verify & Log In' }).click();

  await expect(page.locator('#verification-code-group')).toHaveClass(/invalid/);
  await expect(page.getByRole('link', { name: 'Food Inventory' })).not.toBeVisible();
});

test('pre-seeded demo account logs in with its known authenticator key', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Email Address' }).fill('demo2fa@saveplate.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByRole('heading', { name: '2FA Verification' })).toBeVisible();

  const code = await currentCodeFor(page, 'JBSWY3DPEHPK3PXP');
  await page.locator('#verification-code').fill(code);
  await page.getByRole('button', { name: 'Verify & Log In' }).click();

  await expect(page.getByRole('link', { name: 'Food Inventory' })).toBeVisible();
});
