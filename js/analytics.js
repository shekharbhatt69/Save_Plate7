/**
 * SavePlate Food Analytics Module (analytics.js)
 * 
 * Owning Role: Data Analyst / Analytics Engineer
 * 
 * User Story:
 * As a SavePlate user, I want to see visual statistics of my food consumption and waste patterns
 * so that I can understand my saving performance and adjust my shopping and eating habits.
 * 
 * Acceptance Criteria:
 * - Stats: Items saved/used in time, items donated, items expired, and total tracked.
 * - Calculate waste reduction rate: (Saved + Donated) / Total Tracked.
 * - Time filters: "All time" vs "This month" to recalculate figures.
 * - Renders a horizontal bar chart of categories in current active inventory using pure HTML/CSS.
 */

// Bind analytics period change listener
document.getElementById('analytics-period').addEventListener('change', () => loadAnalytics());

/**
 * Calculates statistics and draws the custom category horizontal bar chart.
 */
function loadAnalytics() {
    const user = db.getCurrentUser();
    if (!user) return;

    const period = document.getElementById('analytics-period').value; // 'all' or 'month'

    // Fetch active inventory and historical events
    const activeInventory = db.getInventory(user.id);
    const history = db.getAnalyticsHistory(user.id);

    // Helpers to determine date ranges
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    function isThisMonth(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }

    // Filter active items and history according to period selection
    let filteredActive = activeInventory;
    let filteredHistory = history;

    if (period === 'month') {
        filteredActive = activeInventory.filter(item => isThisMonth(item.addedDate || item.expiryDate));
        filteredHistory = history.filter(item => isThisMonth(item.date));
    }

    // Calculate Metric Counters
    
    // 1. Saved/Used count (historical logs of 'saved' status)
    const savedCount = filteredHistory.filter(h => h.status === 'saved').length;

    // 2. Donated count (historical logs of 'donated' status)
    const donatedCount = filteredHistory.filter(h => h.status === 'donated').length;

    // 3. Expired count (historical logs of 'expired' status + active expired items)
    const historicalExpiredCount = filteredHistory.filter(h => h.status === 'expired').length;
    const activeExpiredCount = filteredActive.filter(item => daysUntil(item.expiryDate) < 0).length;
    const totalExpired = historicalExpiredCount + activeExpiredCount;

    // 4. Total Tracked
    // Total Tracked is the sum of items that reached a final status (saved, donated, expired) 
    // plus items currently active in inventory
    const activeFreshOrSoonCount = filteredActive.filter(item => daysUntil(item.expiryDate) >= 0).length;
    const totalTracked = savedCount + donatedCount + totalExpired + activeFreshOrSoonCount;

    // 5. Waste Reduction Rate
    // Rate = (Saved + Donated) / Total Tracked (representing successfully salvaged items)
    let reductionRate = 0;
    if (totalTracked > 0) {
        reductionRate = Math.round(((savedCount + donatedCount) / totalTracked) * 100);
    }

    // Render Stats
    document.getElementById('analytics-reduction-rate').textContent = `${reductionRate}%`;
    document.getElementById('analytics-stat-saved').textContent = savedCount;
    document.getElementById('analytics-stat-donated').textContent = donatedCount;
    document.getElementById('analytics-stat-expired').textContent = totalExpired;
    document.getElementById('analytics-stat-total').textContent = totalTracked;

    // --- Build Custom Horizontal Bar Chart ---
    // Displays current ACTIVE inventory category breakdown
    const chartContainer = document.getElementById('analytics-chart-bars');
    chartContainer.innerHTML = '';

    if (filteredActive.length === 0) {
        chartContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No active inventory items to display chart analysis.</p>`;
        return;
    }

    // Count categories in active list
    const categoryCounts = {};
    filteredActive.forEach(item => {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });

    // Renders rows sorted by count descending
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);

    sortedCategories.forEach(cat => {
        const count = categoryCounts[cat];
        const percentage = Math.round((count / filteredActive.length) * 100);

        const barRow = document.createElement('div');
        barRow.className = 'chart-bar-row';
        barRow.innerHTML = `
            <div class="chart-bar-info">
                <span>${escapeHTML(cat)}</span>
                <span style="color: var(--text-muted);">${count} item${count === 1 ? '' : 's'} (${percentage}%)</span>
            </div>
            <div class="chart-bar-outer">
                <div class="chart-bar-inner" style="width: 0%;"></div>
            </div>
        `;
        chartContainer.appendChild(barRow);

        // Force browser to animate width change
        setTimeout(() => {
            const innerBar = barRow.querySelector('.chart-bar-inner');
            if (innerBar) innerBar.style.width = `${percentage}%`;
        }, 50);
    });
}
