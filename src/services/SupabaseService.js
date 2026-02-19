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

    // ─── User Profiles (Credits & Admin) ──────────────────────

    static async getUserProfile() {
        const userId = await this._getUserId();
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;
        return this._mapProfileFromDb(data);
    }

    static async getAllProfiles() {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*, auth_email:user_id')
            .order('created_at', { ascending: true });
        if (error) throw error;
        // We need emails — fetch them from auth.users via a join
        // Since RLS on user_profiles allows master to read all,
        // we fetch profiles and resolve emails separately
        return (data || []).map(row => this._mapProfileFromDb(row));
    }

    /** Fetch all profiles with emails (master only) */
    static async getAllProfilesWithEmails() {
        // Get profiles
        const { data: profiles, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;

        // Get user emails from auth via the admin-friendly user list
        // Since we can't query auth.users from the client, we'll store email in user_profiles
        // For now, return profiles without emails — the UI will get email from the session
        return (profiles || []).map(row => this._mapProfileFromDb(row));
    }

    static async updateUserProfile(userId, updates) {
        const dbUpdates = {};
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.monthlyLimit !== undefined) dbUpdates.monthly_limit = updates.monthlyLimit;
        if (updates.creditsUsed !== undefined) dbUpdates.credits_used = updates.creditsUsed;
        if (updates.creditsExtra !== undefined) dbUpdates.credits_extra = updates.creditsExtra;
        if (updates.suspended !== undefined) dbUpdates.suspended = updates.suspended;
        if (updates.billingPeriodStart !== undefined) dbUpdates.billing_period_start = updates.billingPeriodStart;

        const { error } = await supabase
            .from('user_profiles')
            .update(dbUpdates)
            .eq('user_id', userId);
        if (error) throw error;
    }

    /** Increment credits_used and auto-reset if new billing period */
    static async incrementCreditsUsed() {
        const profile = await this.getUserProfile();
        if (!profile) return;

        // Auto-reset if billing period expired (30 days)
        const periodStart = new Date(profile.billingPeriodStart);
        const now = new Date();
        const daysDiff = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24));

        if (daysDiff >= 30) {
            await this.updateUserProfile(profile.userId, {
                creditsUsed: 1,
                billingPeriodStart: now.toISOString().split('T')[0],
            });
        } else {
            await this.updateUserProfile(profile.userId, {
                creditsUsed: profile.creditsUsed + 1,
            });
        }
    }

    // ─── Credit Packages ──────────────────────────────────────

    static async getActivePackages() {
        const { data, error } = await supabase
            .from('credit_packages')
            .select('*')
            .eq('active', true)
            .order('position', { ascending: true });
        if (error) throw error;
        return (data || []).map(row => this._mapPackageFromDb(row));
    }

    static async getAllPackages() {
        const { data, error } = await supabase
            .from('credit_packages')
            .select('*')
            .order('position', { ascending: true });
        if (error) throw error;
        return (data || []).map(row => this._mapPackageFromDb(row));
    }

    static async addPackage(pkg) {
        const { error } = await supabase
            .from('credit_packages')
            .insert({
                credits: pkg.credits,
                price_cents: pkg.priceCents,
                label: pkg.label,
                active: pkg.active !== false,
                position: pkg.position || 0,
            });
        if (error) throw error;
    }

    static async updatePackage(id, updates) {
        const dbUpdates = {};
        if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
        if (updates.priceCents !== undefined) dbUpdates.price_cents = updates.priceCents;
        if (updates.label !== undefined) dbUpdates.label = updates.label;
        if (updates.active !== undefined) dbUpdates.active = updates.active;
        if (updates.position !== undefined) dbUpdates.position = updates.position;

        const { error } = await supabase
            .from('credit_packages')
            .update(dbUpdates)
            .eq('id', id);
        if (error) throw error;
    }

    static async removePackage(id) {
        const { error } = await supabase
            .from('credit_packages')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ─── App Config ───────────────────────────────────────────

    static async getAppConfig(key) {
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || '';
    }

    static async setAppConfig(key, value) {
        const { error } = await supabase
            .from('app_config')
            .upsert({ key, value, updated_at: new Date().toISOString() });
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

    static _mapProfileFromDb(row) {
        return {
            userId: row.user_id,
            email: row.email || '',
            role: row.role || 'user',
            monthlyLimit: row.monthly_limit ?? 200,
            creditsUsed: row.credits_used ?? 0,
            creditsExtra: row.credits_extra ?? 0,
            billingPeriodStart: row.billing_period_start,
            suspended: row.suspended ?? false,
            createdAt: row.created_at,
        };
    }

    static _mapPackageFromDb(row) {
        return {
            id: row.id,
            credits: row.credits,
            priceCents: row.price_cents,
            label: row.label,
            active: row.active,
            position: row.position,
        };
    }
}
