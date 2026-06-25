/**
 * SavePlate Food Inventory Module (inventory.js)
 * 
 * Owning Role: Inventory Systems Specialist
 * 
 * User Story:
 * As a SavePlate user, I want to add, view, edit, delete, mark used, or donate my food items
 * so that I can keep an accurate record of my household food supply and avoid food spoilage.
 * 
 * Acceptance Criteria:
 * - Add/Edit items: name, quantity, unit, category, storage location, expiry date.
 * - Validation: reject empty name, zero or negative quantities, and blank expiry dates.
 * - Displays inventory sorted by soonest expiry date.
 * - Status pills: "Expired" (red), "Use in Xd" (amber, <=2 days), and "Fresh" (green).
 * - Mark Used: transfers item to analytics history as "saved" and removes from active list.
 * - Donate: adds item to the community donations board (UC3) and marks it as "donated" in analytics.
 * - Delete: prompts for verification before removal.
 */

// --- Real-time Filter Handlers ---

document.getElementById('inventory-search').addEventListener('input', () => loadInventory());
document.getElementById('inventory-filter-category').addEventListener('change', () => loadInventory());
document.getElementById('inventory-filter-location').addEventListener('change', () => loadInventory());

document.getElementById('btn-add-food-modal').addEventListener('click', () => {
    openAddFoodModal();
});

/**
 * Loads the active user's inventory, filters items, sorts by expiry, and renders the rows.
 */
function loadInventory() {
    const user = db.getCurrentUser();
    if (!user) return;

    let items = db.getInventory(user.id);

    // Apply Filters
    const searchQuery = document.getElementById('inventory-search').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('inventory-filter-category').value;
    const locationFilter = document.getElementById('inventory-filter-location').value;

    if (searchQuery) {
        items = items.filter(item => item.name.toLowerCase().includes(searchQuery));
    }
    if (categoryFilter) {
        items = items.filter(item => item.category === categoryFilter);
    }
    if (locationFilter) {
        items = items.filter(item => item.location === locationFilter);
    }

    // Sort by Expiry (soonest first)
    items.sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));

    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No inventory items matched your search criteria.</td></tr>`;
        return;
    }

    items.forEach(item => {
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
            <td style="font-weight: 600;">${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</td>
            <td><span class="donation-tag" style="margin-bottom:0;">${escapeHTML(item.category)}</span></td>
            <td>${escapeHTML(item.location)}</td>
            <td>${fmtDate(item.expiryDate)}</td>
            <td>${statusHtml}</td>
            <td class="action-btns" style="justify-content: center;">
                <button class="btn-icon" onclick="markFoodUsed('${item.id}')" title="Mark Used / Eaten" style="color: var(--primary); border-color: var(--primary);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button class="btn-icon" onclick="donateFoodItem('${item.id}')" title="Donate to Community Board" style="color: #009688; border-color: #009688;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </button>
                <button class="btn-icon" onclick="openEditFoodModal('${item.id}')" title="Edit Item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
                <button class="btn-icon delete" onclick="deleteFoodItem('${item.id}')" title="Delete Item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- CRUD Forms & Actions ---

const FOOD_FORM_TEMPLATE = `
    <form id="food-form" novalidate>
        <input type="hidden" id="form-item-id">
        <div class="form-group" id="form-name-group">
            <label for="form-item-name">Food Name</label>
            <input type="text" id="form-item-name" class="form-control" placeholder="e.g. Fuji Apples">
            <div class="error-message">Food name is required.</div>
        </div>
        <div class="form-row">
            <div class="form-group" id="form-qty-group">
                <label for="form-item-qty">Quantity</label>
                <input type="number" id="form-item-qty" class="form-control" step="any" min="0.01" placeholder="e.g. 5">
                <div class="error-message">Quantity must be greater than zero.</div>
            </div>
            <div class="form-group" id="form-unit-group">
                <label for="form-item-unit">Unit</label>
                <input type="text" id="form-item-unit" class="form-control" placeholder="e.g. pcs, bags, kg">
                <div class="error-message">Unit cannot be empty.</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="form-item-category">Category</label>
                <select id="form-item-category" class="form-control">
                    <option value="Fresh">Fresh</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Grains">Grains</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Frozen">Frozen</option>
                    <option value="Canned">Canned</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label for="form-item-location">Storage Location</label>
                <select id="form-item-location" class="form-control">
                    <option value="Fridge">Fridge</option>
                    <option value="Freezer">Freezer</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Counter">Counter</option>
                    <option value="Other">Other</option>
                </select>
            </div>
        </div>
        <div class="form-group" id="form-expiry-group">
            <label for="form-item-expiry">Expiry Date</label>
            <input type="date" id="form-item-expiry" class="form-control">
            <div class="error-message">Please select a valid expiry date.</div>
        </div>
    </form>
`;

function openAddFoodModal() {
    openModal('Add Food Item', FOOD_FORM_TEMPLATE, saveFoodItemFromForm, true);
    
    // Set default date to 3 days from now
    document.getElementById('form-item-expiry').value = addDays(3);
}

function openEditFoodModal(itemId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const items = db.getInventory(user.id);
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    openModal('Edit Food Item', FOOD_FORM_TEMPLATE, saveFoodItemFromForm, true);

    // Prefill form
    document.getElementById('form-item-id').value = item.id;
    document.getElementById('form-item-name').value = item.name;
    document.getElementById('form-item-qty').value = item.quantity;
    document.getElementById('form-item-unit').value = item.unit;
    document.getElementById('form-item-category').value = item.category;
    document.getElementById('form-item-location').value = item.location;
    document.getElementById('form-item-expiry').value = item.expiryDate;
}

/**
 * Validates the inputs and saves/creates the inventory item.
 */
function saveFoodItemFromForm() {
    const user = db.getCurrentUser();
    if (!user) return;

    const idEl = document.getElementById('form-item-id');
    const nameEl = document.getElementById('form-item-name');
    const qtyEl = document.getElementById('form-item-qty');
    const unitEl = document.getElementById('form-item-unit');
    const categoryEl = document.getElementById('form-item-category');
    const locationEl = document.getElementById('form-item-location');
    const expiryEl = document.getElementById('form-item-expiry');

    let isValid = true;

    // Reset validations
    [nameEl, qtyEl, unitEl, expiryEl].forEach(el => el.parentElement.classList.remove('invalid'));

    if (!nameEl.value.trim()) {
        nameEl.parentElement.classList.add('invalid');
        isValid = false;
    }
    const qty = parseFloat(qtyEl.value);
    if (isNaN(qty) || qty <= 0) {
        qtyEl.parentElement.classList.add('invalid');
        isValid = false;
    }
    if (!unitEl.value.trim()) {
        unitEl.parentElement.classList.add('invalid');
        isValid = false;
    }
    if (!expiryEl.value) {
        expiryEl.parentElement.classList.add('invalid');
        isValid = false;
    }

    if (!isValid) return;

    const allInventory = db.getInventory();
    const itemId = idEl.value;

    if (itemId) {
        // Edit Mode
        const index = allInventory.findIndex(i => i.id === itemId && i.userId === user.id);
        if (index !== -1) {
            allInventory[index].name = nameEl.value.trim();
            allInventory[index].quantity = qty;
            allInventory[index].unit = unitEl.value.trim();
            allInventory[index].category = categoryEl.value;
            allInventory[index].location = locationEl.value;
            allInventory[index].expiryDate = expiryEl.value;

            db.saveInventory(allInventory);
            toast('Food item updated successfully!');
        }
    } else {
        // Add Mode
        const newItem = {
            id: uid(),
            userId: user.id,
            name: nameEl.value.trim(),
            quantity: qty,
            unit: unitEl.value.trim(),
            category: categoryEl.value,
            location: locationEl.value,
            expiryDate: expiryEl.value,
            addedDate: fmtDate(new Date())
        };
        allInventory.push(newItem);
        db.saveInventory(allInventory);
        
        toast('Food item added successfully!');
    }

    closeModal();
    loadInventory();
    
    // Automatically recheck notifications
    if (window.scanForExpiryNotifications) {
        window.scanForExpiryNotifications(user.id);
    }
}

/**
 * Handles deleting a food item.
 */
function deleteFoodItem(itemId) {
    confirmModal('Delete Food Item', 'Are you sure you want to delete this item? This action cannot be undone.', () => {
        const user = db.getCurrentUser();
        if (!user) return;

        const allInventory = db.getInventory();
        const filtered = allInventory.filter(item => !(item.id === itemId && item.userId === user.id));
        
        db.saveInventory(filtered);
        toast('Food item deleted successfully.', 'warning');
        closeModal();
        loadInventory();
    });
}

/**
 * Marks item as used/saved. Removes from active inventory and logs to history.
 */
function markFoodUsed(itemId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const allInventory = db.getInventory();
    const itemIndex = allInventory.findIndex(i => i.id === itemId && i.userId === user.id);

    if (itemIndex !== -1) {
        const item = allInventory[itemIndex];
        
        // Log to analytics history
        const history = db.getAnalyticsHistory();
        history.push({
            id: uid(),
            userId: user.id,
            name: item.name,
            category: item.category,
            status: 'saved',
            date: fmtDate(new Date())
        });
        db.saveAnalyticsHistory(history);

        // Remove from active inventory
        allInventory.splice(itemIndex, 1);
        db.saveInventory(allInventory);

        toast(`Great job saving food! Marked "${item.name}" as used.`);
        loadInventory();
        
        // Automatically check notifications
        if (window.scanForExpiryNotifications) {
            window.scanForExpiryNotifications(user.id);
        }
    }
}

/**
 * Lists the item on the community donations board and removes it from active inventory.
 */
function donateFoodItem(itemId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const allInventory = db.getInventory();
    const itemIndex = allInventory.findIndex(i => i.id === itemId && i.userId === user.id);

    if (itemIndex !== -1) {
        const item = allInventory[itemIndex];

        confirmModal('Donate to Community', `Would you like to list your "${item.name}" on the community donations board? It will be removed from your personal inventory.`, () => {
            // Add to shared donations
            const donations = db.getDonations();
            donations.push({
                id: uid(),
                donorId: user.id,
                donorName: user.name,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                location: item.location,
                expiryDate: item.expiryDate,
                claimed: false,
                claimedBy: null,
                claimedDate: null
            });
            db.saveDonations(donations);

            // Log to analytics history as donated
            const history = db.getAnalyticsHistory();
            history.push({
                id: uid(),
                userId: user.id,
                name: item.name,
                category: item.category,
                status: 'donated',
                date: fmtDate(new Date())
            });
            db.saveAnalyticsHistory(history);

            // Remove from active inventory
            allInventory.splice(itemIndex, 1);
            db.saveInventory(allInventory);

            toast(`Listed "${item.name}" on the community board. Thank you for donating!`);
            closeModal();
            loadInventory();

            if (window.scanForExpiryNotifications) {
                window.scanForExpiryNotifications(user.id);
            }
        });
    }
}
