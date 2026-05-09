/**
 * Pure, browser-free navigation history stack.
 * Used by NavigationHistoryProvider and tested directly in unit tests.
 */
export class NavigationHistory {
  private backStack: string[] = [];
  private forwardStack: string[] = [];
  private _current: string;

  constructor(initialPath: string) {
    this._current = initialPath;
  }

  get current(): string {
    return this._current;
  }

  get canGoBack(): boolean {
    return this.backStack.length > 0;
  }

  get canGoForward(): boolean {
    return this.forwardStack.length > 0;
  }

  get previous(): string | undefined {
    return this.backStack[this.backStack.length - 1];
  }

  /**
   * Record a new navigation push (organic link/tab click).
   * Clears the forward stack because a new branch has started.
   */
  push(path: string): void {
    if (path === this._current) return;
    this.backStack.push(this._current);
    this.forwardStack = [];
    this._current = path;
  }

  /**
   * Go back one step.
   * Returns the path to navigate to.
   * If no back history, returns the fallback.
   */
  back(fallback: string): string {
    if (this.backStack.length > 0) {
      const prev = this.backStack.pop()!;
      this.forwardStack.push(this._current);
      this._current = prev;
      return prev;
    }
    return fallback;
  }

  /**
   * Go forward one step.
   * Returns the path to navigate to, or null if nothing is in forward stack.
   */
  forward(): string | null {
    if (this.forwardStack.length > 0) {
      const next = this.forwardStack.pop()!;
      this.backStack.push(this._current);
      this._current = next;
      return next;
    }
    return null;
  }

  /**
   * Called when the browser fires a native popstate (user pressed device back/forward).
   * We sync the new path without touching the back/forward stacks because the
   * browser history is the authoritative source here.
   */
  syncNativeBack(newPath: string): void {
    this.forwardStack.push(this._current);
    if (this.backStack.length > 0) {
      this.backStack.pop();
    }
    this._current = newPath;
  }
}
