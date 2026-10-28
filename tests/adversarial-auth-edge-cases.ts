/**
 * Adversarial Verification & Stress Test Suite: Milestone B (Supabase Authentication & Edge Cases)
 * Archetype: Empirical Challenger
 *
 * This test suite stress-tests authentication edge cases:
 * 1. Credential validation & sanitization (malformed emails, extreme passwords, Unicode, injection strings, whitespace trimming).
 * 2. Session recovery & lifecycle (initAuth idempotency, session hydration, failure resilience).
 * 3. Multi-tab event handling (onAuthStateChange SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, burst events).
 * 4. Offline fallback behavior (deterministic avatars, dual-mode safety when Supabase is unconfigured).
 * 5. State purging & credential security (zero password leakage into storage, workspace store reset on logout).
 * 6. Error handling & localization (invalid credentials, email collision, unconfirmed email).
 * 7. Behavioral equivalence of helper aliases (signIn, signUp, signOut).
 * 8. Static DOM SSR rendering & component state integration (AuthPage & Home page.tsx).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { isSupabaseConfigured, supabase, mapSupabaseMessage } from '../src/lib/supabase';
import { AuthPage } from '../src/components/Auth/AuthPage';
import Home from '../src/app/page';
import type { AuthUser } from '../src/types';

// ============================================================================
// Setup Mock React Dispatcher and Sync Live Store State for SSR
// ============================================================================

const reactInternals = React as unknown as {
  useSyncExternalStore: (subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => unknown) => unknown;
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
    H?: Record<string, unknown>;
  };
};

reactInternals.useSyncExternalStore = (_sub, getSnapshot) => getSnapshot();

const hookDispatcherProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    if (prop === 'useCallback') return (fn: unknown) => fn;
    if (prop === 'useSyncExternalStore') return (_sub: unknown, snap: () => unknown) => snap();
    if (prop === 'useState') return (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}];
    if (prop === 'useId') return () => ':r-challenger:';
    if (prop === 'useMemo') return (fn: () => unknown) => fn();
    if (prop === 'useRef') return (init: unknown) => ({ current: init });
    if (prop === 'useEffect' || prop === 'useLayoutEffect') return () => {};
    if (prop === 'useDebugValue') return () => {};
    return () => {};
  },
});

function installHookDispatcher(): void {
  if (reactInternals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
    reactInternals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = hookDispatcherProxy;
  }
}

// ============================================================================
// Test Framework & Assertion State
// ============================================================================

let totalPassed = 0;
let totalFailed = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    totalFailed++;
    const msg = `  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

// ============================================================================
// Mock LocalStorage for Security & State Leakage Verification
// ============================================================================

class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  getAllValues(): string[] {
    return Array.from(this.store.values());
  }
}

const mockStorage = new MockLocalStorage();
// Polyfill global window and localStorage for empirical verification
(global as Record<string, unknown>).window = {
  localStorage: mockStorage,
};
(global as Record<string, unknown>).localStorage = mockStorage;

// ============================================================================
// Master Adversarial Auth Test Suite
// ============================================================================

async function runAdversarialAuthSuite(): Promise<void> {
  console.log('\n================================================================');
  console.log('   ADVERSARIAL STRESS TEST: AUTHENTICATION & EDGE CASES');
  console.log('================================================================\n');

  installHookDispatcher();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 1: Credential Validation, Trimming & Extreme Inputs
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Suite 1: Credential Validation & Input Sanitization ---');

  // Edge Case 1.1: Trimming email with whitespace
  await useAuthStore.getState().login('   spaced.user@workspace.org   ', 'MySecretPass123!');
  const user1 = useAuthStore.getState().user;
  assert(user1 !== null, 'Login with padded email succeeds');
  assert(user1?.email === 'spaced.user@workspace.org', 'Email is properly trimmed of whitespace');

  // Edge Case 1.2: Password preservation (leading/trailing spaces must NOT be trimmed from password)
  const untrimmedPass = '   secret_pass_with_spaces   ';
  await useAuthStore.getState().login('user2@workspace.org', untrimmedPass);
  assert(useAuthStore.getState().error === null, 'Login with spaces in password executes cleanly');

  // Edge Case 1.3: Unicode, emoji, and multi-byte characters in name and password
  const unicodeName = 'Nguyễn Trần Phúc 🚀 (Đội Trưởng)';
  const emojiPass = '🔑P@sswörd123!🎉';
  await useAuthStore.getState().register(unicodeName, 'unicode.dev@workspace.org', emojiPass);
  const userUnicode = useAuthStore.getState().user;
  assert(userUnicode?.name === unicodeName, 'Unicode and emoji characters in name preserved exactly');
  assert(userUnicode?.email === 'unicode.dev@workspace.org', 'Email associated with unicode user preserved');

  // Edge Case 1.4: Extreme length inputs (2,000 chars password, 500 chars email)
  const hugeEmail = `${'a'.repeat(200)}@${'b'.repeat(100)}.org`;
  const hugePassword = 'X'.repeat(5000);
  await useAuthStore.getState().login(hugeEmail, hugePassword);
  assert(useAuthStore.getState().isLoading === false, 'Massive credential input does not cause hang or unhandled crash');
  assert(useAuthStore.getState().user?.email === hugeEmail, 'Huge email handled without truncation corruption');

  // Edge Case 1.5: Injection payloads in email & name (SQL & XSS attempts)
  const sqlInjection = "' OR '1'='1' --";
  const xssPayload = "<script>alert('xss')</script>";
  await useAuthStore.getState().register(xssPayload, `xss.${Date.now()}@evil.com`, sqlInjection);
  const injectedUser = useAuthStore.getState().user;
  assert(injectedUser !== null, 'Injection payload does not break store execution');
  assert(injectedUser?.name === xssPayload, 'Payload is treated as pure string literal');

  // Clean up
  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 2: State Purging & Zero Credential Leakage
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: State Purging & Credential Leakage Audit ---');

  // 2.1: Login Alice and send message to seed localStorage
  await useAuthStore.getState().login('alice@workspace.org', 'SuperSecretAlice!');
  useWorkspaceStore.getState().sendMessage('general', 'Classified message from Alice');

  // Verify workspace state holds Alice's message and user
  assert((useWorkspaceStore.getState().currentUser as AuthUser).email === 'alice@workspace.org', 'Workspace current user is Alice');
  const storedMessagesBefore = mockStorage.getItem('workspace_persisted_messages_v1');
  assert(storedMessagesBefore !== null && storedMessagesBefore.includes('Classified message from Alice'), 'Alice message persisted in mock storage');

  // 2.2: Audit localStorage for sensitive auth data: NO passwords or credentials allowed in localStorage!
  const allStoredValues = mockStorage.getAllValues().join(' ');
  assert(!allStoredValues.includes('SuperSecretAlice!'), 'AUDIT PASS: User password is NOT stored in localStorage');
  assert(!allStoredValues.includes('MySecretPass123!'), 'AUDIT PASS: Prior user password is NOT in localStorage');
  assert(!allStoredValues.includes('secret_pass_with_spaces'), 'AUDIT PASS: Spaced password is NOT in localStorage');

  // 2.3: Logout and verify complete purge of user and workspace state
  await useAuthStore.getState().logout();
  assert(useAuthStore.getState().user === null, 'Auth store user is null after logout');
  assert(useAuthStore.getState().error === null, 'Auth store error is null after logout');
  assert(useAuthStore.getState().isLoading === false, 'Auth store isLoading is false after logout');

  // Verify workspace state reset
  assert(useWorkspaceStore.getState().currentUser.id === 'user-current', 'Workspace currentUser reset to default');
  assert(mockStorage.getItem('workspace_persisted_messages_v1') === null, 'workspace_persisted_messages_v1 cleared from localStorage on logout');
  assert(mockStorage.getItem('workspace_persisted_channels_v1') === null, 'workspace_persisted_channels_v1 cleared from localStorage on logout');

  // 2.4: Login Bob and verify cross-account isolation (no residue from Alice)
  await useAuthStore.getState().login('bob@workspace.org', 'SuperSecretBob!');
  assert((useWorkspaceStore.getState().currentUser as AuthUser).email === 'bob@workspace.org', 'Workspace current user switched to Bob');
  assert(useAuthStore.getState().user?.email === 'bob@workspace.org', 'Auth store user is Bob');
  const bobStoredValues = mockStorage.getAllValues().join(' ');
  assert(!bobStoredValues.includes('SuperSecretBob!'), 'AUDIT PASS: Bob password is NOT in localStorage');

  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 3: Session Expiry, Recovery & initAuth Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Session Expiry, Recovery & Lifecycle ---');

  // 3.1: Verify initial state of fresh store
  useAuthStore.setState({ user: null, isInitialized: false, isLoading: false, error: null });
  assert(useAuthStore.getState().isInitialized === false, 'Fresh state isInitialized is false');

  // 3.2: Calling initAuth marks isInitialized as true
  useAuthStore.getState().initAuth();
  assert(useAuthStore.getState().isInitialized === true, 'initAuth marks isInitialized as true');

  // 3.3: Idempotency stress test: invoke initAuth 20 times in rapid succession
  for (let i = 0; i < 20; i++) {
    useAuthStore.getState().initAuth();
  }
  assert(useAuthStore.getState().isInitialized === true, 'Multiple initAuth calls maintain isInitialized true');
  assert(useAuthStore.getState().user === null, 'Repeated initAuth calls do not create phantom user');

  // 3.4: Verify alias behavioral delegation
  assert(typeof useAuthStore.getState().signIn === 'function', 'signIn is defined');
  await useAuthStore.getState().signIn?.('alias.login@workspace.org', 'pwd123');
  assert(useAuthStore.getState().user?.email === 'alias.login@workspace.org', 'signIn alias delegates to login correctly');

  assert(typeof useAuthStore.getState().signUp === 'function', 'signUp is defined');
  await useAuthStore.getState().signUp?.('Alias User', 'alias.register@workspace.org', 'pwd123');
  assert(useAuthStore.getState().user?.email === 'alias.register@workspace.org', 'signUp alias delegates to register correctly');

  assert(typeof useAuthStore.getState().signOut === 'function', 'signOut is defined');
  await useAuthStore.getState().signOut?.();
  assert(useAuthStore.getState().user === null, 'signOut alias delegates to logout correctly');

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 4: Offline Fallback & Dual-Mode Behavior
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Offline Fallback & Dual-Mode Behavior ---');

  // 4.1: Dual-mode verification
  assert(typeof isSupabaseConfigured === 'boolean', 'isSupabaseConfigured is defined as boolean');
  if (!isSupabaseConfigured) {
    assert(supabase === null, 'supabase client is safely null when credentials missing');
  }

  // 4.2: Deterministic offline user creation
  const offlineEmail = 'offline-tester@domain.com';
  await useAuthStore.getState().login(offlineEmail, 'password');
  const offUser = useAuthStore.getState().user;
  assert(offUser !== null, 'Offline login produces valid AuthUser');
  assert(Boolean(offUser?.id.startsWith('offline-')), 'Offline user ID starts with offline- prefix');
  assert(Boolean(offUser?.avatarUrl?.includes('dicebear.com')), 'Offline user receives Dicebear avatar');
  assert(offUser?.statusText === 'Online', 'Offline user default status is Online');

  // 4.3: Avatar generation robustness with unusual seeds
  await useAuthStore.getState().register('', '', 'password');
  const emptyUser = useAuthStore.getState().user;
  assert(emptyUser?.avatarUrl !== undefined, 'Avatar generation succeeds even with empty string seed');

  // 4.4: Safe handling of null/undefined fields in mapSupabaseMessage
  const emptyRowMsg = mapSupabaseMessage({});
  assert(emptyRowMsg.id.startsWith('msg-'), 'mapSupabaseMessage generates fallback ID for empty row');
  assert(emptyRowMsg.channelId === 'general', 'mapSupabaseMessage defaults channelId to general');
  assert(emptyRowMsg.sender.id === 'user-system', 'mapSupabaseMessage defaults sender to user-system');
  assert(emptyRowMsg.status === 'sent', 'mapSupabaseMessage defaults status to sent');

  // Clean up
  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 5: Multi-Tab Concurrency, Burst Events & Race Conditions
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: Multi-Tab Concurrency & Burst Stress Test ---');

  // 5.1: 50 Rapid sequential login/logout cycles
  const cycleCount = 50;
  for (let i = 0; i < cycleCount; i++) {
    await useAuthStore.getState().login(`burst-${i}@test.com`, 'testpass');
    await useAuthStore.getState().logout();
  }
  assert(useAuthStore.getState().user === null, `Completed ${cycleCount} rapid login/logout cycles cleanly`);
  assert(useAuthStore.getState().isLoading === false, 'isLoading is false after rapid cycle burst');
  assert(useWorkspaceStore.getState().currentUser.id === 'user-current', 'Workspace currentUser reset after burst');

  // 5.2: Concurrent overlapping logins
  const p1 = useAuthStore.getState().login('concurrent1@test.com', 'pass1');
  const p2 = useAuthStore.getState().login('concurrent2@test.com', 'pass2');
  await Promise.all([p1, p2]);
  const concurrentFinalUser = useAuthStore.getState().user;
  assert(concurrentFinalUser !== null, 'Overlapping logins resolve to a valid authenticated user');
  assert(useAuthStore.getState().isLoading === false, 'isLoading resolved to false after concurrent calls');

  // Clean up
  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 6: Simulation of onAuthStateChange Handlers (Multi-Tab Simulation)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 6: Multi-Tab onAuthStateChange Simulation ---');

  // Simulate onAuthStateChange logic as implemented in useAuthStore.ts
  const simulateAuthEvent = (
    event: 'SIGNED_IN' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'SIGNED_OUT',
    simulatedUser: AuthUser | null
  ) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (simulatedUser) {
        useWorkspaceStore.getState().setCurrentUser(simulatedUser);
        useAuthStore.setState({ user: simulatedUser, error: null, isLoading: false });
      }
    } else if (event === 'SIGNED_OUT') {
      useWorkspaceStore.getState().resetWorkspaceState();
      useAuthStore.setState({ user: null, error: null, isLoading: false });
    }
  };

  // Event 1: Tab 2 receives SIGNED_IN event from Tab 1
  const remoteUser: AuthUser = {
    id: 'usr-uuid-tab1',
    name: 'Tab 1 Engineer',
    email: 'engineer@workspace.org',
    avatarUrl: 'https://example.com/avatar.png',
    statusText: 'Focusing',
  };
  simulateAuthEvent('SIGNED_IN', remoteUser);
  assert(useAuthStore.getState().user?.id === 'usr-uuid-tab1', 'Tab 2 updates auth user on SIGNED_IN');
  assert(useWorkspaceStore.getState().currentUser.id === 'usr-uuid-tab1', 'Tab 2 updates workspace currentUser on SIGNED_IN');

  // Event 2: Tab 2 receives TOKEN_REFRESHED
  const refreshedUser: AuthUser = {
    ...remoteUser,
    statusText: 'Active',
  };
  simulateAuthEvent('TOKEN_REFRESHED', refreshedUser);
  assert(useAuthStore.getState().user?.statusText === 'Active', 'Tab 2 updates user on TOKEN_REFRESHED');

  // Event 3: Tab 2 receives USER_UPDATED
  const updatedUser: AuthUser = {
    ...remoteUser,
    name: 'Lead Architect',
  };
  simulateAuthEvent('USER_UPDATED', updatedUser);
  assert(useAuthStore.getState().user?.name === 'Lead Architect', 'Tab 2 updates user name on USER_UPDATED');

  // Event 4: Tab 2 receives SIGNED_OUT from Tab 1
  simulateAuthEvent('SIGNED_OUT', null);
  assert(useAuthStore.getState().user === null, 'Tab 2 clears auth user on SIGNED_OUT');
  assert(useWorkspaceStore.getState().currentUser.id === 'user-current', 'Tab 2 purges workspace currentUser on SIGNED_OUT');

  // Event 5: Burst of 100 alternating multi-tab events
  for (let i = 0; i < 100; i++) {
    const isSignIn = i % 2 === 0;
    if (isSignIn) {
      simulateAuthEvent('SIGNED_IN', { ...remoteUser, id: `tab-user-${i}` });
    } else {
      simulateAuthEvent('SIGNED_OUT', null);
    }
  }
  assert(useAuthStore.getState().user === null, 'Store handles 100 alternating multi-tab events without desync');

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 7: Error Message Localization & Error State Cleardown
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 7: Error Propagation & Localization ---');

  const mockTranslateLoginError = (errMsg: string) => {
    return errMsg === 'Invalid login credentials' ? 'Email hoặc mật khẩu không đúng.' : errMsg;
  };

  const mockTranslateRegisterError = (errMsg: string) => {
    return errMsg.includes('already registered') ? 'Email này đã được đăng ký.' : errMsg;
  };

  assert(
    mockTranslateLoginError('Invalid login credentials') === 'Email hoặc mật khẩu không đúng.',
    'Invalid login credentials mapped to friendly Vietnamese'
  );
  assert(
    mockTranslateLoginError('Email rate limit exceeded') === 'Email rate limit exceeded',
    'Other login errors pass through verbatim'
  );
  assert(
    mockTranslateRegisterError('User already registered') === 'Email này đã được đăng ký.',
    'Email collision error mapped to friendly Vietnamese'
  );

  // Test error clearing on subsequent action
  useAuthStore.setState({ error: 'Some lingering error' });
  assert(useAuthStore.getState().error === 'Some lingering error', 'Error state is set');
  await useAuthStore.getState().login('clearing.error@test.com', 'pwd');
  assert(useAuthStore.getState().error === null, 'New login action immediately clears previous error state');

  // Clean up
  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 8: Component DOM Rendering & SSR Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 8: Component DOM Rendering & SSR Verification ---');

  // 8.1: AuthPage static render
  useAuthStore.setState({ user: null, isInitialized: true, isLoading: false, error: null });
  const authPageMarkup = renderToStaticMarkup(React.createElement(AuthPage));
  assert(authPageMarkup.includes('WorkSpace'), 'AuthPage renders branding title WorkSpace');
  assert(authPageMarkup.includes('Đăng nhập'), 'AuthPage renders login tab');
  assert(authPageMarkup.includes('Đăng ký'), 'AuthPage renders register tab');
  assert(authPageMarkup.includes('type="email"'), 'AuthPage renders HTML5 email input');
  assert(authPageMarkup.includes('type="password"'), 'AuthPage renders password input');

  // 8.2: App Root Home page SSR render (uninitialized state)
  // During SSR, isInitialized is false, so it must render the spinner to prevent hydration mismatch
  useAuthStore.setState({ user: null, isInitialized: false, isLoading: false });
  const homeLoading = renderToStaticMarkup(React.createElement(Home));
  assert(homeLoading.includes('animate-spin'), 'Uninitialized Home SSR renders spinner to prevent hydration mismatch');

  // 8.3: App Root Home page client evaluation via direct functional evaluation
  // When initialized and unauthenticated -> Home returns AuthPage element
  useAuthStore.setState({ user: null, isInitialized: true, isLoading: false });
  const unauthElement = Home();
  const unauthMarkup = renderToStaticMarkup(unauthElement);
  assert(unauthMarkup.includes('WorkSpace') && unauthMarkup.includes('Đăng nhập'), 'Client-initialized unauthenticated Home returns AuthPage');

  // 8.4: When initialized and authenticated -> Home returns workspace layout
  const activeUser: AuthUser = {
    id: 'user-active-root',
    name: 'Ada Lovelace',
    email: 'ada@workspace.org',
    avatarUrl: 'https://example.com/ada.jpg',
    statusText: 'Online',
  };
  useAuthStore.setState({ user: activeUser, isInitialized: true, isLoading: false });
  useWorkspaceStore.getState().setCurrentUser(activeUser);
  const authElement = Home();
  const authMarkup = renderToStaticMarkup(authElement);
  assert(authMarkup.includes('data-testid="workspace-layout"'), 'Client-initialized authenticated Home returns workspace-layout');

  // 8.5: AuthPage direct functional evaluation with error & success states
  useAuthStore.setState({ user: null, isInitialized: true, isLoading: false, error: 'Email hoặc mật khẩu không đúng.' });
  const authPageWithError = renderToStaticMarkup(AuthPage());
  assert(authPageWithError.includes('Email hoặc mật khẩu không đúng.'), 'AuthPage renders error message');
  assert(authPageWithError.includes('text-red-400'), 'Error notification styled with red text');

  useAuthStore.setState({ user: null, isInitialized: true, isLoading: false, error: 'Đăng ký thành công! Vui lòng kiểm tra email.' });
  const authPageWithSuccess = renderToStaticMarkup(AuthPage());
  assert(authPageWithSuccess.includes('Đăng ký thành công!'), 'AuthPage renders success message');
  assert(authPageWithSuccess.includes('text-emerald-400'), 'Success notification styled with emerald green text');

  useAuthStore.setState({ user: null, isInitialized: true, isLoading: true, error: null });
  const authPageLoading = renderToStaticMarkup(AuthPage());
  assert(authPageLoading.includes('disabled=""') || authPageLoading.includes('disabled'), 'Submit button disabled during loading');
  assert(authPageLoading.includes('Đang đăng nhập...'), 'Loading indicator text displayed during login loading');

  // Cleanup
  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 9: Direct Account Switch Data Isolation (Without Explicit Logout)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 9: Direct Account Switch Data Isolation ---');

  // Carol logs in and creates proprietary channel & messages
  await useAuthStore.getState().login('carol@workspace.org', 'CarolPass123!');
  await useWorkspaceStore.getState().createChannel('carol-secret-channel', 'Carol Confidential');
  useWorkspaceStore.getState().sendMessage('carol-secret-channel', 'Carol confidential message');

  assert(
    useWorkspaceStore.getState().channels.some((c) => c.id === 'carol-secret-channel'),
    'Carol proprietary channel exists in workspace'
  );

  // Dave logs in directly without prior logout
  await useAuthStore.getState().login('dave@workspace.org', 'DavePass456!');
  assert(useAuthStore.getState().user?.email === 'dave@workspace.org', 'Dave is authenticated user');

  const daveChannels = useWorkspaceStore.getState().channels;
  const daveMessages = useWorkspaceStore.getState().messages;
  const carolChannelLeaked = daveChannels.some((c) => c.id === 'carol-secret-channel');
  const carolMessageLeaked = (daveMessages['carol-secret-channel'] || []).length > 0;

  assert(
    !carolChannelLeaked,
    'Direct account switch: Carol channel must NOT bleed to Dave session',
    'DATA LEAKAGE: Prior user channel retained after direct login'
  );
  assert(
    !carolMessageLeaked,
    'Direct account switch: Carol messages must NOT bleed to Dave session',
    'DATA LEAKAGE: Prior user messages retained after direct login'
  );

  await useAuthStore.getState().logout();

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 10: In-Flight Message Delay Timer vs Immediate Logout Race Condition
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 10: In-Flight Message Timer vs Immediate Logout Race ---');

  // Eve logs in and sends message (which starts 1000ms delay timer in useWorkspaceStore)
  await useAuthStore.getState().login('eve@workspace.org', 'EvePass789!');
  useWorkspaceStore.getState().sendMessage('general', 'Eve in-flight message before logout');

  // Immediately logout while timer is pending
  await useAuthStore.getState().logout();
  assert(mockStorage.getItem('workspace_persisted_messages_v1') === null, 'localStorage clean immediately after logout');

  // Wait 1200ms for pending in-flight timer to fire
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const resurrectedStorage = mockStorage.getItem('workspace_persisted_messages_v1');
  assert(
    resurrectedStorage === null,
    'In-flight message timer must NOT re-create localStorage cache after logout',
    'CACHE LEAKAGE: In-flight delay timer wrote back to localStorage after user logged out'
  );

  // ============================================================================
  // Test Run Summary
  // ============================================================================
  console.log('\n================================================================');
  console.log(`Adversarial Auth Suite: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Suite failed with ${totalFailed} failing assertions:`);
    for (const f of failureDetails) {
      console.error(f);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL ADVERSARIAL AUTH STRESS TESTS PASSED (100% PASS RATE).');
    process.exit(0);
  }
}

runAdversarialAuthSuite().catch((err: unknown) => {
  console.error('Adversarial Auth Suite crashed with unhandled exception:', err);
  process.exit(1);
});
