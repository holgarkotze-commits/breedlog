import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NavigationHistory } from "../client/src/lib/navigation-history.ts";

describe("NavigationHistory — pure stack logic", () => {

  test("starts at initial path with no back/forward history", () => {
    const h = new NavigationHistory("/");
    assert.equal(h.current, "/");
    assert.equal(h.canGoBack, false);
    assert.equal(h.canGoForward, false);
    assert.equal(h.previous, undefined);
  });

  test("push records history and enables goBack", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    assert.equal(h.current, "/animals");
    assert.equal(h.canGoBack, true);
    assert.equal(h.previous, "/");
  });

  test("My Herd → Animal Profile → Back returns to My Herd", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");

    const dest = h.back("/animals");
    assert.equal(dest, "/animals");
    assert.equal(h.current, "/animals");
    assert.equal(h.canGoBack, true);
  });

  test("Back again from My Herd returns to Dashboard", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");

    h.back("/animals"); // → /animals
    const dest = h.back("/"); // → /
    assert.equal(dest, "/");
    assert.equal(h.current, "/");
    assert.equal(h.canGoBack, false);
  });

  test("Forward after Back returns to Animal Profile", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");

    h.back("/animals");         // → /animals; forwardStack: [/animals/42]
    assert.equal(h.canGoForward, true);

    const dest = h.forward();
    assert.equal(dest, "/animals/42");
    assert.equal(h.current, "/animals/42");
    assert.equal(h.canGoForward, false);
  });

  test("Forward again from Animal Profile returns to My Herd via second forward step", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");

    h.back("/animals");   // → /animals
    h.back("/");          // → /; forwardStack: [/animals/42, /animals] wait — check direction
    // forwardStack after two backs: [/animals/42, /animals] (LIFO: /animals on top)
    const fwd1 = h.forward(); // → /animals
    assert.equal(fwd1, "/animals");
    const fwd2 = h.forward(); // → /animals/42
    assert.equal(fwd2, "/animals/42");
    assert.equal(h.canGoForward, false);
  });

  test("Data → Animal Profile → Back returns to Data", () => {
    const h = new NavigationHistory("/");
    h.push("/data");
    h.push("/animals/7");

    const dest = h.back("/animals");
    assert.equal(dest, "/data");
    assert.equal(h.current, "/data");
  });

  test("Breeding → MatingGroup → Back returns to Breeding", () => {
    const h = new NavigationHistory("/");
    h.push("/breeding");
    h.push("/breeding/groups/3");

    const dest = h.back("/breeding");
    assert.equal(dest, "/breeding");
    assert.equal(h.current, "/breeding");
  });

  test("Multiple navigation steps go back step-by-step", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/1");
    h.push("/animals/2");
    h.push("/animals/3");

    assert.equal(h.back("/"), "/animals/2");
    assert.equal(h.back("/"), "/animals/1");
    assert.equal(h.back("/"), "/animals");
    assert.equal(h.back("/"), "/");
    assert.equal(h.canGoBack, false);
  });

  test("New push clears forward stack", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");
    h.back("/animals");         // → /animals; forward: [/animals/42]
    assert.equal(h.canGoForward, true);

    h.push("/breeding");        // new push — forward cleared
    assert.equal(h.canGoForward, false);
    assert.equal(h.current, "/breeding");
  });

  test("Direct deep link to Animal Profile falls back to /animals when no history", () => {
    const h = new NavigationHistory("/animals/99");
    assert.equal(h.canGoBack, false);
    const dest = h.back("/animals");
    assert.equal(dest, "/animals");
  });

  test("Direct deep link to Breeding detail falls back to /breeding", () => {
    const h = new NavigationHistory("/breeding/groups/5");
    assert.equal(h.canGoBack, false);
    const dest = h.back("/breeding");
    assert.equal(dest, "/breeding");
  });

  test("No forced Home navigation when valid previous page exists", () => {
    const h = new NavigationHistory("/");
    h.push("/health");
    h.push("/health/12");

    const dest = h.back("/");
    assert.notEqual(dest, "/");
    assert.equal(dest, "/health");
  });

  test("forward() returns null when nothing in forward stack", () => {
    const h = new NavigationHistory("/animals");
    h.push("/animals/1");
    assert.equal(h.forward(), null);
  });

  test("syncNativeBack adjusts stacks for browser popstate", () => {
    const h = new NavigationHistory("/");
    h.push("/animals");
    h.push("/animals/42");

    // Simulate browser native back
    h.syncNativeBack("/animals");
    assert.equal(h.current, "/animals");
    assert.equal(h.canGoForward, true);

    const fwd = h.forward();
    assert.equal(fwd, "/animals/42");
  });

  test("push is a no-op when navigating to the current path", () => {
    const h = new NavigationHistory("/animals");
    h.push("/animals");
    assert.equal(h.canGoBack, false);
    assert.equal(h.current, "/animals");
  });
});
