// ═══════════════════════════════════════════════════════════════
// Netlify Function — Stripe Webhook Handler
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get webhook secret from app_config
        const { data: configData } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'stripe_webhook_secret')
            .single();

        const webhookSecret = configData?.value;

        // Import Stripe
        const Stripe = (await import('stripe')).default;

        // Get Stripe key for verification
        const { data: keyData } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'stripe_secret_key')
            .single();

        const stripe = new Stripe(keyData?.value || '');

        let stripeEvent;

        // Verify webhook signature if secret is configured
        if (webhookSecret) {
            const sig = event.headers['stripe-signature'];
            try {
                stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return { statusCode: 400, body: `Webhook Error: ${err.message}` };
            }
        } else {
            // No webhook secret configured — parse directly (dev mode)
            stripeEvent = JSON.parse(event.body);
        }

        // Handle checkout.session.completed
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            const userId = session.metadata?.user_id;
            const credits = parseInt(session.metadata?.credits || '0', 10);

            if (userId && credits > 0) {
                // Add credits_extra to the user profile
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('credits_extra')
                    .eq('user_id', userId)
                    .single();

                if (profile) {
                    await supabase
                        .from('user_profiles')
                        .update({ credits_extra: (profile.credits_extra || 0) + credits })
                        .eq('user_id', userId);

                    console.log(`Added ${credits} credits to user ${userId}`);
                }
            }
        }

        return { statusCode: 200, body: JSON.stringify({ received: true }) };
    } catch (err) {
        console.error('Webhook handler error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
