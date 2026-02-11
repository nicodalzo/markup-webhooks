// ═══════════════════════════════════════════════════════════════
// Netlify Function — Webhook forwarder
// ═══════════════════════════════════════════════════════════════

export const handler = async (event) => {
    // Only accept POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON body' })
        };
    }

    const { webhookUrl, payload } = body;

    if (!webhookUrl || !payload) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing webhookUrl or payload' })
        };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        const isSuccess = response.ok; // true only for 2xx

        return {
            statusCode: isSuccess ? 200 : 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: isSuccess,
                status: response.status,
                response: responseText,
                error: isSuccess ? undefined : `Webhook target returned ${response.status}: ${responseText}`
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to send webhook',
                details: err.message
            })
        };
    }
};
