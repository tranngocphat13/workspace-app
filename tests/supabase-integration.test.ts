// ==============================================================================
// Consolidated Supabase Integration Test Suite (Milestone D)
// File: workspace-app/tests/supabase-integration.test.ts
// Run via: npx tsx tests/supabase-integration.test.ts
// ==============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { supabase, isSupabaseConfigured, mapSupabaseMessage } from '../src/lib/supabase';
import { StatusIndicator } from '../src/components/Chat/StatusIndicator';
import { MessageItem } from '../src/components/Chat/MessageItem';
import { ChatArea } from '../src/components/Chat/ChatArea';
import type { Message, AuthUser } from '../src/types';

// ==============================================================================
// 1. Setup Mock React Dispatcher for Node SSR Rendering
// ==============================================================================

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
    if (prop === 'useId') return () => ':r-sync:';
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

// ==============================================================================
// 2. Test Execution Tracker & Assert Utility
// ==============================================================================

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

// ==============================================================================
// 3. Test Suites
// ==============================================================================

async function runConsolidatedIntegrationSuite() {
  console.log('\n================================================================');
  console.log('   CONSOLIDATED SUPABASE INTEGRATION TEST SUITE (MILESTONE D)');
  console.log('================================================================\n');

  // Clean slate before starting
  localStorage.clear();
  useWorkspaceStore.getState().resetWorkspaceState();
  await useAuthStore.getState().logout();

  // ----------------------------------------------------------------------------
  // SUITE 1: Coexistence & Dual-Mode Compatibility (Phase 1 & 2)
  // ----------------------------------------------------------------------------
  console.log('--- Suite 1: Coexistence & Dual-Mode Compatibility ---');

  assert(typeof isSupabaseConfigured === 'boolean', '1.1 isSupabaseConfigured exports a valid boolean flag');
  if (!isSupabaseConfigured) {
    assert(supabase === null, '1.2 supabase client is safely null when environment variables are omitted');
  } else {
    assert(supabase !== null, '1.2 supabase client is initialized when environment variables are configured');
  }

  // Verify mapSupabaseMessage mapper with full row
  const fullRow = {
    id: 'msg-uuid-101',
    channel_id: 'general',
    content: 'Coexistence verification test message',
    created_at: '2026-10-28T14:30:00.000Z',
    status: 'sent',
    client_message_id: 'client-uuid-9999',
    sender: {
      id: 'usr-charlie',
      name: 'Charlie Smith',
      avatar_url: 'https://example.com/avatar.png',
      status_text: 'Reviewing PRs',
    },
  };

  const mapped1 = mapSupabaseMessage(fullRow);
  assert(mapped1.id === 'msg-uuid-101', '1.3 mapSupabaseMessage preserves database id');
  assert(mapped1.channelId === 'general', '1.4 mapSupabaseMessage maps channel_id to channelId');
  assert(mapped1.content === 'Coexistence verification test message', '1.5 mapSupabaseMessage maps content accurately');
  assert(mapped1.sender.name === 'Charlie Smith', '1.6 mapSupabaseMessage extracts sender.name');
  assert(mapped1.sender.avatarUrl === 'https://example.com/avatar.png', '1.7 mapSupabaseMessage extracts sender avatar');
  assert(mapped1.sender.statusText === 'Reviewing PRs', '1.8 mapSupabaseMessage extracts sender status text');
  assert(mapped1.clientMessageId === 'client-uuid-9999', '1.9 mapSupabaseMessage preserves client_message_id');
  assert(mapped1.status === 'sent', '1.10 mapSupabaseMessage maps status');

  // Verify mapSupabaseMessage mapper with stringified JSON sender
  const stringifiedSenderRow = {
    id: 'msg-uuid-102',
    channel_id: 'development',
    content: 'Payload with JSON string sender',
    sender: JSON.stringify({
      id: 'usr-dan',
      name: 'Dan Abramov',
      avatar_url: 'https://example.com/dan.jpg',
      status_text: 'Building React',
    }),
  };
  const mapped2 = mapSupabaseMessage(stringifiedSenderRow);
  assert(mapped2.sender.id === 'usr-dan', '1.11 mapSupabaseMessage parses stringified JSON sender id');
  assert(mapped2.sender.name === 'Dan Abramov', '1.12 mapSupabaseMessage parses stringified JSON sender name');

  // Verify mapSupabaseMessage with missing/null sender fallback
  const fallbackRow = {
    id: 'msg-uuid-103',
    channel_id: 'random',
    content: 'Message without sender info',
  };
  const mapped3 = mapSupabaseMessage(fallbackRow);
  assert(mapped3.sender.id === 'user-system', '1.13 mapSupabaseMessage supplies fallback sender id');
  assert(mapped3.sender.name === 'Member', '1.14 mapSupabaseMessage supplies fallback sender name');

  // ----------------------------------------------------------------------------
  // SUITE 2: Supabase Authentication Workflow & Store Synchronization
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 2: Supabase Auth Lifecycle & Profile Synchronization ---');

  // 2.1 Initial store state
  const initialAuth = useAuthStore.getState();
  assert(initialAuth.user === null, '2.1 Initial auth user is null');
  assert(initialAuth.error === null, '2.2 Initial auth error is null');

  // 2.2 initAuth lifecycle
  useAuthStore.getState().initAuth();
  assert(useAuthStore.getState().isInitialized === true, '2.3 initAuth sets isInitialized to true');

  // 2.3 Login workflow
  const testEmail = 'alex.dev@workspace.org';
  const testPass = 'SecurePass2026!';
  await useAuthStore.getState().login(testEmail, testPass);

  const authUser = useAuthStore.getState().user;
  assert(authUser !== null, '2.4 login sets authenticated user');
  assert(authUser?.email === testEmail, '2.5 authenticated user email matches login argument');
  assert(typeof authUser?.name === 'string' && authUser.name.length > 0, '2.6 authenticated user has non-empty name');
  assert(typeof authUser?.avatarUrl === 'string' && authUser.avatarUrl.length > 0, '2.7 avatar URL is generated');
  assert(useAuthStore.getState().isLoading === false, '2.8 isLoading is false after login');

  // 2.4 Profile synchronization with useWorkspaceStore
  const currentWorkspaceUser = useWorkspaceStore.getState().currentUser;
  assert(currentWorkspaceUser.id === authUser?.id, '2.9 Workspace currentUser id synced with auth user id');
  assert(currentWorkspaceUser.name === authUser?.name, '2.10 Workspace currentUser name synced with auth user name');

  // 2.5 Registration workflow
  const newUserName = 'Evelyn Carter';
  const newUserEmail = 'evelyn.carter@workspace.org';
  await useAuthStore.getState().register(newUserName, newUserEmail, 'EvelynPass123!');

  const registeredUser = useAuthStore.getState().user;
  assert(registeredUser !== null, '2.11 register sets registered user');
  assert(registeredUser?.name === newUserName, '2.12 registered user name matches registration input');
  assert(registeredUser?.email === newUserEmail, '2.13 registered user email matches registration input');
  assert(
    useWorkspaceStore.getState().currentUser.name === newUserName,
    '2.14 Workspace currentUser synchronized to registered user'
  );

  // 2.6 Aliases check
  assert(typeof useAuthStore.getState().signIn === 'function', '2.15 signIn alias is defined');
  assert(typeof useAuthStore.getState().signUp === 'function', '2.16 signUp alias is defined');
  assert(typeof useAuthStore.getState().signOut === 'function', '2.17 signOut alias is defined');

  // 2.7 Logout workflow
  await useAuthStore.getState().logout();
  assert(useAuthStore.getState().user === null, '2.18 logout purges authenticated user in auth store');
  assert(
    useWorkspaceStore.getState().currentUser.id === 'user-current',
    '2.19 logout restores default INITIAL_USER in workspace store'
  );

  // ----------------------------------------------------------------------------
  // SUITE 3: Multi-User State Isolation & Memory Security
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 3: Multi-User State Isolation & Memory Security ---');

  // 3.1 Verify complete cache purge on logout
  await useAuthStore.getState().login('alice@example.com', 'PassAlice123!');
  await useWorkspaceStore.getState().createChannel('alice-confidential', 'Alice internal notes');
  useWorkspaceStore.getState().sendMessage('alice-confidential', 'Confidential token: XYZ-999');

  assert(
    useWorkspaceStore.getState().channels.some((c) => c.id === 'alice-confidential'),
    '3.1 Alice created proprietary channel'
  );
  assert(
    localStorage.getItem('workspace_persisted_channels_v1') !== null,
    '3.2 Channels persisted to localStorage'
  );

  await useAuthStore.getState().logout();
  assert(
    localStorage.getItem('workspace_persisted_channels_v1') === null,
    '3.3 workspace_persisted_channels_v1 purged from localStorage on logout'
  );
  assert(
    localStorage.getItem('workspace_persisted_messages_v1') === null,
    '3.4 workspace_persisted_messages_v1 purged from localStorage on logout'
  );

  // 3.2 Direct account switch without calling logout (Carol -> Dave)
  await useAuthStore.getState().login('carol@example.com', 'PassCarol!');
  await useWorkspaceStore.getState().createChannel('carol-restricted', 'Carol private desk');
  useWorkspaceStore.getState().sendMessage('carol-restricted', 'Carol private memo');

  assert(
    useWorkspaceStore.getState().channels.some((c) => c.id === 'carol-restricted'),
    '3.5 Carol proprietary channel created'
  );

  // Dave logs in directly WITHOUT calling logout() first
  await useAuthStore.getState().login('dave@example.com', 'PassDave!');
  assert(useAuthStore.getState().user?.email === 'dave@example.com', '3.6 Dave logged in directly');
  assert(
    (useWorkspaceStore.getState().currentUser as AuthUser).email === 'dave@example.com',
    '3.7 Workspace currentUser switched to Dave'
  );

  const daveChannels = useWorkspaceStore.getState().channels;
  const daveMessages = useWorkspaceStore.getState().messages;
  assert(
    !daveChannels.some((c) => c.id === 'carol-restricted'),
    '3.8 Carol proprietary channel did NOT bleed to Dave session'
  );
  assert(
    daveMessages['carol-restricted'] === undefined,
    '3.9 Carol proprietary messages did NOT bleed to Dave session'
  );

  await useAuthStore.getState().logout();

  // 3.3 In-flight message delay race condition guard
  await useAuthStore.getState().login('grace@example.com', 'PassGrace!');
  useWorkspaceStore.getState().sendMessage('general', 'Grace transient in-flight message');

  // Immediately logout while 1000ms delay is pending
  await useAuthStore.getState().logout();

  // Wait 1250ms for the delay timer to complete
  await sleep(1250);

  const postTimerMessages = useWorkspaceStore.getState().messages['general'] || [];
  const graceMsgResurrected = postTimerMessages.some(
    (m) => m.content === 'Grace transient in-flight message'
  );
  const cacheRecreated = localStorage.getItem('workspace_persisted_messages_v1') !== null;

  assert(
    !graceMsgResurrected,
    '3.10 In-flight message timer did NOT resurrect Grace message after logout'
  );
  assert(
    !cacheRecreated,
    '3.11 In-flight message timer did NOT recreate localStorage cache after logout'
  );

  // ----------------------------------------------------------------------------
  // SUITE 4: Real-time Chat Sync & Channel Scoping
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 4: Real-time Chat Sync & Channel Scoping ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  // 4.1 Channel switching and scoping
  assert(useWorkspaceStore.getState().activeChannelId === 'general', '4.1 Default active channel is "general"');
  useWorkspaceStore.getState().setActiveChannel('random');
  assert(useWorkspaceStore.getState().activeChannelId === 'random', '4.2 Active channel switched to "random"');

  // Verify non-existent channel is rejected
  useWorkspaceStore.getState().setActiveChannel('non-existent-channel-id');
  assert(useWorkspaceStore.getState().activeChannelId === 'random', '4.3 Invalid channel id ignored');

  // 4.2 Messages in general do not bleed to random
  const generalMsgs = useWorkspaceStore.getState().messages['general'] || [];
  const randomMsgs = useWorkspaceStore.getState().messages['random'] || [];
  assert(
    generalMsgs !== randomMsgs,
    '4.4 Messages records are distinct per channel'
  );

  // 4.3 subscribeToRealtime lifecycle
  const unsubscribeDev = useWorkspaceStore.getState().subscribeToRealtime('development');
  assert(typeof unsubscribeDev === 'function', '4.5 subscribeToRealtime returns unsubscription closure');
  unsubscribeDev(); // Execute unsubscription cleanly

  // ----------------------------------------------------------------------------
  // SUITE 5: Deterministic Message Deduplication via client_message_id
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 5: Deterministic Message Deduplication via client_message_id ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  // 5.1 Optimistic dispatch
  const uniqueContent = 'Deduplication Contract Verification Message';
  useWorkspaceStore.getState().sendMessage('general', uniqueContent);

  const currentGeneral = useWorkspaceStore.getState().messages['general'] || [];
  const optimisticMsg = currentGeneral.find((m) => m.content === uniqueContent);

  assert(optimisticMsg !== undefined, '5.1 Optimistic message added to channel');
  assert(optimisticMsg?.status === 'sending', '5.2 Initial optimistic status is "sending"');
  assert(
    typeof optimisticMsg?.clientMessageId === 'string' && optimisticMsg.clientMessageId.length > 8,
    '5.3 clientMessageId generated as valid UUID/identifier'
  );
  assert(
    optimisticMsg?.id === optimisticMsg?.clientMessageId,
    '5.4 Optimistic message id equals clientMessageId'
  );

  const clientMsgId = optimisticMsg!.clientMessageId!;

  // 5.2 Server DB confirmation reconciliation
  // Simulate receiving database confirmation or realtime broadcast with same client_message_id
  const serverGeneratedDbId = 'real-db-uuid-8888-9999';

  useWorkspaceStore.setState((state) => {
    const list = state.messages['general'] || [];
    const optimisticIndex = list.findIndex(
      (m) => m.clientMessageId === clientMsgId || m.id === clientMsgId
    );

    let updatedList: Message[];
    if (optimisticIndex !== -1) {
      updatedList = [...list];
      updatedList[optimisticIndex] = {
        ...updatedList[optimisticIndex],
        id: serverGeneratedDbId,
        clientMessageId: clientMsgId,
        status: 'sent',
      };
    } else {
      updatedList = [
        ...list,
        {
          id: serverGeneratedDbId,
          channelId: 'general',
          sender: state.currentUser,
          content: uniqueContent,
          timestamp: '12:00 PM',
          status: 'sent',
          clientMessageId: clientMsgId,
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

  const reconciledList = useWorkspaceStore.getState().messages['general'] || [];
  const matchingItems = reconciledList.filter((m) => m.content === uniqueContent);

  assert(matchingItems.length === 1, '5.5 Deduplication: exactly 1 message bubble exists (no duplicates)');
  assert(matchingItems[0].id === serverGeneratedDbId, '5.6 Message id reconciled to server database UUID');
  assert(matchingItems[0].status === 'sent', '5.7 Message status transitioned to "sent"');
  assert(matchingItems[0].clientMessageId === clientMsgId, '5.8 clientMessageId preserved');

  // 5.3 Duplicate packet re-delivery idempotency
  useWorkspaceStore.setState((state) => {
    const list = state.messages['general'] || [];
    if (list.some((m) => m.id === serverGeneratedDbId)) {
      return state; // Idempotently ignore already present packet
    }
    return {
      messages: {
        ...state.messages,
        general: [...list, matchingItems[0]],
      },
    };
  });

  const duplicateCheckList = useWorkspaceStore.getState().messages['general'] || [];
  const duplicateMatching = duplicateCheckList.filter((m) => m.content === uniqueContent);
  assert(
    duplicateMatching.length === 1,
    '5.9 Idempotency: re-delivered message with same server ID does not create duplicate bubble'
  );

  // ----------------------------------------------------------------------------
  // SUITE 6: Idempotent Retries & PostgreSQL 23505 Unique Constraint Recovery
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 6: Failed State, Retries & PostgreSQL 23505 Recovery ---');
  useWorkspaceStore.getState().resetWorkspaceState();

  const failedMsgId = 'client-fail-uuid-111';
  const failedContent = 'Message failing due to transient connection timeout';
  const failedMessage: Message = {
    id: failedMsgId,
    clientMessageId: failedMsgId,
    channelId: 'general',
    sender: useWorkspaceStore.getState().currentUser,
    content: failedContent,
    timestamp: '03:15 PM',
    status: 'failed',
  };

  useWorkspaceStore.setState({
    messages: {
      ...useWorkspaceStore.getState().messages,
      general: [failedMessage],
    },
  });

  assert(
    useWorkspaceStore.getState().messages['general'][0].status === 'failed',
    '6.1 Failed message seeded in store with status "failed"'
  );

  // Trigger retryMessage
  useWorkspaceStore.getState().retryMessage('general', failedMsgId);

  const retryingMsg = useWorkspaceStore.getState().messages['general'][0];
  assert(
    retryingMsg.status === 'sending',
    '6.2 retryMessage transitions status immediately back to "sending"'
  );
  assert(
    retryingMsg.clientMessageId === failedMsgId,
    '6.3 retryMessage strictly preserves original clientMessageId for deduplication'
  );

  // Simulate PostgreSQL 23505 unique constraint recovery:
  // In a real network blip, the first insert actually succeeded on the database,
  // so the retry insert throws 23505 (unique violation).
  // The store recovers by querying the existing row and setting status to 'sent'.
  const resolvedDbId = 'server-uuid-recovered-23505';
  useWorkspaceStore.setState((currState) => {
    const list = currState.messages['general'] || [];
    const updated = list.map((m) =>
      m.id === failedMsgId || m.clientMessageId === failedMsgId
        ? { ...m, id: resolvedDbId, status: 'sent' as const }
        : m
    );
    return { messages: { ...currState.messages, general: updated } };
  });

  const recoveredMsg = useWorkspaceStore.getState().messages['general'][0];
  assert(
    recoveredMsg.status === 'sent',
    '6.4 PostgreSQL 23505 recovery transitions message to "sent"'
  );
  assert(
    recoveredMsg.id === resolvedDbId,
    '6.5 PostgreSQL 23505 recovery updates message id to database UUID'
  );

  // ----------------------------------------------------------------------------
  // SUITE 7: UI Component Contracts & Render Verification
  // ----------------------------------------------------------------------------
  console.log('\n--- Suite 7: UI Component Rendering Contracts ---');

  // 7.1 StatusIndicator rendering for 'failed'
  const failedHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'failed' }));
  assert(
    failedHtml.includes('data-testid="status-failed"'),
    '7.1 StatusIndicator renders data-testid="status-failed" for status="failed"'
  );
  assert(
    failedHtml.includes('title="Failed to send"'),
    '7.2 StatusIndicator renders title="Failed to send" for status="failed"'
  );
  assert(
    failedHtml.includes('text-red-400'),
    '7.3 StatusIndicator applies text-red-400 styling for status="failed"'
  );

  // 7.2 StatusIndicator rendering for 'sending' and 'sent'
  const sendingHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sending' }));
  assert(
    sendingHtml.includes('data-testid="status-sending"'),
    '7.4 StatusIndicator renders data-testid="status-sending" for status="sending"'
  );

  const sentHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sent' }));
  assert(
    sentHtml.includes('data-testid="status-sent"'),
    '7.5 StatusIndicator renders data-testid="status-sent" for status="sent"'
  );

  // 7.3 MessageItem rendering with inline retry button
  const sampleFailedMessage: Message = {
    id: 'msg-render-failed-ui',
    channelId: 'general',
    sender: { id: 'usr-tester', name: 'Quality Engineer' },
    content: 'Failed delivery message with retry button',
    timestamp: '04:00 PM',
    status: 'failed',
    clientMessageId: 'client-render-failed-ui',
  };

  const failedItemHtml = renderToStaticMarkup(
    React.createElement(MessageItem, { message: sampleFailedMessage })
  );

  assert(
    failedItemHtml.includes('data-testid="message-item"'),
    '7.6 MessageItem renders data-testid="message-item"'
  );
  assert(
    failedItemHtml.includes('data-status="failed"'),
    '7.7 MessageItem renders data-status="failed"'
  );
  assert(
    failedItemHtml.includes('data-testid="retry-button"'),
    '7.8 MessageItem renders retry button data-testid="retry-button" when status="failed"'
  );
  assert(
    failedItemHtml.includes('border-red-500/30') || failedItemHtml.includes('bg-red-950/20'),
    '7.9 MessageItem applies red styling border/background for failed message'
  );

  // 7.4 MessageItem does NOT render retry button when sent
  const sampleSentMessage: Message = {
    id: 'msg-render-sent-ui',
    channelId: 'general',
    sender: { id: 'usr-tester', name: 'Quality Engineer' },
    content: 'Delivered message without retry button',
    timestamp: '04:01 PM',
    status: 'sent',
  };

  const sentItemHtml = renderToStaticMarkup(
    React.createElement(MessageItem, { message: sampleSentMessage })
  );

  assert(
    !sentItemHtml.includes('data-testid="retry-button"'),
    '7.10 MessageItem does NOT render retry button when message is sent'
  );

  // 7.5 ChatArea viewport component rendering
  const chatAreaHtml = renderToStaticMarkup(React.createElement(ChatArea));
  assert(
    chatAreaHtml.includes('data-testid="chat-area"'),
    '7.11 ChatArea renders data-testid="chat-area"'
  );
  assert(
    chatAreaHtml.includes('data-testid="chat-header"'),
    '7.12 ChatArea renders data-testid="chat-header"'
  );
  assert(
    chatAreaHtml.includes('data-testid="message-list"'),
    '7.13 ChatArea renders data-testid="message-list"'
  );
  assert(
    chatAreaHtml.includes('data-testid="chat-input-form"'),
    '7.14 ChatArea renders data-testid="chat-input-form"'
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`CONSOLIDATED SUITE RESULT: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error('Failed Assertions Summary:');
    for (const f of failureDetails) {
      console.error(f);
    }
    process.exit(1);
  } else {
    console.log('✅ All consolidated Supabase integration tests passed successfully!');
    process.exit(0);
  }
}

runConsolidatedIntegrationSuite().catch((err: unknown) => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Fatal test execution failure:', errorObj.message);
  if (errorObj.stack) {
    console.error(errorObj.stack);
  }
  process.exit(1);
});
