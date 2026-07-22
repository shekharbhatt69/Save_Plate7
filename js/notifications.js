/**
 * SavePlate Notifications Module (notifications.js)
 * 
 * Owning Role: Notifications Systems Architect
 * 
 * User Story:
 * As a SavePlate user, I want to receive alerts when my food is expired or expiring within 1 day,
 * and manage my notifications (mark read, view counts) so that I can take timely action
 * on items that need to be eaten or donated.
 * 
 * Acceptance Criteria:
 * - List notifications newest first with icon, title, description, and relative time.
 * - Highlight unread entries and display unread count badge in sidebar.
 * - Automatically scan food inventory and create non-duplicate alerts for expired/expiring items.
 * - Mark individual alerts read on click, and provide a "Mark all as read" button.
 */

// Bind mark all read listener
document.getElementById('btn-notif-mark-all').addEventListener('click', () => markAllNotificationsRead());

/**
 * Automatically scans active user inventory for expired or expiring items (within 1 day).
 * Generates warning/danger notifications while guarding against duplicates.
 * @param {string} userId The current user ID.
 */
function scanForExpiryNotifications(userId) {
    if (!userId) return;

    const inventory = db.getInventory(userId);
    const notifications = db.getNotifications(userId);
    let changed = false;

    inventory.forEach(item => {
        const days = daysUntil(item.expiryDate);
        
        if (days < 0) {
            // Expired alert
            const notifKey = `notif_exp_${item.id}_expired`;
            const exists = notifications.some(n => n.id === notifKey);
            
            if (!exists) {
                notifications.push({
                    id: notifKey,
                    userId: userId,
                    title: `Expired: ${item.name}`,
                    description: `Your ${item.name} expired on ${fmtDate(item.expiryDate)}. Please remove it or mark it used.`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    type: 'danger'
                });
                changed = true;
            }
        } else if (days <= 1) {
            // Expiring soon alert (expires today or tomorrow)
            const notifKey = `notif_exp_${item.id}_warning`;
            const exists = notifications.some(n => n.id === notifKey);
            
            if (!exists) {
                const dayText = days === 0 ? 'today' : 'tomorrow';
                notifications.push({
                    id: notifKey,
                    userId: userId,
                    title: `Expiring Soon: ${item.name}`,
                    description: `Your ${item.name} is expiring ${dayText} (${fmtDate(item.expiryDate)}). Try to plan a meal with it.`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    type: 'warning'
                });
                changed = true;
            }
        }
    });

    if (changed) {
        db.saveNotifications(notifications);
        updateSidebarMeta();
    }
}

// Make scanner globally available for routing calls
window.scanForExpiryNotifications = scanForExpiryNotifications;

/**
 * Converts ISO date string to a user-friendly relative timestamp.
 */
function getRelativeTime(isoString) {
    const past = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Loads and renders notifications in the UI panel.
 */
function loadNotifications() {
    const user = db.getCurrentUser();
    if (!user) return;

    // Scan again in case new items were added or date changed
    scanForExpiryNotifications(user.id);

    const notifications = db.getNotifications(user.id);
    
    // Sort: newest first
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const listContainer = document.getElementById('notifications-list');
    listContainer.innerHTML = '';

    const unreadCount = notifications.filter(n => !n.read).length;
    document.getElementById('notif-count-text').textContent = `You have ${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`;

    if (notifications.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>No notifications logs available.</p>
            </div>
        `;
        return;
    }

    notifications.forEach(notif => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `notif-item ${notif.read ? '' : 'unread'}`;
        itemDiv.setAttribute('data-id', notif.id);
        
        let iconClass = 'info';
        let svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        if (notif.type === 'warning') {
            iconClass = 'warning';
            svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        } else if (notif.type === 'danger') {
            iconClass = 'danger';
            svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        }

        itemDiv.innerHTML = `
            <div class="notif-icon ${iconClass}">
                ${svgIcon}
            </div>
            <div class="notif-content">
                <div class="notif-title">${escapeHTML(notif.title)}</div>
                <div class="notif-desc">${escapeHTML(notif.description)}</div>
                <div class="notif-time">${getRelativeTime(notif.timestamp)}</div>
            </div>
        `;

        // Click individual item to mark it read
        itemDiv.addEventListener('click', () => {
            markNotificationAsRead(notif.id);
        });

        listContainer.appendChild(itemDiv);
    });
}

/**
 * Marks a single notification as read in storage.
 */
function markNotificationAsRead(notifId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const notifications = db.getNotifications();
    const index = notifications.findIndex(n => n.id === notifId && n.userId === user.id);

    if (index !== -1) {
        if (!notifications[index].read) {
            notifications[index].read = true;
            db.saveNotifications(notifications);
            toast('Marked alert as read.');
            updateSidebarMeta();
            loadNotifications();
        }
    }
}

/**
 * Marks all notifications for current user as read.
 */
function markAllNotificationsRead() {
    const user = db.getCurrentUser();
    if (!user) return;

    const notifications = db.getNotifications();
    let updated = false;

    notifications.forEach(n => {
        if (n.userId === user.id && !n.read) {
            n.read = true;
            updated = true;
        }
    });

    if (updated) {
        db.saveNotifications(notifications);
        toast('All notifications marked as read.');
        updateSidebarMeta();
        loadNotifications();
    }
}
