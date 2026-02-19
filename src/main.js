// ═══════════════════════════════════════════════════════════════
// Markup Comments — Main Application
// ═══════════════════════════════════════════════════════════════

import { store } from './store/AppStore.js';
import { ProxyService } from './services/ProxyService.js';
import { WebhookService } from './services/WebhookService.js';
import { AuthService } from './services/AuthService.js';
import { SupabaseService } from './services/SupabaseService.js';

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
const webhookInfo = $('#webhook-info');
const webhookInfoText = $('#webhook-info-text');
const dialogClose = $('#dialog-close');
const dialogCancel = $('#dialog-cancel');
const dialogSave = $('#dialog-save');
const teamModal = $('#team-modal');
const teamModalClose = $('#team-modal-close');
const memberName = $('#member-name');
const memberEmail = $('#member-email');
const memberWebhook = $('#member-webhook');
const avatarUpload = $('#avatar-upload');
const avatarInput = $('#avatar-input');
const avatarPreview = $('#avatar-preview');
const addMemberBtn = $('#add-member-btn');
const teamList = $('#team-list');
const teamEmpty = $('#team-empty');
const globalWebhookUrl = $('#global-webhook-url');
const saveGlobalWebhook = $('#save-global-webhook');
const toastContainer = $('#toast-container');

// Edit member modal
const editMemberModal = $('#edit-member-modal');
const editMemberClose = $('#edit-member-close');
const editMemberCancel = $('#edit-member-cancel');
const editMemberSave = $('#edit-member-save');
const editMemberId = $('#edit-member-id');
const editMemberName = $('#edit-member-name');
const editMemberEmail = $('#edit-member-email');
const editMemberWebhook = $('#edit-member-webhook');
const editAvatarUpload = $('#edit-avatar-upload');
const editAvatarInput = $('#edit-avatar-input');
const editAvatarPreview = $('#edit-avatar-preview');

// Auth elements
const authScreen = $('#auth-screen');
const appContainer = $('#app');
const loginForm = $('#login-form');
const signupForm = $('#signup-form');
const loginError = $('#login-error');
const signupError = $('#signup-error');
const authToggleBtn = $('#auth-toggle-btn');
const authToggleText = $('#auth-toggle-text');
const toolbarUserEmail = $('#toolbar-user-email');
const logoutBtn = $('#logout-btn');

// Credits & Admin elements
const creditsBadge = $('#credits-badge');
const creditsCount = $('#credits-count');
const purchaseModal = $('#purchase-modal');
const purchaseModalClose = $('#purchase-modal-close');
const purchasePackages = $('#purchase-packages');
const adminModal = $('#admin-modal');
const adminModalClose = $('#admin-modal-close');

// ─── State ────────────────────────────────────────────────────
let pendingCommentPosition = null;
let pendingAvatarData = '';       // for add form
let pendingEditAvatarData = '';   // for edit form
let activeTagFilter = '';         // current tag filter
let activeFolderId = 'all';      // current folder filter
let taskSearchQuery = '';         // task search query

// ─── Initialize ───────────────────────────────────────────────
async function init() {
    setupAuthListeners();

    // Check if user is already authenticated
    const session = await AuthService.getSession();

    if (session) {
        await showApp(session.user);
    } else {
        showAuth();
    }

    // Listen for auth state changes
    AuthService.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await showApp(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });
}

let _appInitialized = false;

async function showApp(user) {
    authScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    toolbarUserEmail.textContent = user.email;

    if (!_appInitialized) {
        setupEventListeners();
        setupStoreListeners();
        _appInitialized = true;
    }

    // Load data from Supabase (or localStorage fallback)
    await store.init();

    restoreState();
    updateCounts();
    renderComments();
    renderFolders();
    renderTasks();
    renderTeam();
    updateAssigneeDropdowns();
    updateCreditsBadge();

    // Check for Stripe checkout result in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
        showToast('Crediti acquistati con successo! Potrebbero volerci pochi secondi per aggiornarsi.', 'success');
        window.history.replaceState({}, '', window.location.pathname);
        // Refresh profile after a delay to allow webhook to process
        setTimeout(() => store.refreshProfile(), 3000);
    } else if (params.get('checkout') === 'cancel') {
        showToast('Acquisto annullato', 'warning');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function showAuth() {
    authScreen.style.display = 'flex';
    appContainer.style.display = 'none';
}

// ─── Auth Listeners ───────────────────────────────────────────
function setupAuthListeners() {
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;
        const submitBtn = $('#login-submit');

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Accesso in corso...';
            await AuthService.signIn(email, password);
        } catch (err) {
            loginError.textContent = getAuthErrorMessage(err);
            loginError.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Accedi';
        }
    });

    // Signup form
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupError.style.display = 'none';
        const email = $('#signup-email').value.trim();
        const password = $('#signup-password').value;
        const confirm = $('#signup-password-confirm').value;
        const submitBtn = $('#signup-submit');

        if (password !== confirm) {
            signupError.textContent = 'Le password non coincidono';
            signupError.style.display = 'block';
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creazione account...';
            await AuthService.signUp(email, password);
            showToast('Account creato! Effettua il login.', 'success');
            // Switch to login form
            authToggleBtn.click();
        } catch (err) {
            signupError.textContent = getAuthErrorMessage(err);
            signupError.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crea account';
        }
    });

    // Toggle login/signup
    authToggleBtn.addEventListener('click', () => {
        const isLogin = loginForm.style.display !== 'none';
        loginForm.style.display = isLogin ? 'none' : 'block';
        signupForm.style.display = isLogin ? 'block' : 'none';
        authToggleText.textContent = isLogin ? 'Hai già un account?' : 'Non hai un account?';
        authToggleBtn.textContent = isLogin ? 'Accedi' : 'Registrati';
        loginError.style.display = 'none';
        signupError.style.display = 'none';
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await AuthService.signOut();
            // Clear local state
            store.clearAll();
            showAuth();
            showToast('Logout effettuato', 'info');
        } catch (err) {
            showToast('Errore durante il logout', 'error');
        }
    });
}

function getAuthErrorMessage(err) {
    const msg = err.message || '';
    if (msg.includes('Invalid login credentials')) return 'Email o password non corretti';
    if (msg.includes('User already registered')) return 'Questa email è già registrata';
    if (msg.includes('Password should be at least')) return 'La password deve avere almeno 6 caratteri';
    if (msg.includes('Unable to validate email')) return 'Indirizzo email non valido';
    return msg || 'Si è verificato un errore. Riprova.';
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

    // Filter clear
    $('#filter-clear').addEventListener('click', () => {
        activeTagFilter = '';
        renderComments();
    });

    // Task search
    $('#task-search-input').addEventListener('input', (e) => {
        taskSearchQuery = e.target.value;
        renderTasks();
    });

    // Webhook info: update when assignee changes in comment dialog
    commentAssignee.addEventListener('change', updateWebhookInfo);

    // Team modal
    teamBtn.addEventListener('click', () => {
        globalWebhookUrl.value = store.globalWebhookUrl || '';
        teamModal.style.display = 'flex';
    });
    teamModalClose.addEventListener('click', () => {
        teamModal.style.display = 'none';
    });
    teamModal.addEventListener('click', (e) => {
        if (e.target === teamModal) teamModal.style.display = 'none';
    });

    // Global webhook save
    saveGlobalWebhook.addEventListener('click', () => {
        store.setGlobalWebhookUrl(globalWebhookUrl.value.trim());
        showToast('Webhook globale salvato', 'success');
    });

    // Avatar upload (add form)
    avatarUpload.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (e) => {
        handleAvatarFile(e.target.files[0], avatarPreview, (data) => {
            pendingAvatarData = data;
        });
    });

    // Add team member
    addMemberBtn.addEventListener('click', handleAddMember);
    memberEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddMember();
    });

    // Edit member modal
    editMemberClose.addEventListener('click', closeEditMemberModal);
    editMemberCancel.addEventListener('click', closeEditMemberModal);
    editMemberModal.addEventListener('click', (e) => {
        if (e.target === editMemberModal) closeEditMemberModal();
    });
    editMemberSave.addEventListener('click', handleSaveEditMember);

    // Avatar upload (edit form)
    editAvatarUpload.addEventListener('click', () => editAvatarInput.click());
    editAvatarInput.addEventListener('change', (e) => {
        handleAvatarFile(e.target.files[0], editAvatarPreview, (data) => {
            pendingEditAvatarData = data;
        });
    });

    // Listen for navigation messages from iframe
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') {
            urlInput.value = e.data.url;
            handleLoadUrl();
        }
    });

    // Credits badge click → open purchase modal
    creditsBadge.addEventListener('click', () => openPurchaseModal());

    // Purchase modal
    purchaseModalClose.addEventListener('click', () => purchaseModal.style.display = 'none');
    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) purchaseModal.style.display = 'none';
    });

    // Admin modal (only master)
    toolbarUserEmail.addEventListener('click', () => {
        if (store.isMaster) openAdminPanel();
    });
    adminModalClose.addEventListener('click', () => adminModal.style.display = 'none');
    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) adminModal.style.display = 'none';
    });

    // Admin tabs
    $$('.admin__tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.admin__tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $$('.admin__panel').forEach(p => p.classList.remove('active'));
            const panelId = `admin-${tab.dataset.adminTab}-panel`;
            document.getElementById(panelId)?.classList.add('active');
        });
    });

    // Admin save settings
    $('#admin-save-settings').addEventListener('click', handleSaveAdminSettings);

    // Admin add package
    $('#admin-add-package').addEventListener('click', handleAddPackage);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCommentDialog();
            teamModal.style.display = 'none';
            closeEditMemberModal();
            purchaseModal.style.display = 'none';
            adminModal.style.display = 'none';
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
        // Trigger webhook: per-user or global
        const webhookUrl = store.getWebhookUrlForComment(comment);
        if (webhookUrl) {
            triggerWebhook(webhookUrl, comment);
        }
    });

    store.on('commentsUpdated', () => {
        renderComments();
        renderFolders();
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

    store.on('foldersUpdated', () => {
        renderFolders();
        renderComments();
        updateCounts();
    });

    store.on('profileUpdated', () => {
        updateCreditsBadge();
    });

    store.on('creditsExhausted', () => {
        showToast('Crediti esauriti! Acquista un pacchetto per continuare.', 'warning');
        openPurchaseModal();
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
    commentText.focus();

    // Update webhook info display
    updateWebhookInfo();
}

// ─── Webhook Info in Comment Dialog ───────────────────────────
function updateWebhookInfo() {
    const assigneeId = commentAssignee.value;
    let webhookUrl = '';
    let infoText = '';

    if (assigneeId) {
        const member = store.getTeamMemberById(assigneeId);
        if (member && member.webhookUrl) {
            webhookUrl = member.webhookUrl;
            infoText = `Webhook → ${member.name}`;
        }
    }

    if (!webhookUrl && store.globalWebhookUrl) {
        webhookUrl = store.globalWebhookUrl;
        infoText = 'Webhook globale attivo';
    }

    if (webhookUrl) {
        webhookInfo.style.display = 'flex';
        webhookInfoText.textContent = infoText;
    } else {
        webhookInfo.style.display = 'none';
    }
}

// ─── Save Comment ─────────────────────────────────────────────
function handleSaveComment() {
    const text = commentText.value.trim();
    if (!text) {
        showToast('Scrivi un commento prima di salvare', 'warning');
        return;
    }

    const tagsRaw = $('#comment-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    const comment = store.addComment({
        text,
        x: pendingCommentPosition.x,
        y: pendingCommentPosition.y,
        assignee: commentAssignee.value,
        priority: commentPriority.value,
        tags
    });

    // addComment returns null if credits exhausted
    if (!comment) return;

    closeCommentDialog();
    showToast(`Commento #${comment.number} aggiunto`, 'success');
    updateCreditsBadge();

    // Switch to comments tab
    $$('.sidebar__tab').forEach(t => t.classList.remove('active'));
    $$('.sidebar__tab')[0].classList.add('active');
    $$('.sidebar__panel').forEach(p => p.classList.remove('active'));
    commentsPanel.classList.add('active');
}

function closeCommentDialog() {
    commentDialog.style.display = 'none';
    pendingCommentPosition = null;
    // Clear tags input
    const tagsInput = $('#comment-tags');
    if (tagsInput) tagsInput.value = '';
}

// ─── Render Comments ──────────────────────────────────────────
function renderComments() {
    let comments = store.comments;

    // Folder filter
    if (activeFolderId && activeFolderId !== 'all') {
        comments = comments.filter(c => c.folderId === activeFolderId);
    }

    // Tag filter
    const filterBar = $('#filter-bar');
    const filterTagsEl = $('#filter-tags');

    if (activeTagFilter) {
        comments = comments.filter(c => (c.tags || []).includes(activeTagFilter));
        filterBar.style.display = 'flex';
        filterTagsEl.innerHTML = `<span class="sidebar__filter-tag">${escapeHtml(activeTagFilter)}</span>`;
    } else {
        filterBar.style.display = 'none';
    }

    if (comments.length === 0) {
        commentsEmpty.style.display = 'flex';
        commentsList.innerHTML = '';
        return;
    }

    commentsEmpty.style.display = 'none';

    commentsList.innerHTML = comments.map(comment => {
        const member = comment.assignee
            ? store.getTeamMemberById(comment.assignee)
            : null;
        const assigneeName = member ? member.name : '';

        const time = new Date(comment.createdAt);
        const timeStr = time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const dateStr = time.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

        const webhookUrl = store.getWebhookUrlForComment(comment);

        const avatarHtml = member && member.avatar
            ? `<img src="${member.avatar}" alt="${escapeHtml(assigneeName)}" class="comment-item__avatar-img" />`
            : '';

        // Clickable page URL (shortened)
        let urlHtml = '';
        if (comment.pageUrl) {
            try {
                const u = new URL(comment.pageUrl);
                const short = u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname);
                urlHtml = `<a href="${escapeHtml(comment.pageUrl)}" target="_blank" class="comment-item__url" title="${escapeHtml(comment.pageUrl)}">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.5 5.5V8.5H1.5V2.5H4.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M6 1.5H8.5V4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6L8.5 1.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
                    ${escapeHtml(short)}
                </a>`;
            } catch { /* ignore bad URL */ }
        }

        // Tags
        const tagsHtml = (comment.tags || []).map(tag =>
            `<span class="comment-item__tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
        ).join('');

        // Folder dot
        const folder = comment.folderId ? store.folders.find(f => f.id === comment.folderId) : null;
        const folderDotHtml = folder
            ? `<span class="comment-item__folder-dot" style="background:${folder.color}" title="${escapeHtml(folder.name)}"></span>`
            : '';

        return `
      <div class="comment-item" data-id="${comment.id}" draggable="true">
        <div class="comment-item__pin">${comment.number}</div>
        <div class="comment-item__content">
          <div class="comment-item__text">${escapeHtml(comment.text)}</div>
          ${urlHtml ? `<div class="comment-item__url-row">${urlHtml}</div>` : ''}
          ${tagsHtml ? `<div class="comment-item__tags">${tagsHtml}</div>` : ''}
          <div class="comment-item__meta">
            ${folderDotHtml}
            ${assigneeName ? `
              <span class="comment-item__assignee">
                ${avatarHtml || `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="3" r="2" stroke="currentColor" stroke-width="1"/><path d="M1 9C1 7 2.5 5.5 5 5.5C7.5 5.5 9 7 9 9" stroke="currentColor" stroke-width="1"/></svg>`}
                ${escapeHtml(assigneeName)}
              </span>
            ` : ''}
            <span class="comment-item__priority comment-item__priority--${comment.priority}">
              ${getPriorityLabel(comment.priority)}
            </span>
            ${webhookUrl ? `
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

    // Tag click listeners (filter by tag)
    commentsList.querySelectorAll('.comment-item__tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            activeTagFilter = tag.dataset.tag;
            renderComments();
        });
    });

    // URL click listeners (prevent parent click)
    commentsList.querySelectorAll('.comment-item__url').forEach(link => {
        link.addEventListener('click', (e) => e.stopPropagation());
    });

    // Drag-and-drop handlers
    commentsList.querySelectorAll('.comment-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            // Remove drag-over from all folder chips
            document.querySelectorAll('.folder-chip.drag-over').forEach(c => c.classList.remove('drag-over'));
        });
    });
}

// ─── Render Folders ───────────────────────────────────────────
function renderFolders() {
    const foldersList = $('#folders-list');
    const folders = store.folders;
    const comments = store.comments;

    // Count per folder
    const countAll = comments.length;
    const countByFolder = {};
    folders.forEach(f => { countByFolder[f.id] = 0; });
    comments.forEach(c => { if (c.folderId && countByFolder[c.folderId] !== undefined) countByFolder[c.folderId]++; });

    let html = `
        <div class="folder-chip ${activeFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8v6H2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Tutti <span class="folder-chip__count">${countAll}</span>
        </div>
    `;

    html += folders.map(f => `
        <div class="folder-chip ${activeFolderId === f.id ? 'active' : ''}" data-folder-id="${f.id}">
            <span class="folder-chip__dot" style="background:${f.color}"></span>
            ${escapeHtml(f.name)}
            <span class="folder-chip__count">${countByFolder[f.id] || 0}</span>
            <button class="folder-chip__remove" data-folder-delete="${f.id}" title="Elimina cartella">&times;</button>
        </div>
    `).join('');

    foldersList.innerHTML = html;

    // Folder click → filter
    foldersList.querySelectorAll('.folder-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (e.target.closest('.folder-chip__remove')) return;
            activeFolderId = chip.dataset.folderId;
            renderFolders();
            renderComments();
        });

        // Drag-over for drop target (not "all")
        if (chip.dataset.folderId !== 'all') {
            chip.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                chip.classList.add('drag-over');
            });
            chip.addEventListener('dragleave', () => {
                chip.classList.remove('drag-over');
            });
            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                chip.classList.remove('drag-over');
                const commentId = e.dataTransfer.getData('text/plain');
                if (commentId) {
                    store.moveCommentToFolder(commentId, chip.dataset.folderId);
                    showToast('Commento spostato nella cartella', 'success');
                }
            });
        }
    });

    // Delete folder
    foldersList.querySelectorAll('[data-folder-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const folderId = btn.dataset.folderDelete;
            store.removeFolder(folderId);
            if (activeFolderId === folderId) activeFolderId = 'all';
            showToast('Cartella eliminata', 'success');
        });
    });

    // Add folder button
    const addFolderBtn = $('#add-folder-btn');
    addFolderBtn.onclick = () => {
        const name = prompt('Nome della cartella:');
        if (!name || !name.trim()) return;
        const colors = ['#6C5CE7', '#00CEC9', '#E17055', '#FDCB6E', '#0984E3', '#E84393', '#00B894'];
        const color = colors[store.folders.length % colors.length];
        store.addFolder(name.trim(), color);
        showToast(`Cartella "${name.trim()}" creata`, 'success');
    };
}

// ─── Render Tasks ─────────────────────────────────────────────
function renderTasks() {
    let tasks = store.tasks;

    // Search filter
    if (taskSearchQuery) {
        const q = taskSearchQuery.toLowerCase();
        tasks = tasks.filter(t => {
            const comment = store.getCommentById(t.commentId);
            const commentText = comment ? comment.text.toLowerCase() : '';
            const memberName = t.assignee ? (store.getTeamMemberById(t.assignee)?.name || '') : '';
            return t.text.toLowerCase().includes(q) ||
                commentText.includes(q) ||
                memberName.toLowerCase().includes(q);
        });
    }

    if (tasks.length === 0) {
        tasksEmpty.style.display = 'flex';
        tasksList.innerHTML = '';
        return;
    }

    tasksEmpty.style.display = 'none';

    tasksList.innerHTML = tasks.map(task => {
        const comment = store.getCommentById(task.commentId);
        const commentNumber = comment ? comment.number : '?';
        const member = task.assignee ? store.getTeamMemberById(task.assignee) : null;

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
            ${member && member.webhookUrl ? `<span class="comment-item__webhook" title="Webhook personale"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5L3.5 7.5L9 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>` : ''}
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

// ─── Avatar Handling ──────────────────────────────────────────
function handleAvatarFile(file, previewEl, onComplete) {
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
        showToast('Seleziona un file immagine', 'warning');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('L\'immagine deve essere inferiore a 2MB', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        // Resize to 128x128 for storage efficiency
        resizeImage(e.target.result, 128, (resizedData) => {
            previewEl.innerHTML = `<img src="${resizedData}" alt="Avatar" />`;
            previewEl.classList.add('has-image');
            onComplete(resizedData);
        });
    };
    reader.readAsDataURL(file);
}

function resizeImage(dataUrl, maxSize, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');

        // Crop to square from center
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
}

// ─── Render Team ──────────────────────────────────────────────
function renderTeam() {
    const members = store.teamMembers;

    if (members.length === 0) {
        teamEmpty.style.display = 'block';
        teamList.querySelectorAll('.team-member').forEach(el => el.remove());
        return;
    }

    teamEmpty.style.display = 'none';

    // Remove existing member elements
    const existingMembers = teamList.querySelectorAll('.team-member');
    existingMembers.forEach(el => el.remove());

    members.forEach(member => {
        const el = document.createElement('div');
        el.className = 'team-member';

        const avatarContent = member.avatar
            ? `<img src="${member.avatar}" alt="${escapeHtml(member.name)}" />`
            : member.initials;

        el.innerHTML = `
      <div class="team-member__avatar ${member.avatar ? 'has-image' : ''}">${avatarContent}</div>
      <div class="team-member__info">
        <div class="team-member__name">${escapeHtml(member.name)}</div>
        <div class="team-member__email">${escapeHtml(member.email || '—')}</div>
        ${member.webhookUrl ? `<div class="team-member__webhook-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5L3.5 7.5L9 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Webhook
        </div>` : ''}
      </div>
      <div class="team-member__actions">
        <button class="team-member__edit" data-id="${member.id}" title="Modifica">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="team-member__remove" data-id="${member.id}" title="Rimuovi">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
        teamList.appendChild(el);
    });

    // Edit listeners
    teamList.querySelectorAll('.team-member__edit').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditMemberModal(btn.dataset.id);
        });
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
    const webhook = memberWebhook.value.trim();

    if (!name) {
        showToast('Inserisci un nome', 'warning');
        return;
    }

    store.addTeamMember(name, email || '', pendingAvatarData, webhook);

    // Reset form
    memberName.value = '';
    memberEmail.value = '';
    memberWebhook.value = '';
    pendingAvatarData = '';
    avatarPreview.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 5V15M5 10H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    avatarPreview.classList.remove('has-image');
    avatarInput.value = '';

    memberName.focus();
    showToast(`${name} aggiunto al team`, 'success');
}

// ─── Edit Member Modal ────────────────────────────────────────
function openEditMemberModal(memberId) {
    const member = store.getTeamMemberById(memberId);
    if (!member) return;

    editMemberId.value = memberId;
    editMemberName.value = member.name;
    editMemberEmail.value = member.email || '';
    editMemberWebhook.value = member.webhookUrl || '';
    pendingEditAvatarData = member.avatar || '';

    // Show avatar
    if (member.avatar) {
        editAvatarPreview.innerHTML = `<img src="${member.avatar}" alt="Avatar" />`;
        editAvatarPreview.classList.add('has-image');
    } else {
        editAvatarPreview.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        `;
        editAvatarPreview.classList.remove('has-image');
    }
    editAvatarInput.value = '';

    editMemberModal.style.display = 'flex';
}

function closeEditMemberModal() {
    editMemberModal.style.display = 'none';
    pendingEditAvatarData = '';
}

function handleSaveEditMember() {
    const memberId = editMemberId.value;
    const name = editMemberName.value.trim();

    if (!name) {
        showToast('Il nome è obbligatorio', 'warning');
        return;
    }

    store.updateTeamMember(memberId, {
        name,
        email: editMemberEmail.value.trim(),
        webhookUrl: editMemberWebhook.value.trim(),
        avatar: pendingEditAvatarData
    });

    closeEditMemberModal();
    showToast('Membro aggiornato', 'success');
}

function updateAssigneeDropdowns() {
    const options = '<option value="">Nessuno</option>' +
        store.teamMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    commentAssignee.innerHTML = options;

    // Re-render tasks to update assignee selects
    renderTasks();
}

// ─── Webhook ──────────────────────────────────────────────────
async function triggerWebhook(webhookUrl, comment) {
    const member = comment.assignee ? store.getTeamMemberById(comment.assignee) : null;

    const payload = {
        ...comment,
        assigneeName: member ? member.name : 'Non assegnato',
        assigneeEmail: member ? member.email : '',
        webhookType: member && member.webhookUrl ? 'personal' : 'global'
    };

    const result = await WebhookService.sendWebhook(webhookUrl, payload);
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

// ─── Credits Badge ────────────────────────────────────────────
function updateCreditsBadge() {
    const remaining = store.creditsRemaining;
    const profile = store.userProfile;
    creditsCount.textContent = remaining;

    creditsBadge.classList.remove('warning', 'danger');
    if (profile) {
        const pct = remaining / (profile.monthlyLimit || 200);
        if (remaining === 0) {
            creditsBadge.classList.add('danger');
        } else if (pct <= 0.2) {
            creditsBadge.classList.add('warning');
        }
    }

    // Show admin cursor on email if master
    if (store.isMaster) {
        toolbarUserEmail.title = 'Apri pannello admin';
        toolbarUserEmail.style.textDecoration = 'underline';
    }
}

// ─── Purchase Modal ───────────────────────────────────────────
async function openPurchaseModal() {
    purchaseModal.style.display = 'flex';
    purchasePackages.innerHTML = '<p style="text-align:center;color:var(--color-text-tertiary)">Caricamento...</p>';

    try {
        const packages = await SupabaseService.getActivePackages();
        if (!packages.length) {
            purchasePackages.innerHTML = '<p style="text-align:center;color:var(--color-text-tertiary)">Nessun pacchetto disponibile.</p>';
            return;
        }

        purchasePackages.innerHTML = packages.map(pkg => `
            <div class="purchase-card" data-package-id="${pkg.id}">
                <span class="purchase-card__credits">${pkg.credits}</span>
                <span class="purchase-card__label">crediti</span>
                <span class="purchase-card__price">\u20ac${(pkg.priceCents / 100).toFixed(2)}</span>
            </div>
        `).join('');

        // Click handler for each card
        purchasePackages.querySelectorAll('.purchase-card').forEach(card => {
            card.addEventListener('click', async () => {
                const packageId = card.dataset.packageId;
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';

                try {
                    const session = await AuthService.getSession();
                    const res = await fetch('/api/stripe-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            packageId,
                            userId: session.user.id,
                            userEmail: session.user.email,
                        })
                    });
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    } else {
                        showToast(data.error || 'Errore nella creazione del pagamento', 'error');
                        card.style.opacity = '1';
                        card.style.pointerEvents = 'auto';
                    }
                } catch (err) {
                    showToast('Errore di rete', 'error');
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
            });
        });
    } catch (err) {
        purchasePackages.innerHTML = '<p style="color:var(--color-error)">Errore nel caricamento dei pacchetti.</p>';
    }
}

// ─── Admin Panel ──────────────────────────────────────────────
async function openAdminPanel() {
    adminModal.style.display = 'flex';
    await Promise.all([renderAdminUsers(), renderAdminPackages(), loadAdminSettings()]);
}

async function renderAdminUsers() {
    const tbody = $('#admin-users-list');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-tertiary)">Caricamento...</td></tr>';

    try {
        const profiles = await SupabaseService.getAllProfilesWithEmails();
        tbody.innerHTML = profiles.map(p => {
            const statusClass = p.suspended ? 'suspended' : 'active';
            const statusLabel = p.suspended ? 'Sospeso' : 'Attivo';
            const roleClass = p.role === 'master' ? 'master' : 'user';
            const used = p.creditsUsed;
            const limit = p.monthlyLimit;
            const extra = p.creditsExtra;

            return `<tr data-user-id="${p.userId}">
                <td>${escapeHtml(p.email || p.userId.substring(0, 8))}</td>
                <td><span class="admin__badge admin__badge--${roleClass}">${p.role}</span></td>
                <td>${used}/${limit}${extra ? ` +${extra}` : ''}</td>
                <td><input type="number" class="admin__inline-input admin-limit-input" value="${limit}" min="0" data-user-id="${p.userId}" /></td>
                <td><span class="admin__badge admin__badge--${statusClass}">${statusLabel}</span></td>
                <td>
                    <div class="admin__btn-group">
                        <button class="btn btn--ghost admin-toggle-suspend" data-user-id="${p.userId}" data-suspended="${p.suspended}">${p.suspended ? 'Riattiva' : 'Sospendi'}</button>
                        <button class="btn btn--ghost admin-toggle-role" data-user-id="${p.userId}" data-role="${p.role}">${p.role === 'master' ? 'Rimuovi master' : 'Nomina master'}</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Suspend/activate handlers
        tbody.querySelectorAll('.admin-toggle-suspend').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                const isSuspended = btn.dataset.suspended === 'true';
                await SupabaseService.updateUserProfile(userId, { suspended: !isSuspended });
                showToast(isSuspended ? 'Utente riattivato' : 'Utente sospeso', 'success');
                renderAdminUsers();
            });
        });

        // Role toggle handlers
        tbody.querySelectorAll('.admin-toggle-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                const currentRole = btn.dataset.role;
                const newRole = currentRole === 'master' ? 'user' : 'master';
                await SupabaseService.updateUserProfile(userId, { role: newRole });
                showToast(`Ruolo aggiornato a ${newRole}`, 'success');
                renderAdminUsers();
            });
        });

        // Limit change handlers (on blur)
        tbody.querySelectorAll('.admin-limit-input').forEach(input => {
            input.addEventListener('change', async () => {
                const userId = input.dataset.userId;
                const newLimit = parseInt(input.value, 10);
                if (isNaN(newLimit) || newLimit < 0) return;
                await SupabaseService.updateUserProfile(userId, { monthlyLimit: newLimit });
                showToast('Limite aggiornato', 'success');
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--color-error)">Errore: ${err.message}</td></tr>`;
    }
}

async function renderAdminPackages() {
    const tbody = $('#admin-packages-list');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-tertiary)">Caricamento...</td></tr>';

    try {
        const packages = await SupabaseService.getAllPackages();
        tbody.innerHTML = packages.map(pkg => `
            <tr data-package-id="${pkg.id}">
                <td><input type="text" class="admin__inline-input pkg-label" value="${escapeHtml(pkg.label)}" style="width:120px" /></td>
                <td><input type="number" class="admin__inline-input pkg-credits" value="${pkg.credits}" min="1" /></td>
                <td><input type="number" class="admin__inline-input pkg-price" value="${(pkg.priceCents / 100).toFixed(2)}" min="0" step="0.01" style="width:70px" /></td>
                <td><input type="checkbox" class="pkg-active" ${pkg.active ? 'checked' : ''} /></td>
                <td>
                    <div class="admin__btn-group">
                        <button class="btn btn--primary btn--sm pkg-save" data-id="${pkg.id}">Salva</button>
                        <button class="btn btn--ghost btn--sm pkg-delete" data-id="${pkg.id}">\u2715</button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Save package handlers
        tbody.querySelectorAll('.pkg-save').forEach(btn => {
            btn.addEventListener('click', async () => {
                const row = btn.closest('tr');
                const id = btn.dataset.id;
                const label = row.querySelector('.pkg-label').value.trim();
                const credits = parseInt(row.querySelector('.pkg-credits').value, 10);
                const priceCents = Math.round(parseFloat(row.querySelector('.pkg-price').value) * 100);
                const active = row.querySelector('.pkg-active').checked;

                await SupabaseService.updatePackage(id, { label, credits, priceCents, active });
                showToast('Pacchetto aggiornato', 'success');
            });
        });

        // Delete package handlers
        tbody.querySelectorAll('.pkg-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Eliminare questo pacchetto?')) return;
                await SupabaseService.removePackage(btn.dataset.id);
                showToast('Pacchetto eliminato', 'success');
                renderAdminPackages();
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--color-error)">Errore: ${err.message}</td></tr>`;
    }
}

async function loadAdminSettings() {
    try {
        const [stripeKey, webhookSecret] = await Promise.all([
            SupabaseService.getAppConfig('stripe_secret_key'),
            SupabaseService.getAppConfig('stripe_webhook_secret'),
        ]);
        $('#admin-stripe-key').value = stripeKey || '';
        $('#admin-stripe-webhook').value = webhookSecret || '';
    } catch (err) {
        console.warn('Failed to load admin settings:', err);
    }
}

async function handleSaveAdminSettings() {
    const stripeKey = $('#admin-stripe-key').value.trim();
    const webhookSecret = $('#admin-stripe-webhook').value.trim();

    try {
        await Promise.all([
            SupabaseService.setAppConfig('stripe_secret_key', stripeKey),
            SupabaseService.setAppConfig('stripe_webhook_secret', webhookSecret),
        ]);
        showToast('Impostazioni Stripe salvate', 'success');
    } catch (err) {
        showToast('Errore nel salvataggio: ' + err.message, 'error');
    }
}

async function handleAddPackage() {
    const label = prompt('Nome del pacchetto (es. "50 Crediti"):');
    if (!label) return;
    const credits = parseInt(prompt('Numero di crediti:'), 10);
    if (isNaN(credits) || credits <= 0) return;
    const price = parseFloat(prompt('Prezzo in EUR (es. 4.99):'));
    if (isNaN(price) || price <= 0) return;

    try {
        await SupabaseService.addPackage({
            label,
            credits,
            priceCents: Math.round(price * 100),
            active: true,
            position: 99,
        });
        showToast('Pacchetto creato', 'success');
        renderAdminPackages();
    } catch (err) {
        showToast('Errore: ' + err.message, 'error');
    }
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
