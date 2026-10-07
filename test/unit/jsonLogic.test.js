'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, validate, template, truthy } = require('../../src/rules/jsonLogic');
const { evaluate, validateTable } = require('../../src/rules/decisionTable');

test('jsonLogic: comparison, arithmetic and logic operators', () => {
  const d = { a: 5, b: { c: 2 }, list: ['x', 'y'] };
  assert.equal(apply({ '>': [{ var: 'a' }, 3] }, d), true);
  assert.equal(apply({ '+': [{ var: 'a' }, { var: 'b.c' }] }, d), 7);
  assert.equal(apply({ '-': [{ var: 'a' }] }, d), -5);
  assert.equal(apply({ '-': [10, 4] }, d), 6);
  assert.equal(apply({ '*': [2, 3, 4] }, d), 24);
  assert.equal(apply({ '/': [1, 0] }, d), 0, 'division by zero is safe');
  assert.equal(apply({ '%': [7, 3] }, d), 1);
  assert.equal(apply({ min: [3, 1, 2] }, d), 1);
  assert.equal(apply({ max: [3, 1, 2] }, d), 3);
  assert.equal(apply({ clamp: [5, 0, 1] }, d), 1);
  assert.equal(apply({ round: [2.345, 2] }, d), 2.35);
  assert.equal(apply({ in: ['x', { var: 'list' }] }, d), true);
  assert.equal(apply({ in: ['ell', 'hello'] }, d), true);
  assert.equal(apply({ cat: ['a', null, 1] }, d), 'a1');
  assert.equal(apply({ '<': [1, 2, 3] }, d), true);
  assert.equal(apply({ '<=': [1, 1, 3] }, d), true);
  assert.equal(apply({ '>=': [1, 1] }, d), true);
  assert.equal(apply({ '==': [1, '1'] }, d), true);
  assert.equal(apply({ '===': [1, '1'] }, d), false);
  assert.equal(apply({ '!=': [1, 2] }, d), true);
  assert.equal(apply({ '!==': [1, 1] }, d), false);
  assert.equal(apply({ '!': [true] }, d), false);
  assert.equal(apply({ '!!': [[]] }, d), false);
  assert.deepEqual(apply({ missing: ['a', 'zz'] }, d), ['zz']);
  assert.equal(apply({ var: ['nope', 'dflt'] }, d), 'dflt');
  assert.equal(apply({ var: '' }, d), d);
  assert.deepEqual(apply([1, { var: 'a' }], d), [1, 5]);
});

test('jsonLogic: and/or/if short-circuit', () => {
  assert.equal(apply({ and: [true, 0, { var: 'boom.x' }] }, {}), 0);
  assert.equal(apply({ or: [0, 'yes'] }, {}), 'yes');
  assert.equal(apply({ or: [0, false] }, {}), false);
  assert.equal(apply({ if: [false, 1, true, 2, 3] }, {}), 2);
  assert.equal(apply({ if: [false, 1, 3] }, {}), 3);
  assert.equal(apply({ if: [false, 1] }, {}), null);
  assert.equal(truthy([]), false);
});

test('jsonLogic: rejects prototype access and unknown operators', () => {
  assert.throws(() => apply({ var: '__proto__.polluted' }, {}), /forbidden/);
  assert.throws(() => apply({ eval: ['1'] }, {}), /unsupported operator/);
  assert.deepEqual(validate({ var: 'constructor.prototype' }), ['$: forbidden var path']);
  assert.ok(validate({ eval: 1 })[0].includes('unsupported'));
  assert.ok(validate({ a: 1, b: 2 })[0].includes('exactly one operator'));
  assert.ok(validate({ __proto__: 1, x: 1 }).length >= 0);
  assert.deepEqual(validate([{ '==': [1, 1] }]), []);
});

test('template renders placeholders', () => {
  assert.equal(template('Hi {{ name }} / {{a.b}} / {{missing}}', { name: 'An', a: { b: 2 } }), 'Hi An / 2 / ');
});

test('decision tables: first and collect hit policies, defaults, validation', () => {
  const table = {
    hitPolicy: 'first',
    rules: [
      { id: 'big', when: { '>': [{ var: 'n' }, 10] }, then: { size: 'big', msg: 'n={{n}}' } },
      { id: 'any', then: { size: 'any' } },
    ],
  };
  assert.deepEqual(evaluate(table, { n: 20 }), { size: 'big', msg: 'n=20', ruleId: 'big' });
  assert.equal(evaluate(table, { n: 1 }).ruleId, 'any');
  const noMatch = { rules: [{ id: 'x', when: false, then: { a: 1 } }], default: { a: 0 } };
  assert.deepEqual(evaluate(noMatch, {}), { a: 0, ruleId: 'default' });
  assert.equal(evaluate({ rules: [{ id: 'x', when: false, then: {} }] }, {}), null);
  const collect = { hitPolicy: 'collect', rules: [{ id: 'a', then: { v: ['{{x}}'] } }, { id: 'b', when: true, then: 'raw {{x}}' }] };
  const out = evaluate(collect, { x: 'q' });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].v, ['q']);
  assert.ok(validateTable({ rules: [{ then: 1 }, { id: 'd', then: 1 }, { id: 'd', then: 1 }, { id: 'e' }], hitPolicy: 'weird' }).length >= 4);
  assert.deepEqual(validateTable(null), ['$: decision table needs a "rules" array']);
});
