// ==============================================================================
// Milestone C Adversarial Test Suite: Retry Mechanics & Failure Resilience
// File: workspace-app/tests/adversarial-retry-resilience-m3.ts
//
// Tests:
// 1. Simulated network failure during sendMessage transitioning to 'failed'
// 2. Verification of UI status indicator (red AlertCircle) and retry button appearance
// 3. Executing retryMessage reusing client_message_id
// 4. PostgreSQL 23505 unique constraint violation recovery (fetching existing row & transitioning to 'sent')
// 5. Rapid spamming of retry button without duplicate bubbles or store crashes
// 6. Multi-attempt consecutive retry failures and eventual recovery
// 7. Channel switching while retry is in-flight (zero cross-channel leakage)
// 8. Workspace reset / logout race condition during in-flight retry
// ==============================================================================

// Set mock environment variables before dynamic imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://adversarial-mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'adversarial-mock-anon-key';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Message, User } from '../src/types';

// ============================================================================
// React SSR & DOM Environment Mocks for Node.js
// ============================================================================

const reactInternals = React as unknown as {
  useSyncExternalStore: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown
  ) => unknown;
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
    H?: Record<string, unknown>;
  };
};

reactInternals.useSyncExternalStore = (_sub, getSnapshot) => getSnapshot();

const hookDispatcherProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    if (prop === 'useCallback') return (fn: unknown) => fn;
    if (prop === 'useSyncExternalStore') return (_sub: unknown, snap: () => unknown) => snap();
    if (prop === 'useState')
      return (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}];
    if (prop === 'useId') return () => ':r-adv-retry:';
    if (prop === 'useMemo') return (fn: () => unknown) => fn();
    if (prop === 'useRef') return (init: unknown) => ({ current: init });
    if (prop === 'useEffect' || prop === 'useLayoutEffect') return () => {};
    if (prop === 'useDebugValue') return () => {};
    return () => {};
  },
});

if (reactInternals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
  reactInternals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = hookDispatcherProxy;
}

// Mock localStorage for Node
const storageMap = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
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
    get length() {
      return storageMap.size;
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  };
}

if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: globalThis.localStorage,
  };
}

// ============================================================================
// Test Assertion & Reporting Infrastructure
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Adversarial Runner
// ============================================================================

async function runAdversarialRetrySuite() {
  console.log('\n================================================================');
  console.log('   CHALLENGER 2: ADVERSARIAL RETRY & FAILURE RESILIENCE SUITE   ');
  console.log('================================================================\n');

  // Dynamic imports after env vars are established
  const supabaseModule = await import('../src/lib/supabase');
  const storeModule = await import('../src/store/useWorkspaceStore');
  const statusIndicatorModule = await import('../src/components/Chat/StatusIndicator');
  const messageItemModule = await import('../src/components/Chat/MessageItem');

  const supabaseClient = (supabaseModule.supabase || (supabaseModule as unknown as { default: typeof supabaseModule }).default?.supabase) as unknown as Record<string, unknown>;
  const isSupabaseConfigured = supabaseModule.isSupabaseConfigured ?? (supabaseModule as unknown as { default: typeof supabaseModule }).default?.isSupabaseConfigured;
  const useWorkspaceStore = storeModule.useWorkspaceStore || (storeModule as unknown as { default: typeof storeModule }).default?.useWorkspaceStore;
  const StatusIndicator = statusIndicatorModule.StatusIndicator || (statusIndicatorModule as unknown as { default: typeof statusIndicatorModule }).default?.StatusIndicator;
  const MessageItem = messageItemModule.MessageItem || (messageItemModule as unknown as { default: typeof messageItemModule }).default?.MessageItem;

  assert(isSupabaseConfigured === true, 'Supabase client environment is configured for live testing');
  assert(Boolean(supabaseClient && typeof supabaseClient.from === 'function'), 'supabaseClient.from is accessible for mock injection');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Simulated Network Failure in sendMessage -> Transition to 'failed'
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 1: Simulated Network Failure during sendMessage ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  let capturedInsertPayload: unknown = null;

  // Intercept supabase.from to simulate network timeout / connection abort
  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: (payload: unknown) => {
          capturedInsertPayload = payload;
          return {
            select: () => ({
              single: async () => {
                // Simulate network latency then drop connection
                await sleep(40);
                return {
                  data: null,
                  error: {
                    message: 'TypeError: Failed to fetch (Connection timed out)',
                    code: 'NETWORK_TIMEOUT',
                    details: 'TCP socket connection dropped by peer',
                  },
                };
              },
            }),
          };
        },
      };
    }
    return {};
  };

  const channelId = 'general';
  const content = 'Message that will fail due to network outage';

  useWorkspaceStore.getState().sendMessage(channelId, content);

  const initialList = useWorkspaceStore.getState().messages[channelId] || [];
  const optimisticMsg = initialList[initialList.length - 1];

  assert(optimisticMsg !== undefined, 'Optimistic message appended immediately to channel');
  assert(optimisticMsg.status === 'sending', 'Initial status is "sending"');
  assert(typeof optimisticMsg.clientMessageId === 'string', 'clientMessageId is generated');
  assert(optimisticMsg.id === optimisticMsg.clientMessageId, 'Initial id equals clientMessageId');

  // Wait for async network failure to reject and catch in store
  await sleep(100);

  const postFailList = useWorkspaceStore.getState().messages[channelId] || [];
  const failedMsg = postFailList.find((m) => m.clientMessageId === optimisticMsg.clientMessageId);

  assert(failedMsg !== undefined, 'Message still exists in channel after failure');
  assert(failedMsg?.status === 'failed', 'Message cleanly transitioned from "sending" to "failed" on network error');
  assert(failedMsg?.content === content, 'Message content was preserved unchanged');
  assert(failedMsg?.clientMessageId === optimisticMsg.clientMessageId, 'clientMessageId preserved on failure');
  assert(
    (capturedInsertPayload as Record<string, unknown>)?.client_message_id === optimisticMsg.clientMessageId,
    'client_message_id was submitted to database insert payload'
  );

  // Check persistence in localStorage
  const rawStorage = storageMap.get('workspace_persisted_messages_v1');
  assert(rawStorage !== undefined && rawStorage !== null, 'Messages are persisted to localStorage');
  const parsedStorage = JSON.parse(rawStorage || '{}') as Record<string, Message[]>;
  const persistedMsg = (parsedStorage[channelId] || []).find((m) => m.clientMessageId === optimisticMsg.clientMessageId);
  assert(persistedMsg?.status === 'failed', 'Persisted message in localStorage is recorded with status="failed"');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: UI StatusIndicator & MessageItem Rendering Contracts
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: UI StatusIndicator & MessageItem Rendering Contracts ---');

  // 1. StatusIndicator component contracts
  const indicatorFailedHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'failed' }));
  assert(indicatorFailedHtml.includes('data-testid="status-failed"'), 'StatusIndicator renders data-testid="status-failed"');
  assert(indicatorFailedHtml.includes('title="Failed to send"'), 'StatusIndicator renders title="Failed to send"');
  assert(indicatorFailedHtml.includes('text-red-400'), 'StatusIndicator renders text-red-400 color');
  assert(indicatorFailedHtml.includes('Failed to send'), 'StatusIndicator provides accessible sr-only text "Failed to send"');

  const indicatorSendingHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sending' }));
  assert(indicatorSendingHtml.includes('data-testid="status-sending"'), 'StatusIndicator renders data-testid="status-sending"');
  assert(indicatorSendingHtml.includes('animate-pulse'), 'StatusIndicator pulsates during sending');

  const indicatorSentHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sent' }));
  assert(indicatorSentHtml.includes('data-testid="status-sent"'), 'StatusIndicator renders data-testid="status-sent"');
  assert(indicatorSentHtml.includes('text-blue-400'), 'StatusIndicator renders blue Check for sent status');

  // 2. MessageItem component contracts for failed status
  const failedMessageSample: Message = {
    id: failedMsg?.id || 'failed-sample-id',
    clientMessageId: failedMsg?.clientMessageId || 'failed-sample-id',
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Failed delivery message sample',
    timestamp: '03:15 PM',
    status: 'failed',
  };

  const messageItemFailedHtml = renderToStaticMarkup(
    React.createElement(MessageItem, { message: failedMessageSample })
  );

  assert(messageItemFailedHtml.includes('data-testid="message-item"'), 'MessageItem renders data-testid="message-item"');
  assert(messageItemFailedHtml.includes('data-status="failed"'), 'MessageItem root has data-status="failed"');
  assert(messageItemFailedHtml.includes('data-testid="status-failed"'), 'MessageItem contains StatusIndicator with status-failed');
  assert(messageItemFailedHtml.includes('data-testid="retry-button"'), 'MessageItem displays retry button (data-testid="retry-button") when status="failed"');
  assert(messageItemFailedHtml.includes('title="Retry sending"'), 'Retry button has title="Retry sending"');
  assert(messageItemFailedHtml.includes('Retry'), 'Retry button contains visible "Retry" text');
  assert(
    messageItemFailedHtml.includes('border-red-500/30') && messageItemFailedHtml.includes('bg-red-950/20'),
    'MessageItem has distinctive red border & background styling when failed'
  );
  assert(messageItemFailedHtml.includes('opacity-100'), 'Failed MessageItem is full opacity (opacity-100)');

  // 3. MessageItem when sending (retry button must NOT appear)
  const sendingMessageSample: Message = {
    ...failedMessageSample,
    id: 'sending-sample-id',
    status: 'sending',
  };
  const messageItemSendingHtml = renderToStaticMarkup(
    React.createElement(MessageItem, { message: sendingMessageSample })
  );
  assert(!messageItemSendingHtml.includes('data-testid="retry-button"'), 'MessageItem does NOT show retry button while status="sending"');
  assert(messageItemSendingHtml.includes('opacity-70'), 'MessageItem is dimmed (opacity-70) while status="sending"');

  // 4. MessageItem when sent (retry button must NOT appear)
  const sentMessageSample: Message = {
    ...failedMessageSample,
    id: 'sent-sample-id',
    status: 'sent',
  };
  const messageItemSentHtml = renderToStaticMarkup(
    React.createElement(MessageItem, { message: sentMessageSample })
  );
  assert(!messageItemSentHtml.includes('data-testid="retry-button"'), 'MessageItem does NOT show retry button when status="sent"');
  assert(!messageItemSentHtml.includes('data-testid="status-failed"'), 'MessageItem does NOT have status-failed when sent');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Executing retryMessage Reusing client_message_id
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Executing retryMessage Reusing client_message_id ---');

  const failedMsgId = failedMsg!.id;
  const originalClientMsgId = failedMsg!.clientMessageId!;
  let retryInsertPayload: unknown = null;
  const generatedDbUuid = 'db-resolved-uuid-9999';

  // Intercept supabase.from to simulate successful insert upon retry
  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: (payload: unknown) => {
          retryInsertPayload = payload;
          return {
            select: () => ({
              single: async () => {
                await sleep(30);
                return {
                  data: {
                    id: generatedDbUuid,
                    channel_id: (payload as Record<string, unknown>).channel_id,
                    content: (payload as Record<string, unknown>).content,
                    sender_id: (payload as Record<string, unknown>).sender_id,
                    client_message_id: (payload as Record<string, unknown>).client_message_id,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                };
              },
            }),
          };
        },
      };
    }
    return {};
  };

  // Trigger retryMessage
  const retryPromise = useWorkspaceStore.getState().retryMessage(channelId, failedMsgId);

  // Synchronously verify that status transitioned back to 'sending'
  const inFlightRetryMsg = useWorkspaceStore.getState().messages[channelId]?.find(
    (m) => m.clientMessageId === originalClientMsgId
  );
  assert(inFlightRetryMsg?.status === 'sending', 'retryMessage immediately transitions status back to "sending"');

  // Await retry completion
  await retryPromise;
  await sleep(60);

  // Verify DB insert received the exact same client_message_id
  const typedRetryPayload = retryInsertPayload as Record<string, unknown>;
  assert(typedRetryPayload !== null, 'Supabase insert was invoked on retry');
  assert(
    typedRetryPayload.client_message_id === originalClientMsgId,
    'retryMessage reused the identical client_message_id'
  );
  assert(
    typedRetryPayload.content === content,
    'retryMessage submitted the original message content'
  );

  // Verify message transitioned to 'sent' and id updated to DB uuid
  const resolvedList = useWorkspaceStore.getState().messages[channelId] || [];
  const resolvedRetryMsg = resolvedList.find((m) => m.clientMessageId === originalClientMsgId);

  assert(resolvedRetryMsg !== undefined, 'Retried message exists in store');
  assert(resolvedRetryMsg?.status === 'sent', 'Retried message cleanly transitioned to "sent"');
  assert(resolvedRetryMsg?.id === generatedDbUuid, 'Message id was reconciled from clientMessageId to server DB UUID');
  assert(
    resolvedList.filter((m) => m.clientMessageId === originalClientMsgId).length === 1,
    'Exactly 1 message exists in channel (zero duplicate bubbles after retry)'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: PostgreSQL 23505 Unique Constraint Violation Recovery
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: PostgreSQL 23505 Unique Constraint Violation Recovery ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  // Scenario: Client sent message, network dropped before receiving response.
  // The row WAS inserted on the server with DB id "server-db-uuid-original-23505".
  // Client is in "failed" state. User retries.
  // Server rejects with PostgreSQL error code 23505 (unique_violation).
  // Client queries existing row by client_message_id and resolves to 'sent'.

  const dupTestChannel = 'general';
  const dupClientMsgId = 'client-uuid-dup-test-23505';
  const serverDbIdOnServer = 'server-db-uuid-original-23505';

  const failedUnackedMsg: Message = {
    id: dupClientMsgId,
    clientMessageId: dupClientMsgId,
    channelId: dupTestChannel,
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Message that actually succeeded on server before client dropped connection',
    timestamp: '04:00 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      [dupTestChannel]: [failedUnackedMsg],
    },
  });

  const selectTracker = {
    invoked: false,
    field: '',
    value: '',
  };

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => {
              await sleep(30);
              // Return PostgreSQL 23505 error
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "messages_client_message_id_key"',
                  details: `Key (client_message_id)=(${dupClientMsgId}) already exists.`,
                },
              };
            },
          }),
        }),
        select: () => ({
          eq: (field: string, val: string) => {
            selectTracker.invoked = true;
            selectTracker.field = field;
            selectTracker.value = val;
            return {
              single: async () => {
                await sleep(20);
                return {
                  data: {
                    id: serverDbIdOnServer,
                    channel_id: dupTestChannel,
                    sender_id: useWorkspaceStore.getState().currentUser.id,
                    content: failedUnackedMsg.content,
                    client_message_id: dupClientMsgId,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                };
              },
            };
          },
        }),
      };
    }
    return {};
  };

  // Execute retryMessage on the failed un-acked message
  await useWorkspaceStore.getState().retryMessage(dupTestChannel, dupClientMsgId);
  await sleep(60);

  assert(selectTracker.invoked === true, 'Store caught 23505 and executed fallback select query');
  assert(selectTracker.field === 'client_message_id', 'Fallback select queried on client_message_id');
  assert(selectTracker.value === dupClientMsgId, 'Fallback select queried with the exact client_message_id');

  const recoveredList = useWorkspaceStore.getState().messages[dupTestChannel] || [];
  const recoveredMsg = recoveredList.find((m) => m.clientMessageId === dupClientMsgId);

  assert(recoveredMsg !== undefined, 'Recovered message exists in store');
  assert(recoveredMsg?.status === 'sent', 'Recovered message successfully transitioned to "sent" on 23505 recovery');
  assert(recoveredMsg?.id === serverDbIdOnServer, 'Recovered message adopted existing server DB ID');
  assert(recoveredList.length === 1, 'Channel contains exactly 1 message bubble (no duplicates created on 23505)');

  // Test variation: error.message contains "duplicate key" without code 23505
  const dupMsg2ClientMsgId = 'client-uuid-dup-variant-2';
  const dupMsg2ServerDbId = 'server-db-uuid-variant-2';
  const failedUnackedMsg2: Message = {
    id: dupMsg2ClientMsgId,
    clientMessageId: dupMsg2ClientMsgId,
    channelId: dupTestChannel,
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Variant duplicate error message',
    timestamp: '04:05 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      [dupTestChannel]: [failedUnackedMsg2],
    },
  });

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint',
              },
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: dupMsg2ServerDbId,
                client_message_id: dupMsg2ClientMsgId,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    return {};
  };

  await useWorkspaceStore.getState().retryMessage(dupTestChannel, dupMsg2ClientMsgId);
  await sleep(40);

  const recoveredMsg2 = (useWorkspaceStore.getState().messages[dupTestChannel] || []).find(
    (m) => m.clientMessageId === dupMsg2ClientMsgId
  );
  assert(recoveredMsg2?.status === 'sent', 'String match "duplicate key" successfully triggered 23505 recovery');
  assert(recoveredMsg2?.id === dupMsg2ServerDbId, 'Variant duplicate adopted server DB ID');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Rapid Spamming of Retry Button (Concurrency & Race Conditions)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: Rapid Spamming of Retry Button ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  const spamChannel = 'general';
  const spamClientMsgId = 'client-uuid-spam-test-888';
  const spamDbId = 'db-uuid-spam-winner';

  const spamFailedMsg: Message = {
    id: spamClientMsgId,
    clientMessageId: spamClientMsgId,
    channelId: spamChannel,
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Rapid click spam target message',
    timestamp: '04:10 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      [spamChannel]: [spamFailedMsg],
    },
  });

  let insertInvocationCount: number = 0;
  let firstInsertCompleted: boolean = false;

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => {
          insertInvocationCount++;
          return {
            select: () => ({
              single: async () => {
                // Simulate race condition: first one succeeds, others hit 23505
                await sleep(15 + Math.floor(Math.random() * 20));
                if (!firstInsertCompleted) {
                  firstInsertCompleted = true;
                  return {
                    data: {
                      id: spamDbId,
                      channel_id: spamChannel,
                      content: spamFailedMsg.content,
                      client_message_id: spamClientMsgId,
                    },
                    error: null,
                  };
                } else {
                  return {
                    data: null,
                    error: {
                      code: '23505',
                      message: 'duplicate key value violates unique constraint',
                    },
                  };
                }
              },
            }),
          };
        },
        select: () => ({
          eq: () => ({
            single: async () => {
              await sleep(10);
              return {
                data: {
                  id: spamDbId,
                  client_message_id: spamClientMsgId,
                },
                error: null,
              };
            },
          }),
        }),
      };
    }
    return {};
  };

  // Spam 25 concurrent retries simultaneously
  const SPAM_COUNT = 25;
  const spamPromises: Promise<void>[] = [];
  for (let i = 0; i < SPAM_COUNT; i++) {
    spamPromises.push(
      Promise.resolve(useWorkspaceStore.getState().retryMessage(spamChannel, spamClientMsgId))
    );
  }

  // All 25 promises must settle cleanly without unhandled exceptions
  let spamThrewError = false;
  try {
    await Promise.all(spamPromises);
  } catch {
    spamThrewError = true;
  }

  await sleep(100);

  assert(spamThrewError === false, 'Rapid spam of 25 concurrent retries did not throw unhandled exceptions');
  assert(insertInvocationCount === SPAM_COUNT, `All ${SPAM_COUNT} retry attempts dispatched without crashing`);

  const spamChannelList = useWorkspaceStore.getState().messages[spamChannel] || [];
  assert(
    spamChannelList.length === 1,
    `CRITICAL: Channel message array length is strictly 1 (found ${spamChannelList.length}) - zero duplicate bubbles created under 25x spam`
  );

  const finalSpamMsg = spamChannelList[0];
  assert(finalSpamMsg.status === 'sent', 'Final status of spammed message is "sent"');
  assert(finalSpamMsg.id === spamDbId, 'Final message id reconciled to the server DB ID');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Consecutive Retry Failures & Eventual Success
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 6: Multi-Attempt Consecutive Failures and Eventual Success ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  const multiAttemptClientMsgId = 'client-uuid-multi-attempt';
  const multiAttemptChannel = 'general';
  let attemptNumber = 0;

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => {
              attemptNumber++;
              await sleep(20);
              if (attemptNumber === 1) {
                // Attempt 1: 503 Service Unavailable
                return { data: null, error: { message: '503 Service Unavailable', code: 'UNAVAILABLE' } };
              } else if (attemptNumber === 2) {
                // Attempt 2: 504 Gateway Timeout
                return { data: null, error: { message: '504 Gateway Timeout', code: 'TIMEOUT' } };
              } else {
                // Attempt 3: Restored & Succeeded
                return {
                  data: {
                    id: 'db-final-success-id',
                    client_message_id: multiAttemptClientMsgId,
                    content: 'Multi attempt content',
                  },
                  error: null,
                };
              }
            },
          }),
        }),
      };
    }
    return {};
  };

  // Initial send fails (attempt 1)
  useWorkspaceStore.getState().sendMessage(multiAttemptChannel, 'Multi attempt content');
  await sleep(60);

  const initialList6 = useWorkspaceStore.getState().messages[multiAttemptChannel] || [];
  let curMsg = initialList6[initialList6.length - 1];
  const initialLength6 = initialList6.length;
  assert(curMsg?.status === 'failed', 'Attempt 1 failed -> status="failed"');

  // Retry 1 fails (attempt 2)
  await useWorkspaceStore.getState().retryMessage(multiAttemptChannel, curMsg.id);
  await sleep(60);

  const retry1List = useWorkspaceStore.getState().messages[multiAttemptChannel] || [];
  curMsg = retry1List[retry1List.length - 1];
  assert(curMsg?.status === 'failed', 'Attempt 2 failed -> status cleanly re-transitions to "failed"');

  // Retry 2 succeeds (attempt 3)
  await useWorkspaceStore.getState().retryMessage(multiAttemptChannel, curMsg.id);
  await sleep(60);

  const retry2List = useWorkspaceStore.getState().messages[multiAttemptChannel] || [];
  curMsg = retry2List[retry2List.length - 1];
  assert(curMsg?.status === 'sent', 'Attempt 3 succeeded -> status cleanly transitions to "sent"');
  assert(curMsg?.id === 'db-final-success-id', 'Final id reconciled after consecutive retries');
  assert(
    retry2List.length === initialLength6,
    'Zero duplicates across 3 failure/retry cycles'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Channel Switching During In-Flight Retry (Zero Cross-Channel Leakage)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 7: Channel Switching During In-Flight Retry ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  const channelA = 'general';
  const channelB = 'announcements';

  const inFlightLeakMsg: Message = {
    id: 'msg-leak-check',
    clientMessageId: 'msg-leak-check',
    channelId: channelA,
    sender: useWorkspaceStore.getState().currentUser,
    content: 'In-flight retry channel switch test',
    timestamp: '05:00 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      [channelA]: [inFlightLeakMsg],
      [channelB]: [],
    },
    activeChannelId: channelA,
  });

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => {
              // Delayed server response while user switches channels
              await sleep(80);
              return {
                data: {
                  id: 'db-channel-a-resolved',
                  channel_id: channelA,
                  content: inFlightLeakMsg.content,
                  client_message_id: inFlightLeakMsg.clientMessageId,
                },
                error: null,
              };
            },
          }),
        }),
      };
    }
    return {};
  };

  // User starts retry on channelA
  const inFlightRetryPromise = useWorkspaceStore.getState().retryMessage(channelA, inFlightLeakMsg.id);

  // User immediately switches to channelB and posts a message there
  useWorkspaceStore.getState().setActiveChannel(channelB);
  assert(useWorkspaceStore.getState().activeChannelId === channelB, 'Active channel switched to announcements');

  // Await channelA retry to finish in background
  await inFlightRetryPromise;
  await sleep(100);

  const channelAMessages = useWorkspaceStore.getState().messages[channelA] || [];
  const channelBMessages = useWorkspaceStore.getState().messages[channelB] || [];

  assert(
    channelAMessages.length === 1 && channelAMessages[0].status === 'sent',
    'Channel A message resolved to "sent" in its own channel'
  );
  assert(
    channelBMessages.length === 0,
    'CRITICAL: Channel B contains zero messages (no cross-channel leak during in-flight retry)'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 8: Reset / Logout Race Condition & Defensive Edge Cases
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 8: Reset / Logout Race Condition & Defensive Edge Cases ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  const resetTargetMsg: Message = {
    id: 'msg-reset-race',
    clientMessageId: 'msg-reset-race',
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: 'Will be purged by logout while retry is in flight',
    timestamp: '06:00 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      general: [resetTargetMsg],
    },
  });

  supabaseClient.from = (tableName: string) => {
    if (tableName === 'messages') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => {
              await sleep(100);
              return {
                data: {
                  id: 'db-late-arrival',
                  client_message_id: resetTargetMsg.clientMessageId,
                },
                error: null,
              };
            },
          }),
        }),
      };
    }
    return {};
  };

  // Retry started
  const lateRetryPromise = useWorkspaceStore.getState().retryMessage('general', resetTargetMsg.id);

  // 20ms later, user logs out / resets store
  await sleep(20);
  useWorkspaceStore.getState().resetWorkspaceState();

  // Await the late retry response
  await lateRetryPromise;
  await sleep(120);

  const postResetMessages = useWorkspaceStore.getState().messages['general'] || [];
  const zombieMsg = postResetMessages.find((m) => m.clientMessageId === resetTargetMsg.clientMessageId);

  assert(
    zombieMsg === undefined,
    'Reset defense: late in-flight network response does NOT resurrect purged message into store'
  );

  // Test defensive handling: retry non-existent message ID
  let nonExistentThrew = false;
  try {
    await useWorkspaceStore.getState().retryMessage('general', 'ghost-message-id-999');
  } catch {
    nonExistentThrew = true;
  }
  assert(nonExistentThrew === false, 'retryMessage defensively ignores non-existent message ID without crashing');

  // Test defensive handling: retry on non-existent channel ID
  let nonExistentChannelThrew = false;
  try {
    await useWorkspaceStore.getState().retryMessage('ghost-channel-999', 'ghost-message-id');
  } catch {
    nonExistentChannelThrew = true;
  }
  assert(nonExistentChannelThrew === false, 'retryMessage defensively ignores non-existent channel ID without crashing');

  // ──────────────────────────────────────────────────────────────────────────
  // Summary & Exit Codes
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`Challenger 2 Adversarial Results: ${totalPassed} passed, ${totalFailed} failed`);
  if (failureDetails.length > 0) {
    console.log('Failed assertions:');
    failureDetails.forEach((f) => console.log(f));
  }
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialRetrySuite().catch((err: unknown) => {
  console.error('Adversarial retry test crashed:', err);
  process.exit(1);
});
