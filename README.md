# SavePlate - Household Food Waste Reduction App

SavePlate is a fully functional, pure front-end web application designed to help households track food inventory, plan weekly meals, receive expiry alerts, analyze food waste statistics, and donate excess food to a local community board.

This application is built for the **BIT216** Software Engineering course to demonstrate a clean, modular structure, solid UI design, and responsive interactive web practices using vanilla web technologies.

## Tech Stack
- **HTML5**: Standard markup and semantic structure.
- **CSS3 (Vanilla)**: Layout, responsiveness, styling, micro-animations, custom chart layouts.
- **Vanilla JavaScript**: Router, local state, business logic, form validation, alerts, and views.
- **localStorage**: Client-side persistence (no server required).

## Features & Use Cases
1. **UC1: Register & Privacy (auth.js)**: Account creation with inline validation, simulated 2FA (verification code step), login screen, and profile settings.
2. **UC2: Manage Food Inventory (inventory.js)**: Full CRUD operations for food items with category, location, and expiry-date sorting. Status pills show Fresh, Expiring soon (amber), and Expired (red).
3. **UC3: Browse & Donate (browse.js)**: Shared community food board. View, search, filter, and claim items listed by others.
4. **UC4: Food Analytics (analytics.js)**: Key performance metrics, waste-reduction percentage calculations, and a horizontal bar chart displaying category metrics.
5. **UC5: Notifications (notifications.js)**: Scanner that generates alerts for expiring/expired items, unread counter badges, and mark read toggles.
6. **UC6: Weekly Meal Planner (mealplan.js)**: 7-day grid, meal scheduler (custom text or pick from inventory), and an expiring item recommendation banner.

## Directory Structure
```
saveplate/
├── index.html              (app shell & routing nodes)
├── README.md               (this file)
├── css/
│   └── style.css           (styling variables & layouts)
└── js/
    ├── storage.js          (localStorage manager & seed generator)
    ├── auth.js             (auth and simulated 2FA)
    ├── inventory.js        (inventory CRUD & list view)
    ├── browse.js           (community board and claims)
    ├── analytics.js        (analytics dashboard charts)
    ├── notifications.js    (expiry triggers and notifications panel)
    ├── mealplan.js         (7-day scheduling and recommendations)
    └── main.js             (router, modals, and shared toasts)
```

## How to Run
1. Extract or place the files in a directory.
2. Double-click the `index.html` file or open it directly in Google Chrome (or any modern web browser).
3. Alternatively, host the directory via a simple server:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve`

## Demo Credentials
To explore the application with preloaded data:
- **Email**: `demo@saveplate.com`
- **Password**: `demo123`
