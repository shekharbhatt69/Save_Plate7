/**
 * SavePlate Community Board Module (browse.js)
 * 
 * Owning Role: Community Engagement Lead
 * 
 * User Story:
 * As a SavePlate user, I want to browse items donated by others, search and filter them,
 * and claim available donations so that I can reduce food waste and share surplus food with neighbors.
 * 
 * Acceptance Criteria:
 * - Render community items as cards.
 * - Display item name, quantity, category, location, donor name, and days until expiry.
 * - Search by item name and filter by category.
 * - Claim button: requests verification, marks claimed, removes item from available listings,
 *   and logs a notification for the claimer. Prevents claiming your own donations.
 */

// --- Realtime Filter Bindings ---

document.getElementById('browse-search').addEventListener('input', () => loadBrowse());
document.getElementById('browse-filter-category').addEventListener('change', () => loadBrowse());

/**
 * Loads and renders items available for donation in the community grid.
 */
function loadBrowse() {
    const user = db.getCurrentUser();
    if (!user) return;

    let donations = db.getDonations();

    // Filter out claimed items (only show active available items)
    donations = donations.filter(d => !d.claimed);

    // Apply Filter Criteria
    const searchQuery = document.getElementById('browse-search').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('browse-filter-category').value;

    if (searchQuery) {
        donations = donations.filter(d => d.name.toLowerCase().includes(searchQuery));
    }
    if (categoryFilter) {
        donations = donations.filter(d => d.category === categoryFilter);
    }

    // Sort by Expiry Date (soonest first)
    donations.sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));

    // Update Totals Label
    const totalsLabel = document.getElementById('browse-totals-label');
    totalsLabel.textContent = `Showing ${donations.length} community donation${donations.length === 1 ? '' : 's'} available`;

    const grid = document.getElementById('browse-grid');
    grid.innerHTML = '';

    if (donations.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p>No community food donations are currently listed.</p>
                <p style="font-size: 13px; margin-top: 4px;">Items donated from your inventory will appear here.</p>
            </div>
        `;
        return;
    }

    donations.forEach(item => {
        const days = daysUntil(item.expiryDate);
        let expiryText = '';
        let expiryColorClass = '';

        if (days < 0) {
            expiryText = 'Expired';
            expiryColorClass = 'color: var(--accent-red); font-weight: 600;';
        } else if (days === 0) {
            expiryText = 'Expires today!';
            expiryColorClass = 'color: var(--accent-amber); font-weight: 600;';
        } else if (days === 1) {
            expiryText = 'Expires tomorrow!';
            expiryColorClass = 'color: var(--accent-amber); font-weight: 600;';
        } else {
            expiryText = `${days} days left`;
            expiryColorClass = 'color: var(--accent-green);';
        }

        // Determine donor display name
        const isOwnDonation = item.donorId === user.id;
        const donorDisplay = isOwnDonation ? 'You (My Donation)' : item.donorName;

        const card = document.createElement('div');
        card.className = 'card donation-card';
        card.innerHTML = `
            <div class="donation-tag">${escapeHTML(item.category)}</div>
            <h3 class="card-title">${escapeHTML(item.name)}</h3>
            
            <div class="donation-details">
                <span><strong>Quantity:</strong> ${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</span>
                <span><strong>Storage:</strong> ${escapeHTML(item.location)}</span>
                <span><strong>Expires:</strong> <span style="${expiryColorClass}">${expiryText}</span></span>
            </div>

            <div class="donation-meta">
                <span><strong>Shared by:</strong> ${escapeHTML(donorDisplay)}</span>
            </div>
            
            <div style="margin-top: 16px;">
                ${isOwnDonation ? 
                    `<button class="btn btn-secondary btn-block" disabled style="cursor: not-allowed; opacity: 0.6;">Your Item</button>` :
                    `<button class="btn btn-primary btn-block" onclick="claimDonatedItem('${item.id}')">Claim Item</button>`
                }
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * Handles claiming a community donation.
 */
function claimDonatedItem(donationId) {
    const user = db.getCurrentUser();
    if (!user) return;

    const donations = db.getDonations();
    const itemIndex = donations.findIndex(d => d.id === donationId);

    if (itemIndex === -1) return;

    const item = donations[itemIndex];

    if (item.donorId === user.id) {
        toast('You cannot claim your own donation!', 'error');
        return;
    }

    if (item.claimed) {
        toast('This item has already been claimed by another user.', 'error');
        return;
    }

    confirmModal('Claim Donation', `Are you sure you want to claim "${item.name}" donated by ${item.donorName}?`, () => {
        // Update donation status
        donations[itemIndex].claimed = true;
        donations[itemIndex].claimedBy = user.id;
        donations[itemIndex].claimedDate = fmtDate(new Date());
        
        db.saveDonations(donations);

        // Create Claim Notification for the user claiming it
        const notifications = db.getNotifications();
        notifications.push({
            id: uid(),
            userId: user.id,
            title: `Donation Claimed: ${item.name}`,
            description: `You claimed ${item.donorName}'s ${item.name}. Please coordinate pickup details with them.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'info'
        });
        db.saveNotifications(notifications);

        toast(`Success! You have claimed "${item.name}".`);
        closeModal();
        loadBrowse();
        
        // Refresh routing sidebar badges
        updateSidebarMeta();
    });
}
