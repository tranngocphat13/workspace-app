import assert from 'node:assert';
import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import type { AuthUser } from '../src/types';

// Mock browser localStorage for Node.js test environment if not defined
const storageMap = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let passedCount = 0;
let failedCount = 0;

function report(description: string, passed: boolean, details?: string) {
  if (passed) {
    passedCount++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${description}${details ? ' - ' + details : ''}`);
  }
}

async function runAdversarialStressTest() {
  console.log('================================================================');
  console.log('   CHALLENGER ADVERSARIAL STRESS TEST: ISOLATION & PURGING');
  console.log('================================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Multi-Channel In-Flight Burst + Instant Account Switch
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Challenge 1: Multi-Channel In-Flight Burst + Direct Switch ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  await useAuthStore.getState().logout();

  // Login as Alice
  await useAuthStore.getState().login('alice.secret@adversary.com', 'SuperSecretPass123!');
  report('Alice logged in', useAuthStore.getState().user?.email === 'alice.secret@adversary.com');

  // Alice creates 2 custom classified channels
  await useWorkspaceStore.getState().createChannel('classified-alpha', 'Top secret channel');
  await useWorkspaceStore.getState().createChannel('restricted-beta', 'Confidential channel');
  report(
    'Alice custom channels created in store',
    useWorkspaceStore.getState().channels.some((c) => c.id === 'classified-alpha') &&
      useWorkspaceStore.getState().channels.some((c) => c.id === 'restricted-beta')
  );

  // Alice sends in-flight messages across 4 channels simultaneously
  useWorkspaceStore.getState().sendMessage('general', 'Alice general in-flight message');
  useWorkspaceStore.getState().sendMessage('development', 'Alice dev in-flight message');
  useWorkspaceStore.getState().sendMessage('classified-alpha', 'Alice secret alpha leak test');
  useWorkspaceStore.getState().sendMessage('restricted-beta', 'Alice secret beta leak test');

  // Verify messages are currently in "sending" status
  const aliceAlphaMsgs = useWorkspaceStore.getState().messages['classified-alpha'] || [];
  report(
    'Alice messages pending sending',
    aliceAlphaMsgs.some((m) => m.content.includes('secret alpha leak test'))
  );

  // Immediately (5ms later, before the 1000ms delay timer fires), directly switch to Bob
  await sleep(10);
  console.log('  Directly switching from Alice to Bob while 4 channel timers are pending...');
  await useAuthStore.getState().login('bob.innocent@adversary.com', 'Pass4Bob!');

  report(
    'Bob successfully authenticated',
    (useWorkspaceStore.getState().currentUser as AuthUser).email === 'bob.innocent@adversary.com'
  );

  // Sleep 1200ms to allow all original Alice 1000ms delay timers to expire
  console.log('  Sleeping 1200ms to observe if any Alice timers resurrect state...');
  await sleep(1200);

  const bobChannels = useWorkspaceStore.getState().channels;
  const bobHasAlpha = bobChannels.some((c) => c.id === 'classified-alpha');
  const bobHasBeta = bobChannels.some((c) => c.id === 'restricted-beta');
  report('Bob channels do NOT contain classified-alpha', !bobHasAlpha);
  report('Bob channels do NOT contain restricted-beta', !bobHasBeta);

  const bobMessages = useWorkspaceStore.getState().messages;
  let leakedAliceMessages = 0;
  for (const channelId of Object.keys(bobMessages)) {
    const msgs = bobMessages[channelId] || [];
    for (const m of msgs) {
      if (m.content.includes('Alice')) {
        leakedAliceMessages++;
      }
    }
  }
  report('Zero Alice messages leaked to Bob in memory', leakedAliceMessages === 0);

  const rawStorageChannels = localStorage.getItem('workspace_persisted_channels_v1') || '';
  const rawStorageMessages = localStorage.getItem('workspace_persisted_messages_v1') || '';
  report('LocalStorage channels does NOT contain classified-alpha', !rawStorageChannels.includes('classified-alpha'));
  report('LocalStorage channels does NOT contain restricted-beta', !rawStorageChannels.includes('restricted-beta'));
  report('LocalStorage messages does NOT contain Alice content', !rawStorageMessages.includes('Alice'));

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: High-Frequency Ping-Pong Authentication Storm (20 rapid switches)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Challenge 2: High-Frequency Ping-Pong Authentication Storm ---');
  for (let i = 0; i < 20; i++) {
    const isEven = i % 2 === 0;
    const userEmail = isEven ? `userA_${i}@test.com` : `userB_${i}@test.com`;
    const userName = isEven ? `UserA_${i}` : `UserB_${i}`;

    // Rapid register or login
    if (i % 3 === 0) {
      await useAuthStore.getState().register(userName, userEmail, 'storm-pass-123');
    } else {
      await useAuthStore.getState().login(userEmail, 'storm-pass-123');
    }

    // Immediately trigger a message
    useWorkspaceStore.getState().sendMessage('general', `Rapid burst message from ${userName} at iter ${i}`);
    await sleep(25); // 25ms interval: timers are stacked and pending
  }

  // Settle on Final User
  await useAuthStore.getState().login('final.user@test.com', 'final-pass');
  report(
    'Final user logged in after 20 rapid switches',
    (useWorkspaceStore.getState().currentUser as AuthUser).email === 'final.user@test.com'
  );

  console.log('  Waiting 1250ms for storm timers to finish resolution...');
  await sleep(1250);

  const finalMessages = useWorkspaceStore.getState().messages['general'] || [];
  const leakedStormMessages = finalMessages.filter((m) => m.content.includes('Rapid burst message from'));
  report(
    'No in-flight storm messages resurrected into final user session',
    leakedStormMessages.length === 0,
    `Found ${leakedStormMessages.length} resurrected messages`
  );

  const finalStoredMsgs = localStorage.getItem('workspace_persisted_messages_v1') || '';
  report(
    'LocalStorage does not hold dirty storm messages after final switch',
    !finalStoredMsgs.includes('Rapid burst message from')
  );

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Direct Registration Switch with Immediate Channel Post
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Challenge 3: Direct Registration Switch with Custom Channels ---');
  await useAuthStore.getState().register('Eve', 'eve@hacker.corp', 'Pass123!');
  await useWorkspaceStore.getState().createChannel('eve-exploit-hub', 'Zero day channel');
  useWorkspaceStore.getState().sendMessage('eve-exploit-hub', 'Payload X');

  // Direct switch to Frank via registration
  await sleep(5);
  await useAuthStore.getState().register('Frank', 'frank@guardian.org', 'Pass456!');
  report('Frank registered and active', (useWorkspaceStore.getState().currentUser as AuthUser).name === 'Frank');

  await sleep(1100);
  const frankChannels = useWorkspaceStore.getState().channels;
  report('Frank cannot see eve-exploit-hub', !frankChannels.some((c) => c.id === 'eve-exploit-hub'));
  report(
    'Frank messages record does NOT retain eve-exploit-hub messages',
    !useWorkspaceStore.getState().messages['eve-exploit-hub']
  );

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Immediate Logout While In-Flight Message Delay Active
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Challenge 4: Immediate Logout During Delay ---');
  await useAuthStore.getState().login('grace@test.com', 'gracepass');
  useWorkspaceStore.getState().sendMessage('general', 'Grace transient message');
  report(
    'Grace message in sending state',
    (useWorkspaceStore.getState().messages['general'] || []).some((m) => m.content === 'Grace transient message')
  );

  // Instant logout at 50ms
  await sleep(50);
  await useAuthStore.getState().logout();

  report('Auth user is null post-logout', useAuthStore.getState().user === null);
  report('LocalStorage cleared immediately', localStorage.getItem('workspace_persisted_messages_v1') === null);

  console.log('  Waiting 1200ms to ensure Grace timer does not fire and re-write localStorage...');
  await sleep(1200);

  report(
    'LocalStorage remains null after timer duration',
    localStorage.getItem('workspace_persisted_messages_v1') === null
  );
  report(
    'Store messages general does not contain Grace transient message',
    !(useWorkspaceStore.getState().messages['general'] || []).some((m) => m.content === 'Grace transient message')
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`Challenger Stress Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialStressTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
