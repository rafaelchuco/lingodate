import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDateProposal } from '../public/demo-profiles.js';

test('date invitation keeps duration and time zone explicit and is only a draft', () => {
  const result = buildDateProposal({ type: 'music', duration: '60', date: '2099-06-12', time: '18:30' }, { name: 'Lisa' });
  assert.match(result.text, /Lisa, ¿te animas a un encuentro virtual de 60 minutos/);
  assert.ok(result.text.includes(Intl.DateTimeFormat().resolvedOptions().timeZone));
  assert.match(result.text, /acordamos aquí el horario y el medio/);
  assert.equal(result.title, 'Nuestra primera playlist');
});

test('date invitation rejects past dates, invalid types, duration and malformed input', () => {
  const valid = { type: 'coffee', duration: '30', date: '2099-06-12', time: '18:30' };
  for (const invalid of [{ type: 'unknown' }, { duration: '999' }, { date: '2000-01-01' }, { date: '' }, { time: 'tomorrow' }]) {
    assert.throws(() => buildDateProposal({ ...valid, ...invalid }, { name: 'Emma' }));
  }
});
