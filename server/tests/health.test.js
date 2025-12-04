import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Basic sanity check so CI has at least one backend test.
describe('healthcheck', () => {
  it('confirms test runner executes', () => {
    assert.strictEqual(true, true);
  });
});
