/**
 * SavePlate Weekly Meal Planner Module (mealplan.js)
 * 
 * Owning Role: Meal Planner Architect
 * 
 * User Story:
 * As a SavePlate user, I want to plan my weekly household meals (Monday to Sunday) using my current
 * food inventory, especially items expiring soon, so that I can cook efficiently and prevent waste.
 * 
 * Acceptance Criteria:
 * - Render a 7-column planner grid representing Mon-Sun.
 * - Display a warning recommendation banner showing food inventory items expiring in <= 3 days.
 * - Adding meal prompts a modal allowing text input OR picking from current user inventory.
 * - Delete meals by clicking on them.
 * - Persist weekly plans per user.
 */

// Binds delegated click handlers on planner grid container
document.getElementById('planner-days-grid').addEventListener('click', function(e) {
    const target = e.target;
    
    // Add Meal button trigger
    if (target.classList.contains('btn-add-meal')) {
        const day = target.getAttribute('data-day');
        openAddMealModal(day);
        return;
    }

    // Delete Meal Card trigger
    const card = target.closest('.planner-meal-card');
    if (card) {
        const day = card.parentElement.id.replace('meal-list-', '');
        const mealId = card.getAttribute('data-id');
        deleteMealItem(day, mealId);
    }
});

/**
 * Loads the user's weekly meal planner, suggestion banner, and renders meals for each day.
 */
function loadMealPlan() {
    const user = db.getCurrentUser();
    if (!user) return;

    const userPlan = db.getMealPlans(user.id);
    const inventory = db.getInventory(user.id);

    // --- 1. Populate Expiring Soon Suggestion Banner (<= 3 days) ---
    const expiringSoonItems = inventory.filter(item => {
        const days = daysUntil(item.expiryDate);
        return days >= 0 && days <= 3;
    });

    const bannerEl = document.getElementById('planner-suggestion-banner');
    const textEl = document.getElementById('planner-suggestion-text');

    if (expiringSoonItems.length > 0) {
        bannerEl.style.backgroundColor = 'var(--accent-amber-bg)';
        bannerEl.style.borderColor = 'rgba(196, 125, 26, 0.2)';
        
        const itemNames = expiringSoonItems.map(i => i.name);
        // Clean list text
        const itemsText = itemNames.length > 2 
            ? `${itemNames.slice(0, 2).join(', ')}, and ${itemNames.length - 2} other item(s)`
            : itemNames.join(' and ');

        textEl.innerHTML = `You have <strong>${escapeHTML(itemsText)}</strong> expiring in the next 3 days. Consider adding them to your schedule!`;
    } else {
        // Safe green banner if no items are expiring
        bannerEl.style.backgroundColor = 'var(--accent-green-bg)';
        bannerEl.style.borderColor = 'rgba(46, 125, 50, 0.2)';
        textEl.innerHTML = `<strong>Great job!</strong> None of your food inventory items are expiring in the next 3 days.`;
    }

    // --- 2. Render Scheduled Meals for Each Column ---
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    days.forEach(day => {
        const listContainer = document.getElementById(`meal-list-${day}`);
        listContainer.innerHTML = '';

        const dayMeals = userPlan[day] || [];

        if (dayMeals.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 10px; border: 1.5px dashed var(--border-color); border-radius: var(--radius-sm);">No meals planned</div>`;
            return;
        }

        dayMeals.forEach(meal => {
            const mealCard = document.createElement('div');
            mealCard.className = 'planner-meal-card';
            mealCard.setAttribute('data-id', meal.id);
            mealCard.textContent = meal.name;
            mealCard.title = 'Click to remove meal';
            listContainer.appendChild(mealCard);
        });
    });
}

// --- Add & Remove Meal Forms and Handlers ---

/**
 * Renders meal planner modal options with input field or selection dropdown of current food items.
 * @param {string} day The target day code (Mon-Sun).
 */
function openAddMealModal(day) {
    const user = db.getCurrentUser();
    if (!user) return;

    const inventory = db.getInventory(user.id);
    // Sort inventory so that expiring soonest items show first in the select dropdown list
    inventory.sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));

    // Construct inventory options
    let inventoryOptions = '<option value="">-- Select from your Inventory --</option>';
    inventory.forEach(item => {
        const days = daysUntil(item.expiryDate);
        let tag = '';
        if (days < 0) tag = ' (Expired)';
        else if (days <= 2) tag = ` (Expires in ${days}d)`;
        
        inventoryOptions += `<option value="${escapeHTML(item.name)}">${escapeHTML(item.name)} - ${item.quantity} ${escapeHTML(item.unit)}${tag}</option>`;
    });

    const addMealTemplate = `
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-family: var(--font-heading); font-size: 14px; margin-bottom: 6px; font-weight: 500;">Method 1: Select Ingredient from Inventory</label>
            <select id="meal-inventory-select" class="form-control">
                ${inventoryOptions}
            </select>
        </div>
        <div style="text-align: center; margin: 12px 0; color: var(--text-muted); font-weight: 600; font-size: 12px;">— OR —</div>
        <div class="form-group" id="meal-custom-group">
            <label for="meal-custom-name">Method 2: Type Custom Meal Title</label>
            <input type="text" id="meal-custom-name" class="form-control" placeholder="e.g. Pasta Bolognese">
            <div class="error-message">Please enter a meal name or select an inventory item.</div>
        </div>
        <input type="hidden" id="meal-target-day" value="${day}">
    `;

    const fullDayName = {
        Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday'
    }[day];

    openModal(`Add Meal for ${fullDayName}`, addMealTemplate, saveMealFromForm, true);
}

/**
 * Validates selection/input and saves meal to day's scheduler list.
 */
function saveMealFromForm() {
    const user = db.getCurrentUser();
    if (!user) return;

    const day = document.getElementById('meal-target-day').value;
    const inventorySelect = document.getElementById('meal-inventory-select').value;
    const customNameEl = document.getElementById('meal-custom-name');
    const customName = customNameEl.value.trim();

    let mealName = '';

    // Reset validations
    customNameEl.parentElement.classList.remove('invalid');

    if (inventorySelect) {
        mealName = inventorySelect;
    } else if (customName) {
        mealName = customName;
    } else {
        customNameEl.parentElement.classList.add('invalid');
        return;
    }

    // Add to user meal plan array
    const userPlan = db.getMealPlans(user.id);
    if (!userPlan[day]) {
        userPlan[day] = [];
    }

    userPlan[day].push({
        id: uid(),
        name: mealName
    });

    db.saveMealPlans(user.id, userPlan);
    toast(`Scheduled meal for ${day}!`);
    closeModal();
    loadMealPlan();
}

/**
 * Deletes a scheduled meal item.
 */
function deleteMealItem(day, mealId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const userPlan = db.getMealPlans(user.id);
    const dayMeals = userPlan[day] || [];
    
    // Find index of meal
    const index = dayMeals.findIndex(m => m.id === mealId);

    if (index !== -1) {
        const mealName = dayMeals[index].name;
        
        confirmModal('Remove Planned Meal', `Would you like to remove "${mealName}" from your ${day} schedule?`, () => {
            dayMeals.splice(index, 1);
            userPlan[day] = dayMeals;
            db.saveMealPlans(user.id, userPlan);

            toast(`Removed meal from ${day}.`, 'warning');
            closeModal();
            loadMealPlan();
        });
    }
}
