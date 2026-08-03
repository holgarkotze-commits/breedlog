import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSeedingAllowed,
  SeedGuardError,
  SIMULATION_ACCESS_CODES,
} from '../shared/simulation-seed-guard';
import { MASTER_SIMULATION_ACCESS_CODE } from '../shared/master-simulation';

const devEnv = { NODE_ENV: 'development' };

test('refuses to seed when NODE_ENV=production', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE }, { NODE_ENV: 'production' }),
    SeedGuardError,
  );
});

test('refuses to seed in a Replit deployment environment', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE }, { NODE_ENV: 'development', REPLIT_DEPLOYMENT: '1' }),
    SeedGuardError,
  );
});

test('refuses real farmer access codes', () => {
  assert.throws(
    () => assertSeedingAllowed({ accessCode: 'FARMCODE' }, devEnv),
    /not a dedicated simulation access code/,
  );
});

test('allows the dedicated simulation access code in development', () => {
  assert.doesNotThrow(() => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE }, devEnv));
  assert.doesNotThrow(() => assertSeedingAllowed({ accessCode: MASTER_SIMULATION_ACCESS_CODE.toLowerCase() }, devEnv));
});

test('refuses raw user-id targets without explicit override', () => {
  assert.throws(
    () => assertSeedingAllowed({ userId: 'some-user-id' }, devEnv),
    /cannot be verified as a simulation workspace/,
  );
  assert.doesNotThrow(() => assertSeedingAllowed({ userId: 'some-user-id', rawTargetOverride: true }, devEnv));
});

test('refuses when no target given', () => {
  assert.throws(() => assertSeedingAllowed({}, devEnv), SeedGuardError);
});

test('master simulation code is registered as a simulation code', () => {
  assert.ok(SIMULATION_ACCESS_CODES.includes(MASTER_SIMULATION_ACCESS_CODE));
});
