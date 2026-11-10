import type pg from "pg";
import type { PaymentOrder, PaymentTransact } from "./paytoday-types";
import { PaymentRejected } from "./paytoday-types";

// Extends the existing SQL/settings architecture. No provider calls inside a
// database transaction. Lock scope is the authenticated workspace, not user input.
export function sqlPaymentTransact(pool: pg.Pool): PaymentTransact {
  return async (workspace, run) => {
    let c: pg.PoolClient;
    try { c = await pool.connect(); } catch { throw new PaymentRejected(); }
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL lock_timeout='5s'");
      await c.query("SET LOCAL statement_timeout='10s'");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["breedlog:annual:" + workspace]);
      const result = await run({
        async getOrder(id) {
          const r = await c.query("SELECT snapshot, state FROM breedlog_payment_orders WHERE id=$1 AND workspace=$2 FOR UPDATE", [id, workspace]);
          return r.rows[0] ? { ...r.rows[0].snapshot, state: r.rows[0].state } : undefined;
        },
        async insertOrder(order) {
          if (order.workspace !== workspace) throw new PaymentRejected();
          const { state, ...snapshot } = order;
          await c.query("INSERT INTO breedlog_payment_orders (id,workspace,snapshot,state) VALUES ($1,$2,$3,$4)",
            [order.id, workspace, JSON.stringify(snapshot), JSON.stringify(state)]);
        },
        async updateOrderState(id, state) {
          const r = await c.query("UPDATE breedlog_payment_orders SET state=$3,payment_hash=$4 WHERE id=$1 AND workspace=$2",
            [id, workspace, JSON.stringify(state), state.paymentHash ?? null]);
          if (r.rowCount !== 1) throw new PaymentRejected();
        },
        async getSetting(key) {
          const r = await c.query("SELECT value FROM system_settings WHERE key=$1", [key]);
          return r.rows[0]?.value;
        },
        async setSetting(key, value) {
          await c.query("INSERT INTO system_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()", [key, value]);
        },
      });
      await c.query("COMMIT");
      return result;
    } catch {
      try { await c.query("ROLLBACK"); } catch { /* Lost connection: safe retry reads durable outcome. */ }
      // PostgreSQL diagnostics can contain tokens/keys/row values: never propagate.
      throw new PaymentRejected();
    } finally { c.release(); }
  };
}

// Test/preview only; same atomic semantics, discarded when the process exits.
export function memoryPaymentTransact(settings: Map<string, string>): PaymentTransact {
  let orders = new Map<string, PaymentOrder>();
  let tail = Promise.resolve();
  return async (workspace, run) => {
    let unlock!: () => void;
    const previous = tail;
    tail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    const staged = structuredClone(orders);
    const writes = new Map<string, string>();
    try {
      const result = await run({
        async getOrder(id) {
          const o = staged.get(id);
          return o?.workspace === workspace ? structuredClone(o) : undefined;
        },
        async insertOrder(o) {
          if (o.workspace !== workspace || staged.has(o.id)) throw new PaymentRejected();
          staged.set(o.id, structuredClone(o));
        },
        async updateOrderState(id, state) {
          const o = staged.get(id);
          if (!o || o.workspace !== workspace) throw new PaymentRejected();
          if (state.paymentHash && [...staged.values()].some(other =>
            other.id !== id && other.state.paymentHash === state.paymentHash)) throw new PaymentRejected();
          o.state = structuredClone(state);
        },
        async getSetting(key) { return writes.get(key) ?? settings.get(key); },
        async setSetting(key, value) { writes.set(key, value); },
      });
      orders = staged;
      for (const [key, value] of writes) settings.set(key, value);
      return result;
    } finally { unlock(); }
  };
}
