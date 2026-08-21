import { test, expect } from '@playwright/test';
import { currentCodeFor } from './helpers.js';

/**
 * UC1: Register & Privacy (auth.js, totp.js)
 *
 * Acceptance criteria under test:
 * - Registration validates full name, email format, duplicate email, household
 *   size (1-20), password length (>=6), and matching confirm password.
 * - Enabling 2FA at registration generates a TOTP secret and blocks account
 *   creation until confirmed with a code from an authenticator app.
 * - Login rejects wrong email/password and demands a TOTP code whenever the
 *   account has 2FA enabled.
 */

test.describe('UC1: Registration validation', () => {
  test('rejects an empty name, invalid email, mismatched household size, short password, and mismatched confirm', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Register here' }).click();

    await page.getByRole('textbox', { name: 'Email Address' }).fill('not-an-email');
    await page.getByRole('spinbutton', { name: 'Household Size (1-20 members)' }).fill('99');
    await page.getByLabel('Password (min 6 chars)').fill('123');
    await page.getByLabel('Confirm Password').fill('456');

    await page.getByRole('button', { name: 'Register Account' }).click();

    await expect(page.locator('#reg-name-group')).toHaveClass(/invalid/);
    await expect(page.locator('#reg-email-group')).toHaveClass(/invalid/);
    await expect(page.locator('#reg-size-group')).toHaveClass(/invalid/);
    await expect(page.locator('#reg-password-group')).toHaveClass(/invalid/);
    await expect(page.locator('#reg-confirm-group')).toHaveClass(/invalid/);

    // No account should have been created, and we should still be on the register box.
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('rejects registering with an email that already exists', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Register here' }).click();

    await page.getByRole('textbox', { name: 'Full Name' }).fill('Duplicate Tester');
    await page.getByRole('textbox', { name: 'Email Address' }).fill('demo@saveplate.com');
    await page.getByLabel('Password (min 6 chars)').fill('validpass');
    await page.getByLabel('Confirm Password').fill('validpass');

    await page.getByRole('button', { name: 'Register Account' }).click();

    await expect(page.locator('#reg-email-group')).toHaveClass(/invalid/);
    await expect(page.locator('#reg-email-group .error-message')).toHaveText('This email is already registered.');
  });

  test('creates an account without 2FA and logs straight into the dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Register here' }).click();

    const email = `plain_${Date.now()}@saveplate.com`;
    await page.getByRole('textbox', { name: 'Full Name' }).fill('Plain User');
    await page.getByRole('textbox', { name: 'Email Address' }).fill(email);
    await page.getByLabel('Password (min 6 chars)').fill('demo123');
    await page.getByLabel('Confirm Password').fill('demo123');

    await page.getByRole('button', { name: 'Register Account' }).click();

    // Back on the login box with the email prefilled, no 2FA prompt.
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email Address' })).toHaveValue(email);

    await page.getByRole('textbox', { name: 'Password' }).fill('demo123');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page.getByRole('link', { name: 'Food Inventory' })).toBeVisible();
  });
});

test.describe('UC1: Login validation', () => {
  test('rejects an unknown email/password combination', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('textbox', { name: 'Email Address' }).fill('demo@saveplate.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page.locator('#login-password-group')).toHaveClass(/invalid/);
    await expect(page.getByRole('link', { name: 'Food Inventory' })).not.toBeVisible();
  });
});

test.describe('UC1: Two-factor authenticator (real TOTP)', () => {
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
    await expect(page.getByRole('heading', { name: 'Set Up 2FA' })).toBeVisible();
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
});
