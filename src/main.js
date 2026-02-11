// ═══════════════════════════════════════════════════════════════
// Markup Comments — Main Application
// ═══════════════════════════════════════════════════════════════

import { store } from './store/AppStore.js';
import { ProxyService } from './services/ProxyService.js';
import { WebhookService } from './services/WebhookService.js';

// ─── DOM References ─────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const urlInput = $('#url-input');
const loadUrlBtn = $('#load-url-btn');
const modeToggle = $('#mode-toggle');
const teamBtn = $('#team-btn');
const sidebar = $('#sidebar');
const commentsPanel = $('#comments-panel');
const tasksPanel = $('#tasks-panel');
const commentsList = $('#comments-list');
const tasksList = $('#tasks-list');
const commentsEmpty = $('#comments-empty');
const tasksEmpty = $('#tasks-empty');
const commentCount = $('#comment-count');
const taskCount = $('#task-count');
const viewportEmpty = $('#viewport-empty');
const frameWrapper = $('#frame-wrapper');
const pageFrame = $('#page-frame');
const commentOverlay = $('#comment-overlay');
const pinsContainer = $('#pins-container');
const commentDialog = $('#comment-dialog');
const dialogPinNumber = $('#dialog-pin-number');
const commentText = $('#comment-text');
const commentAssignee = $('#comment-assignee');
const commentPriority = $('#comment-priority');
const webhookEnabled = $('#webhook-enabled');
const webhookConfig = $('#webhook-config');
const webhookUrl = $('#webhook-url');
const dialogClose = $('#dialog-close');
const dialogCancel = $('#dialog-cancel');
const dialogSave = $('#dialog-save');
const teamModal = $('#team-modal');
const teamModalClose = $('#team-modal-close');
const memberName = $('#member-name');
const memberEmail = $('#member-email');
const addMemberBtn = $('#add-member-btn');
const teamList = $('#team-list');
const teamEmpty = $('#team-empty');
const toastContainer = $('#toast-container');

// ─── State ────────────────────────────────────────────────────
let pendingCommentPosition = null;

// ─── Initialize ───────────────────────────────────────────────
function init() {
    setupEventListeners();
    setupStoreListeners();
    restoreState();
    updateCounts();
    renderComments();
    renderTasks();
    renderTeam();
    updateAssigneeDropdowns();
}

// ─── Event Listeners ──────────────────────────────────────────
function setupEventListeners() {
    // URL loading
    loadUrlBtn.addEventListener('click', handleLoadUrl);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLoadUrl();
    });

    // Mode toggle
    modeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        store.setMode(mode);
    });

    // Sidebar tabs
    sidebar.addEventListener('click', (e) => {
        const tab = e.target.closest('.sidebar__tab');
        if (!tab) return;
        const tabName = tab.dataset.tab;
        $$('.sidebar__tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        $$('.sidebar__panel').forEach(p => p.classList.remove('active'));
        $(`#${tabName}-panel`).classList.add('active');
    });

    // Comment overlay click (place comment)
    commentOverlay.addEventListener('click', handleOverlayClick);

    // Comment dialog
    dialogClose.addEventListener('click', closeCommentDialog);
    dialogCancel.addEventListener('click', closeCommentDialog);
    dialogSave.addEventListener('click', handleSaveComment);

    // Webhook toggle
    webhookEnabled.addEventListener('change', () => {
        webhookConfig.style.display = webhookEnabled.checked ? 'block' : 'none';
    });

    // Team modal
    teamBtn.addEventListener('click', () => {
        teamModal.style.display = 'flex';
    });
    teamModalClose.addEventListener('click', () => {
        teamModal.style.display = 'none';
    });
    teamModal.addEventListener('click', (e) => {
        if (e.target === teamModal) teamModal.style.display = 'none';
    });

    // Add team member
    addMemberBtn.addEventListener('click', handleAddMember);
    memberEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddMember();
    });

    // Listen for navigation messages from iframe
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') {
            urlInput.value = e.data.url;
            handleLoadUrl();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCommentDialog();
            teamModal.style.display = 'none';
        }
    });
}

// ─── Store Listeners ──────────────────────────────────────────
function setupStoreListeners() {
    store.on('modeChanged', (mode) => {
        updateModeUI(mode);
    });

    store.on('commentAdded', (comment) => {
        renderComments();
        renderPins();
        updateCounts();
        // Trigger webhook if enabled
        if (comment.webhookEnabled && comment.webhookUrl) {
            triggerWebhook(comment);
        }
    });

    store.on('commentsUpdated', () => {
        renderComments();
        renderPins();
        updateCounts();
    });

    store.on('taskAdded', () => {
        renderTasks();
        updateCounts();
    });

    store.on('tasksUpdated', () => {
        renderTasks();
    });

    store.on('teamUpdated', () => {
        renderTeam();
        updateAssigneeDropdowns();
    });

    store.on('countsChanged', () => {
        updateCounts();
    });
}

// ─── URL Loading ──────────────────────────────────────────────
function handleLoadUrl() {
    const rawUrl = urlInput.value;
    const url = ProxyService.normalizeUrl(rawUrl);

    if (!url) {
        showToast('Inserisci un URL valido', 'error');
        return;
    }

    urlInput.value = url;
    store.setCurrentUrl(url);

    // Show loading
    viewportEmpty.style.display = 'none';
    frameWrapper.style.display = 'block';

    // Add loading indicator
    const existingLoader = frameWrapper.querySelector('.viewport__loading');
    if (existingLoader) existingLoader.remove();

    const loader = document.createElement('div');
    loader.className = 'viewport__loading';
    loader.innerHTML = '<div class="loading-spinner"></div><span>Caricamento pagina...</span>';
    frameWrapper.appendChild(loader);

    // Load via proxy
    const proxyUrl = ProxyService.getProxyUrl(url);
    pageFrame.src = proxyUrl;

    pageFrame.onload = () => {
        const loadingEl = frameWrapper.querySelector('.viewport__loading');
        if (loadingEl) loadingEl.remove();
        renderPins();
        showToast('Pagina caricata con successo', 'success');
    };

    pageFrame.onerror = () => {
        const loadingEl = frameWrapper.querySelector('.viewport__loading');
        if (loadingEl) loadingEl.remove();
        showToast('Errore nel caricamento della pagina', 'error');
    };
}

// ─── Mode ─────────────────────────────────────────────────────
function updateModeUI(mode) {
    $$('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'comment') {
        commentOverlay.style.display = 'block';
        document.body.style.cursor = 'default';
    } else {
        commentOverlay.style.display = 'none';
        closeCommentDialog();
    }
}

// ─── Comment Overlay ──────────────────────────────────────────
function handleOverlayClick(e) {
    if (store.mode !== 'comment') return;

    const rect = commentOverlay.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    pendingCommentPosition = { x, y };

    // Position & show dialog
    const dialogX = e.clientX + 16;
    const dialogY = e.clientY - 20;

    // Make sure dialog stays within viewport
    const maxX = window.innerWidth - 340;
    const maxY = window.innerHeight - 400;

    commentDialog.style.left = Math.min(dialogX, maxX) + 'px';
    commentDialog.style.top = Math.min(dialogY, maxY) + 'px';
    commentDialog.style.display = 'block';

    dialogPinNumber.textContent = store.comments.length + 1;
    commentText.value = '';
    commentAssignee.value = '';
    commentPriority.value = 'medium';
    webhookEnabled.checked = false;
    webhookConfig.style.display = 'none';
    webhookUrl.value = store.globalWebhookUrl || '';
    commentText.focus();
}

// ─── Save Comment ─────────────────────────────────────────────
function handleSaveComment() {
    const text = commentText.value.trim();
    if (!text) {
        showToast('Scrivi un commento prima di salvare', 'warning');
        return;
    }

    const comment = store.addComment({
        text,
        x: pendingCommentPosition.x,
        y: pendingCommentPosition.y,
        assignee: commentAssignee.value,
        priority: commentPriority.value,
        webhookEnabled: webhookEnabled.checked,
        webhookUrl: webhookUrl.value.trim()
    });

    closeCommentDialog();
    showToast(`Commento #${comment.number} aggiunto`, 'success');

    // Switch to comments tab
    $$('.sidebar__tab').forEach(t => t.classList.remove('active'));
    $$('.sidebar__tab')[0].classList.add('active');
    $$('.sidebar__panel').forEach(p => p.classList.remove('active'));
    commentsPanel.classList.add('active');
}

function closeCommentDialog() {
    commentDialog.style.display = 'none';
    pendingCommentPosition = null;
}

// ─── Render Comments ──────────────────────────────────────────
function renderComments() {
    const comments = store.comments;

    if (comments.length === 0) {
        commentsEmpty.style.display = 'flex';
        commentsList.innerHTML = '';
        return;
    }

    commentsEmpty.style.display = 'none';

    commentsList.innerHTML = comments.map(comment => {
        const assigneeName = comment.assignee
            ? store.teamMembers.find(m => m.id === comment.assignee)?.name || ''
            : '';

        const time = new Date(comment.createdAt);
        const timeStr = time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const dateStr = time.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

        return `
      <div class="comment-item" data-id="${comment.id}">
        <div class="comment-item__pin">${comment.number}</div>
        <div class="comment-item__content">
          <div class="comment-item__text">${escapeHtml(comment.text)}</div>
          <div class="comment-item__meta">
            ${assigneeName ? `
              <span class="comment-item__assignee">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="3" r="2" stroke="currentColor" stroke-width="1"/><path d="M1 9C1 7 2.5 5.5 5 5.5C7.5 5.5 9 7 9 9" stroke="currentColor" stroke-width="1"/></svg>
                ${escapeHtml(assigneeName)}
              </span>
            ` : ''}
            <span class="comment-item__priority comment-item__priority--${comment.priority}">
              ${getPriorityLabel(comment.priority)}
            </span>
            ${comment.webhookEnabled ? `
              <span class="comment-item__webhook">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5L3.5 7.5L9 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Webhook
              </span>
            ` : ''}
            <span>${dateStr} ${timeStr}</span>
          </div>
        </div>
        <div class="comment-item__actions">
          <button class="comment-item__action-btn" data-action="delete" data-id="${comment.id}" title="Elimina">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3H10.5M4 3V1.5H8V3M4.5 5V9M7.5 5V9M2.5 3L3 10.5H9L9.5 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
    }).join('');

    // Comment item click listeners
    commentsList.querySelectorAll('.comment-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Ignore if clicking delete button
            if (e.target.closest('[data-action="delete"]')) return;
            const id = item.dataset.id;
            highlightPin(id);
        });
    });

    // Delete button listeners
    commentsList.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            store.removeComment(id);
            renderPins();
            showToast('Commento eliminato', 'success');
        });
    });
}

// ─── Render Tasks ─────────────────────────────────────────────
function renderTasks() {
    const tasks = store.tasks;

    if (tasks.length === 0) {
        tasksEmpty.style.display = 'flex';
        tasksList.innerHTML = '';
        return;
    }

    tasksEmpty.style.display = 'none';

    tasksList.innerHTML = tasks.map(task => {
        const comment = store.getCommentById(task.commentId);
        const commentNumber = comment ? comment.number : '?';

        return `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-item__checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="task-item__content">
          <div class="task-item__text">
            <span style="color:var(--color-primary);font-weight:600;">#${commentNumber}</span>
            ${escapeHtml(task.text)}
          </div>
          <div class="task-item__meta">
            <select class="task-item__assignee-select" data-task-id="${task.id}">
              <option value="">Non assegnato</option>
              ${store.teamMembers.map(m => `
                <option value="${m.id}" ${task.assignee === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
              `).join('')}
            </select>
            <span class="comment-item__priority comment-item__priority--${task.priority}">
              ${getPriorityLabel(task.priority)}
            </span>
          </div>
        </div>
      </div>
    `;
    }).join('');

    // Checkbox listeners
    tasksList.querySelectorAll('.task-item__checkbox').forEach(cb => {
        cb.addEventListener('click', () => {
            const taskId = cb.dataset.taskId;
            store.toggleTask(taskId);
        });
    });

    // Assignee select listeners
    tasksList.querySelectorAll('.task-item__assignee-select').forEach(select => {
        select.addEventListener('change', () => {
            const taskId = select.dataset.taskId;
            store.updateTaskAssignee(taskId, select.value);
        });
    });
}

// ─── Render Pins ──────────────────────────────────────────────
function renderPins() {
    pinsContainer.innerHTML = '';

    store.comments.forEach(comment => {
        if (comment.pageUrl !== store.currentUrl) return;

        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.dataset.id = comment.id;
        pin.style.left = comment.x + '%';
        pin.style.top = comment.y + '%';
        pin.innerHTML = `
      <div class="pin__tooltip">${escapeHtml(comment.text)}</div>
      <div class="pin__marker">
        <div class="pin__circle">${comment.number}</div>
        <div class="pin__tail"></div>
      </div>
    `;

        pin.addEventListener('click', () => {
            highlightComment(comment.id);
        });

        pinsContainer.appendChild(pin);
    });
}

function highlightPin(commentId) {
    // Remove previous highlight
    pinsContainer.querySelectorAll('.pin').forEach(p => {
        p.style.transform = p.style.transform.replace(' scale(1.3)', '');
    });

    const pin = pinsContainer.querySelector(`[data-id="${commentId}"]`);
    if (pin) {
        pin.style.transform = 'translate(-50%, -100%) scale(1.3)';
        setTimeout(() => {
            pin.style.transform = '';
        }, 1500);
    }
}

function highlightComment(commentId) {
    commentsList.querySelectorAll('.comment-item').forEach(item => {
        item.classList.remove('active');
    });

    const commentItem = commentsList.querySelector(`[data-id="${commentId}"]`);
    if (commentItem) {
        commentItem.classList.add('active');
        commentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Switch to comments tab
        $$('.sidebar__tab').forEach(t => t.classList.remove('active'));
        $$('.sidebar__tab')[0].classList.add('active');
        $$('.sidebar__panel').forEach(p => p.classList.remove('active'));
        commentsPanel.classList.add('active');
    }
}

// ─── Render Team ──────────────────────────────────────────────
function renderTeam() {
    const members = store.teamMembers;

    if (members.length === 0) {
        teamEmpty.style.display = 'block';
        // Remove all team-member elements
        teamList.querySelectorAll('.team-member').forEach(el => el.remove());
        return;
    }

    teamEmpty.style.display = 'none';

    // Keep the empty message element, replace rest
    const existingMembers = teamList.querySelectorAll('.team-member');
    existingMembers.forEach(el => el.remove());

    members.forEach(member => {
        const el = document.createElement('div');
        el.className = 'team-member';
        el.innerHTML = `
      <div class="team-member__avatar">${member.initials}</div>
      <div class="team-member__info">
        <div class="team-member__name">${escapeHtml(member.name)}</div>
        <div class="team-member__email">${escapeHtml(member.email)}</div>
      </div>
      <button class="team-member__remove" data-id="${member.id}" title="Rimuovi">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;
        teamList.appendChild(el);
    });

    // Remove listeners
    teamList.querySelectorAll('.team-member__remove').forEach(btn => {
        btn.addEventListener('click', () => {
            store.removeTeamMember(btn.dataset.id);
            showToast('Membro rimosso', 'success');
        });
    });
}

function handleAddMember() {
    const name = memberName.value.trim();
    const email = memberEmail.value.trim();

    if (!name) {
        showToast('Inserisci un nome', 'warning');
        return;
    }

    store.addTeamMember(name, email || '');
    memberName.value = '';
    memberEmail.value = '';
    memberName.focus();
    showToast(`${name} aggiunto al team`, 'success');
}

function updateAssigneeDropdowns() {
    const options = '<option value="">Nessuno</option>' +
        store.teamMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    commentAssignee.innerHTML = options;

    // Re-render tasks to update assignee selects
    renderTasks();
}

// ─── Webhook ──────────────────────────────────────────────────
async function triggerWebhook(comment) {
    const result = await WebhookService.sendWebhook(comment.webhookUrl, comment);
    if (result.success) {
        showToast('Webhook inviato con successo', 'success');
    } else {
        showToast(`Errore webhook: ${result.error}`, 'error');
    }
}

// ─── Counts ───────────────────────────────────────────────────
function updateCounts() {
    commentCount.textContent = store.comments.length;
    taskCount.textContent = store.tasks.length;
}

// ─── Restore State ────────────────────────────────────────────
function restoreState() {
    // Restore URL
    if (store.currentUrl) {
        urlInput.value = store.currentUrl;
        viewportEmpty.style.display = 'none';
        frameWrapper.style.display = 'block';
        pageFrame.src = ProxyService.getProxyUrl(store.currentUrl);
        pageFrame.onload = () => renderPins();
    }

    // Restore mode
    updateModeUI(store.mode);
}

// ─── Utilities ────────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPriorityLabel(priority) {
    const labels = {
        low: 'Bassa',
        medium: 'Media',
        high: 'Alta',
        urgent: 'Urgente'
    };
    return labels[priority] || priority;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

// ─── Start ────────────────────────────────────────────────────
init();
