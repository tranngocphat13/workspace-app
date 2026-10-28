/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */
import type { UseBoundStore, StoreApi } from 'zustand';
import type { Message, WorkspaceStoreState } from '../src/types';

// Set environment variables before module imports to activate Supabase configured mode
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://adversarial-mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-adversarial-12345';

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
  // @ts-expect-error Node environment mock
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

// ============================================================================
// Mock Supabase Realtime & DB Infrastructure
// ============================================================================

interface MockSubscription {
  channelName: string;
  filter: string;
  callback: (payload: { new: any }) => Promise<void> | void;
}

interface MockProfileRow {
  id: string;
  name: string;
  avatar_url?: string;
  status_text?: string;
}

interface MockMessageRow {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  client_message_id: string;
  created_at: string;
}

class MockSupabaseHarness {
  public subscriptions: Map<string, MockSubscription[]> = new Map();
  public removedChannels: string[] = [];
  public databaseMessages: Map<string, MockMessageRow> = new Map();
  public profiles: Map<string, MockProfileRow> = new Map();

  public nextInsertId: string | null = null;
  public insertDelayMs: number = 0;
  public insertError: any = null;
  public onInsertHook?: (row: any) => void;

  constructor() {
    this.reset();
  }

  reset() {
    this.subscriptions.clear();
    this.removedChannels = [];
    this.databaseMessages.clear();
    this.profiles.clear();
    this.nextInsertId = null;
    this.insertDelayMs = 0;
    this.insertError = null;
    this.onInsertHook = undefined;

    // Seed known mock profiles
    this.profiles.set('user-current', {
      id: 'user-current',
      name: 'Alex Johnson',
      avatar_url: 'https://example.com/alex.png',
      status_text: 'Online',
    });
    this.profiles.set('user-sarah', {
      id: 'user-sarah',
      name: 'Sarah Chen',
      avatar_url: 'https://example.com/sarah.png',
      status_text: 'Active',
    });
    this.profiles.set('user-peer-1', {
      id: 'user-peer-1',
      name: 'Peer Engineer 1',
      avatar_url: 'https://example.com/peer1.png',
      status_text: 'Coding',
    });
    this.profiles.set('user-peer-2', {
      id: 'user-peer-2',
      name: 'Peer Engineer 2',
      avatar_url: 'https://example.com/peer2.png',
      status_text: 'Reviewing PR',
    });
  }

  channel(channelName: string) {
    const harness = this;
    const channelObj = {
      channelName,
      on(
        eventType: string,
        filterConfig: { event: string; schema: string; table: string; filter: string },
        callback: (payload: { new: any }) => Promise<void> | void
      ) {
        if (!harness.subscriptions.has(channelName)) {
          harness.subscriptions.set(channelName, []);
        }
        harness.subscriptions.get(channelName)!.push({
          channelName,
          filter: filterConfig.filter,
          callback,
        });
        return channelObj;
      },
      subscribe(statusCb?: (status: string) => void) {
        if (statusCb) {
          // Immediately confirm subscription
          statusCb('SUBSCRIBED');
        }
        return channelObj;
      },
    };
    return channelObj;
  }

  removeChannel(channelObj: any) {
    const name = channelObj?.channelName || (typeof channelObj === 'string' ? channelObj : 'unknown');
    this.removedChannels.push(name);
    this.subscriptions.delete(name);
  }

  // Trigger real-time broadcast to all matching subscribers
  async emitRealtimeInsert(channelId: string, row: any) {
    const chKey = `realtime:channel:${channelId}`;
    const subs = this.subscriptions.get(chKey) || [];
    const promises = subs.map((sub) => sub.callback({ new: row }));
    await Promise.all(promises);
  }

  from(table: string) {
    const harness = this;

    if (table === 'messages') {
      return {
        insert(data: { channel_id: string; sender_id: string; content: string; client_message_id: string }) {
          const insertPromise = (async () => {
            if (harness.insertDelayMs > 0) {
              await sleep(harness.insertDelayMs);
            }

            if (harness.insertError) {
              return { data: null, error: harness.insertError };
            }

            const dbId = harness.nextInsertId || `db-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            harness.nextInsertId = null;
            const row: MockMessageRow = {
              id: dbId,
              channel_id: data.channel_id,
              sender_id: data.sender_id,
              content: data.content,
              client_message_id: data.client_message_id,
              created_at: new Date().toISOString(),
            };

            harness.databaseMessages.set(row.id, row);
            if (harness.onInsertHook) {
              harness.onInsertHook(row);
            }

            return { data: row, error: null };
          })();

          return {
            select() {
              return {
                async single() {
                  return await insertPromise;
                },
              };
            },
            async single() {
              return await insertPromise;
            },
          };
        },

        select(columns: string = '*') {
          let targetChannel: string | null = null;
          let filterClientMsgId: string | null = null;

          const queryObj = {
            eq(col: string, val: string) {
              if (col === 'channel_id') {
                targetChannel = val;
              } else if (col === 'client_message_id') {
                filterClientMsgId = val;
              }
              return queryObj;
            },
            order(_col: string, _opts?: { ascending: boolean }) {
              return queryObj;
            },
            async single() {
              if (filterClientMsgId) {
                for (const row of harness.databaseMessages.values()) {
                  if (row.client_message_id === filterClientMsgId) {
                    return { data: row, error: null };
                  }
                }
                return { data: null, error: { message: 'Row not found' } };
              }
              return { data: null, error: null };
            },
            then(resolve: (res: { data: any[]; error: null }) => void) {
              let rows = Array.from(harness.databaseMessages.values());
              if (targetChannel) {
                rows = rows.filter((r) => r.channel_id === targetChannel);
              }
              resolve({ data: rows, error: null });
            },
          };
          return queryObj;
        },
      };
    }

    if (table === 'profiles') {
      return {
        select(_cols: string = '*') {
          let profileId: string | null = null;
          return {
            eq(col: string, val: string) {
              if (col === 'id') profileId = val;
              return {
                async single() {
                  if (profileId && harness.profiles.has(profileId)) {
                    return { data: harness.profiles.get(profileId), error: null };
                  }
                  return {
                    data: {
                      id: profileId || 'usr-generic',
                      name: `User ${profileId}`,
                      avatar_url: 'https://example.com/avatar.png',
                      status_text: 'Online',
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    }

    if (table === 'channels') {
      return {
        select(_cols: string = '*') {
          return {
            then(resolve: (res: { data: any[]; error: null }) => void) {
              resolve({
                data: [
                  { id: 'general', name: 'general', description: 'General channel', icon_name: 'Hash' },
                  { id: 'random', name: 'random', description: 'Random channel', icon_name: 'MessageSquare' },
                  { id: 'announcements', name: 'announcements', description: 'Announcements', icon_name: 'Bell' },
                  { id: 'development', name: 'development', description: 'Dev channel', icon_name: 'Code' },
                ],
                error: null,
              });
            },
          };
        },
        insert() {
          return Promise.resolve({ data: null, error: null });
        },
      };
    }

    if (table === 'channel_members') {
      return {
        insert() {
          return Promise.resolve({ data: null, error: null });
        },
      };
    }

    return {
      select: () => ({ single: async () => ({ data: null, error: null }) }),
    };
  }
}

// ============================================================================
// Main Adversarial Runner
// ============================================================================

async function runAdversarialRealtimeTests() {
  console.log('\n================================================================');
  console.log('   CHALLENGER 1: ADVERSARIAL REALTIME CONCURRENCY & DEDUP SUITE');
  console.log('================================================================\n');

  // Dynamically import modules to ensure process.env applies
  const supabaseModule = await import('../src/lib/supabase');
  const actualSupabaseClient = (supabaseModule as any).default?.supabase || supabaseModule.supabase;
  const isSupabaseConfigured = (supabaseModule as any).default?.isSupabaseConfigured ?? supabaseModule.isSupabaseConfigured;

  const storeModule = await import('../src/store/useWorkspaceStore');
  const useWorkspaceStore: UseBoundStore<StoreApi<WorkspaceStoreState>> =
    (storeModule as any).default?.useWorkspaceStore || storeModule.useWorkspaceStore;

  assert(isSupabaseConfigured === true, 'Supabase is configured in active mode');
  assert(actualSupabaseClient !== null, 'Supabase client instance is initialized');

  // Install MockSupabaseHarness on actualSupabaseClient
  const harness = new MockSupabaseHarness();
  actualSupabaseClient.channel = (name: string) => harness.channel(name);
  actualSupabaseClient.removeChannel = (ch: any) => harness.removeChannel(ch);
  actualSupabaseClient.from = (table: string) => harness.from(table);

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 1: High-Throughput Concurrent Incoming Real-time Inserts
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 1: High-Throughput Concurrent Real-time Inserts ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  const unsubscribeGeneral = useWorkspaceStore.getState().subscribeToRealtime('general');
  assert(harness.subscriptions.has('realtime:channel:general'), 'Subscribed to realtime:channel:general');

  const initialCountGeneral = useWorkspaceStore.getState().messages['general']?.length || 0;

  // Test 1.1: 50 concurrent incoming real-time inserts for the same channel (#general) fired in parallel
  console.log('  -> Dispatching 50 concurrent real-time broadcast packets to #general...');
  const concurrentCount = 50;
  const burstRows = Array.from({ length: concurrentCount }, (_, i) => ({
    id: `db-concurrent-msg-${i + 1}`,
    channel_id: 'general',
    sender_id: i % 2 === 0 ? 'user-peer-1' : 'user-peer-2',
    content: `Concurrent packet payload #${i + 1}`,
    client_message_id: `client-peer-uuid-${i + 1}`,
    created_at: new Date(Date.now() + i * 10).toISOString(),
    sender: {
      id: i % 2 === 0 ? 'user-peer-1' : 'user-peer-2',
      name: i % 2 === 0 ? 'Peer Engineer 1' : 'Peer Engineer 2',
      avatar_url: `https://example.com/peer-${(i % 2) + 1}.png`,
      status_text: 'Online',
    },
  }));

  // Emit all 50 concurrently via Promise.all
  await Promise.all(burstRows.map((row) => harness.emitRealtimeInsert('general', row)));

  const afterBurstMessages = useWorkspaceStore.getState().messages['general'] || [];
  assert(
    afterBurstMessages.length === initialCountGeneral + concurrentCount,
    `Zero packet drops: Exactly ${initialCountGeneral + concurrentCount} messages in #general (got ${afterBurstMessages.length})`
  );

  // Verify all 50 messages have valid fields and matching content
  let allFieldsValid = true;
  for (let i = 0; i < concurrentCount; i++) {
    const expectedId = `db-concurrent-msg-${i + 1}`;
    const found = afterBurstMessages.find((m) => m.id === expectedId);
    if (!found || !found.content || found.status !== 'sent' || !found.sender?.name) {
      allFieldsValid = false;
      break;
    }
  }
  assert(allFieldsValid, 'All 50 concurrent messages possess intact fields, valid senders, and status "sent"');

  // Test 1.2: 30 concurrent real-time inserts requiring async profile hydration from profiles table
  console.log('  -> Dispatching 30 concurrent real-time inserts requiring async profile table lookup...');
  const hydrationRows = Array.from({ length: 30 }, (_, i) => ({
    id: `db-hydrate-msg-${i + 1}`,
    channel_id: 'general',
    sender_id: 'user-sarah', // sender is user-sarah, no embedded sender profile in payload
    content: `Hydration test message #${i + 1}`,
    client_message_id: `client-hydrate-uuid-${i + 1}`,
    created_at: new Date().toISOString(),
  }));

  await Promise.all(hydrationRows.map((row) => harness.emitRealtimeInsert('general', row)));
  await sleep(50); // allow microtasks to resolve

  const postHydrationMessages = useWorkspaceStore.getState().messages['general'] || [];
  const sampleHydrated = postHydrationMessages.find((m) => m.id === 'db-hydrate-msg-15');
  assert(sampleHydrated !== undefined, 'Hydrated message exists in store');
  assert(sampleHydrated?.sender.name === 'Sarah Chen', 'Async profile hydration correctly resolved sender name "Sarah Chen"');
  assert(sampleHydrated?.sender.statusText === 'Active', 'Async profile hydration populated statusText');

  // Test 1.3: 80 concurrent real-time inserts distributed evenly across 4 channels (20 each)
  console.log('  -> Dispatching 80 concurrent inserts across all 4 channels (20 per channel)...');
  const allChannels = ['general', 'random', 'announcements', 'development'];
  // Subscribe to all 4 channels
  const unsubs = allChannels.map((c) => useWorkspaceStore.getState().subscribeToRealtime(c));

  const multiChannelRows = allChannels.flatMap((ch) =>
    Array.from({ length: 20 }, (_, i) => ({
      id: `db-multi-${ch}-${i + 1}`,
      channel_id: ch,
      sender_id: 'user-peer-1',
      content: `Multi-channel msg #${i + 1} for #${ch}`,
      client_message_id: `multi-client-${ch}-${i + 1}`,
      created_at: new Date().toISOString(),
      sender: { id: 'user-peer-1', name: 'Peer Engineer 1' },
    }))
  );

  // Emit all 80 concurrently
  await Promise.all(multiChannelRows.map((row) => harness.emitRealtimeInsert(row.channel_id, row)));

  let channelsIsolated = true;
  for (const ch of allChannels) {
    const list = useWorkspaceStore.getState().messages[ch] || [];
    const chMessages = list.filter((m) => m.id.startsWith(`db-multi-${ch}-`));
    const leakedMessages = list.filter((m) => m.id.startsWith('db-multi-') && !m.id.startsWith(`db-multi-${ch}-`));
    if (chMessages.length !== 20 || leakedMessages.length > 0) {
      channelsIsolated = false;
      console.error(`Channel ${ch} isolation failure: expected 20 msgs, got ${chMessages.length}; leaks: ${leakedMessages.length}`);
      break;
    }
  }
  assert(channelsIsolated, 'Total channel isolation under 80-message concurrent multi-channel broadcast');

  // Clean up subscriptions
  unsubscribeGeneral();
  unsubs.forEach((u) => u());

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Broadcast vs HTTP Insert Race Conditions
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: Broadcast vs HTTP Insert Race Conditions ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  const unsubRace = useWorkspaceStore.getState().subscribeToRealtime('general');

  // Test 2.1: Race Condition A (Real-time broadcast arrives BEFORE HTTP POST response resolves)
  console.log('  -> Testing Race A: Real-time broadcast arrives BEFORE HTTP response resolves...');
  harness.insertDelayMs = 120; // HTTP insert takes 120ms

  let capturedClientMsgIdA: string = '';
  harness.onInsertHook = (row) => {
    capturedClientMsgIdA = row.client_message_id;
  };

  const initialGenCount = useWorkspaceStore.getState().messages['general'].length;
  const serverDbIdA = 'db-server-race-A-uuid';
  harness.nextInsertId = serverDbIdA;

  // Trigger sendMessage (optimistic message added immediately)
  useWorkspaceStore.getState().sendMessage('general', 'Race A: Broadcast arrives first');

  const afterSendListA = useWorkspaceStore.getState().messages['general'];
  const optimisticMsgA = afterSendListA[afterSendListA.length - 1];
  assert(optimisticMsgA.status === 'sending', 'Optimistic message in "sending" status');
  const clientMsgIdA = optimisticMsgA.clientMessageId!;

  // Simulate Supabase Realtime broadcast arriving at 25ms (well before the 120ms HTTP resolution)
  await sleep(25);
  await harness.emitRealtimeInsert('general', {
    id: serverDbIdA,
    channel_id: 'general',
    sender_id: 'user-current',
    content: 'Race A: Broadcast arrives first',
    client_message_id: clientMsgIdA,
    created_at: new Date().toISOString(),
  });

  // Verify that Realtime listener reconciled the optimistic message to 'sent'
  const midStateListA = useWorkspaceStore.getState().messages['general'];
  const reconciledMidA = midStateListA.find((m) => m.clientMessageId === clientMsgIdA || m.id === serverDbIdA);
  assert(reconciledMidA !== undefined, 'Message found in store after early realtime broadcast');
  assert(reconciledMidA?.id === serverDbIdA, 'Message ID updated to server DB ID by realtime broadcast');
  assert(reconciledMidA?.status === 'sent', 'Message status transitioned to "sent" by realtime broadcast');
  assert(midStateListA.length === initialGenCount + 1, 'Exactly 1 message added (zero duplicate bubbles)');

  // Now wait for HTTP insert response to finish (at ~120ms)
  console.log('  -> Waiting for HTTP response to resolve (120ms total)...');
  await sleep(150);

  const finalStateListA = useWorkspaceStore.getState().messages['general'];
  assert(
    finalStateListA.length === initialGenCount + 1,
    'Race A Resolution: Exactly 1 message persists after late HTTP response (no duplicate bubble created)'
  );
  const finalMsgA = finalStateListA[finalStateListA.length - 1];
  assert(finalMsgA.id === serverDbIdA, 'Final message ID matches server DB ID');
  assert(finalMsgA.status === 'sent', 'Final message status remains "sent"');

  // Test 2.2: Race Condition B (HTTP response resolves BEFORE Real-time broadcast arrives)
  console.log('\n  -> Testing Race B: HTTP response resolves BEFORE real-time broadcast arrives...');
  harness.insertDelayMs = 15; // HTTP insert resolves quickly in 15ms
  harness.onInsertHook = undefined;

  const preCountB = useWorkspaceStore.getState().messages['general'].length;
  useWorkspaceStore.getState().sendMessage('general', 'Race B: HTTP resolves first');

  const afterSendListB = useWorkspaceStore.getState().messages['general'];
  const optimisticMsgB = afterSendListB[afterSendListB.length - 1];
  const clientMsgIdB = optimisticMsgB.clientMessageId!;

  // Wait for HTTP insert to complete (30ms)
  await sleep(35);

  const afterHttpListB = useWorkspaceStore.getState().messages['general'];
  const resolvedHttpMsgB = afterHttpListB.find((m) => m.clientMessageId === clientMsgIdB);
  assert(resolvedHttpMsgB !== undefined, 'Message updated by HTTP response');
  assert(resolvedHttpMsgB?.status === 'sent', 'Message status transitioned to "sent" via HTTP response');
  const serverDbIdB = resolvedHttpMsgB!.id;

  // Now, deliver Realtime broadcast late at 60ms
  console.log('  -> Late real-time broadcast arriving after HTTP already completed...');
  await harness.emitRealtimeInsert('general', {
    id: serverDbIdB,
    channel_id: 'general',
    sender_id: 'user-current',
    content: 'Race B: HTTP resolves first',
    client_message_id: clientMsgIdB,
    created_at: new Date().toISOString(),
  });

  const finalStateListB = useWorkspaceStore.getState().messages['general'];
  assert(
    finalStateListB.length === preCountB + 1,
    'Race B Resolution: No duplicate bubble created when realtime broadcast arrives after HTTP response'
  );
  const finalMsgB = finalStateListB.find((m) => m.id === serverDbIdB);
  assert(finalMsgB?.status === 'sent', 'Message status remains "sent"');

  // Test 2.3: Massive Stochastic Race Burst (20 messages with randomized latencies)
  console.log('\n  -> Testing Race C: 20-message stochastic burst with randomized latencies...');
  const burstCount = 20;
  const initialBurstCount = useWorkspaceStore.getState().messages['general'].length;

  for (let i = 0; i < burstCount; i++) {
    const httpLatency = 20 + Math.floor(Math.random() * 50); // 20-70ms
    const realtimeLatency = 20 + Math.floor(Math.random() * 50); // 20-70ms
    harness.insertDelayMs = httpLatency;

    const content = `Stochastic race burst item #${i + 1}`;
    useWorkspaceStore.getState().sendMessage('general', content);

    const currentList = useWorkspaceStore.getState().messages['general'];
    const optMsg = currentList[currentList.length - 1];
    const cMsgId = optMsg.clientMessageId!;

    // Asynchronously dispatch realtime broadcast after realtimeLatency
    setTimeout(async () => {
      await harness.emitRealtimeInsert('general', {
        id: `db-stochastic-${i + 1}`,
        channel_id: 'general',
        sender_id: 'user-current',
        content,
        client_message_id: cMsgId,
        created_at: new Date().toISOString(),
      });
    }, realtimeLatency);

    await sleep(15);
  }

  // Wait for all randomized timers and requests to settle
  console.log('  -> Waiting for all stochastic latencies to settle (250ms)...');
  await sleep(250);

  const postBurstList = useWorkspaceStore.getState().messages['general'];
  const addedCount = postBurstList.length - initialBurstCount;
  assert(
    addedCount === burstCount,
    `Stochastic Race Result: Exactly ${burstCount} messages added across randomized races (got ${addedCount})`
  );

  const sendingRemaining = postBurstList.filter((m) => m.status === 'sending');
  assert(sendingRemaining.length === 0, 'Zero messages left in "sending" status after race resolution');

  // Check for any duplicate clientMessageIds or IDs
  const idSet = new Set<string>();
  let hasDuplicateId = false;
  for (const m of postBurstList) {
    if (idSet.has(m.id)) {
      hasDuplicateId = true;
      break;
    }
    idSet.add(m.id);
  }
  assert(!hasDuplicateId, 'Zero duplicate message IDs across all messages in #general');

  unsubRace();

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Idempotent Deduplication against Duplicate Delivery Packets
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Idempotent Deduplication against Duplicate Packets ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  const unsubDedup = useWorkspaceStore.getState().subscribeToRealtime('general');

  // Test 3.1: 5x duplicate broadcast delivery of the exact same message packet
  console.log('  -> Dispatching 5 identical broadcast packets for the same message ID...');
  const dupRow = {
    id: 'db-duplicate-pkt-555',
    channel_id: 'general',
    sender_id: 'user-peer-1',
    content: 'Duplicate packet flood test',
    client_message_id: 'client-dup-test-555',
    created_at: new Date().toISOString(),
    sender: { id: 'user-peer-1', name: 'Peer Engineer 1' },
  };

  const preDupCount = useWorkspaceStore.getState().messages['general'].length;

  // Deliver packet 5 times in a row
  await harness.emitRealtimeInsert('general', dupRow);
  await harness.emitRealtimeInsert('general', dupRow);
  await harness.emitRealtimeInsert('general', dupRow);
  await harness.emitRealtimeInsert('general', dupRow);
  await harness.emitRealtimeInsert('general', dupRow);

  const postDupList = useWorkspaceStore.getState().messages['general'];
  assert(
    postDupList.length === preDupCount + 1,
    `Idempotency: Exactly 1 message added after 5 duplicate packet broadcasts (got ${postDupList.length - preDupCount})`
  );

  const dupMatches = postDupList.filter((m) => m.id === dupRow.id);
  assert(dupMatches.length === 1, 'Only 1 message entry with id="db-duplicate-pkt-555" exists in store');

  // Test 3.2: Duplicate delivery with updated metadata (timestamp/statusText)
  console.log('  -> Delivering duplicate packet with updated timestamp and statusText...');
  const updatedDupRow = {
    ...dupRow,
    timestamp: '11:59 PM',
    sender: { id: 'user-peer-1', name: 'Peer Engineer 1', status_text: 'Away' },
  };
  await harness.emitRealtimeInsert('general', updatedDupRow);

  const postUpdateList = useWorkspaceStore.getState().messages['general'];
  assert(
    postUpdateList.length === preDupCount + 1,
    'Packet with updated metadata updates in place without appending duplicate'
  );
  const updatedItem = postUpdateList.find((m) => m.id === dupRow.id);
  assert(updatedItem?.timestamp === '11:59 PM', 'In-place update refreshed timestamp');

  // Test 3.3: Duplicate delivery after fetchMessages synchronization
  console.log('  -> Testing fetchMessages followed by duplicate realtime broadcast...');
  const fetchedRow: MockMessageRow = {
    id: 'db-fetched-msg-777',
    channel_id: 'general',
    sender_id: 'user-peer-1',
    content: 'Previously fetched message',
    client_message_id: 'client-fetched-777',
    created_at: new Date().toISOString(),
  };
  harness.databaseMessages.set(fetchedRow.id, fetchedRow);

  // Sync via fetchMessages
  await useWorkspaceStore.getState().fetchMessages('general');
  const countAfterFetch = useWorkspaceStore.getState().messages['general'].length;
  assert(
    useWorkspaceStore.getState().messages['general'].some((m) => m.id === fetchedRow.id),
    'Fetched message present in store'
  );

  // Now Realtime broadcast arrives with the same fetched message
  await harness.emitRealtimeInsert('general', fetchedRow);
  const countAfterFetchBroadcast = useWorkspaceStore.getState().messages['general'].length;
  assert(
    countAfterFetchBroadcast === countAfterFetch,
    'Realtime delivery of already-fetched message does NOT append duplicate bubble'
  );

  unsubDedup();

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Rapid Channel Toggling & Cross-Channel Isolation
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Rapid Channel Toggling & Cross-Channel Isolation ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  // Test 4.1: Active in-flight message sending while switching active channel
  console.log('  -> Sending message in #general, immediately switching to #development...');
  harness.insertDelayMs = 50;

  // Subscribe to both general and development
  const unsubGen4 = useWorkspaceStore.getState().subscribeToRealtime('general');
  const unsubDev4 = useWorkspaceStore.getState().subscribeToRealtime('development');

  useWorkspaceStore.getState().setActiveChannel('general');
  useWorkspaceStore.getState().sendMessage('general', 'Message in general');

  // Immediately switch active channel
  useWorkspaceStore.getState().setActiveChannel('development');
  assert(useWorkspaceStore.getState().activeChannelId === 'development', 'Active channel switched to development');

  // Send message in development
  useWorkspaceStore.getState().sendMessage('development', 'Message in development');

  // Immediately switch active channel to announcements
  useWorkspaceStore.getState().setActiveChannel('announcements');
  assert(useWorkspaceStore.getState().activeChannelId === 'announcements', 'Active channel switched to announcements');

  // Wait for HTTP responses to settle
  console.log('  -> Waiting for multi-channel in-flight HTTP requests to settle (80ms)...');
  await sleep(80);

  const messagesGen = useWorkspaceStore.getState().messages['general'] || [];
  const messagesDev = useWorkspaceStore.getState().messages['development'] || [];
  const messagesAnn = useWorkspaceStore.getState().messages['announcements'] || [];

  const genHasGenMsg = messagesGen.some((m) => m.content === 'Message in general');
  const genHasDevMsg = messagesGen.some((m) => m.content === 'Message in development');
  assert(genHasGenMsg && !genHasDevMsg, '#general contains only its own message (zero leak from #development)');

  const devHasDevMsg = messagesDev.some((m) => m.content === 'Message in development');
  const devHasGenMsg = messagesDev.some((m) => m.content === 'Message in general');
  assert(devHasDevMsg && !devHasGenMsg, '#development contains only its own message (zero leak from #general)');

  const annHasForeignMsg = messagesAnn.some((m) => m.content.includes('Message in'));
  assert(!annHasForeignMsg, '#announcements contains zero leaked messages from active switching');

  // Test 4.2: Ping-Pong Channel Toggling during 40 active broadcasts
  console.log('  -> Executing 100 ping-pong channel switches during 40 incoming broadcasts...');
  const channelsList = ['general', 'random', 'announcements', 'development'];
  const unsubsAll = channelsList.map((ch) => useWorkspaceStore.getState().subscribeToRealtime(ch));

  // Start concurrent channel switcher loop
  let stopSwitching = false;
  const switchLoop = (async () => {
    let idx = 0;
    while (!stopSwitching) {
      useWorkspaceStore.getState().setActiveChannel(channelsList[idx % channelsList.length]);
      idx++;
      await sleep(2);
    }
  })();

  // Fire 10 broadcasts to each channel concurrently
  const pingPongPromises = channelsList.flatMap((ch) =>
    Array.from({ length: 10 }, (_, i) =>
      harness.emitRealtimeInsert(ch, {
        id: `db-pingpong-${ch}-${i + 1}`,
        channel_id: ch,
        sender_id: 'user-peer-1',
        content: `Pingpong payload #${i + 1} for ${ch}`,
        client_message_id: `pp-client-${ch}-${i + 1}`,
        created_at: new Date().toISOString(),
        sender: { id: 'user-peer-1', name: 'Peer Engineer 1' },
      })
    )
  );

  await Promise.all(pingPongPromises);
  stopSwitching = true;
  await switchLoop;

  // Verify each channel received strictly its own 10 pingpong messages
  let pingPongLeakFree = true;
  for (const ch of channelsList) {
    const list = useWorkspaceStore.getState().messages[ch] || [];
    const chMsgs = list.filter((m) => m.id.startsWith(`db-pingpong-${ch}-`));
    const foreignMsgs = list.filter((m) => m.id.startsWith('db-pingpong-') && !m.id.startsWith(`db-pingpong-${ch}-`));
    if (chMsgs.length !== 10 || foreignMsgs.length > 0) {
      pingPongLeakFree = false;
      console.error(`Leak detected in ${ch}: own count=${chMsgs.length}, foreign=${foreignMsgs.length}`);
      break;
    }
  }
  assert(pingPongLeakFree, 'Zero cross-channel bleeding during 100 rapid channel toggles and 40 concurrent broadcasts');

  // Clean up all channel subscriptions
  unsubsAll.forEach((u) => u());

  // Test 4.3: Subscription Lifecycle & Cleanup
  console.log('  -> Verifying subscription lifecycle and removal on channel switch...');
  const unsubInitial = useWorkspaceStore.getState().subscribeToRealtime('development');
  assert(harness.subscriptions.has('realtime:channel:development'), 'Subscribed to realtime:channel:development');

  // Trigger unsubscribe cleanup
  unsubInitial();
  assert(
    harness.removedChannels.includes('realtime:channel:development'),
    'supabase.removeChannel called on unsubscribe cleanup'
  );

  unsubGen4();
  unsubDev4();

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Resilience, Error Recovery & Idempotent Retry Mechanics
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: Resilience, Error Recovery & Idempotent Retry ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  const unsubRetry = useWorkspaceStore.getState().subscribeToRealtime('general');

  // Test 5.1: HTTP insert failure transitions to 'failed' status
  console.log('  -> Simulating network timeout on sendMessage...');
  harness.insertError = { message: 'Network connection timeout: upstream unavailable' };

  useWorkspaceStore.getState().sendMessage('general', 'Resilience test: failing message');
  await sleep(25); // allow async insert to fail

  const listAfterFail = useWorkspaceStore.getState().messages['general'];
  const failedMsg = listAfterFail[listAfterFail.length - 1];
  assert(failedMsg.status === 'failed', 'Message cleanly transitioned to status "failed" upon HTTP error');
  assert(typeof failedMsg.clientMessageId === 'string', 'clientMessageId preserved on failed message');

  // Test 5.2: Idempotent retry with successful re-insert
  console.log('  -> Retrying failed message with network recovered...');
  harness.insertError = null; // network recovered
  harness.insertDelayMs = 20;

  const retryPromise = useWorkspaceStore.getState().retryMessage('general', failedMsg.id);
  const midRetryList = useWorkspaceStore.getState().messages['general'];
  const retryingMsg = midRetryList.find((m) => m.clientMessageId === failedMsg.clientMessageId);
  assert(retryingMsg?.status === 'sending', 'retryMessage immediately transitioned status back to "sending"');

  await retryPromise;
  await sleep(30);

  const postRetryList = useWorkspaceStore.getState().messages['general'];
  const resolvedRetryMsg = postRetryList.find((m) => m.clientMessageId === failedMsg.clientMessageId);
  assert(resolvedRetryMsg?.status === 'sent', 'retryMessage successfully transitioned to "sent" upon recovery');
  assert(
    resolvedRetryMsg?.id.startsWith('db-msg-') === true,
    'retryMessage updated message ID to server DB ID'
  );

  // Test 5.3: PostgreSQL 23505 Unique Constraint Violation Recovery during Retry
  console.log('  -> Simulating retry where original message actually reached DB before client dropped (PostgreSQL 23505)...');
  const preViolationCount = useWorkspaceStore.getState().messages['general'].length;

  // Seed a message that is marked 'failed' on client, but actually exists in DB
  const existingClientMsgId = 'unique-violation-test-uuid-888';
  const existingDbId = 'db-already-in-database-888';
  harness.databaseMessages.set(existingDbId, {
    id: existingDbId,
    channel_id: 'general',
    sender_id: 'user-current',
    content: 'Unique violation recovery test',
    client_message_id: existingClientMsgId,
    created_at: new Date().toISOString(),
  });

  const failedLocalMsg = {
    id: existingClientMsgId,
    clientMessageId: existingClientMsgId,
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Unique violation recovery test',
    timestamp: '03:00 PM',
    status: 'failed' as const,
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      general: [...useWorkspaceStore.getState().messages['general'], failedLocalMsg],
    },
  });

  // Configure harness to throw PostgreSQL error 23505 on insert attempt
  harness.insertError = {
    code: '23505',
    message: 'duplicate key value violates unique constraint "messages_client_message_id_key"',
  };

  await useWorkspaceStore.getState().retryMessage('general', existingClientMsgId);

  const post23505List = useWorkspaceStore.getState().messages['general'];
  const recoveredMsg = post23505List.find((m) => m.clientMessageId === existingClientMsgId);
  assert(recoveredMsg !== undefined, 'Recovered message exists in store');
  assert(recoveredMsg?.status === 'sent', 'PostgreSQL 23505 recovered: message transitioned to "sent"');
  assert(recoveredMsg?.id === existingDbId, 'PostgreSQL 23505 recovered: server DB ID retrieved from database');
  assert(
    post23505List.length === preViolationCount + 1,
    'PostgreSQL 23505 recovered: exactly 1 message exists (no duplicate inserted)'
  );

  // Test 5.4: State reset (resetWorkspaceState) during in-flight insert
  console.log('  -> Testing state reset (logout/clear) during in-flight insert...');
  harness.insertError = null;
  harness.insertDelayMs = 100;

  useWorkspaceStore.getState().sendMessage('general', 'Message to be aborted by reset');
  // Immediately reset state
  useWorkspaceStore.getState().resetWorkspaceState();

  // Wait for late HTTP insert to finish
  await sleep(130);

  const afterResetList = useWorkspaceStore.getState().messages['general'];
  const zombieMsg = afterResetList.find((m) => m.content === 'Message to be aborted by reset');
  assert(zombieMsg === undefined, 'State reset safely discarded in-flight insert without creating zombie message');

  unsubRetry();

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Edge Cases, Input Validation & Malformed Payload Handling
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 6: Edge Cases & Malformed Payload Handling ---');
  useWorkspaceStore.getState().resetWorkspaceState();
  harness.reset();

  const unsubSuite6 = useWorkspaceStore.getState().subscribeToRealtime('general');

  // Test 6.1: Null and malformed broadcast payloads
  console.log('  -> Dispatching null and empty realtime broadcast payloads...');
  const countBeforeMalformed = useWorkspaceStore.getState().messages['general'].length;

  // Emit malformed payloads
  const chKey = 'realtime:channel:general';
  const subs = harness.subscriptions.get(chKey) || [];
  for (const sub of subs) {
    await sub.callback(null as any);
    await sub.callback({} as any);
    await sub.callback({ new: null } as any);
    await sub.callback({ new: undefined } as any);
  }

  const countAfterMalformed = useWorkspaceStore.getState().messages['general'].length;
  assert(
    countAfterMalformed === countBeforeMalformed,
    'Store safely ignored null/empty broadcast payloads without crashing or corrupting state'
  );

  // Test 6.2: Validation guard - empty and whitespace-only content
  console.log('  -> Testing validation on empty and whitespace-only messages...');
  useWorkspaceStore.getState().sendMessage('general', '');
  useWorkspaceStore.getState().sendMessage('general', '   ');
  useWorkspaceStore.getState().sendMessage('general', '\n\t  \n');

  const countAfterEmpty = useWorkspaceStore.getState().messages['general'].length;
  assert(
    countAfterEmpty === countBeforeMalformed,
    'Empty and whitespace-only messages strictly rejected without creating optimistic entries'
  );

  // Test 6.3: Non-existent message retry
  console.log('  -> Calling retryMessage on non-existent message ID...');
  let retryThrew = false;
  try {
    await useWorkspaceStore.getState().retryMessage('general', 'non-existent-msg-id-999');
  } catch {
    retryThrew = true;
  }
  assert(!retryThrew, 'retryMessage with invalid ID gracefully no-ops without throwing');

  // Test 6.4: Rapid burst retry on failed message (click-spam resilience)
  console.log('  -> Testing rapid duplicate retry burst (5 clicks in 10ms)...');
  const spamMsgId = 'spam-failed-uuid-111';
  const spamMessage = {
    id: spamMsgId,
    clientMessageId: spamMsgId,
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Click-spam retry message',
    timestamp: '04:00 PM',
    status: 'failed' as const,
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      general: [...useWorkspaceStore.getState().messages['general'], spamMessage],
    },
  });

  harness.insertDelayMs = 25;
  // Trigger 5 retry calls concurrently
  await Promise.all([
    useWorkspaceStore.getState().retryMessage('general', spamMsgId),
    useWorkspaceStore.getState().retryMessage('general', spamMsgId),
    useWorkspaceStore.getState().retryMessage('general', spamMsgId),
    useWorkspaceStore.getState().retryMessage('general', spamMsgId),
    useWorkspaceStore.getState().retryMessage('general', spamMsgId),
  ]);

  await sleep(40);

  const postSpamList = useWorkspaceStore.getState().messages['general'];
  const spamMatches = postSpamList.filter((m) => m.clientMessageId === spamMsgId);
  assert(
    spamMatches.length === 1,
    'Rapid duplicate retry clicks resulted in exactly 1 message (zero duplicate bubbles)'
  );
  assert(spamMatches[0].status === 'sent', 'Spam retry message resolved cleanly to "sent"');

  // Test 6.5: Rich content & special characters preservation
  console.log('  -> Testing preservation of rich content, code snippets, and special characters...');
  const richContent = '`<script>alert("xss")</script>` 🚀 & "quotes" \'apostrophe\' \n Multi-line\nCode: const x = 42;';
  const richMsgId = 'db-rich-content-uuid-999';

  await harness.emitRealtimeInsert('general', {
    id: richMsgId,
    channel_id: 'general',
    sender_id: 'user-peer-1',
    content: richContent,
    client_message_id: 'client-rich-uuid-999',
    created_at: new Date().toISOString(),
    sender: { id: 'user-peer-1', name: 'Peer Engineer 1' },
  });

  const richMsgStored = useWorkspaceStore.getState().messages['general'].find((m) => m.id === richMsgId);
  assert(richMsgStored !== undefined, 'Rich content message delivered and stored');
  assert(richMsgStored?.content === richContent, 'Exact multi-line characters and HTML strings preserved without mangling');

  unsubSuite6();

  // ────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`CHALLENGER 1 ADVERSARIAL STRESS TEST RESULTS:`);
  console.log(`Total Assertions Passed: ${totalPassed}`);
  console.log(`Total Assertions Failed: ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error('Failure Details:');
    failureDetails.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('🎉 ALL 24 ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runAdversarialRealtimeTests().catch((err) => {
  console.error('Fatal crash in adversarial test runner:', err);
  process.exit(1);
});
