const test = require('node:test');
const assert = require('node:assert/strict');
const { canTransition } = require('../src/constants');

test('valid forward transitions', () => {
  assert.ok(canTransition('Pending', 'Assigned'));
  assert.ok(canTransition('Assigned', 'In Progress'));
  assert.ok(canTransition('In Progress', 'Completed'));
});

test('cancel allowed from open states only', () => {
  for (const s of ['Pending', 'Assigned', 'In Progress']) assert.ok(canTransition(s, 'Cancelled'));
  assert.ok(!canTransition('Completed', 'Cancelled'));
});

test('completed / cancelled are final, no going back', () => {
  assert.ok(!canTransition('Completed', 'Pending'));
  assert.ok(!canTransition('Completed', 'In Progress'));
  assert.ok(!canTransition('Cancelled', 'Pending'));
  assert.ok(!canTransition('Pending', 'Completed'));
});
