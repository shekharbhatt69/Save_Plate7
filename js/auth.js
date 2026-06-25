/**
 * SavePlate Authentication Module (auth.js)
 * 
 * Owning Role: Security Engineer / User Experience Specialist
 * 
 * User Story:
 * As a SavePlate user, I want to create an account, log in securely (with optional 2FA),
 * and manage my profile/privacy settings so that my personal food data remains private,
 * and I can configure notifications to my liking.
 * 
 * Acceptance Criteria:
 * - Validate registration: full name, valid email, duplicate email check, household size 1-20,
 *   password >= 6 chars, and matching confirm password.
 * - Simulated 2FA displays a 6-digit code inside a container and blocks registration/login until verified.
 * - Validate login inputs, rejects wrong email/password.
 * - A demo account is pre-seeded (demo@saveplate.com / demo123).
 * - Settings view enables editing profile details (name, size, privacy switches, 2FA toggle).
 */

let verificationState = {
    code: '',
    userData: null, // Holds registration or login session payload during verification step
    isLoginVerification: false
};

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
    document.getElementById('auth-login-box').classList.remove('hidden');
    document.getElementById('auth-register-box').classList.add('hidden');
    document.getElementById('auth-2fa-box').classList.add('hidden');
}

function showRegisterBox() {
    document.getElementById('auth-login-box').classList.add('hidden');
    document.getElementById('auth-register-box').classList.remove('hidden');
    document.getElementById('auth-2fa-box').classList.add('hidden');
}

function show2FABox(code) {
    document.getElementById('auth-login-box').classList.add('hidden');
    document.getElementById('auth-register-box').classList.add('hidden');
    document.getElementById('auth-2fa-box').classList.remove('hidden');
    document.getElementById('simulated-code').textContent = code;
    
    // Clear code input field
    const codeInput = document.getElementById('verification-code');
    codeInput.value = '';
    codeInput.parentElement.classList.remove('invalid');
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
    verificationState = { code: '', userData: null, isLoginVerification: false };
    showLoginBox();
});

// --- UC1 Form Validations & Operations ---

// 1. Registration Handler
document.getElementById('register-form').addEventListener('submit', function(e) {
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
        // Generate simulated 2FA code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationState = {
            code: code,
            userData: newUser,
            isLoginVerification: false
        };
        show2FABox(code);
    } else {
        // Save user immediately
        const users = db.getUsers();
        users.push(newUser);
        db.saveUsers(users);

        toast('Registration successful! You can now log in.');
        showLoginBox();
        
        // Populate email field in login for convenient demo
        document.getElementById('login-email').value = newUser.email;
    }
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
    if (user.privacy && user.privacy.enable2FA) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationState = {
            code: code,
            userData: user,
            isLoginVerification: true
        };
        show2FABox(code);
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

// 3. Simulated 2FA verification code submission
document.getElementById('verification-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const codeEl = document.getElementById('verification-code');
    const codeEntered = codeEl.value.trim();

    if (codeEntered !== verificationState.code) {
        codeEl.parentElement.classList.add('invalid');
        return;
    }

    // Code matched!
    if (verificationState.isLoginVerification) {
        // Session Login verification completion
        db.setCurrentUser(verificationState.userData);
        toast('2FA verified. Logged in successfully!');
        
        if (window.scanForExpiryNotifications) {
            window.scanForExpiryNotifications(verificationState.userData.id);
        }
        
        window.location.hash = '#dashboard';
        showView('dashboard');
    } else {
        // Register user completion
        const users = db.getUsers();
        users.push(verificationState.userData);
        db.saveUsers(users);

        toast('Registration successful! Please log in.');
        showLoginBox();
        document.getElementById('login-email').value = verificationState.userData.email;
    }

    // Reset State
    verificationState = { code: '', userData: null, isLoginVerification: false };
});

// 4. Settings Updates Handler
document.getElementById('settings-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const user = db.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('settings-name');
    const sizeEl = document.getElementById('settings-size');
    const showDonations = document.getElementById('settings-privacy-show-donations').checked;
    const emailAlerts = document.getElementById('settings-privacy-email-alerts').checked;
    const enable2fa = document.getElementById('settings-toggle-2fa').checked;

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

    // Update user properties
    const users = db.getUsers();
    const dbUserIndex = users.findIndex(u => u.id === user.id);

    if (dbUserIndex !== -1) {
        users[dbUserIndex].name = nameEl.value.trim();
        users[dbUserIndex].householdSize = size;
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
