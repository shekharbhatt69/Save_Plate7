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
}

async function jsClick(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
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
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await delay(600);

    // Log in with demo account
    await page.type('#login-email', 'demo@saveplate.com');
    await page.type('#login-password', 'demo123');
    await jsClick(page, '#login-form button[type="submit"]');
    await delay(1200);

    const appVisible = await page.$eval('#app-shell', el => !el.classList.contains('hidden'));
    console.log(`App shell visible: ${appVisible}`);

    // ── SCREEN 9: Dashboard Overview ─────────────────────────────────
    console.log('\n[1/2] Dashboard Overview');
    await jsClick(page, '#nav-dashboard');
    await delay(900);
    await saveScreenshot(page, 'screen_09_dashboard.png');

    // ── SCREEN 10: Weekly Meal Planner ────────────────────────────────
    console.log('\n[2/2] Weekly Meal Planner');
    await jsClick(page, '#nav-mealplan');
    await delay(900);
    await saveScreenshot(page, 'screen_10_mealplan.png');

    await browser.close();

    // Verify
    const files = ['screen_09_dashboard.png', 'screen_10_mealplan.png'];
    console.log('\n=== Summary ===');
    files.forEach(f => {
        const fp = path.join(SAVE_DIR, f);
        const exists = fs.existsSync(fp);
        const size = exists ? fs.statSync(fp).size : 0;
        console.log(`${exists ? '✓' : '✗'} ${f} (${(size/1024).toFixed(1)} KB)`);
    });
    console.log('Done!');
})();
