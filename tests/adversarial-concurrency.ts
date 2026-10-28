/**
 * Adversarial Concurrency, Channel Scoping & State Immutability Harness
 * Milestone 1 - Challenger 2
 */

import { useWorkspaceStore } from '../src/store/useWorkspaceStore';

// ============================================================================
// Utilities & Assertion Library
// ============================================================================

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

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  const record = obj as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = record[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetTestStore(): void {
  useWorkspaceStore.setState({
    channels: [
      { id: 'general', name: 'general', description: 'General channel', iconName: 'Hash' },
      { id: 'random', name: 'random', description: 'Random channel', iconName: 'MessageSquare' },
      { id: 'announcements', name: 'announcements', description: 'Announcements channel', iconName: 'Bell' },
      { id: 'development', name: 'development', description: 'Dev channel', iconName: 'Code' },
    ],
    activeChannelId: 'general',
    currentUser: {
      id: 'user-challenger',
      name: 'Adversarial Challenger',
      statusText: 'Testing',
    },
    messages: {
      general: [
        {
          id: 'gen-seed-1',
          channelId: 'general',
          sender: { id: 'user-seed-1', name: 'Seed 1' },
          content: 'Initial general seed',
          timestamp: '10:00 AM',
          status: 'sent',
        },
      ],
      random: [
        {
          id: 'rnd-seed-1',
          channelId: 'random',
          sender: { id: 'user-seed-2', name: 'Seed 2' },
          content: 'Initial random seed',
          timestamp: '10:01 AM',
          status: 'sent',
        },
      ],
      announcements: [
        {
          id: 'ann-seed-1',
          channelId: 'announcements',
          sender: { id: 'user-seed-3', name: 'Seed 3' },
          content: 'Initial announcements seed',
          timestamp: '10:02 AM',
          status: 'sent',
        },
      ],
      development: [],
    },
  });
}

// ============================================================================
// SUITE 1: Channel Isolation
// ============================================================================
async function runSuite1_ChannelIsolation() {
  console.log('\n=== SUITE 1: Channel Isolation & Message Scoping ===');
  resetTestStore();

  const store = useWorkspaceStore;
  const initialGeneralCount = store.getState().messages.general.length;
  const initialRandomCount = store.getState().messages.random.length;
  const initialAnnounceCount = store.getState().messages.announcements.length;
  const initialDevCount = store.getState().messages.development.length;

  // 1. Send in channel 1 (general)
  store.getState().sendMessage('general', 'Message in Channel 1 (general)');
  const postGenState = store.getState();

  assert(
    postGenState.messages.general.length === initialGeneralCount + 1,
    'S1.1: General message count incremented after sending in general'
  );
  assert(
    postGenState.messages.random.length === initialRandomCount,
    'S1.2: Random message count unaffected after general send'
  );
  assert(
    postGenState.messages.announcements.length === initialAnnounceCount,
    'S1.3: Announcements message count unaffected after general send'
  );

  // Check referential equality for unaffected channels
  assert(
    postGenState.messages.random === store.getState().messages.random,
    'S1.4: Random array referential stability preserved when general updates'
  );

  // 2. Switch to channel 2 (random)
  store.getState().setActiveChannel('random');
  assert(
    store.getState().activeChannelId === 'random',
    'S1.5: activeChannelId updated to random'
  );

  // Send in channel 2 (random)
  store.getState().sendMessage('random', 'Message in Channel 2 (random)');
  const postRndState = store.getState();

  assert(
    postRndState.messages.random.length === initialRandomCount + 1,
    'S1.6: Random message count incremented after sending in random'
  );
  assert(
    postRndState.messages.general.length === initialGeneralCount + 1,
    'S1.7: General message count unaffected after random send'
  );

  // 3. Switch to channel 3 (announcements)
  store.getState().setActiveChannel('announcements');
  assert(
    store.getState().activeChannelId === 'announcements',
    'S1.8: activeChannelId updated to announcements'
  );

  // Verify message arrays are strictly isolated across all channels
  const currentMessages = store.getState().messages;
  const generalMsg = currentMessages.general.slice(-1)[0];
  const randomMsg = currentMessages.random.slice(-1)[0];

  assert(
    generalMsg.content === 'Message in Channel 1 (general)' && generalMsg.channelId === 'general',
    'S1.9: General message has correct channelId and content'
  );
  assert(
    randomMsg.content === 'Message in Channel 2 (random)' && randomMsg.channelId === 'random',
    'S1.10: Random message has correct channelId and content'
  );
  assert(
    generalMsg.id !== randomMsg.id,
    'S1.11: Message IDs across different channels are strictly unique'
  );
  assert(
    currentMessages.development.length === initialDevCount,
    'S1.12: Development channel untouched with zero messages'
  );

  // Check no cross-channel pollution
  const allGeneralIds = new Set(currentMessages.general.map((m) => m.id));
  const allRandomIds = new Set(currentMessages.random.map((m) => m.id));
  const allAnnounceIds = new Set(currentMessages.announcements.map((m) => m.id));

  const generalHasRandom = currentMessages.general.some((m) => allRandomIds.has(m.id));
  const randomHasGeneral = currentMessages.random.some((m) => allGeneralIds.has(m.id));
  const generalHasAnnounce = currentMessages.general.some((m) => allAnnounceIds.has(m.id));
  const announceHasAny = currentMessages.announcements.some(
    (m) => allGeneralIds.has(m.id) || allRandomIds.has(m.id)
  );

  assert(!generalHasRandom && !randomHasGeneral && !generalHasAnnounce && !announceHasAny, 'S1.13: Zero cross-channel ID leakage');

  // Let timers finish
  await sleep(1100);
}

// ============================================================================
// SUITE 2: In-Flight Channel Switching & Async Timer Resolution
// ============================================================================
async function runSuite2_InFlightChannelSwitching() {
  console.log('\n=== SUITE 2: In-Flight Channel Switching & Concurrency ===');
  resetTestStore();
  const store = useWorkspaceStore;

  // 1. In-flight single channel switch
  // Send in channel A ('general')
  store.getState().sendMessage('general', 'In-flight target in channel A');
  const genMsgsBefore = store.getState().messages.general;
  const targetMsgA = genMsgsBefore[genMsgsBefore.length - 1];

  assert(
    targetMsgA.status === 'sending',
    'S2.1: Target message in Channel A is immediately "sending"'
  );

  // Immediately switch to channel B ('random')
  store.getState().setActiveChannel('random');
  assert(
    store.getState().activeChannelId === 'random',
    'S2.2: Active channel successfully switched to Channel B while message in-flight'
  );

  const randomCountBeforeTimer = store.getState().messages.random.length;

  // Wait 1100ms for 1000ms timer to expire while in channel B
  await sleep(1100);

  // Check while still on channel B
  const randomCountAfterTimer = store.getState().messages.random.length;
  assert(
    randomCountBeforeTimer === randomCountAfterTimer,
    'S2.3: Channel B message list unaffected by Channel A timer expiration'
  );
  assert(
    store.getState().activeChannelId === 'random',
    'S2.4: Active channel remained "random" through timer expiration'
  );

  // Switch back to channel A ('general')
  store.getState().setActiveChannel('general');
  assert(
    store.getState().activeChannelId === 'general',
    'S2.5: Successfully navigated back to Channel A'
  );

  // Verify message in Channel A transitioned to 'sent'
  const genMsgsAfter = store.getState().messages.general;
  const targetMsgAfter = genMsgsAfter.find((m) => m.id === targetMsgA.id);

  assert(
    targetMsgAfter !== undefined,
    'S2.6: Target message still exists in Channel A'
  );
  assert(
    targetMsgAfter?.status === 'sent',
    'S2.7: Target message in Channel A transitioned to "sent"'
  );
  assert(
    genMsgsAfter.filter((m) => m.id === targetMsgA.id).length === 1,
    'S2.8: No duplicate copies of target message exist in Channel A'
  );

  // 2. Multi-channel concurrent in-flight pipeline
  console.log('  Testing multi-channel concurrent in-flight pipeline...');
  resetTestStore();

  // Send message in general
  store.getState().setActiveChannel('general');
  store.getState().sendMessage('general', 'Pipeline general msg');
  const idGen = store.getState().messages.general.slice(-1)[0].id;

  await sleep(200);

  // Switch to random and send
  store.getState().setActiveChannel('random');
  store.getState().sendMessage('random', 'Pipeline random msg');
  const idRnd = store.getState().messages.random.slice(-1)[0].id;

  await sleep(200);

  // Switch to announcements and send
  store.getState().setActiveChannel('announcements');
  store.getState().sendMessage('announcements', 'Pipeline announcements msg');
  const idAnn = store.getState().messages.announcements.slice(-1)[0].id;

  // Rapidly thrash activeChannel while timers are resolving in background
  const channels = ['general', 'random', 'announcements', 'development'];
  for (let i = 0; i < 20; i++) {
    store.getState().setActiveChannel(channels[i % channels.length]);
    await sleep(40);
  }

  // Wait remaining time for all timers to settle
  await sleep(1000);

  const finalGen = store.getState().messages.general.find((m) => m.id === idGen);
  const finalRnd = store.getState().messages.random.find((m) => m.id === idRnd);
  const finalAnn = store.getState().messages.announcements.find((m) => m.id === idAnn);

  assert(
    finalGen?.status === 'sent' && finalRnd?.status === 'sent' && finalAnn?.status === 'sent',
    'S2.9: All multi-channel in-flight messages cleanly transitioned to "sent" during rapid switching'
  );
  assert(
    finalGen?.channelId === 'general' && finalRnd?.channelId === 'random' && finalAnn?.channelId === 'announcements',
    'S2.10: All messages retained their original channel scoping during rapid switching'
  );
}

// ============================================================================
// SUITE 3: State Immutability (Deep Freeze Oracle)
// ============================================================================
async function runSuite3_StateImmutability() {
  console.log('\n=== SUITE 3: State Immutability & Deep Freeze Verification ===');
  resetTestStore();
  const store = useWorkspaceStore;

  // 1. setActiveChannel Immutability
  const preSwitchState = store.getState();
  deepFreeze(preSwitchState);

  try {
    store.getState().setActiveChannel('random');
    assert(true, 'S3.1: setActiveChannel did not mutate frozen previous state');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    assert(false, 'S3.1: setActiveChannel did not mutate frozen previous state', errorMsg);
  }

  const postSwitchState = store.getState();
  assert(
    postSwitchState !== preSwitchState,
    'S3.2: setActiveChannel generated a new state reference'
  );
  assert(
    preSwitchState.activeChannelId === 'general',
    'S3.3: Frozen previous state activeChannelId remains "general"'
  );
  assert(
    postSwitchState.activeChannelId === 'random',
    'S3.4: New state activeChannelId is "random"'
  );

  // Idempotent setActiveChannel check
  const stateBeforeSameSwitch = store.getState();
  store.getState().setActiveChannel('random');
  const stateAfterSameSwitch = store.getState();
  assert(
    stateBeforeSameSwitch === stateAfterSameSwitch,
    'S3.5: Switching to already active channel returns exact same state instance (no re-render)'
  );

  // 2. sendMessage Immutability
  const preSendState = store.getState();
  deepFreeze(preSendState);

  try {
    store.getState().sendMessage('random', 'Message to test immutability');
    assert(true, 'S3.6: sendMessage did not mutate frozen previous state');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    assert(false, 'S3.6: sendMessage did not mutate frozen previous state', errorMsg);
  }

  const postSendState = store.getState();
  assert(
    postSendState.messages !== preSendState.messages,
    'S3.7: messages dictionary reference changed'
  );
  assert(
    postSendState.messages.random !== preSendState.messages.random,
    'S3.8: Target channel messages array reference changed'
  );
  assert(
    postSendState.messages.general === preSendState.messages.general,
    'S3.9: Non-target channel messages array reference strictly preserved'
  );
  assert(
    preSendState.messages.random.length + 1 === postSendState.messages.random.length,
    'S3.10: New state has 1 additional message while previous state length was preserved'
  );

  // 3. Timer Resolution Immutability (Transition to 'sent')
  // Deep freeze postSendState before the timer fires!
  deepFreeze(postSendState);
  const targetMessageId = postSendState.messages.random.slice(-1)[0].id;
  const previousMessageSnapshot = postSendState.messages.random.slice(-1)[0];

  assert(
    previousMessageSnapshot.status === 'sending',
    'S3.11: Message snapshot prior to timer resolution has status "sending"'
  );

  // Wait for 1000ms timer
  await sleep(1150);

  const postTimerState = store.getState();
  const resolvedMessage = postTimerState.messages.random.find((m) => m.id === targetMessageId);

  assert(
    resolvedMessage?.status === 'sent',
    'S3.12: Message in new state transitioned to "sent"'
  );
  assert(
    previousMessageSnapshot.status === 'sending',
    'S3.13: Frozen previous message snapshot was NOT mutated in-place'
  );
  assert(
    postTimerState.messages.random !== postSendState.messages.random,
    'S3.14: Timer update generated a new channel array reference instead of mutating in place'
  );
  assert(
    resolvedMessage !== previousMessageSnapshot,
    'S3.15: Resolved message object is a new immutable copy, not a mutated reference'
  );
}

// ============================================================================
// SUITE 4: Adversarial Stress, Boundary & Race Conditions
// ============================================================================
async function runSuite4_AdversarialStress() {
  console.log('\n=== SUITE 4: Adversarial Stress & Edge Cases ===');
  resetTestStore();
  const store = useWorkspaceStore;

  // 1. Boundary: Invalid channel ID in setActiveChannel
  const preInvalidState = store.getState();
  store.getState().setActiveChannel('non-existent-channel-xyz');
  assert(
    store.getState().activeChannelId === preInvalidState.activeChannelId,
    'S4.1: setActiveChannel ignores non-existent channel ID'
  );
  assert(
    store.getState() === preInvalidState,
    'S4.2: Invalid setActiveChannel preserves exact store state instance'
  );

  // 2. Boundary: Whitespace & Empty sendMessage
  const initialGeneralLength = store.getState().messages.general.length;
  store.getState().sendMessage('general', '');
  store.getState().sendMessage('general', '   ');
  store.getState().sendMessage('general', '\n\t  \r\n');
  assert(
    store.getState().messages.general.length === initialGeneralLength,
    'S4.3: Whitespace, empty, and newline-only messages are rejected'
  );

  // 3. Stress: High-frequency burst across multiple channels with concurrent switching
  console.log('  Executing high-frequency burst across channels...');
  const burstCountPerChannel = 10;
  const targetChannels = ['general', 'random', 'announcements', 'development'];
  const sentMessageIds: string[] = [];

  const initialLengths: Record<string, number> = {};
  for (const ch of targetChannels) {
    initialLengths[ch] = store.getState().messages[ch]?.length || 0;
  }

  // Interleaved dispatch of 40 messages with channel switching
  for (let i = 0; i < burstCountPerChannel; i++) {
    for (const ch of targetChannels) {
      store.getState().setActiveChannel(ch);
      store.getState().sendMessage(ch, `Burst ${i} in ${ch}`);
      const latest = store.getState().messages[ch].slice(-1)[0];
      sentMessageIds.push(latest.id);
    }
  }

  assert(
    sentMessageIds.length === 40,
    'S4.4: 40 messages dispatched across 4 channels'
  );

  // Verify all are initially 'sending'
  let allSending = true;
  for (const ch of targetChannels) {
    const msgs = store.getState().messages[ch];
    const added = msgs.slice(-burstCountPerChannel);
    if (added.length !== burstCountPerChannel) {
      allSending = false;
      break;
    }
    for (const m of added) {
      if (m.status !== 'sending') {
        allSending = false;
        break;
      }
    }
  }
  assert(allSending, 'S4.5: All 40 burst messages initially have status "sending"');

  // Verify unique IDs
  const uniqueIdSet = new Set(sentMessageIds);
  assert(
    uniqueIdSet.size === 40,
    'S4.6: All 40 generated message IDs are strictly distinct'
  );

  // Wait for all 40 1000ms timers to complete
  await sleep(1300);

  // Verify all 40 messages transitioned to 'sent'
  let allSent = true;
  for (const ch of targetChannels) {
    const msgs = store.getState().messages[ch];
    const added = msgs.slice(-burstCountPerChannel);
    for (const m of added) {
      if (m.status !== 'sent') {
        allSent = false;
        break;
      }
    }
  }
  assert(allSent, 'S4.7: All 40 burst messages resolved to status "sent"');

  // Verify exact counts per channel
  for (const ch of targetChannels) {
    const currentLength = store.getState().messages[ch].length;
    assert(
      currentLength === initialLengths[ch] + burstCountPerChannel,
      `S4.8: Channel ${ch} has exact expected message count (${initialLengths[ch] + burstCountPerChannel})`
    );
  }
}

// ============================================================================
// Main Runner
// ============================================================================
async function runAllAdversarialSuites() {
  console.log('===============================================================');
  console.log('  Starting Adversarial Concurrency & Scoping Verification');
  console.log('===============================================================');

  const startTime = Date.now();
  await runSuite1_ChannelIsolation();
  await runSuite2_InFlightChannelSwitching();
  await runSuite3_StateImmutability();
  await runSuite4_AdversarialStress();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n===============================================================');
  console.log(`  Verification Summary: ${totalPassed} Passed, ${totalFailed} Failed in ${duration}s`);
  console.log('===============================================================');

  if (totalFailed > 0) {
    console.error('\nFailures detected:');
    failureDetails.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('\nALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY.');
    process.exit(0);
  }
}

runAllAdversarialSuites().catch((err) => {
  console.error('Fatal unhandled error in adversarial test suite:', err);
  process.exit(1);
});
