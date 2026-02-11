// ═══════════════════════════════════════════════════════════════
// AppStore — Central state management with pub/sub
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'markup-comments-data';

class AppStore {
    constructor() {
        this.listeners = new Map();
        this.state = this._loadState();
    }

    // ─── State Access ───────────────────────────────────────────
    get comments() { return this.state.comments; }
    get tasks() { return this.state.tasks; }
    get teamMembers() { return this.state.teamMembers; }
    get currentUrl() { return this.state.currentUrl; }
    get mode() { return this.state.mode; }
    get globalWebhookUrl() { return this.state.globalWebhookUrl; }

    // ─── URL ────────────────────────────────────────────────────
    setCurrentUrl(url) {
        this.state.currentUrl = url;
        this._save();
        this._emit('urlChanged', url);
    }

    // ─── Mode ───────────────────────────────────────────────────
    setMode(mode) {
        this.state.mode = mode;
        this._save();
        this._emit('modeChanged', mode);
    }

    // ─── Comments ───────────────────────────────────────────────
    addComment(comment) {
        const newComment = {
            id: this._generateId(),
            number: this.state.comments.length + 1,
            text: comment.text,
            x: comment.x,
            y: comment.y,
            pageUrl: this.state.currentUrl,
            assignee: comment.assignee || '',
            priority: comment.priority || 'medium',
            webhookEnabled: comment.webhookEnabled || false,
            webhookUrl: comment.webhookUrl || '',
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

        this._save();
        this._emit('commentAdded', newComment);
        this._emit('taskAdded', newTask);
        this._emit('countsChanged');

        return newComment;
    }

    removeComment(commentId) {
        this.state.comments = this.state.comments.filter(c => c.id !== commentId);
        this.state.tasks = this.state.tasks.filter(t => t.commentId !== commentId);

        // Renumber remaining comments
        this.state.comments.forEach((c, i) => c.number = i + 1);

        this._save();
        this._emit('commentsUpdated');
        this._emit('tasksUpdated');
        this._emit('countsChanged');
    }

    getCommentById(id) {
        return this.state.comments.find(c => c.id === id);
    }

    // ─── Tasks ──────────────────────────────────────────────────
    toggleTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this._save();
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
            this._save();
            this._emit('tasksUpdated');
            this._emit('commentsUpdated');
        }
    }

    // ─── Team Members ──────────────────────────────────────────
    addTeamMember(name, email) {
        const member = {
            id: this._generateId(),
            name,
            email,
            initials: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        };
        this.state.teamMembers.push(member);
        this._save();
        this._emit('teamUpdated');
        return member;
    }

    removeTeamMember(memberId) {
        this.state.teamMembers = this.state.teamMembers.filter(m => m.id !== memberId);
        this._save();
        this._emit('teamUpdated');
    }

    // ─── Webhook ────────────────────────────────────────────────
    setGlobalWebhookUrl(url) {
        this.state.globalWebhookUrl = url;
        this._save();
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
    _loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    comments: parsed.comments || [],
                    tasks: parsed.tasks || [],
                    teamMembers: parsed.teamMembers || [],
                    currentUrl: parsed.currentUrl || '',
                    mode: parsed.mode || 'browse',
                    globalWebhookUrl: parsed.globalWebhookUrl || ''
                };
            }
        } catch (e) {
            console.warn('Failed to load state from localStorage:', e);
        }
        return {
            comments: [],
            tasks: [],
            teamMembers: [],
            currentUrl: '',
            mode: 'browse',
            globalWebhookUrl: ''
        };
    }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ─── Clear all data ────────────────────────────────────────
    clearAll() {
        this.state = {
            comments: [],
            tasks: [],
            teamMembers: this.state.teamMembers,
            currentUrl: '',
            mode: 'browse',
            globalWebhookUrl: this.state.globalWebhookUrl
        };
        this._save();
        this._emit('commentsUpdated');
        this._emit('tasksUpdated');
        this._emit('countsChanged');
    }
}

// Singleton
export const store = new AppStore();
