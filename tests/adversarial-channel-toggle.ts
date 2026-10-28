/**
 * Milestone 2 Challenger 2: Adversarial Stress Test Harness
 * Rapid Channel Toggling, Zustand Integration & UI Synchronization
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { useAuthStore } from '../src/store/useAuthStore';
import { Sidebar } from '../src/components/Sidebar/Sidebar';
import { ChannelList } from '../src/components/Sidebar/ChannelList';
import Home from '../src/app/page';
import type { Channel } from '../src/types';

// Simulate React Client-Side hydration/rendering for useSyncExternalStore
// (In Node.js, React default SSR calls getServerSnapshot which freezes initial state;
// this enables accurate client-side getSnapshot evaluation on state updates)
(React as unknown as { useSyncExternalStore: (sub: unknown, getSnap: () => unknown) => unknown }).useSyncExternalStore =
  (_sub: unknown, getSnap: () => unknown) => getSnap();

let testsPassed = 0;
let testsFailed = 0;
const failureLog: string[] = [];

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    testsFailed++;
    const msg = `  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`;
    console.error(msg);
    failureLog.push(msg);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function resetStoreToDefault() {
  useWorkspaceStore.setState({
    channels: [
      { id: 'general', name: 'general', description: 'General channel', iconName: 'Hash' },
      { id: 'random', name: 'random', description: 'Random channel', iconName: 'MessageSquare' },
      { id: 'announcements', name: 'announcements', description: 'Announcements channel', iconName: 'Bell' },
      { id: 'development', name: 'development', description: 'Dev channel', iconName: 'Code' },
    ],
    activeChannelId: 'general',
    currentUser: {
      id: 'challenger-2-user',
      name: 'Challenger 2',
      statusText: 'Stress Testing',
    },
    messages: {
      general: [],
      random: [],
      announcements: [],
      development: [],
    },
  });

  useAuthStore.setState({
    user: {
      id: 'challenger-2-user',
      name: 'Challenger 2',
      email: 'challenger2@workspace.test',
      statusText: 'Stress Testing',
    },
    isInitialized: true,
    isLoading: false,
    error: null,
  });
}

// ============================================================================
// STRESS TEST 1: Rapid 10,000 Burst Channel Toggling
// ============================================================================
async function testBurstChannelToggling() {
  console.log('\n--- TEST 1: Rapid 10,000 Burst Channel Toggling ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  const channelSequence = ['random', 'announcements', 'development', 'general'];
  const iterations = 2500; // 2500 * 4 = 10,000 toggles
  let notificationCount = 0;

  const unsubscribe = store.subscribe(() => {
    notificationCount++;
  });

  const startTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    for (const channelId of channelSequence) {
      store.getState().setActiveChannel(channelId);
    }
  }
  const duration = Date.now() - startTime;

  assert(
    store.getState().activeChannelId === 'general',
    'T1.1: Store activeChannelId strictly matches the final toggled channel ("general")'
  );
  assert(
    notificationCount === 10000,
    `T1.2: Zustand store fired exact subscriber notification count (expected 10000, got ${notificationCount})`
  );
  console.log(`       Completed 10,000 switches in ${duration}ms (${(10000 / (duration / 1000)).toFixed(0)} ops/sec)`);

  unsubscribe();
}

// ============================================================================
// STRESS TEST 2: Idempotent & Ping-Pong Toggling (Redundant Clicks)
// ============================================================================
async function testIdempotentAndPingPong() {
  console.log('\n--- TEST 2: Idempotent Redundant Clicks & Ping-Pong Toggling ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  let listenerFiredCount = 0;
  const unsubscribe = store.subscribe(() => {
    listenerFiredCount++;
  });

  // Clicking same channel 1,000 times should NOT fire store notifications
  for (let i = 0; i < 1000; i++) {
    store.getState().setActiveChannel('general');
  }

  assert(
    listenerFiredCount === 0,
    `T2.1: Redundant clicks on already active channel do not trigger state mutations or re-renders (got ${listenerFiredCount})`
  );

  // Ping-pong between 'general' and 'random' 1,000 times
  for (let i = 0; i < 1000; i++) {
    const target = i % 2 === 0 ? 'random' : 'general';
    store.getState().setActiveChannel(target);
    const current = store.getState().activeChannelId;
    if (current !== target) {
      assert(false, `T2.2: Desynchronization detected at ping-pong iteration ${i}`);
      return;
    }
  }

  assert(
    store.getState().activeChannelId === 'general',
    'T2.2: 1,000 ping-pong switches resolved accurately with zero desync'
  );
  assert(
    listenerFiredCount === 1000,
    `T2.3: Listener fired exactly 1,000 times for 1,000 ping-pong switches (got ${listenerFiredCount})`
  );

  unsubscribe();
}

// ============================================================================
// STRESS TEST 3: UI Rendering Synchronization (Sidebar, ChannelList, ChatArea)
// ============================================================================
async function testUIRenderingSync() {
  console.log('\n--- TEST 3: UI Rendering Synchronization (Sidebar, ChannelList, ChatArea) ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  const testChannels = ['general', 'random', 'announcements', 'development'];

  // Test that for every channel, rendering React UI components reflects the active state accurately
  for (const targetChannel of testChannels) {
    store.getState().setActiveChannel(targetChannel);

    // Render full Home page (Sidebar + ChatArea)
    const homeHtml = renderToString(React.createElement(Home));

    // Verify ChatArea header reflects target channel
    const expectedHeaderChannel = `data-testid="chat-channel-name">${targetChannel}</h2>`;
    assert(
      homeHtml.includes(expectedHeaderChannel),
      `T3.1 [${targetChannel}]: ChatArea header name reflects "${targetChannel}"`
    );

    const expectedActiveIdTag = `Active Channel ID: <code class="text-zinc-200 font-mono">${targetChannel}</code>`;
    assert(
      homeHtml.includes(expectedActiveIdTag),
      `T3.2 [${targetChannel}]: ChatArea Active Channel ID tag matches "${targetChannel}"`
    );

    // Verify ChannelItem rendering in Sidebar
    for (const ch of store.getState().channels) {
      const isTarget = ch.id === targetChannel;
      const expectedAttr = `data-channel-id="${ch.id}" data-active="${isTarget ? 'true' : 'false'}"`;
      assert(
        homeHtml.includes(expectedAttr),
        `T3.3 [${targetChannel}]: Channel item "${ch.id}" has correct data-active="${isTarget}"`
      );

      if (isTarget) {
        assert(
          homeHtml.includes(`data-channel-id="${ch.id}" data-active="true" aria-current="page"`),
          `T3.4 [${targetChannel}]: Active channel item "${ch.id}" has aria-current="page"`
        );
        assert(
          homeHtml.includes(`data-testid="channel-item active-channel"`),
          `T3.5 [${targetChannel}]: Active channel item has testid "channel-item active-channel"`
        );
      }
    }
  }
}

// ============================================================================
// STRESS TEST 4: Rapid Channel Toggling with In-Flight Concurrent Messages
// ============================================================================
async function testRapidTogglingWithInFlightMessages() {
  console.log('\n--- TEST 4: Rapid Channel Toggling with In-Flight Messages ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  const channels = ['general', 'random', 'announcements', 'development'];
  const dispatchedIds: { id: string; channelId: string }[] = [];

  // Dispatch messages while actively toggling channels
  for (let i = 0; i < 20; i++) {
    const ch = channels[i % channels.length];
    store.getState().setActiveChannel(ch);
    store.getState().sendMessage(ch, `Concurrent stress message ${i}`);

    const latest = store.getState().messages[ch].slice(-1)[0];
    dispatchedIds.push({ id: latest.id, channelId: ch });

    // Thrash activeChannel immediately after dispatching
    store.getState().setActiveChannel(channels[(i + 1) % channels.length]);
    store.getState().setActiveChannel(channels[(i + 2) % channels.length]);
  }

  assert(
    dispatchedIds.length === 20,
    'T4.1: Successfully queued 20 messages while thrashing activeChannel'
  );

  // During delay, rapidly switch channels 100 times
  for (let j = 0; j < 100; j++) {
    store.getState().setActiveChannel(channels[j % channels.length]);
    await sleep(10);
  }

  // Wait for 1000ms async delay timers to settle
  await sleep(1200);

  // Verify all 20 messages cleanly resolved to 'sent' in their respective channels
  let allSent = true;
  let allCorrectChannel = true;
  for (const item of dispatchedIds) {
    const msg = store.getState().messages[item.channelId]?.find((m) => m.id === item.id);
    if (!msg || msg.status !== 'sent') {
      allSent = false;
    }
    if (!msg || msg.channelId !== item.channelId) {
      allCorrectChannel = false;
    }
  }

  assert(allSent, 'T4.2: All 20 messages resolved to status="sent" despite 100 rapid channel switches');
  assert(allCorrectChannel, 'T4.3: All 20 messages remained strictly scoped to their original channels');

  // Verify message counts: 20 messages across 4 channels = 5 messages each
  for (const ch of channels) {
    const count = store.getState().messages[ch].length;
    assert(
      count === 5,
      `T4.4: Channel "${ch}" contains exactly 5 messages (got ${count})`
    );
  }
}

// ============================================================================
// STRESS TEST 5: Adversarial Inputs & Fuzzing setActiveChannel
// ============================================================================
async function testAdversarialChannelInputs() {
  console.log('\n--- TEST 5: Adversarial Inputs & Fuzzing setActiveChannel ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  const validChannels = ['general', 'random', 'announcements', 'development'];
  store.getState().setActiveChannel('random');
  const baselineChannel = store.getState().activeChannelId;
  assert(baselineChannel === 'random', 'T5.1: Baseline activeChannelId is "random"');

  const adversarialInputs = [
    '',
    '   ',
    'null',
    'undefined',
    'GENERAL', // case mismatch
    'Random',
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
    '<script>alert(1)</script>',
    'DROP TABLE channels;--',
    '../general',
    '/etc/passwd',
    'non_existent_id_404',
    '🔔 emoji id',
    'a'.repeat(1000),
  ];

  let stateCorrupted = false;
  for (const badInput of adversarialInputs) {
    try {
      store.getState().setActiveChannel(badInput as string);
      const current = store.getState().activeChannelId;
      if (!validChannels.includes(current)) {
        stateCorrupted = true;
        console.error(`      Corrupted by input: "${badInput}" -> activeChannelId="${current}"`);
      }
    } catch (err) {
      stateCorrupted = true;
      console.error(`      Threw exception on input "${badInput}":`, err);
    }
  }

  assert(
    !stateCorrupted,
    'T5.2: Adversarial channel inputs do not corrupt activeChannelId or throw exceptions'
  );
  assert(
    store.getState().activeChannelId === 'random',
    'T5.3: activeChannelId preserved as "random" throughout all adversarial inputs'
  );
}

// ============================================================================
// STRESS TEST 6: Channel List Dynamic Modifications Under Toggling
// ============================================================================
async function testDynamicChannelListUnderToggling() {
  console.log('\n--- TEST 6: Dynamic Channel List Modifications Under Toggling ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  // Add 10 dynamic channels
  const extraChannels: Channel[] = Array.from({ length: 10 }, (_, i) => ({
    id: `dyn-channel-${i}`,
    name: `dynamic-${i}`,
    description: `Dynamic test channel ${i}`,
    iconName: 'Hash' as const,
  }));

  store.setState({
    channels: [...store.getState().channels, ...extraChannels],
    messages: {
      ...store.getState().messages,
      ...Object.fromEntries(extraChannels.map((c) => [c.id, []])),
    },
  });

  assert(
    store.getState().channels.length === 14,
    'T6.1: Channels count expanded to 14'
  );

  // Switch across all 14 channels rapidly and render ChannelList
  for (const ch of store.getState().channels) {
    store.getState().setActiveChannel(ch.id);
    assert(
      store.getState().activeChannelId === ch.id,
      `T6.2: Switched cleanly to dynamic channel "${ch.id}"`
    );

    const html = renderToString(React.createElement(ChannelList));
    assert(
      html.includes(`data-channel-id="${ch.id}" data-active="true"`),
      `T6.3: ChannelList rendered dynamic channel "${ch.id}" as active`
    );
  }
}

// ============================================================================
// STRESS TEST 7: Simulated UI Click Rapid-Fire Stream
// ============================================================================
async function testSimulatedRapidClicks() {
  console.log('\n--- TEST 7: Simulated Rapid UI Click Stream ---');
  resetStoreToDefault();
  const store = useWorkspaceStore;

  const channels = store.getState().channels;

  // Rapidly trigger the exact onClick handler that ChannelItem binds
  const clickCount = 500;
  for (let i = 0; i < clickCount; i++) {
    const targetChannel = channels[i % channels.length];
    // ChannelItem handleClick calls setActiveChannel(channel.id)
    store.getState().setActiveChannel(targetChannel.id);

    // Verify immediate UI consistency
    const currentActive = store.getState().activeChannelId;
    if (currentActive !== targetChannel.id) {
      assert(false, `T7.1: UI click desync at iteration ${i}`);
      return;
    }
  }

  assert(
    true,
    'T7.1: 500 rapid simulated UI clicks processed synchronously with zero lag or desync'
  );

  const finalHtml = renderToString(React.createElement(Sidebar));
  const activeChannelId = store.getState().activeChannelId;
  assert(
    finalHtml.includes(`data-channel-id="${activeChannelId}" data-active="true"`),
    `T7.2: Sidebar renders final active channel "${activeChannelId}" highlighted`
  );
}

// ============================================================================
// Main Execution
// ============================================================================
async function runAllStressTests() {
  console.log('================================================================');
  console.log('   WORKSPACE-APP ADVERSARIAL STRESS TEST HARNESS (M2 C2)');
  console.log('================================================================');

  const start = Date.now();
  await testBurstChannelToggling();
  await testIdempotentAndPingPong();
  await testUIRenderingSync();
  await testRapidTogglingWithInFlightMessages();
  await testAdversarialChannelInputs();
  await testDynamicChannelListUnderToggling();
  await testSimulatedRapidClicks();

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`   ADVERSARIAL STRESS SUMMARY: ${testsPassed} passed, ${testsFailed} failed in ${duration}s`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    console.error('Failures encountered:');
    failureLog.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('✅ ALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runAllStressTests().catch((err) => {
  console.error('Fatal unhandled error:', err);
  process.exit(1);
});
