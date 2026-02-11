import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from dist if built
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
}

// ─── Proxy endpoint ─────────────────────────────────────────────
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing "url" query parameter' });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            redirect: 'follow'
        });

        let html = await response.text();

        // Inject a <base> tag so relative URLs resolve correctly
        const baseTag = `<base href="${targetUrl}" target="_self">`;
        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${baseTag}`);
        } else if (html.includes('<HEAD>')) {
            html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
        } else {
            html = baseTag + html;
        }

        // Inject script to disable navigation inside iframe
        const navBlockScript = `
      <script>
        // Intercept link clicks to prevent iframe navigation
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link && link.href) {
            e.preventDefault();
            e.stopPropagation();
            // Send message to parent to handle navigation
            window.parent.postMessage({ type: 'navigate', url: link.href }, '*');
          }
        }, true);
      </script>
    `;
        html = html.replace('</body>', `${navBlockScript}</body>`);

        // Set headers: remove iframe blockers
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('X-Frame-Options', 'ALLOWALL');
        res.removeHeader('Content-Security-Policy');
        res.send(html);
    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).json({ error: 'Failed to fetch the URL', details: err.message });
    }
});

// ─── Webhook forwarder ──────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
    const { webhookUrl, payload } = req.body;

    if (!webhookUrl || !payload) {
        return res.status(400).json({ error: 'Missing webhookUrl or payload' });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        res.json({
            success: true,
            status: response.status,
            response: responseText
        });
    } catch (err) {
        console.error('Webhook error:', err.message);
        res.status(500).json({ error: 'Failed to send webhook', details: err.message });
    }
});

// ─── Fallback for SPA ───────────────────────────────────────────
if (existsSync(distPath)) {
    app.get('*', (req, res) => {
        res.sendFile(join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`✨ Markup server running at http://localhost:${PORT}`);
});
