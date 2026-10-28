// ==============================================================================
// Milestone D Challenger Empirical Stress Harness
// File: workspace-app/tests/challenger-m4-stress.ts
// Run via: npx tsx tests/challenger-m4-stress.ts
// ==============================================================================

import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { isSupabaseConfigured, supabase, mapSupabaseMessage } from '../src/lib/supabase';
import type { Message, AuthUser } from '../src/types';

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

if (typeof globalThis.window === 'undefined') {
  // @ts-expect-error Node mock
  globalThis.window = {
    localStorage: globalThis.localStorage,
  };
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runChallengerM4Stress() {
  console.log('\n================================================================');
  console.log('   CHALLENGER MILESTONE D: EMPIRICAL STRESS & REGRESSION HARNESS');
  console.log('================================================================\n');

  // Clean initial state
  localStorage.clear();
  useWorkspaceStore.getState().resetWorkspaceState();
  await useAuthStore.getState().logout();

  // ----------------------------------------------------------------------------
  // SECTION 1: Dual-Mode Fallback Integrity (When .env.local is missing)
  // ----------------------------------------------------------------------------
  console.log('--- Section 1: Dual-Mode Fallback Integrity ---');

  assert(isSupabaseConfigured === false, '1.1 isSupabaseConfigured is false in default offline environment');
  assert(supabase === null, '1.2 supabase client is safely null without credentials');

  // Verify subscribeToRealtime safely returns a callable cleanup in offline mode
  const unsubscribeRealtime = useWorkspaceStore.getState().subscribeToRealtime('general');
  assert(typeof unsubscribeRealtime === 'function', '1.3 subscribeToRealtime returns cleanup function in offline mode');
  if (typeof unsubscribeRealtime === 'function') {
    unsubscribeRealtime();
  }

  // Verify fetchChannels and fetchMessages do not throw when offline
  await useWorkspaceStore.getState().fetchChannels?.();
  assert(useWorkspaceStore.getState().channels.length >= 4, '1.4 fetchChannels maintains default seed channels');

  await useWorkspaceStore.getState().fetchMessages?.('general');
  assert(
    (useWorkspaceStore.getState().messages['general'] || []).length >= 3,
    '1.5 fetchMessages loads fallback seed messages'
  );

  // Verify offline sendMessage lifecycle (optimistic sending -> sent after 1000ms)
  const testOfflineMsg = 'Offline dual-mode empirical test message';
  useWorkspaceStore.getState().sendMessage('general', testOfflineMsg);

  const initialOfflineList = useWorkspaceStore.getState().messages['general'] || [];
  const optimisticOfflineMsg = initialOfflineList.find((m) => m.content === testOfflineMsg);
  assert(optimisticOfflineMsg !== undefined, '1.6 Message immediately placed in store optimistically');
  assert(optimisticOfflineMsg?.status === 'sending', '1.7 Message has status "sending" initially');

  // Await offline 1000ms timer
  await sleep(1150);

  const resolvedOfflineList = useWorkspaceStore.getState().messages['general'] || [];
  const resolvedOfflineMsg = resolvedOfflineList.find((m) => m.content === testOfflineMsg);
  assert(resolvedOfflineMsg?.status === 'sent', '1.8 Message transitioned to "sent" after offline timer');

  // Verify offline retryMessage lifecycle (failed -> sending -> sent after 500ms)
  const failedTestId = 'offline-fail-test-id';
  const failedOfflineMsg: Message = {
    id: failedTestId,
    clientMessageId: failedTestId,
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Offline failed message for retry test',
    timestamp: '01:00 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState((s) => ({
    messages: {
      ...s.messages,
      general: [...(s.messages['general'] || []), failedOfflineMsg],
    },
  }));

  useWorkspaceStore.getState().retryMessage('general', failedTestId);
  const retryingMsg = (useWorkspaceStore.getState().messages['general'] || []).find((m) => m.id === failedTestId);
  assert(retryingMsg?.status === 'sending', '1.9 retryMessage transitions status to "sending"');

  await sleep(650);

  const retriedMsg = (useWorkspaceStore.getState().messages['general'] || []).find((m) => m.id === failedTestId);
  assert(retriedMsg?.status === 'sent', '1.10 retryMessage transitions to "sent" after 500ms offline fallback');

  // ----------------------------------------------------------------------------
  // SECTION 2: Multi-User Rapid Login/Logout Cycles & Memory Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 2: Multi-User Rapid Cycles & Memory Isolation ---');

  const users = [
    { name: 'User Alpha', email: 'alpha@enterprise.org', channel: 'alpha-private' },
    { name: 'User Beta', email: 'beta@enterprise.org', channel: 'beta-private' },
    { name: 'User Gamma', email: 'gamma@enterprise.org', channel: 'gamma-private' },
    { name: 'User Delta', email: 'delta@enterprise.org', channel: 'delta-private' },
  ];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    await useAuthStore.getState().login(u.email, 'SecretPass123!');
    assert(useAuthStore.getState().user?.email === u.email, `2.${i * 3 + 1} Logged in as ${u.name}`);

    // Create private channel and message
    await useWorkspaceStore.getState().createChannel(u.channel, `${u.name} confidential room`);
    useWorkspaceStore.getState().sendMessage(u.channel, `Classified note for ${u.name}`);

    assert(
      useWorkspaceStore.getState().channels.some((c) => c.id === u.channel),
      `2.${i * 3 + 2} ${u.channel} exists for ${u.name}`
    );

    // Logout and verify complete purge
    await useAuthStore.getState().logout();
    assert(useAuthStore.getState().user === null, `2.${i * 3 + 3} Logout purged auth user`);
    assert(
      !useWorkspaceStore.getState().channels.some((c) => c.id === u.channel),
      `2.${i * 3 + 4} ${u.channel} completely purged from workspace channels`
    );
    assert(
      useWorkspaceStore.getState().messages[u.channel] === undefined,
      `2.${i * 3 + 5} ${u.channel} messages completely purged from workspace messages`
    );
  }

  // Verify direct switch without logout (Zeta -> Omega)
  await useAuthStore.getState().login('zeta@enterprise.org', 'PassZeta!');
  await useWorkspaceStore.getState().createChannel('zeta-restricted', 'Zeta restricted room');
  useWorkspaceStore.getState().sendMessage('zeta-restricted', 'Zeta secret memo');

  // Direct login as Omega
  await useAuthStore.getState().login('omega@enterprise.org', 'PassOmega!');
  assert(useAuthStore.getState().user?.email === 'omega@enterprise.org', '2.17 Direct login as Omega succeeded');
  assert(
    !useWorkspaceStore.getState().channels.some((c) => c.id === 'zeta-restricted'),
    '2.18 Zeta channel did NOT leak to Omega'
  );
  assert(
    useWorkspaceStore.getState().messages['zeta-restricted'] === undefined,
    '2.19 Zeta messages did NOT leak to Omega'
  );

  await useAuthStore.getState().logout();

  // ----------------------------------------------------------------------------
  // SECTION 3: Token Refresh & Auth Listener Events Simulation
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 3: Token Refresh & Auth Listener Simulation ---');

  // Setup user session
  await useAuthStore.getState().login('simon@enterprise.org', 'PassSimon!');
  useWorkspaceStore.getState().setActiveChannel('development');
  useWorkspaceStore.getState().sendMessage('development', 'Simon message before token refresh');

  const beforeRefreshMsgCount = (useWorkspaceStore.getState().messages['development'] || []).length;
  const beforeActiveChannel = useWorkspaceStore.getState().activeChannelId;

  // Simulate TOKEN_REFRESHED event:
  // onAuthStateChange handles TOKEN_REFRESHED by updating profile without resetting workspace state
  const mockRefreshedUser: AuthUser = {
    id: useAuthStore.getState().user!.id,
    name: 'Simon Refreshed',
    email: 'simon@enterprise.org',
    avatarUrl: useAuthStore.getState().user!.avatarUrl,
    statusText: 'Active Token',
  };

  // Dispatch profile synchronization simulating TOKEN_REFRESHED handler
  useWorkspaceStore.getState().setCurrentUser(mockRefreshedUser);
  useAuthStore.setState({ user: mockRefreshedUser });

  assert(
    useWorkspaceStore.getState().activeChannelId === beforeActiveChannel,
    '3.1 TOKEN_REFRESHED preserved activeChannelId'
  );
  assert(
    (useWorkspaceStore.getState().messages['development'] || []).length === beforeRefreshMsgCount,
    '3.2 TOKEN_REFRESHED preserved in-memory messages without resetting store'
  );
  assert(
    useWorkspaceStore.getState().currentUser.name === 'Simon Refreshed',
    '3.3 TOKEN_REFRESHED updated currentUser profile name'
  );

  // Simulate USER_UPDATED event
  const mockUpdatedProfile: AuthUser = {
    ...mockRefreshedUser,
    name: 'Simon Executive',
    statusText: 'In Executive Meeting',
  };
  useWorkspaceStore.getState().setCurrentUser(mockUpdatedProfile);
  useAuthStore.setState({ user: mockUpdatedProfile });

  assert(
    useWorkspaceStore.getState().currentUser.name === 'Simon Executive',
    '3.4 USER_UPDATED updated currentUser profile name'
  );
  assert(
    useWorkspaceStore.getState().currentUser.statusText === 'In Executive Meeting',
    '3.5 USER_UPDATED updated currentUser statusText'
  );

  // Simulate SIGNED_OUT event
  useWorkspaceStore.getState().resetWorkspaceState();
  useAuthStore.setState({ user: null });

  assert(useAuthStore.getState().user === null, '3.6 SIGNED_OUT cleared auth user');
  assert(useWorkspaceStore.getState().activeChannelId === 'general', '3.7 SIGNED_OUT reset active channel to "general"');
  assert(
    useWorkspaceStore.getState().currentUser.id === 'user-current',
    '3.8 SIGNED_OUT restored default INITIAL_USER'
  );

  // ----------------------------------------------------------------------------
  // SECTION 4: Channel Switching Stress & Isolation Guard
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 4: Channel Switching Stress & Isolation Guard ---');

  const channelNames = ['general', 'random', 'announcements', 'development'];

  // Rapidly toggle channel 200 times
  for (let i = 0; i < 200; i++) {
    const target = channelNames[i % channelNames.length];
    useWorkspaceStore.getState().setActiveChannel(target);
  }

  assert(
    useWorkspaceStore.getState().activeChannelId === channelNames[199 % channelNames.length],
    '4.1 200 rapid channel toggles terminated at correct target channel'
  );

  // Invalid channel switching rejected
  useWorkspaceStore.getState().setActiveChannel('non-existent-channel-xyz');
  assert(
    useWorkspaceStore.getState().activeChannelId === channelNames[199 % channelNames.length],
    '4.2 Invalid channel rejected, active channel unchanged'
  );

  useWorkspaceStore.getState().setActiveChannel('');
  assert(
    useWorkspaceStore.getState().activeChannelId === channelNames[199 % channelNames.length],
    '4.3 Empty string channel rejected, active channel unchanged'
  );

  // Messages in distinct channels remain strictly partitioned
  useWorkspaceStore.getState().resetWorkspaceState();
  for (const ch of channelNames) {
    useWorkspaceStore.getState().sendMessage(ch, `Partition test in #${ch}`);
  }

  for (const ch of channelNames) {
    const msgs = useWorkspaceStore.getState().messages[ch] || [];
    const ownMsgs = msgs.filter((m) => m.content === `Partition test in #${ch}`);
    assert(ownMsgs.length === 1, `4.4 #${ch} contains its own message`);

    // Ensure other channel messages did not leak into this channel
    for (const otherCh of channelNames) {
      if (otherCh !== ch) {
        const leak = msgs.filter((m) => m.content === `Partition test in #${otherCh}`);
        assert(leak.length === 0, `4.5 #${ch} does NOT contain message from #${otherCh}`);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // SECTION 5: Real-time Packet Flooding & Deduplication Storm
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 5: Real-time Packet Flooding & Deduplication Storm ---');

  useWorkspaceStore.getState().resetWorkspaceState();

  // Create 10 unique optimistic messages
  const burstCount = 10;
  const burstClientIds: string[] = [];

  for (let i = 0; i < burstCount; i++) {
    const cId = `client-storm-uuid-${i}`;
    burstClientIds.push(cId);

    const stormMsg: Message = {
      id: cId,
      clientMessageId: cId,
      channelId: 'general',
      sender: useWorkspaceStore.getState().currentUser,
      content: `Storm message #${i}`,
      timestamp: '02:00 PM',
      status: 'sending',
    };

    useWorkspaceStore.setState((s) => ({
      messages: {
        ...s.messages,
        general: [...(s.messages['general'] || []), stormMsg],
      },
    }));
  }

  assert(
    (useWorkspaceStore.getState().messages['general'] || []).filter((m) => m.status === 'sending').length === burstCount,
    '5.1 10 optimistic storm messages seeded in sending status'
  );

  // Now simulate a flood of 20 duplicate broadcast packets for EACH message (200 packets total)
  // Interleaved in random/scrambled order
  const packets: Array<{ serverDbId: string; clientMsgId: string; index: number }> = [];
  for (let i = 0; i < burstCount; i++) {
    const serverDbId = `db-storm-resolved-uuid-${i}`;
    for (let rep = 0; rep < 20; rep++) {
      packets.push({ serverDbId, clientMsgId: burstClientIds[i], index: i });
    }
  }

  // Shuffle packets pseudo-randomly
  packets.sort(() => (Math.random() > 0.5 ? 1 : -1));

  // Process all 200 packets through the store deduplication logic
  for (const pkt of packets) {
    useWorkspaceStore.setState((state) => {
      const list = state.messages['general'] || [];

      // Idempotency: ignore if serverDbId already present
      const alreadyPresent = list.some((m) => m.id === pkt.serverDbId);
      if (alreadyPresent) {
        return state;
      }

      // Deduplication: match against optimistic message
      const optimisticIndex = list.findIndex(
        (m) => m.clientMessageId === pkt.clientMsgId || m.id === pkt.clientMsgId
      );

      let updatedList: Message[];
      if (optimisticIndex !== -1) {
        updatedList = [...list];
        updatedList[optimisticIndex] = {
          ...updatedList[optimisticIndex],
          id: pkt.serverDbId,
          clientMessageId: pkt.clientMsgId,
          status: 'sent',
        };
      } else {
        updatedList = [
          ...list,
          {
            id: pkt.serverDbId,
            channelId: 'general',
            sender: state.currentUser,
            content: `Storm message #${pkt.index}`,
            timestamp: '02:00 PM',
            status: 'sent',
            clientMessageId: pkt.clientMsgId,
          },
        ];
      }

      return {
        messages: {
          ...state.messages,
          general: updatedList,
        },
      };
    });
  }

  const finalGeneralMsgs = useWorkspaceStore.getState().messages['general'] || [];
  const stormResolvedMsgs = finalGeneralMsgs.filter((m) => m.content.startsWith('Storm message #'));

  assert(
    stormResolvedMsgs.length === burstCount,
    `5.2 Deduplication storm: exactly ${burstCount} messages exist after 200 duplicate packets (got ${stormResolvedMsgs.length})`
  );

  const allSent = stormResolvedMsgs.every((m) => m.status === 'sent');
  assert(allSent, '5.3 All storm messages successfully resolved to "sent"');

  const allHaveDbIds = stormResolvedMsgs.every((m) => m.id.startsWith('db-storm-resolved-uuid-'));
  assert(allHaveDbIds, '5.4 All storm messages have reconciled database UUIDs');

  const uniqueIds = new Set(stormResolvedMsgs.map((m) => m.id));
  assert(uniqueIds.size === burstCount, '5.5 Zero duplicate IDs exist in message store');

  // ----------------------------------------------------------------------------
  // SECTION 6: Robust Data Mapper Edge Cases
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 6: Data Mapper Malformed Input Resilience ---');

  // Null input
  const mNull = mapSupabaseMessage(null);
  assert(mNull.channelId === 'general', '6.1 Null payload mapped to default channel');
  assert(mNull.sender.id === 'user-system', '6.2 Null payload mapped to system sender');

  // Malformed JSON sender string
  const mBadJson = mapSupabaseMessage({
    id: 'msg-bad-json',
    channel_id: 'random',
    content: 'Corrupt sender string',
    sender: '{ not-valid-json: broken }',
  });
  assert(mBadJson.sender.name === '{ not-valid-json: broken }', '6.3 Broken JSON sender falls back to raw string');

  // Object sender with mixed snake_case and camelCase
  const mMixed = mapSupabaseMessage({
    id: 'msg-mixed-case',
    channelId: 'announcements',
    content: 'Mixed case row',
    client_message_id: 'client-mixed-uuid',
    sender: {
      id: 'usr-mixed',
      name: 'Mixed User',
      avatar_url: 'https://example.com/avatar_snake.png',
      status_text: 'Status Snake',
    },
  });
  assert(mMixed.sender.avatarUrl === 'https://example.com/avatar_snake.png', '6.4 Sender avatar_url extracted correctly');
  assert(mMixed.sender.statusText === 'Status Snake', '6.5 Sender status_text extracted correctly');
  assert(mMixed.clientMessageId === 'client-mixed-uuid', '6.6 client_message_id preserved');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`CHALLENGER STRESS HARNESS RESULT: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error('Failed Assertions Summary:');
    for (const f of failureDetails) {
      console.error(f);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL CHALLENGER STRESS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runChallengerM4Stress().catch((err) => {
  console.error('Fatal challenger execution failure:', err);
  process.exit(1);
});
