// ==============================================================================
// EMPIRICAL STRESS TEST SUITE: State Isolation & Cache Purging
// Target: tests/state-isolation-stress.test.ts
// Run via: npx tsx tests/state-isolation-stress.test.ts
// ==============================================================================

import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import type { AuthUser } from '../src/types';

let totalPassed = 0;
let totalFailed = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
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

// Mock localStorage for Node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// Mock window for Node environment if not present
if (typeof globalThis.window === 'undefined') {
  // @ts-expect-error Node mock
  globalThis.window = {
    localStorage: globalThis.localStorage,
  };
}

async function runStressTests() {
  console.log('\n================================================================');
  console.log('   EMPIRICAL STRESS TESTS: STATE ISOLATION & CACHE PURGING');
  console.log('================================================================\n');

  // Clean slate
  localStorage.clear();
  useWorkspaceStore.getState().resetWorkspaceState();
  await useAuthStore.getState().logout();

  // ─── Test 1: Baseline Cache Purge on Logout ───────────────────────────────
  console.log('--- Test 1: Cache Purge on Logout ---');
  await useAuthStore.getState().login('alice@example.com', 'Pass123!');
  const alice = useAuthStore.getState().user;
  assert(alice?.email === 'alice@example.com', 'Alice logged in');

  // Alice creates custom channel and message
  await useWorkspaceStore.getState().createChannel('alice-private', 'Alice private channel');
  useWorkspaceStore.getState().sendMessage('alice-private', 'Alice private diary');
  useWorkspaceStore.getState().setActiveChannel('alice-private');

  // Verify created in store and in localStorage
  const preLogoutChannels = useWorkspaceStore.getState().channels;
  const preLogoutMessages = useWorkspaceStore.getState().messages;
  assert(
    preLogoutChannels.some((c) => c.id === 'alice-private'),
    'Alice channel created in store'
  );
  assert(
    (preLogoutMessages['alice-private'] || []).length > 0,
    'Alice message present in store'
  );
  assert(
    localStorage.getItem('workspace_persisted_channels_v1') !== null,
    'Channels persisted to localStorage'
  );
  assert(
    localStorage.getItem('workspace_persisted_messages_v1') !== null,
    'Messages persisted to localStorage'
  );

  // Now Alice logs out
  await useAuthStore.getState().logout();

  // Verify auth store purged
  assert(useAuthStore.getState().user === null, 'Auth user is null after logout');
  assert(useAuthStore.getState().error === null, 'Auth error is null after logout');

  // Verify localStorage purged
  assert(
    localStorage.getItem('workspace_persisted_channels_v1') === null,
    'workspace_persisted_channels_v1 purged from localStorage on logout'
  );
  assert(
    localStorage.getItem('workspace_persisted_messages_v1') === null,
    'workspace_persisted_messages_v1 purged from localStorage on logout'
  );

  // Verify workspace store state purged to default initial state
  const postLogoutChannels = useWorkspaceStore.getState().channels;
  const postLogoutMessages = useWorkspaceStore.getState().messages;
  assert(
    !postLogoutChannels.some((c) => c.id === 'alice-private'),
    'Alice private channel purged from channels list'
  );
  assert(
    postLogoutMessages['alice-private'] === undefined,
    'Alice private channel messages purged from messages record'
  );
  assert(
    useWorkspaceStore.getState().activeChannelId === 'general',
    'Active channel reset to "general"'
  );
  assert(
    useWorkspaceStore.getState().currentUser.id === 'user-current',
    'Current user reset to default INITIAL_USER'
  );

  // ─── Test 2: Account Switching with Logout (Alice -> Bob) ─────────────────
  console.log('\n--- Test 2: Account Switching with Logout (Alice -> Bob) ---');
  await useAuthStore.getState().login('bob@example.com', 'Pass456!');
  const bob = useAuthStore.getState().user;
  assert(bob?.email === 'bob@example.com', 'Bob logged in');
  assert(
    (useWorkspaceStore.getState().currentUser as AuthUser).email === 'bob@example.com',
    'Workspace currentUser is Bob'
  );

  // Bob must not see Alice data
  const bobChannels = useWorkspaceStore.getState().channels;
  const bobMessages = useWorkspaceStore.getState().messages;
  assert(
    !bobChannels.some((c) => c.id === 'alice-private'),
    'Bob does not see Alice custom channel'
  );
  assert(
    bobMessages['alice-private'] === undefined,
    'Bob does not see Alice custom messages'
  );

  // Bob sends message in general
  useWorkspaceStore.getState().sendMessage('general', 'Hello from Bob');
  assert(
    useWorkspaceStore.getState().messages['general'].some((m) => m.content === 'Hello from Bob'),
    'Bob message recorded in general'
  );

  // Bob logs out
  await useAuthStore.getState().logout();
  assert(
    !useWorkspaceStore.getState().messages['general'].some((m) => m.content === 'Hello from Bob'),
    'Bob message purged on logout'
  );

  // ─── Test 3: Direct Account Switching WITHOUT Calling Logout ───────────────
  console.log('\n--- Test 3: Direct Account Switch (Carol -> Dave) WITHOUT Logout ---');
  // Carol logs in and creates proprietary data
  await useAuthStore.getState().login('carol@example.com', 'PassCarol1!');
  await useWorkspaceStore.getState().createChannel('carol-top-secret', 'Carol classified channel');
  useWorkspaceStore.getState().sendMessage('carol-top-secret', 'Carol classified message');

  // Verify Carol data exists
  assert(
    useWorkspaceStore.getState().channels.some((c) => c.id === 'carol-top-secret'),
    'Carol classified channel exists in workspace'
  );

  // Dave logs in DIRECTLY without prior logout
  console.log('  Direct switch: logging in Dave without calling logout()...');
  await useAuthStore.getState().login('dave@example.com', 'PassDave2!');
  const dave = useAuthStore.getState().user;
  assert(dave?.email === 'dave@example.com', 'Dave is authenticated user');
  assert(
    (useWorkspaceStore.getState().currentUser as AuthUser).email === 'dave@example.com',
    'Workspace currentUser switched to Dave'
  );

  // Check whether Carol data bled into Dave workspace session
  const daveChannels = useWorkspaceStore.getState().channels;
  const daveMessages = useWorkspaceStore.getState().messages;
  const carolChannelLeaked = daveChannels.some((c) => c.id === 'carol-top-secret');
  const carolMessageLeaked = (daveMessages['carol-top-secret'] || []).length > 0;

  console.log(`  Carol channel leaked to Dave: ${carolChannelLeaked}`);
  console.log(`  Carol messages leaked to Dave: ${carolMessageLeaked}`);

  assert(
    !carolChannelLeaked,
    'Direct account switch: Carol channel must NOT bleed to Dave',
    carolChannelLeaked ? 'DATA BLEED DETECTED: Carol channel visible in Dave session' : undefined
  );
  assert(
    !carolMessageLeaked,
    'Direct account switch: Carol messages must NOT bleed to Dave',
    carolMessageLeaked ? 'DATA BLEED DETECTED: Carol messages visible in Dave session' : undefined
  );

  // Cleanup
  await useAuthStore.getState().logout();

  // ─── Test 4: Direct Registration Switch WITHOUT Logout ─────────────────────
  console.log('\n--- Test 4: Direct Register Switch (Eve -> Frank) WITHOUT Logout ---');
  await useAuthStore.getState().register('Eve', 'eve@example.com', 'PassEve1!');
  await useWorkspaceStore.getState().createChannel('eve-secret-room', 'Eve secrets');
  useWorkspaceStore.getState().sendMessage('eve-secret-room', 'Eve secret message');

  // Frank registers directly
  console.log('  Direct register: registering Frank without calling logout()...');
  await useAuthStore.getState().register('Frank', 'frank@example.com', 'PassFrank2!');
  assert(useAuthStore.getState().user?.email === 'frank@example.com', 'Frank is authenticated user');

  const frankChannels = useWorkspaceStore.getState().channels;
  const eveChannelLeaked = frankChannels.some((c) => c.id === 'eve-secret-room');
  console.log(`  Eve channel leaked to Frank: ${eveChannelLeaked}`);

  assert(
    !eveChannelLeaked,
    'Direct registration switch: Eve channel must NOT bleed to Frank',
    eveChannelLeaked ? 'DATA BLEED DETECTED: Eve channel visible in Frank session' : undefined
  );

  // Cleanup
  await useAuthStore.getState().logout();

  // ─── Test 5: In-Flight Message Delay Race Condition on Logout ──────────────
  console.log('\n--- Test 5: In-Flight Message Race Condition on Logout ---');
  await useAuthStore.getState().login('grace@example.com', 'PassGrace1!');
  useWorkspaceStore.getState().sendMessage('general', 'Grace transient message');

  // Immediately logout while 1s delay is pending (simulated network in flight)
  console.log('  Logging out immediately while 1s message timer is in flight...');
  await useAuthStore.getState().logout();

  // Wait 1300ms for optimistic timer to fire
  await new Promise((r) => setTimeout(r, 1300));

  // Check if Grace's message resurrected in messages or localStorage after logout
  const postTimerMessages = useWorkspaceStore.getState().messages['general'] || [];
  const graceMsgPresent = postTimerMessages.some((m) => m.content === 'Grace transient message');
  const persistedRaw = localStorage.getItem('workspace_persisted_messages_v1');

  console.log(`  Grace in-flight message resurrected in store: ${graceMsgPresent}`);
  console.log(`  LocalStorage recreated by in-flight timer: ${persistedRaw !== null}`);

  assert(
    !graceMsgPresent,
    'In-flight message timer must NOT resurrect logged-out user message in store',
    graceMsgPresent ? 'RACE CONDITION DETECTED: In-flight timer restored message after logout' : undefined
  );
  assert(
    persistedRaw === null,
    'In-flight message timer must NOT recreate localStorage cache after logout',
    persistedRaw !== null ? 'CACHE BLEED DETECTED: In-flight timer wrote back to localStorage after logout' : undefined
  );

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`Stress Test Results: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error('Failed Assertions:');
    for (const f of failureDetails) {
      console.error(f);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

runStressTests().catch((err) => {
  console.error('Stress test fatal error:', err);
  process.exit(1);
});
