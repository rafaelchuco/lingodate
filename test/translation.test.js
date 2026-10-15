import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../translation.js';

test('LibreTranslate adapter follows the text API contract', async () => {
  let request;
  const translator = createTranslator({ endpoint: 'https://translate.example/translate', apiKey: 'server-secret', fetcher: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ translatedText: 'Cześć!' }) }; } });
  assert.equal(await translator.translate('¡Hola!', 'Español', 'Polaco'), 'Cześć!');
  assert.equal(String(request.url), 'https://translate.example/translate');
  assert.deepEqual(JSON.parse(request.options.body), { q: '¡Hola!', source: 'es', target: 'pl', format: 'text', api_key: 'server-secret' });
  assert.equal(request.options.redirect, 'error');
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.equal(await translator.translate('¡Hola!', 'Español', 'Español'), null);
});

test('translation is off without a provider, and malformed provider output is rejected', async () => {
  const disabled = createTranslator({ endpoint: '' });
  assert.equal(disabled.enabled, false);
  assert.equal(await disabled.translate('Hola', 'Español', 'Inglés'), null);
  assert.throws(() => createTranslator({ endpoint: 'file:///etc/passwd' }));
  const malformed = createTranslator({ endpoint: 'https://translate.example/translate', fetcher: async () => ({ ok: true, json: async () => ({ translatedText: ['unexpected'] }) }) });
  await assert.rejects(() => malformed.translate('Hola', 'Español', 'Inglés'));
  const failed = createTranslator({ endpoint: 'https://translate.example/translate', fetcher: async () => ({ ok: false }) });
  await assert.rejects(() => failed.translate('Hola', 'Español', 'Inglés'));
});

test('OpenAI adapter requests structured phonetics without exposing or storing credentials in output', async () => {
  const { createAiTranslator } = await import('../translation.js');
  let request;
  const adapter = createAiTranslator({ apiKey: 'test-only-key', fetcher: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ translatedText: 'Hola', pronunciation: 'Jelóu' }) }] }] }) };
  } });
  assert.deepEqual(await adapter.analyze('Hello', 'Inglés', 'Español'), { translatedText: 'Hola', pronunciation: 'Jelóu' });
  const input = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(input.store, false); assert.equal(input.text.format.strict, true);
  assert.equal(input.text.format.schema.additionalProperties, false);
  assert.equal(JSON.parse(input.input).text, 'Hello');
  assert.throws(() => createAiTranslator({ apiKey: '' }));
  const refusing = createAiTranslator({ apiKey: 'test-only-key', fetcher: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }) });
  await assert.rejects(() => refusing.analyze('Hello', 'Inglés', 'Español'));
});
