// ═══════════════════════════════════════════════════════════════
// ProxyService — Load webpages through the server proxy
// ═══════════════════════════════════════════════════════════════

export class ProxyService {
    /**
     * Get the proxy URL for loading a page in the iframe
     */
    static getProxyUrl(targetUrl) {
        return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    }

    /**
     * Validate and normalize a URL
     */
    static normalizeUrl(url) {
        let normalized = url.trim();
        if (!normalized) return null;

        // Add protocol if missing
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }

        try {
            new URL(normalized);
            return normalized;
        } catch {
            return null;
        }
    }

    /**
     * Check if the proxy can load the URL
     */
    static async testUrl(url) {
        try {
            const response = await fetch(this.getProxyUrl(url), { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }
}
