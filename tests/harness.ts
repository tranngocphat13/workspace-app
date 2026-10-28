// Automated Lightweight Test Harness for Real-time Workspace UI E2E Test Suite

export interface TestCase {
  suite: string;
  name: string;
  fn: () => void | Promise<void>;
  status?: 'passed' | 'failed' | 'skipped';
  error?: Error;
  durationMs?: number;
}

interface SuiteState {
  currentSuite: string;
  tests: TestCase[];
  beforeEachHooks: (() => void | Promise<void>)[];
  afterEachHooks: (() => void | Promise<void>)[];
}

const state: SuiteState = {
  currentSuite: '',
  tests: [],
  beforeEachHooks: [],
  afterEachHooks: [],
};

export function describe(name: string, fn: () => void): void {
  const previousSuite = state.currentSuite;
  state.currentSuite = previousSuite ? `${previousSuite} > ${name}` : name;
  fn();
  state.currentSuite = previousSuite;
}

export function it(name: string, fn: () => void | Promise<void>): void {
  state.tests.push({
    suite: state.currentSuite,
    name,
    fn,
  });
}

export const test = it;

export function beforeEach(fn: () => void | Promise<void>): void {
  state.beforeEachHooks.push(fn);
}

export function afterEach(fn: () => void | Promise<void>): void {
  state.afterEachHooks.push(fn);
}

export function expect<T = unknown>(actual: T) {
  const matchers = (isNot: boolean) => ({
    toBe(expected: unknown) {
      const pass = Object.is(actual, expected);
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'NOT to be' : 'to be'} ${JSON.stringify(expected)}`
        );
      }
    },
    toEqual(expected: unknown) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'NOT to equal' : 'to equal'} ${JSON.stringify(expected)}`
        );
      }
    },
    toBeTruthy() {
      const pass = Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'NOT to be truthy' : 'to be truthy'}`);
      }
    },
    toBeFalsy() {
      const pass = !Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'NOT to be falsy' : 'to be falsy'}`);
      }
    },
    toBeDefined() {
      const pass = actual !== undefined;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'to be undefined' : 'to be defined'}`);
      }
    },
    toBeUndefined() {
      const pass = actual === undefined;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'NOT to be undefined' : 'to be undefined'}`);
      }
    },
    toContain(expectedItem: unknown) {
      let pass = false;
      if (typeof actual === 'string') {
        pass = actual.includes(String(expectedItem));
      } else if (Array.isArray(actual)) {
        pass = actual.includes(expectedItem);
      } else if (actual && typeof actual === 'object') {
        pass = Object.prototype.hasOwnProperty.call(actual, expectedItem as string);
      }
      if (isNot ? pass : !pass) {
        throw new Error(`Expected collection ${isNot ? 'NOT to contain' : 'to contain'} ${JSON.stringify(expectedItem)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      const pass = typeof actual === 'number' && actual > expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'NOT to be >' : 'to be >'} ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      const pass = typeof actual === 'number' && actual >= expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'NOT to be >=' : 'to be >='} ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      const pass = typeof actual === 'number' && actual < expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'NOT to be <' : 'to be <'} ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      const pass = typeof actual === 'number' && actual <= expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'NOT to be <=' : 'to be <='} ${expected}`);
      }
    },
    toMatch(regex: RegExp) {
      const pass = typeof actual === 'string' && regex.test(actual);
      if (isNot ? pass : !pass) {
        throw new Error(`Expected "${actual}" ${isNot ? 'NOT to match' : 'to match'} ${regex}`);
      }
    },
    toHaveLength(expectedLen: number) {
      const len =
        typeof actual === 'string' || Array.isArray(actual)
          ? actual.length
          : (actual as { length?: number } | null | undefined)?.length;
      const pass = len === expectedLen;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected length ${len} ${isNot ? 'NOT to be' : 'to be'} ${expectedLen}`);
      }
    },
    toThrow(expectedMessage?: string | RegExp) {
      if (typeof actual !== 'function') {
        throw new Error('Actual must be a function to use toThrow');
      }
      let threw = false;
      let caughtError: unknown;
      try {
        (actual as () => void)();
      } catch (err: unknown) {
        threw = true;
        caughtError = err;
      }
      if (!threw && !isNot) {
        throw new Error('Expected function to throw, but it did not throw');
      }
      if (threw && isNot) {
        throw new Error(`Expected function NOT to throw, but it threw: ${String(caughtError)}`);
      }
      if (threw && expectedMessage) {
        const msg = caughtError instanceof Error ? caughtError.message : String(caughtError);
        const matches =
          expectedMessage instanceof RegExp
            ? expectedMessage.test(msg)
            : msg.includes(expectedMessage);
        if (!matches) {
          throw new Error(`Expected error message to match ${expectedMessage}, got: ${msg}`);
        }
      }
    },
  });

  return {
    ...matchers(false),
    not: matchers(true),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSuite(suiteTitle: string): Promise<{ total: number; passed: number; failed: number }> {
  console.log(`\n======================================================`);
  console.log(`  Executing: ${suiteTitle}`);
  console.log(`======================================================`);

  const testsToRun = [...state.tests];
  state.tests = []; // Reset for next batch if called sequentially

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const t of testsToRun) {
    for (const hook of state.beforeEachHooks) {
      await hook();
    }

    const testStart = Date.now();
    try {
      await t.fn();
      t.status = 'passed';
      t.durationMs = Date.now() - testStart;
      passed++;
      console.log(`  ✓ [PASS] [${t.suite}] ${t.name} (${t.durationMs}ms)`);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      t.status = 'failed';
      t.error = errorObj;
      t.durationMs = Date.now() - testStart;
      failed++;
      console.error(`  ✗ [FAIL] [${t.suite}] ${t.name} (${t.durationMs}ms)`);
      console.error(`      Error: ${errorObj.message}`);
      if (errorObj.stack) {
        const stackLines = errorObj.stack.split('\n').slice(1, 4).join('\n');
        console.error(`      Stack: ${stackLines}`);
      }
    }

    for (const hook of state.afterEachHooks) {
      await hook();
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`------------------------------------------------------`);
  console.log(`Results: ${passed} passed, ${failed} failed (${testsToRun.length} total) in ${duration}s`);
  console.log(`======================================================\n`);

  return { total: testsToRun.length, passed, failed };
}

export function clearRegisteredSuites(): void {
  state.tests = [];
  state.beforeEachHooks = [];
  state.afterEachHooks = [];
  state.currentSuite = '';
}
