// ═══════════════════════════════════════════════════════════════
// SupabaseService — Cloud database for persistence (multi-user)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials missing. Using localStorage fallback.');
}

const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export class SupabaseService {

    static get isAvailable() {
        return supabase !== null;
    }

    /** Get current user ID from Supabase Auth session */
    static async _getUserId() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        return user.id;
    }

    // ─── Team Members ─────────────────────────────────────────
    static async getTeamMembers() {
        // RLS auto-filters by user_id
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(this._mapMemberFromDb);
    }

    static async addTeamMember(member) {
        const userId = await this._getUserId();
        const { data, error } = await supabase
            .from('team_members')
            .insert({ ...this._mapMemberToDb(member), user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return this._mapMemberFromDb(data);
    }

    static async updateTeamMember(id, updates) {
        const dbUpdates = {};
        if (updates.name !== undefined) {
            dbUpdates.name = updates.name;
            dbUpdates.initials = updates.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        }
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
        if (updates.webhookUrl !== undefined) dbUpdates.webhook_url = updates.webhookUrl;

        const { error } = await supabase
            .from('team_members')
            .update(dbUpdates)
            .eq('id', id);
        if (error) throw error;
    }

    static async removeTeamMember(id) {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ─── Comments ─────────────────────────────────────────────
    static async getComments() {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .order('number', { ascending: true });
        if (error) throw error;
        return (data || []).map(this._mapCommentFromDb);
    }

    static async addComment(comment) {
        const userId = await this._getUserId();
        const { data, error } = await supabase
            .from('comments')
            .insert({ ...this._mapCommentToDb(comment), user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return this._mapCommentFromDb(data);
    }

    static async removeComment(id) {
        await supabase.from('tasks').delete().eq('comment_id', id);
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ─── Tasks ────────────────────────────────────────────────
    static async getTasks() {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(this._mapTaskFromDb);
    }

    static async addTask(task) {
        const userId = await this._getUserId();
        const { data, error } = await supabase
            .from('tasks')
            .insert({ ...this._mapTaskToDb(task), user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return this._mapTaskFromDb(data);
    }

    static async updateTask(id, updates) {
        const dbUpdates = {};
        if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
        if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;

        const { error } = await supabase
            .from('tasks')
            .update(dbUpdates)
            .eq('id', id);
        if (error) throw error;
    }

    // ─── Settings ─────────────────────────────────────────────
    static async getSetting(key) {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();
        if (error) throw error;
        return data ? data.value : '';
    }

    static async setSetting(key, value) {
        const userId = await this._getUserId();
        const { error } = await supabase
            .from('settings')
            .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
        if (error) throw error;
    }

    // ─── Folders ───────────────────────────────────────────────
    static async getFolders() {
        const { data, error } = await supabase
            .from('folders')
            .select('*')
            .order('position', { ascending: true });
        if (error) throw error;
        return (data || []).map(this._mapFolderFromDb);
    }

    static async addFolder(folder) {
        const userId = await this._getUserId();
        const { data, error } = await supabase
            .from('folders')
            .insert({ ...this._mapFolderToDb(folder), user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return this._mapFolderFromDb(data);
    }

    static async updateFolder(id, updates) {
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.position !== undefined) dbUpdates.position = updates.position;

        const { error } = await supabase
            .from('folders')
            .update(dbUpdates)
            .eq('id', id);
        if (error) throw error;
    }

    static async removeFolder(id) {
        // Unassign comments from this folder
        await supabase.from('comments').update({ folder_id: null }).eq('folder_id', id);
        const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    static async updateCommentFolder(commentId, folderId) {
        const { error } = await supabase
            .from('comments')
            .update({ folder_id: folderId })
            .eq('id', commentId);
        if (error) throw error;
    }

    // ─── Data Mappers (DB ↔ JS) ──────────────────────────────

    static _mapMemberFromDb(row) {
        return {
            id: row.id,
            name: row.name,
            email: row.email || '',
            avatar: row.avatar || '',
            webhookUrl: row.webhook_url || '',
            initials: row.initials || ''
        };
    }

    static _mapMemberToDb(member) {
        return {
            id: member.id,
            name: member.name,
            email: member.email || '',
            avatar: member.avatar || '',
            webhook_url: member.webhookUrl || '',
            initials: member.initials || ''
        };
    }

    static _mapCommentFromDb(row) {
        return {
            id: row.id,
            number: row.number,
            text: row.text,
            pageUrl: row.page_url || '',
            x: row.x,
            y: row.y,
            assignee: row.assignee || '',
            priority: row.priority || 'medium',
            tags: row.tags ? JSON.parse(row.tags) : [],
            folderId: row.folder_id || null,
            createdAt: row.created_at
        };
    }

    static _mapCommentToDb(comment) {
        return {
            id: comment.id,
            number: comment.number,
            text: comment.text,
            page_url: comment.pageUrl || '',
            x: comment.x,
            y: comment.y,
            assignee: comment.assignee || null,
            priority: comment.priority || 'medium',
            tags: JSON.stringify(comment.tags || []),
            folder_id: comment.folderId || null,
            created_at: comment.createdAt
        };
    }

    static _mapFolderFromDb(row) {
        return {
            id: row.id,
            name: row.name,
            color: row.color || '#6C5CE7',
            position: row.position || 0
        };
    }

    static _mapFolderToDb(folder) {
        return {
            id: folder.id,
            name: folder.name,
            color: folder.color || '#6C5CE7',
            position: folder.position || 0
        };
    }

    static _mapTaskFromDb(row) {
        return {
            id: row.id,
            commentId: row.comment_id,
            text: row.text,
            assignee: row.assignee || '',
            priority: row.priority || 'medium',
            completed: row.completed || false,
            createdAt: row.created_at
        };
    }

    static _mapTaskToDb(task) {
        return {
            id: task.id,
            comment_id: task.commentId,
            text: task.text,
            assignee: task.assignee || null,
            priority: task.priority || 'medium',
            completed: task.completed || false,
            created_at: task.createdAt
        };
    }
}
