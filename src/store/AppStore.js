// ═══════════════════════════════════════════════════════════════
// AppStore — Central state management with Supabase + localStorage fallback
// ═══════════════════════════════════════════════════════════════

import { SupabaseService } from '../services/SupabaseService.js';

const STORAGE_KEY = 'markup-comments-data';

class AppStore {
    constructor() {
        this.listeners = new Map();
        this.state = this._loadLocalState();
        this.dbReady = false;
    }

    /**
     * Initialize: load data from Supabase if available, otherwise use localStorage.
     * Called once from main.js after DOM is ready.
     */
    async init() {
        if (!SupabaseService.isAvailable) {
            console.log('📦 Using localStorage (no Supabase)');
            return;
        }

        try {
            const [teamMembers, comments, tasks, folders, globalWebhookUrl, currentUrl, userProfile] = await Promise.all([
                SupabaseService.getTeamMembers(),
                SupabaseService.getComments(),
                SupabaseService.getTasks(),
                SupabaseService.getFolders(),
                SupabaseService.getSetting('globalWebhookUrl'),
                SupabaseService.getSetting('currentUrl'),
                SupabaseService.getUserProfile()
            ]);

            this.state.teamMembers = teamMembers;
            this.state.comments = comments;
            this.state.tasks = tasks;
            this.state.folders = folders;
            this.state.globalWebhookUrl = globalWebhookUrl || '';
            this.state.currentUrl = currentUrl || this.state.currentUrl;
            this.state.userProfile = userProfile;
            this.dbReady = true;

            // Auto-reset billing period if needed
            if (userProfile) {
                const periodStart = new Date(userProfile.billingPeriodStart);
                const now = new Date();
                const daysDiff = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 30) {
                    this.state.userProfile.creditsUsed = 0;
                    this.state.userProfile.billingPeriodStart = now.toISOString().split('T')[0];
                    SupabaseService.updateUserProfile(userProfile.userId, {
                        creditsUsed: 0,
                        billingPeriodStart: this.state.userProfile.billingPeriodStart
                    }).catch(e => console.warn('Failed to reset billing period:', e));
                }
            }

            // Sync localStorage
            this._saveLocal();

            console.log('☁️ Data loaded from Supabase');

            // Emit events to re-render UI
            this._emit('teamUpdated');
            this._emit('commentsUpdated');
            this._emit('tasksUpdated');
            this._emit('foldersUpdated');
            this._emit('countsChanged');
            this._emit('profileUpdated');
        } catch (err) {
            console.warn('⚠️ Supabase load failed, using localStorage:', err.message);
        }
    }

    // ─── State Access ───────────────────────────────────────────
    get comments() { return this.state.comments; }
    get tasks() { return this.state.tasks; }
    get teamMembers() { return this.state.teamMembers; }
    get folders() { return this.state.folders; }
    get currentUrl() { return this.state.currentUrl; }
    get mode() { return this.state.mode; }
    get globalWebhookUrl() { return this.state.globalWebhookUrl; }
    get userProfile() { return this.state.userProfile; }
    get isMaster() { return this.state.userProfile?.role === 'master'; }

    get creditsRemaining() {
        const p = this.state.userProfile;
        if (!p) return 0;
        const base = Math.max(0, p.monthlyLimit - p.creditsUsed);
        return base + (p.creditsExtra || 0);
    }

    get canComment() {
        const p = this.state.userProfile;
        if (!p) return false;
        if (p.suspended) return false;
        return this.creditsRemaining > 0;
    }

    async refreshProfile() {
        try {
            this.state.userProfile = await SupabaseService.getUserProfile();
            this._emit('profileUpdated');
        } catch (e) { console.warn('Failed to refresh profile:', e); }
    }

    // ─── URL ────────────────────────────────────────────────────
    setCurrentUrl(url) {
        this.state.currentUrl = url;
        this._saveLocal();
        this._dbSave(() => SupabaseService.setSetting('currentUrl', url));
        this._emit('urlChanged', url);
    }

    // ─── Mode ───────────────────────────────────────────────────
    setMode(mode) {
        this.state.mode = mode;
        this._saveLocal();
        this._emit('modeChanged', mode);
    }

    // ─── Comments ───────────────────────────────────────────────
    addComment(comment) {
        // Check credits before allowing comment
        if (!this.canComment) {
            this._emit('creditsExhausted');
            return null;
        }

        const newComment = {
            id: this._generateId(),
            number: this.state.comments.length + 1,
            text: comment.text,
            x: comment.x,
            y: comment.y,
            pageUrl: this.state.currentUrl,
            assignee: comment.assignee || '',
            priority: comment.priority || 'medium',
            tags: comment.tags || [],
            folderId: comment.folderId || null,
            createdAt: new Date().toISOString(),
            resolved: false
        };

        this.state.comments.push(newComment);

        // Auto-create task from comment
        const newTask = {
            id: this._generateId(),
            commentId: newComment.id,
            text: newComment.text,
            assignee: newComment.assignee,
            priority: newComment.priority,
            completed: false,
            createdAt: newComment.createdAt
        };
        this.state.tasks.push(newTask);

        // Deduct credit: prefer monthly first, then extra
        if (this.state.userProfile) {
            const p = this.state.userProfile;
            if (p.creditsUsed < p.monthlyLimit) {
                p.creditsUsed++;
            } else if (p.creditsExtra > 0) {
                p.creditsExtra--;
            }
        }

        this._saveLocal();
        this._dbSave(async () => {
            await SupabaseService.addComment(newComment);
            await SupabaseService.addTask(newTask);
            await SupabaseService.incrementCreditsUsed();
        });

        this._emit('commentAdded', newComment);
        this._emit('taskAdded', newTask);
        this._emit('countsChanged');
        this._emit('profileUpdated');

        return newComment;
    }

    removeComment(commentId) {
        this.state.comments = this.state.comments.filter(c => c.id !== commentId);
        this.state.tasks = this.state.tasks.filter(t => t.commentId !== commentId);

        // Renumber remaining comments
        this.state.comments.forEach((c, i) => c.number = i + 1);

        this._saveLocal();
        this._dbSave(() => SupabaseService.removeComment(commentId));

        this._emit('commentsUpdated');
        this._emit('tasksUpdated');
        this._emit('countsChanged');
    }

    getCommentById(id) {
        return this.state.comments.find(c => c.id === id);
    }

    // ─── Folders ─────────────────────────────────────────────
    addFolder(name, color = '#6C5CE7') {
        const folder = {
            id: this._generateId(),
            name,
            color,
            position: this.state.folders.length
        };
        this.state.folders.push(folder);
        this._saveLocal();
        this._dbSave(() => SupabaseService.addFolder(folder));
        this._emit('foldersUpdated');
        return folder;
    }

    removeFolder(folderId) {
        this.state.folders = this.state.folders.filter(f => f.id !== folderId);
        // Unassign comments from deleted folder
        this.state.comments.forEach(c => {
            if (c.folderId === folderId) c.folderId = null;
        });
        this._saveLocal();
        this._dbSave(() => SupabaseService.removeFolder(folderId));
        this._emit('foldersUpdated');
        this._emit('commentsUpdated');
    }

    moveCommentToFolder(commentId, folderId) {
        const comment = this.state.comments.find(c => c.id === commentId);
        if (!comment) return;
        comment.folderId = folderId;
        this._saveLocal();
        this._dbSave(() => SupabaseService.updateCommentFolder(commentId, folderId));
        this._emit('commentsUpdated');
        this._emit('foldersUpdated');
    }

    // ─── Tasks ──────────────────────────────────────────────────
    toggleTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this._saveLocal();
            this._dbSave(() => SupabaseService.updateTask(taskId, { completed: task.completed }));
            this._emit('tasksUpdated');
        }
    }

    updateTaskAssignee(taskId, assignee) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
            task.assignee = assignee;
            // Also update comment assignee
            const comment = this.state.comments.find(c => c.id === task.commentId);
            if (comment) comment.assignee = assignee;

            this._saveLocal();
            this._dbSave(() => SupabaseService.updateTask(taskId, { assignee }));

            this._emit('tasksUpdated');
            this._emit('commentsUpdated');
        }
    }

    // ─── Team Members ──────────────────────────────────────────
    addTeamMember(name, email, avatar, webhookUrl) {
        const member = {
            id: this._generateId(),
            name,
            email,
            avatar: avatar || '',
            webhookUrl: webhookUrl || '',
            initials: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        };
        this.state.teamMembers.push(member);
        this._saveLocal();
        this._dbSave(() => SupabaseService.addTeamMember(member));
        this._emit('teamUpdated');
        return member;
    }

    updateTeamMember(memberId, updates) {
        const member = this.state.teamMembers.find(m => m.id === memberId);
        if (member) {
            if (updates.name !== undefined) {
                member.name = updates.name;
                member.initials = updates.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            }
            if (updates.email !== undefined) member.email = updates.email;
            if (updates.avatar !== undefined) member.avatar = updates.avatar;
            if (updates.webhookUrl !== undefined) member.webhookUrl = updates.webhookUrl;

            this._saveLocal();
            this._dbSave(() => SupabaseService.updateTeamMember(memberId, updates));
            this._emit('teamUpdated');
        }
    }

    removeTeamMember(memberId) {
        this.state.teamMembers = this.state.teamMembers.filter(m => m.id !== memberId);
        this._saveLocal();
        this._dbSave(() => SupabaseService.removeTeamMember(memberId));
        this._emit('teamUpdated');
    }

    getTeamMemberById(id) {
        return this.state.teamMembers.find(m => m.id === id);
    }

    // ─── Webhook ────────────────────────────────────────────────
    setGlobalWebhookUrl(url) {
        this.state.globalWebhookUrl = url;
        this._saveLocal();
        this._dbSave(() => SupabaseService.setSetting('globalWebhookUrl', url));
        this._emit('globalWebhookChanged');
    }

    /**
     * Get the appropriate webhook URL for a comment.
     * Priority: assignee's personal webhook > global webhook
     */
    getWebhookUrlForComment(comment) {
        if (comment.assignee) {
            const member = this.getTeamMemberById(comment.assignee);
            if (member && member.webhookUrl) {
                return member.webhookUrl;
            }
        }
        return this.state.globalWebhookUrl || '';
    }

    // ─── Pub/Sub ────────────────────────────────────────────────
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }

    // ─── Persistence ───────────────────────────────────────────

    /** Save to Supabase (fire and forget with error logging) */
    _dbSave(fn) {
        if (this.dbReady && SupabaseService.isAvailable) {
            fn().catch(err => console.warn('☁️ Supabase sync error:', err.message));
        }
    }

    /** Save to localStorage (always, as cache/fallback) */
    _saveLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    /** Load from localStorage (used as initial state before Supabase loads) */
    _loadLocalState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    comments: parsed.comments || [],
                    tasks: parsed.tasks || [],
                    teamMembers: (parsed.teamMembers || []).map(m => ({
                        ...m,
                        avatar: m.avatar || '',
                        webhookUrl: m.webhookUrl || ''
                    })),
                    folders: parsed.folders || [],
                    currentUrl: parsed.currentUrl || '',
                    mode: parsed.mode || 'browse',
                    globalWebhookUrl: parsed.globalWebhookUrl || ''
                };
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
        return {
            comments: [],
            tasks: [],
            teamMembers: [],
            folders: [],
            currentUrl: '',
            mode: 'browse',
            globalWebhookUrl: ''
        };
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ─── Clear all data ────────────────────────────────────────
    clearAll() {
        this.state = {
            comments: [],
            tasks: [],
            teamMembers: [],
            folders: [],
            currentUrl: '',
            mode: 'browse',
            globalWebhookUrl: ''
        };
        this._saveLocal();
        this._emit('commentsUpdated');
        this._emit('tasksUpdated');
        this._emit('foldersUpdated');
        this._emit('countsChanged');
    }
}

// Singleton
export const store = new AppStore();
