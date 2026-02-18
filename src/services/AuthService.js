// ═══════════════════════════════════════════════════════════════
// AuthService — Supabase Auth wrapper
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export class AuthService {

    static get isAvailable() {
        return supabase !== null;
    }

    /**
     * Sign up with email and password
     */
    static async signUp(email, password) {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    /**
     * Sign in with email and password
     */
    static async signIn(email, password) {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    /**
     * Sign out the current user
     */
    static async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    /**
     * Get the current authenticated user
     */
    static async getUser() {
        if (!supabase) return null;
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    /**
     * Get the current session
     */
    static async getSession() {
        if (!supabase) return null;
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    }

    /**
     * Listen for auth state changes (login, logout, token refresh)
     */
    static onAuthStateChange(callback) {
        if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }

    /**
     * Get user ID (shortcut)
     */
    static async getUserId() {
        const user = await this.getUser();
        return user?.id || null;
    }
}
