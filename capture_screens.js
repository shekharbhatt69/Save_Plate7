const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080/index.html';
const SAVE_DIR = '/Users/shekharbhatt/Desktop/saveplate';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function saveScreenshot(page, filename) {
    const filePath = path.join(SAVE_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    const size = fs.statSync(filePath).size;
    console.log(`  ✓ Saved: ${filename} (${(size/1024).toFixed(1)} KB)`);
    return filePath;
}

async function jsClick(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
        else console.warn('Element not found:', sel);
    }, selector);
}

(async () => {
    console.log('Launching Chrome...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 1: Register / Create Account Page
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[1/8] Register / Create Account Page');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await delay(600);
    // Click "Register here" to show registration form
    await jsClick(page, '#go-to-register');
    await delay(600);
    await saveScreenshot(page, 'screen_01_register.png');

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 2: 2FA Setup Page
    // First fill registration with 2FA checked to show that screen
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[2/8] 2FA Setup Page');
    // Use a unique email to avoid duplicate
    await page.type('#reg-name', 'Demo User');
    await page.type('#reg-email', 'test2fa@saveplate.com');
    await page.$eval('#reg-size', el => el.value = '2');
    await page.type('#reg-password', 'test123');
    await page.type('#reg-confirm', 'test123');
    await page.$eval('#reg-2fa', el => { el.checked = true; });
    await delay(300);
    await jsClick(page, '#register-form button[type="submit"]');
    await delay(900);
    // 2FA box should now be visible
    await saveScreenshot(page, 'screen_02_2fa.png');

    // ─────────────────────────────────────────────────────────────────
    // Now log in via the pre-seeded demo account (no 2FA)
    // This avoids the 2FA flow entirely
    // ─────────────────────────────────────────────────────────────────
    console.log('\n  Logging in with demo account...');
    // Go back to login
    await jsClick(page, '#cancel-2fa');
    await delay(500);
    await page.type('#login-email', 'demo@saveplate.com');
    await page.type('#login-password', 'demo123');
    await jsClick(page, '#login-form button[type="submit"]');
    await delay(1200);

    // Verify we're in the app
    const appVisible = await page.$eval('#app-shell', el => !el.classList.contains('hidden'));
    console.log(`  App shell visible: ${appVisible}`);
    if (!appVisible) {
        console.error('  ERROR: Login failed! Trying via localStorage injection...');
        // Inject session via localStorage as fallback
        await page.evaluate(() => {
            const users = JSON.parse(localStorage.getItem('saveplate_users') || '[]');
            const demo = users.find(u => u.email === 'demo@saveplate.com');
            if (demo) {
                localStorage.setItem('saveplate_current_user_id', demo.id);
            }
        });
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        await delay(800);
    }

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 3: Account Privacy and Security Settings Page
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[3/8] Account Privacy & Security Settings Page');
    await jsClick(page, '#nav-settings');
    await delay(800);
    await saveScreenshot(page, 'screen_03_settings.png');

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 4: Food Inventory Page
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[4/8] Food Inventory Page');
    await jsClick(page, '#nav-inventory');
    await delay(800);
    await saveScreenshot(page, 'screen_04_inventory.png');

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 5: Add Food Item Dialog
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[5/8] Add Food Item Dialog');
    await jsClick(page, '#btn-add-food-modal');
    await delay(800);
    await saveScreenshot(page, 'screen_05_add_food.png');
    // Close modal
    await jsClick(page, '#modal-close-btn');
    await delay(500);

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 6: Browse & Donate Page
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[6/8] Browse & Donate Page');
    await jsClick(page, '#nav-browse');
    await delay(800);
    await saveScreenshot(page, 'screen_06_browse.png');

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 7: Food Analytics Dashboard
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Food Analytics Dashboard');
    await jsClick(page, '#nav-analytics');
    await delay(800);
    await saveScreenshot(page, 'screen_07_analytics.png');

    // ─────────────────────────────────────────────────────────────────
    // SCREEN 8: Notifications Page
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[8/8] Notifications Page');
    await jsClick(page, '#nav-notifications');
    await delay(800);
    await saveScreenshot(page, 'screen_08_notifications.png');

    await browser.close();

    // ── Final Verification ────────────────────────────────────────────
    const files = [
        'screen_01_register.png',
        'screen_02_2fa.png',
        'screen_03_settings.png',
        'screen_04_inventory.png',
        'screen_05_add_food.png',
        'screen_06_browse.png',
        'screen_07_analytics.png',
        'screen_08_notifications.png',
    ];

    console.log('\n========== FINAL SUMMARY ==========');
    let allOk = true;
    files.forEach(f => {
        const fp = path.join(SAVE_DIR, f);
        const exists = fs.existsSync(fp);
        const size = exists ? fs.statSync(fp).size : 0;
        if (!exists || size < 10000) allOk = false;
        console.log(`${(exists && size > 10000) ? '✓' : '✗'} ${f} (${(size/1024).toFixed(1)} KB)`);
    });
    console.log(allOk ? '\nAll 8 screenshots captured!' : '\nWarning: Some screenshots may be missing or too small.');
})();
