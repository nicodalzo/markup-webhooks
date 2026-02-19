// ═══════════════════════════════════════════════════════════════
// Netlify Function — Stripe Checkout Session
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { packageId, userId, userEmail } = JSON.parse(event.body);

        if (!packageId || !userId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing packageId or userId' }) };
        }

        // Initialize Supabase with service key (bypasses RLS)
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get Stripe secret key from app_config
        const { data: configData } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'stripe_secret_key')
            .single();

        const stripeKey = configData?.value;
        if (!stripeKey) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Stripe not configured' }) };
        }

        // Get the selected package
        const { data: pkg } = await supabase
            .from('credit_packages')
            .select('*')
            .eq('id', packageId)
            .eq('active', true)
            .single();

        if (!pkg) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Package not found' }) };
        }

        // Import Stripe dynamically
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey);

        // Determine the origin for redirect URLs
        const origin = event.headers.origin || event.headers.referer?.replace(/\/$/, '') || 'https://markup-app.netlify.app';

        // Create Checkout Session in embedded mode
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: userEmail || undefined,
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: pkg.label,
                        description: `${pkg.credits} crediti extra per Markup Comments`,
                    },
                    unit_amount: pkg.price_cents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            ui_mode: 'embedded',
            return_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                user_id: userId,
                credits: pkg.credits.toString(),
                package_id: packageId,
            },
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ clientSecret: session.client_secret }),
        };
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create checkout session', details: err.message }),
        };
    }
};
