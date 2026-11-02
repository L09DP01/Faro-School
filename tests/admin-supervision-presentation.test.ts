import assert from 'node:assert/strict';
import { formatAiDailyCost, conversationStatusLabel } from '../src/lib/admin/supervision-presentation';

for (const locale of ['fr', 'ht']) {
  const actual = formatAiDailyCost(0.00007042857142857, locale);
  assert(actual.startsWith('< '));
  assert(actual.includes('USD'));
  assert(!actual.includes('428571'));
  assert(!formatAiDailyCost(0.123456789, locale).includes('56789'));
  assert.equal(formatAiDailyCost(NaN, locale), '—');
  assert.equal(formatAiDailyCost(-1, locale), '—');
  assert(!formatAiDailyCost(0, locale).startsWith('<'));
  for (const status of ['open','ai_handling','waiting_staff','staff_replied','closed'] as const) {
    assert.notEqual(conversationStatusLabel(status, locale), status);
  }
}
assert.equal(conversationStatusLabel('waiting_staff', 'fr'), 'En attente d’un intervenant');
assert.equal(conversationStatusLabel('closed', 'ht'), 'Fèmen');
console.log('PASS supervision presentation: tiny costs bounded without false zero, invalid values unavailable, all conversation states translated FR/KR.');
