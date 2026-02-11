// ═══════════════════════════════════════════════════════════════
// WebhookService — Send data to configured webhook URLs
// ═══════════════════════════════════════════════════════════════

export class WebhookService {
    /**
     * Send comment data to a webhook URL via the server proxy
     */
    static async sendWebhook(webhookUrl, comment) {
        const payload = {
            event: 'new_comment',
            timestamp: new Date().toISOString(),
            data: {
                comment_id: comment.id,
                comment_text: comment.text,
                page_url: comment.pageUrl,
                position: {
                    x_percent: comment.x,
                    y_percent: comment.y
                },
                assignee: comment.assignee || null,
                priority: comment.priority,
                created_at: comment.createdAt,
                comment_number: comment.number
            }
        };

        try {
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhookUrl,
                    payload
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Webhook failed');
            }

            return { success: true, result };
        } catch (error) {
            console.error('Webhook error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test a webhook URL with sample data
     */
    static async testWebhook(webhookUrl) {
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: {
                message: 'Test webhook from Markup Comments',
                comment_text: 'Questo è un commento di test',
                page_url: 'https://example.com',
                priority: 'medium'
            }
        };

        try {
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhookUrl,
                    payload: testPayload
                })
            });

            const result = await response.json();
            return { success: response.ok && result.success, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
