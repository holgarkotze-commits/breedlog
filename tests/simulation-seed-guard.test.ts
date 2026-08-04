import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSeedingAllowed,
  SeedGuardError,
  SIMULATION_ACCESS_CODES,
} from '../shared/simulation-seed-guard';
import { MASTER_SIMULATION_ACCESS_CODE } from '../shared/master-simulation';

const devEnv = { NODE_ENV: 'development' };

test('refuses even dry-runs when NODE_ENV=production', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE, apply: false }, { NODE_ENV: 'production' }),
    SeedGuardError,
  );
});

test('refuses writes in a Replit deployment environment', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE, apply: true }, { NODE_ENV: 'development', REPLIT_DEPLOYMENT: '1' }),
    SeedGuardError,
  );
});

test('dry-runs are allowed for any target in development (read-only)', () => {
  assert.doesNotThrow(() => assertSeedingAllowed({ accessCode: 'ANYCODE99', apply: false }, devEnv));
  assert.doesNotThrow(() => assertSeedingAllowed({ userId: 'some-user-id', apply: false }, devEnv));
});

test('writes with a real farmer access code are refused — no override exists', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: 'FARMCODE', apply: true }, devEnv),
    /not a dedicated simulation access code/,
  );
});

test('writes to raw user ids are always refused', () => {
  assert.throws(
    () => assertSeedingAllowed({ userId: 'some-user-id', apply: true }, devEnv),
    /raw ids cannot be verified/,
  );
});

test('writes with the dedicated simulation access code are allowed in development', () => {
  assert.doesNotThrow(() => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE, apply: true }, devEnv));
  assert.doesNotThrow(() => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE.toLowerCase(), apply: true }, devEnv));
});

test('master simulation code is registered as a simulation code', () => {
  assert.ok(SIMULATION_ACCESS_CODES.includes(MASTER_SIMULATION_ACCESS_CODE));
});
