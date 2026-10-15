// LibreTranslate-compatible server adapter. No message leaves the server unless configured.
export function createTranslator({ endpoint = process.env.TRANSLATE_URL, apiKey = process.env.TRANSLATE_API_KEY, fetcher = fetch } = {}) {
  const codes = { Español: 'es', Inglés: 'en', Polaco: 'pl', Portugués: 'pt', Francés: 'fr', Japonés: 'ja' };
  if (!endpoint) return { enabled: false, host: null, translate: async () => null };
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('TRANSLATE_URL debe ser una URL HTTP(S) sin credenciales.');
  return {
    enabled: true,
    host: url.host,
    async translate(text, source, target) {
      if (!codes[source] || !codes[target] || source === target) return null;
      const response = await fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: codes[source], target: codes[target], format: 'text', ...(apiKey ? { api_key: apiKey } : {}) }),
        signal: AbortSignal.timeout(8000),
        redirect: 'error'
      });
      if (!response.ok) throw new Error('El proveedor no pudo traducir.');
      const payload = await response.json();
      if (typeof payload.translatedText !== 'string' || !payload.translatedText.trim() || payload.translatedText.length > 10000) throw new Error('Respuesta de traducción no válida.');
      return payload.translatedText.trim();
    }
  };
}
