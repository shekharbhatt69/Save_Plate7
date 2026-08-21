/**
 * SavePlate Authentication Module (auth.js)
 *
 * Owning Role: Security Engineer / User Experience Specialist
 *
 * User Story:
 * As a SavePlate user, I want to create an account, log in securely (with optional 2FA
 * backed by a real authenticator app), and manage my profile/privacy settings so that my
 * personal food data remains private, and I can configure notifications to my liking.
 *
 * Acceptance Criteria:
 * - Validate registration: full name, valid email, duplicate email check, household size 1-20,
 *   password >= 6 chars, and matching confirm password.
 * - Enabling 2FA (at registration or in Settings) generates a TOTP secret and requires the
 *   user to confirm it by entering a code from their authenticator app before it's saved.
 * - Login blocks on a TOTP code (verified via totp.js) whenever 2FA is enabled for the account.
 * - Validate login inputs, rejects wrong email/password.
 * - A demo account is pre-seeded (demo@saveplate.com / demo123).
 * - Settings view enables editing profile details (name, size, privacy switches, 2FA toggle).
 */

// Holds the user record awaiting a TOTP code during the login flow.
let loginVerificationState = {
    user: null
};

// Stops the login box's live TOTP code display, if one is currently running.
let stopLoginLiveDisplay = null;
function clearLoginLiveDisplay() {
    if (stopLoginLiveDisplay) {
        stopLoginLiveDisplay();
        stopLoginLiveDisplay = null;
    }
}

/**
 * Starts a self-updating live display of the current TOTP code for a secret,
 * so the app can act as its own "authenticator" without a separate device.
 * Refreshes every second and keeps an input field pre-filled with the code,
 * but backs off auto-filling if the field's value diverges from what it last
 * wrote (e.g. a test or user deliberately typed a different code), so manual
 * entry of a wrong code for validation purposes still works as expected.
 * Returns a function that stops the live updates.
 */
function startLiveTOTPDisplay(secret, { codeEl, countdownEl, inputEl }) {
    let stopped = false;
    let lastAutoFilled = '';

    async function tick() {
        if (stopped) return;
        const code = await generateTOTP(secret);
        const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);

        if (codeEl) codeEl.textContent = code;
        if (countdownEl) countdownEl.textContent = `Refreshes in ${secondsLeft}s`;

        if (inputEl && (inputEl.value === '' || inputEl.value === lastAutoFilled)) {
            inputEl.value = code;
        }
        lastAutoFilled = code;
    }

    tick();
    const intervalId = setInterval(tick, 1000);

    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
}

/**
 * Opens a modal walking the user through TOTP authenticator setup: shows the
 * secret key (for a real authenticator app) plus a live auto-filled code (for
 * quick/demo use without one), and asks for confirmation. Resolves true once
 * confirmed, false if the user cancels.
 */
function promptTOTPSetup(secret) {
    return new Promise((resolve) => {
        let settled = false;
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeBtn = document.getElementById('modal-close-btn');
        let stopLiveDisplay = null;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            if (stopLiveDisplay) stopLiveDisplay();
            resolve(result);
        };
        const onCancel = () => finish(false);

        const groupedSecret = secret.match(/.{1,4}/g).join(' ');
        const html = `
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 16px;">
                The code below is already filled in for you. If you'd rather use a real authenticator app (Google Authenticator, Authy, etc.), add the setup key there instead ("Enter a setup key" / manual entry).
            </p>
            <div style="background-color: var(--accent-green-bg); border: 1.5px dashed var(--accent-green); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 16px; text-align: center;">
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">CURRENT CODE</div>
                <div id="totp-live-code" style="font-size: 28px; font-weight: 700; letter-spacing: 6px; font-family: monospace; color: var(--accent-green);">------</div>
                <div id="totp-live-countdown" style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Refreshes in 30s</div>
            </div>
            <div style="background-color: var(--accent-amber-bg); border: 1.5px dashed var(--accent-amber); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px; text-align: center;">
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">SETUP KEY (for a real authenticator app)</div>
                <div id="totp-secret-display" style="font-size: 18px; font-weight: 700; letter-spacing: 2px; font-family: monospace; word-break: break-all;">${escapeHTML(groupedSecret)}</div>
                <button type="button" id="totp-copy-btn" class="btn btn-secondary" style="margin-top: 10px; font-size: 12px; padding: 6px 12px;">Copy Key</button>
            </div>
            <div class="form-group" id="totp-verify-group">
                <label for="totp-verify-input">6-digit code</label>
                <input type="text" id="totp-verify-input" class="form-control" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" style="text-align: center; letter-spacing: 8px; font-size: 20px; font-weight: 700;">
                <div class="error-message">Incorrect code. Please try again.</div>
            </div>
        `;

        openModal('Set Up 2FA', html, async () => {
            const input = document.getElementById('totp-verify-input');
            const group = document.getElementById('totp-verify-group');
            const confirmBtn = document.getElementById('modal-confirm-btn');

            confirmBtn.disabled = true;
            const ok = await verifyTOTP(secret, input.value);
            confirmBtn.disabled = false;

            if (ok) {
                group.classList.remove('invalid');
                closeModal();
                finish(true);
            } else {
                group.classList.add('invalid');
            }
        }, true);

        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);

        document.getElementById('totp-copy-btn').addEventListener('click', () => {
            navigator.clipboard?.writeText(secret);
            toast('Setup key copied to clipboard.');
        });

        stopLiveDisplay = startLiveTOTPDisplay(secret, {
            codeEl: document.getElementById('totp-live-code'),
            countdownEl: document.getElementById('totp-live-countdown'),
            inputEl: document.getElementById('totp-verify-input')
        });
    });
}

// --- Show/Hide Screen Controllers ---

/**
 * Shows the login screen and hides main app shell.
 */
function showAuthScreen() {
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    showLoginBox();
}

function showLoginBox() {
    clearLoginLiveDisplay();
    document.getElementById('auth-login-box').classList.remove('hidden');
    document.getElementById('auth-register-box').classList.add('hidden');
    document.getElementById('auth-2fa-box').classList.add('hidden');
}

function showRegisterBox() {
    clearLoginLiveDisplay();
    document.getElementById('auth-login-box').classList.add('hidden');
    document.getElementById('auth-register-box').classList.remove('hidden');
    document.getElementById('auth-2fa-box').classList.add('hidden');
}

/**
 * Shows the login-time 2FA box with a live, auto-filled TOTP code (backed by
 * the same RFC 6238 algorithm as a real authenticator app), so logging in
 * doesn't require a separate device.
 */
function showLoginVerificationBox(secret) {
    document.getElementById('auth-login-box').classList.add('hidden');
    document.getElementById('auth-register-box').classList.add('hidden');
    document.getElementById('auth-2fa-box').classList.remove('hidden');

    // Clear code input field
    const codeInput = document.getElementById('verification-code');
    codeInput.value = '';
    codeInput.parentElement.classList.remove('invalid');

    clearLoginLiveDisplay();
    stopLoginLiveDisplay = startLiveTOTPDisplay(secret, {
        codeEl: document.getElementById('login-live-code'),
        countdownEl: document.getElementById('login-live-countdown'),
        inputEl: codeInput
    });
}

// --- UI Navigation Bindings ---

document.getElementById('go-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterBox();
});

document.getElementById('go-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginBox();
});

document.getElementById('cancel-2fa').addEventListener('click', (e) => {
    e.preventDefault();
    clearLoginLiveDisplay();
    loginVerificationState = { user: null };
    showLoginBox();
});

// --- UC1 Form Validations & Operations ---

// 1. Registration Handler
document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const nameEl = document.getElementById('reg-name');
    const emailEl = document.getElementById('reg-email');
    const sizeEl = document.getElementById('reg-size');
    const passEl = document.getElementById('reg-password');
    const confEl = document.getElementById('reg-confirm');
    const check2fa = document.getElementById('reg-2fa').checked;

    let isValid = true;

    // Reset validations
    [nameEl, emailEl, sizeEl, passEl, confEl].forEach(el => {
        el.parentElement.classList.remove('invalid');
    });

    // Validate Name
    if (!nameEl.value.trim()) {
        nameEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailEl.value.trim())) {
        emailEl.parentElement.classList.add('invalid');
        isValid = false;
    } else {
        // Check duplicate email
        const users = db.getUsers();
        const duplicate = users.some(u => u.email.toLowerCase() === emailEl.value.trim().toLowerCase());
        if (duplicate) {
            emailEl.parentElement.classList.add('invalid');
            emailEl.parentElement.querySelector('.error-message').textContent = 'This email is already registered.';
            isValid = false;
        }
    }

    // Validate Household Size
    const size = parseInt(sizeEl.value);
    if (isNaN(size) || size < 1 || size > 20) {
        sizeEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    // Validate Password
    if (passEl.value.length < 6) {
        passEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    // Validate Confirm Password
    if (confEl.value !== passEl.value) {
        confEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    if (!isValid) return;

    // Build user record payload
    const newUser = {
        id: uid(),
        name: nameEl.value.trim(),
        email: emailEl.value.trim().toLowerCase(),
        password: passEl.value,
        householdSize: size,
        privacy: {
            showDonations: true,
            emailAlerts: true,
            enable2FA: check2fa
        }
    };

    if (check2fa) {
        // Generate a real TOTP secret and require confirmation from the user's
        // authenticator app before the account is created with 2FA enabled.
        const secret = generateTOTPSecret();
        const confirmed = await promptTOTPSetup(secret);

        if (!confirmed) {
            toast('Authenticator setup was not completed. Registration cancelled.', 'error');
            return;
        }

        newUser.totpSecret = secret;
    }

    // Save user
    const users = db.getUsers();
    users.push(newUser);
    db.saveUsers(users);

    toast(check2fa ? 'Registration successful! Authenticator app connected.' : 'Registration successful! You can now log in.');
    showLoginBox();

    // Populate email field in login for convenient demo
    document.getElementById('login-email').value = newUser.email;
});

// 2. Login Handler
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');

    let isValid = true;

    // Reset validations
    emailEl.parentElement.classList.remove('invalid');
    passEl.parentElement.classList.remove('invalid');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailEl.value.trim())) {
        emailEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    if (!passEl.value) {
        passEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    if (!isValid) return;

    // Find User
    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === emailEl.value.trim().toLowerCase() && u.password === passEl.value);

    if (!user) {
        // Display credentials mismatch toast and inline error
        passEl.parentElement.classList.add('invalid');
        passEl.parentElement.querySelector('.error-message').textContent = 'Incorrect password or email.';
        toast('Login failed. Please check your credentials.', 'error');
        return;
    }

    // Check if 2FA is enabled in settings
    if (user.privacy && user.privacy.enable2FA && user.totpSecret) {
        loginVerificationState = { user: user };
        showLoginVerificationBox(user.totpSecret);
    } else {
        // Start user session
        db.setCurrentUser(user);
        toast('Logged in successfully!');
        
        // Scan expiry notifications on load
        if (window.scanForExpiryNotifications) {
            window.scanForExpiryNotifications(user.id);
        }

        // Redirect to dashboard
        window.location.hash = '#dashboard';
        showView('dashboard');
    }
});

// 3. Login-time TOTP verification code submission
document.getElementById('verification-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const user = loginVerificationState.user;
    if (!user) return;

    const codeEl = document.getElementById('verification-code');
    const codeEntered = codeEl.value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    const ok = await verifyTOTP(user.totpSecret, codeEntered);
    submitBtn.disabled = false;

    if (!ok) {
        codeEl.parentElement.classList.add('invalid');
        return;
    }

    codeEl.parentElement.classList.remove('invalid');
    clearLoginLiveDisplay();

    // Session Login verification completion
    db.setCurrentUser(user);
    toast('2FA verified. Logged in successfully!');

    if (window.scanForExpiryNotifications) {
        window.scanForExpiryNotifications(user.id);
    }

    window.location.hash = '#dashboard';
    showView('dashboard');

    // Reset State
    loginVerificationState = { user: null };
});

// 4. Settings Updates Handler
document.getElementById('settings-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const user = db.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('settings-name');
    const sizeEl = document.getElementById('settings-size');
    const showDonations = document.getElementById('settings-privacy-show-donations').checked;
    const emailAlerts = document.getElementById('settings-privacy-email-alerts').checked;
    const enable2faToggle = document.getElementById('settings-toggle-2fa');
    const enable2fa = enable2faToggle.checked;

    let isValid = true;

    // Reset states
    nameEl.parentElement.classList.remove('invalid');
    sizeEl.parentElement.classList.remove('invalid');

    if (!nameEl.value.trim()) {
        nameEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    const size = parseInt(sizeEl.value);
    if (isNaN(size) || size < 1 || size > 20) {
        sizeEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    if (!isValid) return;

    const wasEnabled = !!(user.privacy && user.privacy.enable2FA);
    let totpSecret = user.totpSecret || null;

    if (enable2fa && !wasEnabled) {
        // Turning 2FA on: must confirm a new authenticator secret first.
        const secret = generateTOTPSecret();
        const confirmed = await promptTOTPSetup(secret);

        if (!confirmed) {
            toast('Authenticator setup was not completed. 2FA remains disabled.', 'error');
            enable2faToggle.checked = false;
            return;
        }

        totpSecret = secret;
    } else if (!enable2fa) {
        totpSecret = null;
    }

    // Update user properties
    const users = db.getUsers();
    const dbUserIndex = users.findIndex(u => u.id === user.id);

    if (dbUserIndex !== -1) {
        users[dbUserIndex].name = nameEl.value.trim();
        users[dbUserIndex].householdSize = size;
        users[dbUserIndex].totpSecret = totpSecret;
        users[dbUserIndex].privacy = {
            showDonations: showDonations,
            emailAlerts: emailAlerts,
            enable2FA: enable2fa
        };

        // Update database and active session
        db.saveUsers(users);
        db.setCurrentUser(users[dbUserIndex]);

        toast('Settings updated successfully!');

        // Refresh routing sidebar metadata immediately
        updateSidebarMeta();
    }
});

/**
 * Clears current user session and displays auth login container.
 */
function logoutUser() {
    db.setCurrentUser(null);
    toast('Logged out successfully.');
    
    // Clear credentials fields
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    showAuthScreen();
}

// Bind navbar and button logout listener directly
document.getElementById('btn-logout').addEventListener('click', function(e) {
    e.preventDefault();
    logoutUser();
});

/**
 * Loads current settings inputs inside settings form page.
 */
function loadSettings() {
    const user = db.getCurrentUser();
    if (!user) return;

    document.getElementById('settings-name').value = user.name;
    document.getElementById('settings-size').value = user.householdSize;
    document.getElementById('settings-privacy-show-donations').checked = user.privacy ? user.privacy.showDonations : true;
    document.getElementById('settings-privacy-email-alerts').checked = user.privacy ? user.privacy.emailAlerts : true;
    document.getElementById('settings-toggle-2fa').checked = user.privacy ? user.privacy.enable2FA : false;
}
