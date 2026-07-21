/**
 * SavePlate Storage Module (storage.js)
 * 
 * Owning Role: Database Designer / Storage Engineer
 * 
 * User Story:
 * As a SavePlate user or developer, I want a robust local database using the browser's 
 * localStorage so that all users, inventories, donations, meal plans, and notifications
 * are persisted locally without requiring a backend database server.
 * 
 * Acceptance Criteria:
 * - Reads/writes users, current session, per-user inventory, community board, meal plans, and notifications.
 * - Provides helpers for ID generation and date manipulation.
 * - Seeds a demo account (demo@saveplate.com / demo123) with 8 inventory items (some expiring soon, some expired),
 *   3 community donations from other users, and 3 notifications on first run.
 * - Ensures dates are dynamic (relative to the current date) so the demo is always realistic.
 */

const STORAGE_KEYS = {
    USERS: 'saveplate_users',
    SESSION: 'saveplate_session',
    INVENTORY: 'saveplate_inventory',
    DONATIONS: 'saveplate_donations',
    MEALPLAN: 'saveplate_mealplan',
    NOTIFICATIONS: 'saveplate_notifications',
    ANALYTICS_HISTORY: 'saveplate_analytics_history' // Track used/expired events for UC4
};

// --- Helper Functions ---

/**
 * Generates a unique identifier string.
 */
function uid() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Calculates days remaining until the given date string.
 * Returns negative if the date is in the past.
 */
function daysUntil(dateStr) {
    if (!dateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns a formatted Date string YYYY-MM-DD from a Date object or string.
 */
function fmtDate(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

/**
 * Adds (or subtracts if negative) days to the current date and returns YYYY-MM-DD.
 */
function addDays(n) {
    const date = new Date();
    date.setDate(date.getDate() + n);
    return fmtDate(date);
}

/**
 * Sanitizes input text to prevent basic HTML injection.
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- DB Interface ---

const db = {
    // Users
    getUsers() {
        const users = localStorage.getItem(STORAGE_KEYS.USERS);
        return users ? JSON.parse(users) : [];
    },
    saveUsers(users) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    },

    // Session (current user object or null)
    getCurrentUser() {
        const session = localStorage.getItem(STORAGE_KEYS.SESSION);
        return session ? JSON.parse(session) : null;
    },
    setCurrentUser(user) {
        if (user) {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
    },

    // Inventory (all items across all users, filtered by userId)
    getInventory(userId) {
        const items = localStorage.getItem(STORAGE_KEYS.INVENTORY);
        const allItems = items ? JSON.parse(items) : [];
        if (userId) {
            return allItems.filter(item => item.userId === userId);
        }
        return allItems;
    },
    saveInventory(allItems) {
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(allItems));
    },

    // Donations (shared community list)
    getDonations() {
        const donations = localStorage.getItem(STORAGE_KEYS.DONATIONS);
        return donations ? JSON.parse(donations) : [];
    },
    saveDonations(donations) {
        localStorage.setItem(STORAGE_KEYS.DONATIONS, JSON.stringify(donations));
    },

    // Meal Plans (per user: { userId: { Mon: [], Tue: [] ... } })
    getMealPlans(userId) {
        const plans = localStorage.getItem(STORAGE_KEYS.MEALPLAN);
        const allPlans = plans ? JSON.parse(plans) : {};
        if (userId) {
            return allPlans[userId] || {
                Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: []
            };
        }
        return allPlans;
    },
    saveMealPlans(userId, userPlan) {
        const allPlans = this.getMealPlans();
        allPlans[userId] = userPlan;
        localStorage.setItem(STORAGE_KEYS.MEALPLAN, JSON.stringify(allPlans));
    },

    // Notifications (per user)
    getNotifications(userId) {
        const notifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
        const allNotifications = notifications ? JSON.parse(notifications) : [];
        if (userId) {
            return allNotifications.filter(n => n.userId === userId);
        }
        return allNotifications;
    },
    saveNotifications(allNotifications) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(allNotifications));
    },

    // Analytics history (log of items consumed, expired, or donated for UC4 metrics)
    getAnalyticsHistory(userId) {
        const history = localStorage.getItem(STORAGE_KEYS.ANALYTICS_HISTORY);
        const allHistory = history ? JSON.parse(history) : [];
        if (userId) {
            return allHistory.filter(h => h.userId === userId);
        }
        return allHistory;
    },
    saveAnalyticsHistory(allHistory) {
        localStorage.setItem(STORAGE_KEYS.ANALYTICS_HISTORY, JSON.stringify(allHistory));
    },

    // Initialize/Seed Database
    initialize() {
        // 1. Seed Users
        let users = this.getUsers();
        let demoUser = users.find(u => u.email === 'demo@saveplate.com');
        
        if (!demoUser) {
            demoUser = {
                id: 'usr_demo',
                name: 'Demo User',
                email: 'demo@saveplate.com',
                password: 'demo123', // Simple plaintext password for university demo
                householdSize: 3,
                privacy: {
                    showDonations: true,
                    emailAlerts: true,
                    enable2FA: false
                }
            };
            users.push(demoUser);
            this.saveUsers(users);
        }

        // Seed a second demo account with 2FA already switched on so the
        // authenticator flow can be tried immediately with any TOTP app
        // (Google Authenticator, Authy, etc.) using the setup key below.
        let demo2faUser = users.find(u => u.email === 'demo2fa@saveplate.com');
        if (!demo2faUser) {
            demo2faUser = {
                id: 'usr_demo_2fa',
                name: 'Demo 2FA User',
                email: 'demo2fa@saveplate.com',
                password: 'demo123',
                householdSize: 2,
                totpSecret: 'JBSWY3DPEHPK3PXP', // classic RFC test-vector key: add this in your authenticator app to log in
                privacy: {
                    showDonations: true,
                    emailAlerts: true,
                    enable2FA: true
                }
            };
            users.push(demo2faUser);
            this.saveUsers(users);
        }

        // 2. Seed Inventory for Demo User (if inventory is empty)
        let allItems = localStorage.getItem(STORAGE_KEYS.INVENTORY) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY)) : null;
        if (!allItems) {
            allItems = [
                // Expired (Red status)
                {
                    id: 'inv_1',
                    userId: 'usr_demo',
                    name: 'Whole Wheat Bread',
                    quantity: 1,
                    unit: 'loaf',
                    category: 'Bakery',
                    location: 'Counter',
                    expiryDate: addDays(-3), // Expired 3 days ago
                    addedDate: addDays(-8)
                },
                {
                    id: 'inv_2',
                    userId: 'usr_demo',
                    name: 'Whole Milk',
                    quantity: 0.5,
                    unit: 'L',
                    category: 'Dairy',
                    location: 'Fridge',
                    expiryDate: addDays(-1), // Expired 1 day ago
                    addedDate: addDays(-6)
                },
                // Expiring soon (≤ 2 days, Amber status)
                {
                    id: 'inv_3',
                    userId: 'usr_demo',
                    name: 'Roma Tomatoes',
                    quantity: 5,
                    unit: 'pcs',
                    category: 'Fresh',
                    location: 'Fridge',
                    expiryDate: addDays(0), // Expiring today
                    addedDate: addDays(-4)
                },
                {
                    id: 'inv_4',
                    userId: 'usr_demo',
                    name: 'Ripe Avocado',
                    quantity: 2,
                    unit: 'pcs',
                    category: 'Fresh',
                    location: 'Counter',
                    expiryDate: addDays(1), // Expiring tomorrow
                    addedDate: addDays(-3)
                },
                {
                    id: 'inv_5',
                    userId: 'usr_demo',
                    name: 'Chicken Breasts',
                    quantity: 500,
                    unit: 'g',
                    category: 'Other',
                    location: 'Fridge',
                    expiryDate: addDays(2), // Expiring in 2 days
                    addedDate: addDays(-2)
                },
                // Fresh (> 2 days, Green status)
                {
                    id: 'inv_6',
                    userId: 'usr_demo',
                    name: 'Fuji Apples',
                    quantity: 8,
                    unit: 'pcs',
                    category: 'Fresh',
                    location: 'Counter',
                    expiryDate: addDays(10), // Expiring in 10 days
                    addedDate: addDays(-2)
                },
                {
                    id: 'inv_7',
                    userId: 'usr_demo',
                    name: 'Jasmine Rice',
                    quantity: 2,
                    unit: 'kg',
                    category: 'Grains',
                    location: 'Pantry',
                    expiryDate: addDays(120), // Expiring in 120 days
                    addedDate: addDays(-5)
                },
                {
                    id: 'inv_8',
                    userId: 'usr_demo',
                    name: 'Canned Lentils',
                    quantity: 3,
                    unit: 'cans',
                    category: 'Canned',
                    location: 'Pantry',
                    expiryDate: addDays(200), // Expiring in 200 days
                    addedDate: addDays(-10)
                }
            ];
            this.saveInventory(allItems);
        }

        // 3. Seed Shared Community Donations (from other simulated users)
        let donations = localStorage.getItem(STORAGE_KEYS.DONATIONS) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.DONATIONS)) : null;
        if (!donations) {
            donations = [
                {
                    id: 'don_1',
                    donorId: 'usr_sarah',
                    donorName: 'Sarah Jenkins',
                    name: 'Organic Strawberries',
                    quantity: 2,
                    unit: 'boxes',
                    category: 'Fresh',
                    location: 'Fridge',
                    expiryDate: addDays(2),
                    claimed: false,
                    claimedBy: null,
                    claimedDate: null
                },
                {
                    id: 'don_2',
                    donorId: 'usr_john',
                    donorName: 'John Doe',
                    name: 'Sweet Corn Cans',
                    quantity: 4,
                    unit: 'cans',
                    category: 'Canned',
                    location: 'Pantry',
                    expiryDate: addDays(90),
                    claimed: false,
                    claimedBy: null,
                    claimedDate: null
                },
                {
                    id: 'don_3',
                    donorId: 'usr_clara',
                    donorName: 'Clara Oswald',
                    name: 'Bagels (Sesame)',
                    quantity: 1,
                    unit: 'pack',
                    category: 'Bakery',
                    location: 'Counter',
                    expiryDate: addDays(1),
                    claimed: false,
                    claimedBy: null,
                    claimedDate: null
                }
            ];
            this.saveDonations(donations);
        }

        // 4. Seed Notifications for Demo User
        let notifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) : null;
        if (!notifications) {
            notifications = [
                {
                    id: 'notif_1',
                    userId: 'usr_demo',
                    title: 'Welcome to SavePlate!',
                    description: 'Explore your food inventory, plan your meals, and help reduce food waste in your community.',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                    read: false,
                    type: 'info'
                },
                {
                    id: 'notif_2',
                    userId: 'usr_demo',
                    title: 'Expiry Warning: Whole Wheat Bread',
                    description: 'Your Whole Wheat Bread has expired! Mark it as used or clean it up.',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                    read: false,
                    type: 'warning'
                },
                {
                    id: 'notif_3',
                    userId: 'usr_demo',
                    title: 'Expiry Warning: Roma Tomatoes',
                    description: 'Roma Tomatoes are expiring today. Use them in a meal or list them for donation!',
                    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
                    read: false,
                    type: 'warning'
                }
            ];
            this.saveNotifications(notifications);
        }

        // 5. Seed Analytics History (for calculations)
        let history = localStorage.getItem(STORAGE_KEYS.ANALYTICS_HISTORY) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_HISTORY)) : null;
        if (!history) {
            // Seed a history of used/saved and expired items to populate stats
            history = [
                { id: 'h_1', userId: 'usr_demo', name: 'Spinach', category: 'Fresh', status: 'saved', date: addDays(-10) },
                { id: 'h_2', userId: 'usr_demo', name: 'Yogurt', category: 'Dairy', status: 'saved', date: addDays(-8) },
                { id: 'h_3', userId: 'usr_demo', name: 'Eggs', category: 'Dairy', status: 'saved', date: addDays(-5) },
                { id: 'h_4', userId: 'usr_demo', name: 'Bananas', category: 'Fresh', status: 'expired', date: addDays(-7) },
                { id: 'h_5', userId: 'usr_demo', name: 'Cheddar Cheese', category: 'Dairy', status: 'donated', date: addDays(-4) },
                { id: 'h_6', userId: 'usr_demo', name: 'Tortillas', category: 'Bakery', status: 'saved', date: addDays(-2) }
            ];
            this.saveAnalyticsHistory(history);
        }
        
        // 6. Seed Meal Plan for Demo User
        let mealPlans = localStorage.getItem(STORAGE_KEYS.MEALPLAN) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.MEALPLAN)) : null;
        if (!mealPlans) {
            const demoMealPlan = {
                Mon: [{ id: 'mp_1', name: 'Tomato Toast (Used Bread & Tomatoes)' }],
                Tue: [{ id: 'mp_2', name: 'Chicken and Rice' }],
                Wed: [],
                Thu: [{ id: 'mp_3', name: 'Avocado Salad' }],
                Fri: [],
                Sat: [],
                Sun: []
            };
            this.saveMealPlans('usr_demo', demoMealPlan);
        }
    }
};

// Initialize DB on script load
db.initialize();
