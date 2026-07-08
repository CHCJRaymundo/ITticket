/* ============================================
   IT Ticketing System — Client-Side JavaScript
   ============================================ */

// --------------------------------------------
// Global State
// --------------------------------------------
const APP = {
    currentPage: null,
    isAdmin: false,
    refreshInterval: null,
    lastDashboardLoad: null
};

// --------------------------------------------
// Toast Notifications
// --------------------------------------------
/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSvg = type === 'success'
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

    toast.innerHTML = `${iconSvg}<span class="toast-message"></span>`;
    toast.querySelector('.toast-message').textContent = message;

    container.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 5000);
}

// --------------------------------------------
// Date / Formatting Utilities
// --------------------------------------------
/**
 * Format an ISO date string to a readable format
 * @param {string} isoString - ISO 8601 datetime string
 * @returns {string} Formatted date string
 */
function formatDate(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return isoString;
    }
}

/**
 * Format bytes to human-readable KB/MB
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Get CSS class for priority badge
 * @param {string} priority - 'High', 'Medium', or 'Low'
 * @returns {string} CSS class name
 */
function getPriorityColor(priority) {
    const map = {
        'High': 'badge-priority-high',
        'Medium': 'badge-priority-medium',
        'Low': 'badge-priority-low'
    };
    return map[priority] || 'badge-priority-low';
}

/**
 * Get CSS class for status badge
 * @param {string} status - 'Pending', 'In Progress', or 'Resolved'
 * @returns {string} CSS class name
 */
function getStatusColor(status) {
    const map = {
        'Pending': 'badge-status-pending',
        'In Progress': 'badge-status-in-progress',
        'Resolved': 'badge-status-resolved'
    };
    return map[status] || 'badge-status-pending';
}

/**
 * Calculate relative time (e.g., "2 hours ago")
 * @param {string} isoString - ISO datetime
 * @returns {string} Relative time string
 */
function timeAgo(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
        const months = Math.floor(days / 30);
        return `${months} month${months !== 1 ? 's' : ''} ago`;
    } catch {
        return isoString;
    }
}

// ============================================
// Index Page Functions
// ============================================

/**
 * Initialize the ticket form submission handler
 */
function initTicketForm() {
    const form = document.getElementById('ticket-form');
    if (!form) return;

    // File upload drag-and-drop
    initFileUpload();

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitBtn = document.getElementById('submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');

        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Submitting...';
        btnSpinner.classList.remove('hidden');

        try {
            const formData = new FormData(form);

            // Validate file count
            const files = document.getElementById('attachments').files;
            if (files.length > 5) {
                showToast('Maximum 5 files allowed. Please remove some files.', 'error');
                return;
            }

            const response = await fetch('/api/tickets', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showToast(`Ticket #${data.ticket_id} submitted successfully!`, 'success');
                form.reset();
                document.getElementById('file-list').innerHTML = '';
                // Reload ticket list if email is in the filter
                const filterEmail = document.getElementById('filter-email');
                if (filterEmail && filterEmail.value) {
                    loadMyTickets();
                }
            } else {
                showToast(data.error || 'Failed to submit ticket.', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
            console.error('Form submission error:', error);
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Ticket';
            btnSpinner.classList.add('hidden');
        }
    });
}

/**
 * Initialize file upload drag-and-drop
 */
function initFileUpload() {
    const zone = document.getElementById('file-upload-zone');
    const input = document.getElementById('attachments');
    const fileList = document.getElementById('file-list');
    if (!zone || !input) return;

    let allFiles = [];

    function renderFileList() {
        fileList.innerHTML = '';
        allFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <span class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="file-item-size">${formatFileSize(file.size)}</span>
                <button type="button" class="file-item-remove" data-index="${index}" title="Remove file">&times;</button>
            `;
            fileList.appendChild(item);
        });

        // Sync back to input using DataTransfer
        const dt = new DataTransfer();
        allFiles.forEach(f => dt.items.add(f));
        input.files = dt.files;
    }

    // Drag and drop events
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const dropped = Array.from(e.dataTransfer.files);
        if (allFiles.length + dropped.length > 5) {
            showToast('Maximum 5 files allowed.', 'error');
            return;
        }
        allFiles = allFiles.concat(dropped);
        renderFileList();
    });

    // File input change
    input.addEventListener('change', () => {
        allFiles = Array.from(input.files);
        if (allFiles.length > 5) {
            showToast('Maximum 5 files allowed. Only the first 5 will be used.', 'error');
            allFiles = allFiles.slice(0, 5);
        }
        renderFileList();
    });

    // Remove file via event delegation
    fileList.addEventListener('click', (e) => {
        if (e.target.classList.contains('file-item-remove')) {
            const index = parseInt(e.target.dataset.index, 10);
            allFiles.splice(index, 1);
            renderFileList();
        }
    });
}

/**
 * Load tickets for the entered email address
 */
async function loadMyTickets() {
    const emailInput = document.getElementById('filter-email');
    const container = document.getElementById('tickets-container');
    if (!emailInput || !container) return;

    const email = emailInput.value.trim();
    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }

    // Save email to localStorage for convenience
    localStorage.setItem('ticket_email', email);

    // Show loading state
    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <p>Loading tickets...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/tickets?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const tickets = await response.json();
        renderTicketList(tickets);
    } catch (error) {
        console.error('Error loading tickets:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p class="empty-title">Error loading tickets</p>
                <p class="empty-hint">Please check your connection and try again.</p>
            </div>
        `;
        showToast('Failed to load tickets.', 'error');
    }
}

/**
 * Render the list of ticket cards
 * @param {Array} tickets - Array of ticket objects
 */
function renderTicketList(tickets) {
    const container = document.getElementById('tickets-container');
    if (!container) return;

    if (!tickets || tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"></path>
                </svg>
                <p class="empty-title">No tickets found</p>
                <p class="empty-hint">You haven't submitted any tickets yet.</p>
            </div>
        `;
        return;
    }

    // Check if we're in admin mode
    const isAdmin = window.APP_DATA && window.APP_DATA.isAdmin;

    container.innerHTML = `<div class="ticket-list">${tickets.map(ticket => buildTicketCard(ticket, isAdmin)).join('')}</div>`;
}

/**
 * Build HTML for a single ticket card
 * @param {Object} ticket - Ticket data
 * @param {boolean} isAdmin - Whether to show admin controls
 * @returns {string} HTML string
 */
function buildTicketCard(ticket, isAdmin = false) {
    const priorityClass = getPriorityColor(ticket.priority);
    const statusClass = getStatusColor(ticket.status);
    const dateStr = formatDate(ticket.created_at);
    const hasAttachments = ticket.attachments && ticket.attachments.length > 0;

    let attachmentsHtml = '';
    if (hasAttachments) {
        attachmentsHtml = `
            <div class="ticket-attachments">
                <div class="ticket-attachments-title">Attachments</div>
                ${ticket.attachments.map(att => `
                    <a href="/api/attachments/${att.id}" class="ticket-attachment-link" download>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        ${escapeHtml(att.filename)}
                    </a>
                `).join('')}
            </div>
        `;
    }

    let adminControls = '';
    if (isAdmin) {
        adminControls = `
            <div class="ticket-admin-controls">
                <div class="form-group">
                    <select class="form-select" onchange="adminUpdateTicket(${ticket.id}, 'status', this.value)">
                        <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </div>
                <div class="form-group">
                    <select class="form-select" onchange="adminUpdateTicket(${ticket.id}, 'assigned_to', this.value)">
                        <option value="">Unassigned</option>
                        <option value="Alex Johnson" ${ticket.assigned_to === 'Alex Johnson' ? 'selected' : ''}>Alex Johnson</option>
                        <option value="Sarah Chen" ${ticket.assigned_to === 'Sarah Chen' ? 'selected' : ''}>Sarah Chen</option>
                        <option value="Mike Williams" ${ticket.assigned_to === 'Mike Williams' ? 'selected' : ''}>Mike Williams</option>
                        <option value="Emily Rodriguez" ${ticket.assigned_to === 'Emily Rodriguez' ? 'selected' : ''}>Emily Rodriguez</option>
                        <option value="David Park" ${ticket.assigned_to === 'David Park' ? 'selected' : ''}>David Park</option>
                        <option value="Lisa Thompson" ${ticket.assigned_to === 'Lisa Thompson' ? 'selected' : ''}>Lisa Thompson</option>
                    </select>
                </div>
            </div>
        `;
    }

    return `
        <div class="ticket-card" id="ticket-${ticket.id}" data-ticket-id="${ticket.id}">
            <div class="ticket-card-header" onclick="toggleTicketCard(${ticket.id})">
                <div class="ticket-card-header-left">
                    <span class="badge badge-id">#${ticket.id}</span>
                    <span class="ticket-card-title">${escapeHtml(ticket.title)}</span>
                </div>
                <div class="ticket-card-meta">
                    <span class="badge badge-category">${escapeHtml(ticket.category)}</span>
                    <span class="badge ${priorityClass}">${escapeHtml(ticket.priority)}</span>
                    <span class="badge ${statusClass}">${escapeHtml(ticket.status)}</span>
                    <span class="ticket-card-date">${dateStr}</span>
                    <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="ticket-card-body" id="ticket-body-${ticket.id}">
                <div class="ticket-description">${escapeHtml(ticket.description)}</div>
                ${attachmentsHtml}
                ${adminControls}
            </div>
        </div>
    `;
}

/**
 * Toggle expand/collapse of a ticket card
 * @param {number} ticketId - The ticket ID
 */
function toggleTicketCard(ticketId) {
    const card = document.getElementById(`ticket-${ticketId}`);
    const body = document.getElementById(`ticket-body-${ticketId}`);
    if (!card || !body) return;

    const isExpanded = body.classList.contains('expanded');

    // Collapse all others (accordion behavior)
    document.querySelectorAll('.ticket-card-body.expanded').forEach(el => {
        el.classList.remove('expanded');
    });
    document.querySelectorAll('.ticket-card.expanded').forEach(el => {
        el.classList.remove('expanded');
    });

    if (!isExpanded) {
        body.classList.add('expanded');
        card.classList.add('expanded');
    }
}

/**
 * Initialize admin panel mode
 */
function initAdminPanel() {
    const isAdmin = window.APP_DATA && window.APP_DATA.isAdmin;
    if (!isAdmin) return;

    APP.isAdmin = true;

    // Load all tickets for admin
    loadAllTickets();
}

/**
 * Load all tickets (admin mode)
 */
async function loadAllTickets() {
    const container = document.getElementById('tickets-container');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <p>Loading all tickets...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/tickets?admin=1');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const tickets = await response.json();
        renderTicketList(tickets);
    } catch (error) {
        console.error('Error loading all tickets:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p class="empty-title">Error loading tickets</p>
                <p class="empty-hint">Failed to load tickets. Please try again.</p>
            </div>
        `;
        showToast('Failed to load tickets.', 'error');
    }
}

/**
 * Quick admin update from the ticket list
 * @param {number} ticketId - Ticket ID
 * @param {string} field - 'status' or 'assigned_to'
 * @param {string} value - New value
 */
async function adminUpdateTicket(ticketId, field, value) {
    try {
        const body = {};
        if (field === 'status') body.status = value;
        if (field === 'assigned_to') body.assigned_to = value || null;

        const response = await fetch(`/api/ticket/${ticketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (data.success) {
            showToast(`Ticket #${ticketId} updated.`, 'success');
            // Refresh the list
            loadAllTickets();
        } else {
            showToast(data.error || 'Update failed.', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Admin update error:', error);
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Dashboard Page Functions
// ============================================

/**
 * Load dashboard data (stats + staff)
 */
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.stats) renderStats(data.stats);
        if (data.staff) renderStaffGrid(data.staff);

        APP.lastDashboardLoad = new Date();
        updateLastUpdated();
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard data.', 'error');
    }
}

/**
 * Render stats cards
 * @param {Object} stats - Stats object from API
 */
function renderStats(stats) {
    const totalEl = document.getElementById('stat-total');
    const openEl = document.getElementById('stat-open');
    const inProgressEl = document.getElementById('stat-in-progress');
    const resolvedEl = document.getElementById('stat-resolved');

    if (totalEl) totalEl.textContent = stats.total_tickets || 0;
    if (openEl) openEl.textContent = stats.open_tickets || 0;
    if (inProgressEl) inProgressEl.textContent = stats.in_progress_tickets || 0;
    if (resolvedEl) resolvedEl.textContent = stats.resolved_tickets || 0;
}

/**
 * Render the staff availability grid
 * @param {Array} staff - Array of staff member objects
 */
function renderStaffGrid(staff) {
    const grid = document.getElementById('staff-grid');
    if (!grid) return;

    if (!staff || staff.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p class="empty-title">No staff data available</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = staff.map(member => buildStaffCard(member)).join('');
}

/**
 * Build HTML for a single staff card
 * @param {Object} member - Staff member data
 * @returns {string} HTML string
 */
function buildStaffCard(member) {
    const initials = getInitials(member.name);
    const isAvailable = member.is_available;
    const cardClass = isAvailable ? '' : 'busy';
    const availabilityClass = isAvailable ? 'badge-available' : 'badge-busy';
    const availabilityText = isAvailable ? 'Available' : 'Busy';

    let ticketsHtml = '';
    if (!isAvailable && member.current_tickets && member.current_tickets.length > 0) {
        ticketsHtml = `
            <div class="staff-tickets">
                <div class="staff-tickets-title">Current Tickets</div>
                ${member.current_tickets.map(ticket => `
                    <div class="staff-ticket-item">
                        <span class="staff-ticket-id">#${ticket.id}</span>
                        <span class="staff-ticket-title" title="${escapeHtml(ticket.title)}">${escapeHtml(ticket.title)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="staff-card ${cardClass}">
            <div class="staff-card-header">
                <div class="staff-avatar" style="background-color: ${member.avatar_color};">
                    ${initials}
                </div>
                <div class="staff-info">
                    <div class="staff-name">${escapeHtml(member.name)}</div>
                    <div class="staff-role">${escapeHtml(member.role)}</div>
                </div>
                <span class="badge ${availabilityClass}">${availabilityText}</span>
            </div>
            ${ticketsHtml}
        </div>
    `;
}

/**
 * Get initials from a full name
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Update the "last updated" text
 */
function updateLastUpdated() {
    const el = document.getElementById('last-updated');
    if (!el || !APP.lastDashboardLoad) return;

    const seconds = Math.floor((new Date() - APP.lastDashboardLoad) / 1000);
    if (seconds < 5) {
        el.textContent = 'Just now';
    } else if (seconds < 60) {
        el.textContent = `${seconds}s ago`;
    } else {
        const minutes = Math.floor(seconds / 60);
        el.textContent = `${minutes}m ${seconds % 60}s ago`;
    }
}

/**
 * Start auto-refresh of dashboard data
 */
function startAutoRefresh() {
    // Load immediately
    loadDashboard();

    // Update "last updated" text every second
    setInterval(updateLastUpdated, 1000);

    // Refresh data every 30 seconds
    APP.refreshInterval = setInterval(loadDashboard, 30000);
}

// ============================================
// Ticket Detail Page Functions
// ============================================

/**
 * Load ticket detail data
 */
async function loadTicketDetail() {
    const ticketId = window.APP_DATA && window.APP_DATA.ticketId;
    if (!ticketId) {
        console.error('No ticket ID found');
        return;
    }

    try {
        const response = await fetch(`/api/ticket/${ticketId}`);
        if (!response.ok) {
            if (response.status === 404) {
                showToast('Ticket not found.', 'error');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        const ticket = await response.json();
        renderTicketDetail(ticket);
    } catch (error) {
        console.error('Error loading ticket:', error);
        showToast('Failed to load ticket details.', 'error');
    }
}

/**
 * Render ticket detail page
 * @param {Object} ticket - Full ticket data with attachments
 */
function renderTicketDetail(ticket) {
    // Update breadcrumb
    const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
    if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = `Ticket #${ticket.id}`;
    }

    // Info card
    const infoCard = document.getElementById('ticket-info-card');
    if (infoCard) {
        const priorityClass = getPriorityColor(ticket.priority);
        const statusClass = getStatusColor(ticket.status);
        infoCard.innerHTML = `
            <div class="ticket-detail-header">
                <h1 class="page-title">#${ticket.id} &mdash; ${escapeHtml(ticket.title)}</h1>
                <div class="ticket-detail-meta">
                    <span class="badge badge-category">${escapeHtml(ticket.category)}</span>
                    <span class="badge ${priorityClass}">${escapeHtml(ticket.priority)}</span>
                    <span class="badge ${statusClass}">${escapeHtml(ticket.status)}</span>
                    <span class="ticket-meta-separator">|</span>
                    <span class="ticket-meta-text">By ${escapeHtml(ticket.requester_name)}</span>
                    <span class="ticket-meta-text">${formatDate(ticket.created_at)}</span>
                </div>
            </div>
        `;
    }

    // Description card
    const descCard = document.getElementById('ticket-description-card');
    if (descCard) {
        descCard.innerHTML = `
            <h3 class="card-subtitle">Description</h3>
            <div class="ticket-description">${escapeHtml(ticket.description)}</div>
        `;
    }

    // Attachments card
    const attachmentsCard = document.getElementById('ticket-attachments-card');
    const attachmentList = document.getElementById('attachment-list');
    if (attachmentsCard && attachmentList) {
        if (ticket.attachments && ticket.attachments.length > 0) {
            attachmentsCard.classList.remove('hidden');
            attachmentList.innerHTML = ticket.attachments.map(att => `
                <li class="attachment-item">
                    <div class="attachment-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                    </div>
                    <div class="attachment-info">
                        <div class="attachment-name">${escapeHtml(att.filename)}</div>
                        <div class="attachment-size">${formatFileSize(att.file_size)}</div>
                    </div>
                    <a href="/api/attachments/${att.id}" class="btn btn-primary attachment-download" download>
                        Download
                    </a>
                </li>
            `).join('');
        } else {
            attachmentsCard.classList.add('hidden');
        }
    }

    // Info panel
    const infoCreated = document.getElementById('info-created');
    const infoUpdated = document.getElementById('info-updated');
    const infoAge = document.getElementById('info-age');
    if (infoCreated) infoCreated.textContent = formatDate(ticket.created_at);
    if (infoUpdated) infoUpdated.textContent = formatDate(ticket.updated_at);
    if (infoAge) infoAge.textContent = timeAgo(ticket.created_at);

    // Status selector
    const statusSelect = document.getElementById('status-select');
    if (statusSelect) {
        statusSelect.value = ticket.status || 'Pending';
    }

    // Assign selector
    const assignSelect = document.getElementById('assign-select');
    if (assignSelect) {
        // Preserve the unassigned option, update the rest
        const currentVal = ticket.assigned_to || '';
        assignSelect.value = currentVal;
    }
}

/**
 * Update ticket status and/or assignment
 */
async function updateTicket() {
    const ticketId = window.APP_DATA && window.APP_DATA.ticketId;
    if (!ticketId) return;

    const statusSelect = document.getElementById('status-select');
    const assignSelect = document.getElementById('assign-select');
    const updateBtn = document.getElementById('update-ticket-btn');
    const btnText = updateBtn.querySelector('.btn-text');
    const btnSpinner = updateBtn.querySelector('.btn-spinner');

    const body = {};
    if (statusSelect) body.status = statusSelect.value;
    if (assignSelect) body.assigned_to = assignSelect.value || null;

    // Show loading state
    updateBtn.disabled = true;
    btnText.textContent = 'Updating...';
    btnSpinner.classList.remove('hidden');

    try {
        const response = await fetch(`/api/ticket/${ticketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (data.success) {
            showToast('Ticket updated successfully!', 'success');
            // Reload ticket data
            loadTicketDetail();
        } else {
            showToast(data.error || 'Update failed.', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Update error:', error);
    } finally {
        updateBtn.disabled = false;
        btnText.textContent = 'Update Ticket';
        btnSpinner.classList.add('hidden');
    }
}

// ============================================
// Page Router & Initialization
// =============================================

/**
 * Set active nav link based on current page
 */
function setActiveNavLink() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path) {
            link.classList.add('active');
        }
    });

    // Handle /admin as index page with admin mode
    if (path === '/admin') {
        const indexLink = document.querySelector('.nav-link[data-page="index"]');
        if (indexLink) indexLink.classList.add('active');
    }
}

/**
 * Detect current page and initialize appropriate functions
 */
function initPage() {
    const path = window.location.pathname;
    APP.currentPage = path;

    setActiveNavLink();

    if (path === '/' || path === '/admin') {
        // Index page (ticket submission + my tickets)
        initTicketForm();

        if (path === '/admin') {
            initAdminPanel();
        } else {
            // Regular user mode - restore email from localStorage
            const savedEmail = localStorage.getItem('ticket_email');
            if (savedEmail) {
                const emailInput = document.getElementById('filter-email');
                if (emailInput) {
                    emailInput.value = savedEmail;
                    // Auto-load tickets
                    loadMyTickets();
                }
            }
        }
    } else if (path === '/dashboard') {
        // Dashboard page
        startAutoRefresh();
    } else if (path.startsWith('/ticket/')) {
        // Ticket detail page
        loadTicketDetail();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initPage);
