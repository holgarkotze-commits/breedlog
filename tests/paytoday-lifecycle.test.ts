import test from "node:test";
import { InMemoryStorage } from "../server/storage";
import { annualLifecycle } from "./helpers/paytoday-lifecycle";

test("annual checkout reservation and immutable price lifecycle in memory", async t => {
  await annualLifecycle(t, new InMemoryStorage().paymentTransaction);
});
