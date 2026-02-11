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

    // Parse domain for referer/origin
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        // Full browser-like headers to avoid 403 blocks
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'identity',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Referer': parsedUrl.origin + '/',
                'DNT': '1'
            },
            redirect: 'follow'
        });

        let html = await response.text();

        // If we got an error page (403, 5xx etc), show a friendly error
        if (!response.ok) {
            html = generateErrorPage(targetUrl, response.status, response.statusText);
        }

        // Inject a <base> tag so relative URLs resolve correctly
        const baseTag = `<base href="${targetUrl}" target="_self">`;
        const headRegex = /<head(\s[^>]*)?>/i;
        if (headRegex.test(html)) {
            html = html.replace(headRegex, `$&${baseTag}`);
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
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${navBlockScript}</body>`);
        } else if (html.includes('</BODY>')) {
            html = html.replace('</BODY>', `${navBlockScript}</BODY>`);
        } else {
            html += navBlockScript;
        }

        // Set headers: remove iframe blockers
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('X-Frame-Options', 'ALLOWALL');
        res.removeHeader('Content-Security-Policy');
        res.send(html);
    } catch (err) {
        console.error('Proxy error:', err.message);
        const errorHtml = generateErrorPage(targetUrl, 0, err.message);
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(errorHtml);
    }
});

// Generate a user-friendly error page
function generateErrorPage(url, status, message) {
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Errore caricamento</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #FAFAFA; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #1A1A2E; }
        .error-card { text-align: center; max-width: 480px; padding: 48px 32px; }
        .error-icon { width: 64px; height: 64px; background: #FEF2F2; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
        .error-icon svg { color: #EF4444; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .error-status { display: inline-block; background: #FEF2F2; color: #DC2626; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        p { color: #6B7280; font-size: 14px; line-height: 1.6; }
        .error-url { display: block; margin-top: 16px; padding: 12px; background: #F5F5F5; border-radius: 8px; font-size: 13px; color: #9CA3AF; word-break: break-all; }
        .tips { text-align: left; margin-top: 24px; padding: 16px; background: #F0EDFF; border-radius: 12px; }
        .tips h3 { font-size: 13px; color: #6C5CE7; margin-bottom: 8px; }
        .tips ul { list-style: none; font-size: 13px; color: #6B7280; }
        .tips li { padding: 4px 0; padding-left: 16px; position: relative; }
        .tips li::before { content: '→'; position: absolute; left: 0; color: #6C5CE7; }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        </div>
        ${status ? `<span class="error-status">Errore ${status}</span>` : ''}
        <h1>Impossibile caricare la pagina</h1>
        <p>${message || 'Il sito potrebbe bloccare l\'accesso esterno o non essere raggiungibile.'}</p>
        <code class="error-url">${url}</code>
        <div class="tips">
            <h3>Suggerimenti</h3>
            <ul>
                <li>Verifica che l'URL sia corretto</li>
                <li>Alcuni siti bloccano l'accesso da proxy (es. Cloudflare)</li>
                <li>Prova con un sito diverso, ad es. https://example.com</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
}

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

        if (!response.ok) {
            return res.status(502).json({
                success: false,
                status: response.status,
                error: `Webhook target returned ${response.status}: ${responseText}`
            });
        }

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
