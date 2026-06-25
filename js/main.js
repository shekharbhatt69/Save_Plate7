/**
 * SavePlate Shared Routing & Utility Module (main.js)
 * 
 * Owning Role: Lead Software Engineer / Architect
 * 
 * User Story:
 * As a SavePlate user, I want smooth navigation between the dashboard, inventory,
 * weekly meal planner, community board, food analytics, and notification center 
 * so that my operations are intuitive, and I receive prompt feedback for my actions.
 * 
 * Acceptance Criteria:
 * - Direct hash-based routing between all views.
 * - Handles login state and session checking on startup and route changes.
 * - Renders a dashboard with: welcome message, stat counts, list of 5 soonest-expiring items,
 *   and quick action buttons.
 * - Provides reusable, customizable modal, confirmation modal, and toast managers.
 * - Manages responsive sidebar toggle operations for mobile screens.
 */

// Global Router and View State Configuration
const views = {
    dashboard: { id: 'view-dashboard', title: 'Dashboard', init: () => loadDashboard() },
    inventory: { id: 'view-inventory', title: 'Food Inventory', init: () => loadInventory() },
    mealplan: { id: 'view-mealplan', title: 'Meal Planner', init: () => loadMealPlan() },
    browse: { id: 'view-browse', title: 'Community Donations', init: () => loadBrowse() },
    analytics: { id: 'view-analytics', title: 'Food Analytics', init: () => loadAnalytics() },
    notifications: { id: 'view-notifications', title: 'Notifications', init: () => loadNotifications() },
    settings: { id: 'view-settings', title: 'Settings', init: () => loadSettings() }
};

// Global Event Handlers for Modals
let activeModalConfirmHandler = null;

// --- Toast Alerts Implementation ---

/**
 * Displays a non-blocking toast alert in the bottom right.
 * @param {string} message The text content of the toast.
 * @param {'success'|'error'|'warning'|'info'} type The alert type.
 */
function toast(message, type = 'success') {
    const toastWrapper = document.getElementById('toast-wrapper');
    if (!toastWrapper) return;

    const toastDiv = document.createElement('div');
    toastDiv.className = `toast ${type}`;

    // Select corresponding SVG icon
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toastDiv.innerHTML = `${iconSvg} <span>${escapeHTML(message)}</span>`;
    toastWrapper.appendChild(toastDiv);

    // Auto-remove toast node from DOM after animation completes
    setTimeout(() => {
        toastDiv.remove();
    }, 3000);
}

// --- Modal Overlays Implementation ---

/**
 * Opens a reusable overlay modal.
 * @param {string} title Modal header text.
 * @param {string} contentHtml Custom HTML representation for the form body.
 * @param {function} onConfirm Callback triggered upon clicking confirm.
 * @param {boolean} showCancel Toggle visibility of the cancel button.
 */
function openModal(title, contentHtml, onConfirm, showCancel = true) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title-text');
    const modalBody = document.getElementById('modal-body-content');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    
    if (showCancel) {
        cancelBtn.style.display = 'inline-flex';
    } else {
        cancelBtn.style.display = 'none';
    }
    
    activeModalConfirmHandler = onConfirm;
    modalContainer.classList.add('active');
}

/**
 * Closes the active modal overlay.
 */
function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('active');
    activeModalConfirmHandler = null;
}

/**
 * Opens a confirmation dialog.
 * @param {string} title Dialog header.
 * @param {string} message Text message.
 * @param {function} onConfirm Success callback.
 */
function confirmModal(title, message, onConfirm) {
    const content = `<p style="font-size: 15px; color: var(--text-charcoal);">${escapeHTML(message)}</p>`;
    openModal(title, content, onConfirm, true);
}

// --- Routing Engine ---

/**
 * Main visibility switcher for single page tabs.
 */
function showView(viewName) {
    const user = db.getCurrentUser();
    
    // Auth route guard
    if (!user) {
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('active'); // Wait, auth-screen is controlled by auth.js
        showAuthScreen();
        return;
    }

    // Hide auth screen and display main layout shell
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    const view = views[viewName];
    if (!view) {
        window.location.hash = '#dashboard';
        return;
    }

    // Close any navigation drawer overlay open on mobile screens
    document.getElementById('app-sidebar').classList.remove('mobile-active');

    // Toggle DOM sections
    Object.keys(views).forEach(k => {
        const viewEl = document.getElementById(views[k].id);
        const linkEl = document.getElementById(`nav-${k}`);
        if (k === viewName) {
            viewEl.classList.remove('hidden');
            if (linkEl) linkEl.classList.add('active');
        } else {
            viewEl.classList.add('hidden');
            if (linkEl) linkEl.classList.remove('active');
        }
    });

    // Update Topbar Title Display
    document.getElementById('page-display-title').textContent = view.title;

    // Trigger specific page initiation handlers
    view.init();
    
    // Refresh sidebar badging and user profile details
    updateSidebarMeta();
}

/**
 * Refreshes unread count badges and profile data in sidebar footer.
 */
function updateSidebarMeta() {
    const user = db.getCurrentUser();
    if (!user) return;

    // Name and avatar letter
    document.getElementById('header-user-name').textContent = user.name;
    const initial = user.name ? user.name.trim().charAt(0).toUpperCase() : 'U';
    document.getElementById('header-avatar').textContent = initial;

    // Unread count notification badge
    const notifs = db.getNotifications(user.id);
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
}

// --- Load View Handlers ---

/**
 * Loads dashboard view data & counters
 */
function loadDashboard() {
    const user = db.getCurrentUser();
    if (!user) return;

    // Set greeting text
    document.getElementById('dashboard-welcome').textContent = `Hello, ${escapeHTML(user.name)}!`;

    // Set today's date in human format
    const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('dashboard-date-display').textContent = todayStr;

    // Load active inventories
    const inventory = db.getInventory(user.id);
    
    // Dynamic counts
    let expiringCount = 0;
    let expiredCount = 0;

    inventory.forEach(item => {
        const days = daysUntil(item.expiryDate);
        if (days < 0) {
            expiredCount++;
        } else if (days <= 2) {
            expiringCount++;
        }
    });

    // Donations nearby claims count
    const claims = db.getDonations().filter(d => d.claimed && d.claimedBy === user.id).length;

    // Print counter cards
    document.getElementById('dash-stat-inventory').textContent = inventory.length;
    document.getElementById('dash-stat-expiring').textContent = expiringCount;
    document.getElementById('dash-stat-expired').textContent = expiredCount;
    document.getElementById('dash-stat-donations').textContent = claims;

    // Print soonest expiring list (Top 5)
    // Sort inventory items: expired first (daysUntil ascending)
    const sorted = [...inventory].sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
    const top5 = sorted.slice(0, 5);

    const tbody = document.getElementById('dash-expiring-tbody');
    tbody.innerHTML = '';

    if (top5.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No food items in your inventory. Click "Add Food Item" under inventory to get started!</td></tr>`;
        return;
    }

    top5.forEach(item => {
        const days = daysUntil(item.expiryDate);
        let statusHtml = '';
        if (days < 0) {
            statusHtml = `<span class="pill pill-danger">Expired</span>`;
        } else if (days <= 2) {
            statusHtml = `<span class="pill pill-warning">Use in ${days}d</span>`;
        } else {
            statusHtml = `<span class="pill pill-fresh">Fresh</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.location)}</td>
            <td><span class="donation-tag" style="margin-bottom:0;">${escapeHTML(item.category)}</span></td>
            <td>${fmtDate(item.expiryDate)}</td>
            <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Global Initialization & Event Listeners ---

window.addEventListener('hashchange', () => {
    const hash = window.location.hash || '#dashboard';
    
    if (hash === '#logout') {
        logoutUser();
        return;
    }

    const viewName = hash.replace('#', '');
    if (views[viewName]) {
        showView(viewName);
    } else {
        showView('dashboard');
    }
});

// Setup global modal event listeners
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    if (activeModalConfirmHandler) {
        activeModalConfirmHandler();
    }
});

// Mobile menu navigation button
document.getElementById('mobile-toggle-btn').addEventListener('click', () => {
    document.getElementById('app-sidebar').classList.toggle('mobile-active');
});

// Init load
document.addEventListener('DOMContentLoaded', () => {
    // Run notification scan on startup if user logged in
    const user = db.getCurrentUser();
    if (user) {
        // Automatically check expiry notifications
        if (window.scanForExpiryNotifications) {
            window.scanForExpiryNotifications(user.id);
        }
        
        // Initial routing trigger
        const hash = window.location.hash || '#dashboard';
        const viewName = hash.replace('#', '');
        if (views[viewName]) {
            showView(viewName);
        } else {
            showView('dashboard');
        }
    } else {
        showAuthScreen();
    }
});
