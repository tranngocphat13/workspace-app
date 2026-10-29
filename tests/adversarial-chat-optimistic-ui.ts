/**
 * Adversarial Verification & Stress Test Suite: Milestone 3 (Chat Area & Optimistic UI)
 * Archetype: Empirical Challenger
 *
 * This test suite directly executes:
 * 1. DOM structure & data-testid verification across all Chat components:
 *    chat-area, chat-header, chat-channel-name, message-list, message-item,
 *    status-sending, status-sent, message-input, send-button, chat-input-form,
 *    message-timestamp, message-content, empty-channel-message
 * 2. Visual distinction between 'sending' and 'sent' states (opacity-70 vs opacity-100, Clock vs Check icons)
 * 3. Immediate appearance of message on submit with status: 'sending' and data-testid="status-sending"
 * 4. Input field clears immediately upon submit (both form submission and Enter key press)
 * 5. 1000ms simulated network delay and transition to 'sent' with data-testid="status-sent"
 * 6. Strict duplicate prevention in store and rendered DOM
 * 7. Adversarial stress tests: rapid bursts, in-flight channel switching, empty/whitespace edge cases, XSS escaping, avatar fallbacks
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';
import { ChatArea } from '../src/components/Chat/ChatArea';
import { ChatHeader } from '../src/components/Chat/ChatHeader';
import { MessageList } from '../src/components/Chat/MessageList';
import { MessageItem } from '../src/components/Chat/MessageItem';
import { MessageInput } from '../src/components/Chat/MessageInput';
import { StatusIndicator } from '../src/components/Chat/StatusIndicator';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { useAuthStore } from '../src/store/useAuthStore';
import type { Message } from '../src/types';

// ============================================================================
// Setup Mock React Dispatcher and Sync Live Store State for SSR
// ============================================================================
(React as any).useSyncExternalStore = (_sub: any, getSnapshot: any) => getSnapshot();

let customInputVal: string | null = null;
let lastInputStateSet: string | null = null;

const hookDispatcherProxy = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === 'useCallback') return (fn: any) => fn;
    if (prop === 'useSyncExternalStore') return (_sub: any, snap: any) => snap();
    if (prop === 'useState') {
      return (init: any) => {
        const isStringState = typeof init === 'string';
        const val = isStringState && customInputVal !== null ? customInputVal : (typeof init === 'function' ? init() : init);
        return [
          val,
          (newVal: any) => {
            const resolved = typeof newVal === 'function' ? newVal(val) : newVal;
            if (isStringState) {
              lastInputStateSet = resolved;
              customInputVal = resolved;
            }
          },
        ];
      };
    }
    if (prop === 'useId') return () => ':r-challenger-m3:';
    if (prop === 'useMemo') return (fn: any) => fn();
    if (prop === 'useRef') return (init: any) => ({ current: init });
    if (prop === 'useEffect' || prop === 'useLayoutEffect') return () => {};
    if (prop === 'useDebugValue') return () => {};
    return () => {};
  },
});

function installHookDispatcher() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (internals) {
    internals.H = hookDispatcherProxy;
  }
}

// ============================================================================
// Test Framework & Assertion State
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

function findElementByTestId(element: any, testId: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.['data-testid'] === testId) return element;
  const children = Array.isArray(element.props?.children)
    ? element.props.children
    : [element.props?.children];
  for (const child of children) {
    const found = findElementByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

function resetTestStore(): void {
  customInputVal = null;
  lastInputStateSet = null;
  useAuthStore.setState({
    isInitialized: true,
    user: { id: 'usr-challenger-m3', email: 'challenger@test.com', name: 'Adversarial Challenger' },
  });
  useWorkspaceStore.setState({
    channels: [
      { id: 'general', name: 'general', description: 'Company-wide announcements and team discussions', iconName: 'Hash' },
      { id: 'random', name: 'random', description: 'Water cooler chat, off-topic discussions, and fun', iconName: 'MessageSquare' },
      { id: 'announcements', name: 'announcements', description: 'Official workspace updates, policy changes, and events', iconName: 'Bell' },
      { id: 'development', name: 'development', description: 'Engineering discussions, commits, pull requests, and deploys', iconName: 'Code' },
    ],
    activeChannelId: 'general',
    messages: {
      general: [],
      random: [],
      announcements: [],
      development: [],
    },
    currentUser: {
      id: 'usr-challenger-m3',
      name: 'Adversarial Challenger',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      statusText: 'Testing M3 Optimistic UI',
    },
  });
}

// ============================================================================
// Test Execution Runner
// ============================================================================

async function runMilestone3Verification() {
  console.log('\n================================================================');
  console.log('   CHALLENGER ADVERSARIAL SUITE: MILESTONE 3 (CHAT & OPTIMISTIC UI)');
  console.log('================================================================\n');

  installHookDispatcher();

  // --------------------------------------------------------------------------
  // SUITE 1: DOM Structure & All Required data-testid Attributes
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: DOM Structure & Required data-testid Attributes ---');
  resetTestStore();

  const chatAreaHtml = renderToStaticMarkup(React.createElement(ChatArea));
  const chatHeaderHtml = renderToStaticMarkup(React.createElement(ChatHeader));
  const messageInputHtml = renderToStaticMarkup(React.createElement(MessageInput));
  const emptyListHtml = renderToStaticMarkup(React.createElement(MessageList));

  // 1.1 ChatArea Container
  assert(
    chatAreaHtml.includes('data-testid="chat-area"'),
    '1.1 ChatArea root contains data-testid="chat-area"'
  );
  assert(
    chatAreaHtml.includes('<main') && chatAreaHtml.includes('aria-label="Chat Area"'),
    '1.2 ChatArea renders semantic <main> landmark with aria-label="Chat Area"'
  );
  assert(
    chatAreaHtml.includes('flex-1') && chatAreaHtml.includes('flex-col') && chatAreaHtml.includes('min-w-0'),
    '1.3 ChatArea possesses responsive flex layout classes (flex-1 flex flex-col min-w-0 h-full)'
  );

  // 1.2 ChatHeader
  assert(
    chatHeaderHtml.includes('data-testid="chat-header"'),
    '1.4 ChatHeader contains data-testid="chat-header"'
  );
  assert(
    chatHeaderHtml.includes('data-testid="chat-channel-name"'),
    '1.5 ChatHeader contains channel title with data-testid="chat-channel-name"'
  );
  assert(
    chatHeaderHtml.includes('general'),
    '1.6 ChatHeader correctly renders active channel name "general"'
  );

  // 1.3 MessageInput & Form
  assert(
    messageInputHtml.includes('data-testid="chat-input-form"'),
    '1.7 MessageInput renders form container with data-testid="chat-input-form"'
  );
  assert(
    messageInputHtml.includes('data-testid="message-input"'),
    '1.8 MessageInput renders input element with data-testid="message-input"'
  );
  assert(
    messageInputHtml.includes('data-testid="send-button"'),
    '1.9 MessageInput renders submit button with data-testid="send-button"'
  );
  assert(
    messageInputHtml.includes('placeholder="Message #general..."'),
    '1.10 MessageInput dynamic placeholder reflects active channel "#general"'
  );

  // 1.4 MessageList (Empty State)
  assert(
    emptyListHtml.includes('data-testid="message-list"'),
    '1.11 MessageList container has data-testid="message-list"'
  );
  assert(
    emptyListHtml.includes('data-testid="empty-channel-message"'),
    '1.12 MessageList renders empty state container with data-testid="empty-channel-message" when 0 messages'
  );

  // 1.5 MessageItem & Status Indicators
  const sampleSendingMsg: Message = {
    id: 'msg-test-sending',
    channelId: 'general',
    sender: { id: 'usr-1', name: 'Test User' },
    content: 'Testing sending message item',
    timestamp: '12:00 PM',
    status: 'sending',
  };
  const sendingItemHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: sampleSendingMsg }));

  assert(
    sendingItemHtml.includes('data-testid="message-item"'),
    '1.13 MessageItem has data-testid="message-item"'
  );
  assert(
    sendingItemHtml.includes('data-message-id="msg-test-sending"'),
    '1.14 MessageItem exposes data-message-id attribute matching message ID'
  );
  assert(
    sendingItemHtml.includes('data-status="sending"'),
    '1.15 MessageItem exposes data-status="sending" attribute'
  );
  assert(
    sendingItemHtml.includes('data-testid="status-sending"'),
    '1.16 MessageItem embeds StatusIndicator with data-testid="status-sending"'
  );
  assert(
    sendingItemHtml.includes('data-testid="message-timestamp"'),
    '1.17 MessageItem contains timestamp with data-testid="message-timestamp"'
  );
  assert(
    sendingItemHtml.includes('data-testid="message-content"'),
    '1.18 MessageItem contains message body with data-testid="message-content"'
  );

  // 1.6 Sent Message Item
  const sampleSentMsg: Message = {
    id: 'msg-test-sent',
    channelId: 'general',
    sender: { id: 'usr-1', name: 'Test User' },
    content: 'Testing sent message item',
    timestamp: '12:01 PM',
    status: 'sent',
  };
  const sentItemHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: sampleSentMsg }));

  assert(
    sentItemHtml.includes('data-testid="status-sent"'),
    '1.19 MessageItem for sent message embeds data-testid="status-sent"'
  );
  assert(
    !sentItemHtml.includes('data-testid="status-sending"'),
    '1.20 MessageItem for sent message does NOT contain data-testid="status-sending"'
  );

  // 1.7 Overall Top-Level Page Layout
  const homeHtml = renderToStaticMarkup(React.createElement(Home));
  assert(
    homeHtml.includes('data-testid="workspace-layout"') &&
    homeHtml.includes('data-testid="sidebar"') &&
    homeHtml.includes('data-testid="chat-area"'),
    '1.21 Home page integrates both Sidebar and ChatArea within workspace-layout'
  );

  // --------------------------------------------------------------------------
  // SUITE 2: Visual Distinction (Opacity & Icons)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Visual Distinction (Opacity & Icons) ---');

  // 2.1 StatusIndicator Isolated Render
  const indicatorSendingHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sending' }));
  const indicatorSentHtml = renderToStaticMarkup(React.createElement(StatusIndicator, { status: 'sent' }));

  assert(
    indicatorSendingHtml.includes('data-testid="status-sending"') &&
    indicatorSendingHtml.includes('animate-pulse'),
    '2.1 StatusIndicator (sending) renders Clock icon with animate-pulse class'
  );
  assert(
    indicatorSendingHtml.includes('Sending...'),
    '2.2 StatusIndicator (sending) includes accessible "Sending..." label'
  );
  assert(
    indicatorSentHtml.includes('data-testid="status-sent"') &&
    indicatorSentHtml.includes('text-blue-400'),
    '2.3 StatusIndicator (sent) renders Check icon with text-blue-400 styling'
  );
  assert(
    indicatorSentHtml.includes('Sent'),
    '2.4 StatusIndicator (sent) includes accessible "Sent" label'
  );

  // 2.2 MessageItem Opacity Distinction
  assert(
    sendingItemHtml.includes('opacity-70') && sendingItemHtml.includes('text-zinc-300'),
    '2.5 MessageItem in "sending" state has opacity-70 and text-zinc-300'
  );
  assert(
    sentItemHtml.includes('opacity-100') && sentItemHtml.includes('text-zinc-100'),
    '2.6 MessageItem in "sent" state has opacity-100 and text-zinc-100'
  );
  assert(
    !sendingItemHtml.includes('opacity-100'),
    '2.7 MessageItem in "sending" state does NOT have opacity-100'
  );

  // --------------------------------------------------------------------------
  // SUITE 3: Interactive Submit & Immediate Input Field Clear
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Interactive Submit & Immediate Input Field Clear ---');
  resetTestStore();

  // 3.1 Form Submission clears input immediately
  customInputVal = 'Hello from simulated user input';
  const renderedInputForm = (MessageInput as any)({});
  assert(
    renderedInputForm.type === 'form' && renderedInputForm.props['data-testid'] === 'chat-input-form',
    '3.1 MessageInput component returns form element'
  );

  let defaultPrevented = false;
  renderedInputForm.props.onSubmit({
    preventDefault: () => {
      defaultPrevented = true;
    },
  });

  assert(defaultPrevented, '3.2 Form onSubmit calls e.preventDefault() to prevent page reload');
  assert(
    lastInputStateSet === '',
    '3.3 Input state clears immediately to empty string ("") synchronously upon submit'
  );

  const msgsAfterFormSubmit = useWorkspaceStore.getState().messages['general'];
  assert(
    msgsAfterFormSubmit.length === 1 && msgsAfterFormSubmit[0].content === 'Hello from simulated user input',
    '3.4 Submitted text was forwarded to workspace store'
  );
  assert(
    msgsAfterFormSubmit[0].status === 'sending',
    '3.5 Message appeared instantly with status: "sending"'
  );

  // 3.2 Enter Key Submission clears input immediately
  customInputVal = 'Second message via Enter key';
  const renderedInputFormEnter = (MessageInput as any)({});
  const inputChild = findElementByTestId(renderedInputFormEnter, 'message-input');

  let enterPrevented = false;
  inputChild.props.onKeyDown({
    key: 'Enter',
    shiftKey: false,
    preventDefault: () => {
      enterPrevented = true;
    },
  });

  assert(enterPrevented, '3.6 Enter key handler calls e.preventDefault()');
  assert(
    lastInputStateSet === '',
    '3.7 Input state clears immediately to empty string ("") on Enter key press'
  );
  assert(
    useWorkspaceStore.getState().messages['general'].length === 2,
    '3.8 Store received message submitted via Enter key'
  );

  // 3.3 Shift+Enter does NOT submit message and does NOT clear input
  customInputVal = 'Multiline text';
  lastInputStateSet = null;
  const renderedInputShift = (MessageInput as any)({});
  const inputChildShift = findElementByTestId(renderedInputShift, 'message-input');

  let shiftEnterPrevented = false;
  inputChildShift.props.onKeyDown({
    key: 'Enter',
    shiftKey: true,
    preventDefault: () => {
      shiftEnterPrevented = true;
    },
  });

  assert(!shiftEnterPrevented, '3.9 Shift+Enter does not prevent default');
  assert(lastInputStateSet === null, '3.10 Shift+Enter does not trigger submit or clear input');
  assert(
    useWorkspaceStore.getState().messages['general'].length === 2,
    '3.11 Store message count unchanged on Shift+Enter'
  );

  // --------------------------------------------------------------------------
  // SUITE 4: Optimistic UI Interaction & Simulated Network Delay (1000ms)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Optimistic UI Interaction & 1000ms Simulated Delay ---');
  resetTestStore();

  const store = useWorkspaceStore.getState();

  // 4.1 Instant Appearance with status: 'sending'
  const messageText = 'Empirical challenger optimistic test payload';
  store.sendMessage('general', messageText);

  const initialMsgs = useWorkspaceStore.getState().messages['general'];
  assert(initialMsgs.length === 1, '4.1 sendMessage immediately appends message to active channel in store');

  const pendingMsg = initialMsgs[0];
  assert(pendingMsg.content === messageText, '4.2 Appended message retains exact content');
  assert(pendingMsg.status === 'sending', '4.3 Appended message has status: "sending" synchronously');
  assert(typeof pendingMsg.id === 'string' && pendingMsg.id.length > 0, '4.4 Appended message assigned valid unique ID');

  // 4.2 Instant DOM appearance in ChatArea
  const liveChatAreaSending = renderToStaticMarkup(React.createElement(ChatArea));
  assert(
    liveChatAreaSending.includes('data-testid="status-sending"'),
    '4.5 ChatArea instantly re-renders with data-testid="status-sending"'
  );
  assert(
    liveChatAreaSending.includes('opacity-70'),
    '4.6 ChatArea instantly renders optimistic message with opacity-70'
  );
  assert(
    liveChatAreaSending.includes(messageText),
    '4.7 ChatArea contains newly added message content instantly'
  );
  assert(
    !liveChatAreaSending.includes('data-testid="empty-channel-message"'),
    '4.8 Empty channel placeholder disappears as soon as optimistic message is added'
  );

  // 4.3 Mid-flight check at 500ms
  console.log('    Sleeping 500ms to test mid-flight persistence...');
  await sleep(500);

  const midFlightMsgs = useWorkspaceStore.getState().messages['general'];
  assert(
    midFlightMsgs[0].status === 'sending',
    '4.9 Message status remains "sending" at 500ms (halfway through delay)'
  );

  // 4.4 Near-threshold check at 800ms
  console.log('    Sleeping 300ms (total 800ms) to test pre-1000ms threshold...');
  await sleep(300);

  const preThresholdMsgs = useWorkspaceStore.getState().messages['general'];
  assert(
    preThresholdMsgs[0].status === 'sending',
    '4.10 Message status remains "sending" at 800ms before 1000ms threshold'
  );

  // 4.5 Resolution after 1000ms delay (wait remaining 350ms to reach ~1150ms)
  console.log('    Sleeping additional 350ms (total ~1150ms) to test simulated network completion...');
  await sleep(350);

  const resolvedMsgs = useWorkspaceStore.getState().messages['general'];
  assert(
    resolvedMsgs[0].status === 'sent',
    '4.11 Message status transitions to "sent" after 1000ms delay'
  );

  // 4.6 Re-rendered DOM verification for confirmed sent state
  const liveChatAreaSent = renderToStaticMarkup(React.createElement(ChatArea));
  assert(
    liveChatAreaSent.includes('data-testid="status-sent"'),
    '4.12 ChatArea DOM transitions to data-testid="status-sent"'
  );
  assert(
    !liveChatAreaSent.includes('data-testid="status-sending"'),
    '4.13 ChatArea DOM no longer contains data-testid="status-sending"'
  );
  assert(
    liveChatAreaSent.includes('opacity-100'),
    '4.14 ChatArea DOM message now has full opacity (opacity-100)'
  );

  // --------------------------------------------------------------------------
  // SUITE 5: Duplicate Prevention & List Ordering
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Duplicate Prevention & List Ordering ---');
  resetTestStore();

  // Send 3 distinct messages
  useWorkspaceStore.getState().sendMessage('general', 'Message 1');
  useWorkspaceStore.getState().sendMessage('general', 'Message 2');
  useWorkspaceStore.getState().sendMessage('general', 'Message 3');

  const beforeTransition = useWorkspaceStore.getState().messages['general'];
  assert(beforeTransition.length === 3, '5.1 Three messages queued');
  const idsBefore = beforeTransition.map((m) => m.id);

  console.log('    Waiting 1200ms for all 3 messages to resolve...');
  await sleep(1200);

  const afterTransition = useWorkspaceStore.getState().messages['general'];
  assert(afterTransition.length === 3, '5.2 Exactly 3 messages exist after resolution (NO duplicate entries in store)');

  const idsAfter = afterTransition.map((m) => m.id);
  assert(
    JSON.stringify(idsBefore) === JSON.stringify(idsAfter),
    '5.3 Exact ordering and message IDs preserved throughout status mutation'
  );

  const allSent = afterTransition.every((m) => m.status === 'sent');
  assert(allSent, '5.4 All messages successfully resolved to "sent"');

  // Verify DOM rendered count
  const multiMessageDom = renderToStaticMarkup(React.createElement(ChatArea));
  const messageItemMatches = multiMessageDom.match(/data-testid="message-item"/g) || [];
  assert(
    messageItemMatches.length === 3,
    '5.5 Exactly 3 data-testid="message-item" nodes rendered in DOM (no duplicate DOM elements)'
  );
  const statusSentMatches = multiMessageDom.match(/data-testid="status-sent"/g) || [];
  assert(
    statusSentMatches.length === 3,
    '5.6 Exactly 3 data-testid="status-sent" nodes rendered in DOM'
  );
  const statusSendingMatches = multiMessageDom.match(/data-testid="status-sending"/g) || [];
  assert(
    statusSendingMatches.length === 0,
    '5.7 Exactly 0 data-testid="status-sending" nodes remain in DOM'
  );

  // --------------------------------------------------------------------------
  // SUITE 6: Adversarial Stress Tests & Edge Cases
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Adversarial Stress Tests & Edge Cases ---');

  // 6.1 Empty and Whitespace-only submission validation
  resetTestStore();
  const emptyInitialCount = useWorkspaceStore.getState().messages['general'].length;

  useWorkspaceStore.getState().sendMessage('general', '');
  useWorkspaceStore.getState().sendMessage('general', '   ');
  useWorkspaceStore.getState().sendMessage('general', '\t\n   \r\n');
  assert(
    useWorkspaceStore.getState().messages['general'].length === emptyInitialCount,
    '6.1 Empty and whitespace-only submissions are completely rejected by store'
  );

  // 6.2 Disabled Send Button when input empty
  const defaultInputHtml = renderToStaticMarkup(React.createElement(MessageInput));
  assert(
    defaultInputHtml.includes('disabled=""') || defaultInputHtml.includes('disabled'),
    '6.2 Send button is disabled in DOM when input is empty'
  );
  assert(
    defaultInputHtml.includes('cursor-not-allowed') && defaultInputHtml.includes('opacity-50'),
    '6.3 Send button has disabled styling (cursor-not-allowed opacity-50)'
  );

  // 6.3 In-Flight Channel Switch Isolation
  resetTestStore();
  useWorkspaceStore.getState().sendMessage('general', 'Message in general channel');
  const generalMsgId = useWorkspaceStore.getState().messages['general'][0].id;

  // Immediately switch channel while general is still sending
  useWorkspaceStore.getState().setActiveChannel('random');
  assert(useWorkspaceStore.getState().activeChannelId === 'random', '6.4 Switched activeChannelId to "random"');

  const randomChatArea = renderToStaticMarkup(React.createElement(ChatArea));
  assert(
    randomChatArea.includes('random'),
    '6.5 ChatArea header reflects "random" channel name'
  );
  assert(
    !randomChatArea.includes('Message in general channel'),
    '6.6 In-flight message for general does NOT leak into random channel view'
  );
  assert(
    randomChatArea.includes('data-testid="empty-channel-message"'),
    '6.7 Random channel correctly displays empty-channel-message'
  );

  // Wait for general channel background timer to resolve
  console.log('    Waiting 1200ms while user is in "random" channel...');
  await sleep(1200);

  const generalMsgResolved = useWorkspaceStore.getState().messages['general'].find((m) => m.id === generalMsgId);
  assert(
    generalMsgResolved?.status === 'sent',
    '6.8 General channel message seamlessly resolved to "sent" in background'
  );

  // Switch back to general
  useWorkspaceStore.getState().setActiveChannel('general');
  const backToGeneralChatArea = renderToStaticMarkup(React.createElement(ChatArea));
  assert(
    backToGeneralChatArea.includes('Message in general channel'),
    '6.9 Switching back to general displays resolved message'
  );
  assert(
    backToGeneralChatArea.includes('data-testid="status-sent"'),
    '6.10 Switched-back channel shows data-testid="status-sent"'
  );

  // 6.4 Rapid Burst Concurrency (5 rapid messages)
  resetTestStore();
  const burstCount = 5;
  for (let i = 0; i < burstCount; i++) {
    useWorkspaceStore.getState().sendMessage('general', `Burst message #${i + 1}`);
  }

  const burstMsgs = useWorkspaceStore.getState().messages['general'];
  assert(burstMsgs.length === burstCount, '6.11 All 5 burst messages appended immediately');
  assert(
    burstMsgs.every((m) => m.status === 'sending'),
    '6.12 All 5 burst messages synchronously in "sending" status'
  );

  console.log('    Waiting 1200ms for 5 burst messages to resolve concurrently...');
  await sleep(1200);

  const burstResolved = useWorkspaceStore.getState().messages['general'];
  assert(burstResolved.length === burstCount, '6.13 Burst resolution preserves exact count (5 items)');
  assert(
    burstResolved.every((m) => m.status === 'sent'),
    '6.14 All 5 burst messages successfully transitioned to "sent"'
  );
  for (let i = 0; i < burstCount; i++) {
    assert(
      burstResolved[i].content === `Burst message #${i + 1}`,
      `6.15 Burst message #${i + 1} preserved in exact order`
    );
  }

  // 6.5 Avatar fallback resilience
  const msgWithoutAvatar: Message = {
    id: 'msg-no-avatar',
    channelId: 'general',
    sender: { id: 'usr-no-av', name: 'John Doe', avatarUrl: undefined },
    content: 'Testing missing avatar fallback',
    timestamp: '01:00 PM',
    status: 'sent',
  };
  const noAvatarHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: msgWithoutAvatar }));
  assert(
    noAvatarHtml.includes('JD'),
    '6.16 MessageItem generates initials "JD" fallback badge when avatarUrl is missing'
  );

  const msgSingleName: Message = {
    id: 'msg-single-name',
    channelId: 'general',
    sender: { id: 'usr-single', name: 'Cher' },
    content: 'Testing single name initials',
    timestamp: '01:05 PM',
    status: 'sent',
  };
  const singleNameHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: msgSingleName }));
  assert(
    singleNameHtml.includes('C'),
    '6.17 MessageItem generates single initial "C" when user has single name'
  );

  // 6.6 Special characters, Markdown, and HTML escaping resilience
  const xssContent = '<script>alert("xss")</script> & <b>bold</b> 🔥 🚀';
  const xssMsg: Message = {
    id: 'msg-xss',
    channelId: 'general',
    sender: { id: 'usr-xss', name: 'Hacker <script>' },
    content: xssContent,
    timestamp: '01:10 PM',
    status: 'sent',
  };
  const xssHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: xssMsg }));
  assert(
    xssHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'),
    '6.18 XSS injection attempt properly escaped in message body'
  );
  assert(
    xssHtml.includes('🔥 🚀'),
    '6.19 Emoji characters rendered cleanly without corruption'
  );

  // 6.7 Long unbroken string word-wrap verification
  const longWord = 'A'.repeat(200);
  const longMsg: Message = {
    id: 'msg-long',
    channelId: 'general',
    sender: { id: 'usr-long', name: 'Long Poster' },
    content: longWord,
    timestamp: '01:15 PM',
    status: 'sent',
  };
  const longHtml = renderToStaticMarkup(React.createElement(MessageItem, { message: longMsg }));
  assert(
    longHtml.includes('break-words') && longHtml.includes('whitespace-pre-wrap'),
    '6.20 MessageItem contains break-words whitespace-pre-wrap classes to handle long unbroken strings'
  );

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n================================================================');
  console.log('             ADVERSARIAL VERIFICATION SUITE RESULTS');
  console.log('================================================================');
  console.log(`Total Assertions Checked : ${totalPassed + totalFailed}`);
  console.log(`Assertions Passed        : ${totalPassed}`);
  console.log(`Assertions Failed        : ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error('❌ Failures encountered:');
    failureDetails.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('✅ ALL ADVERSARIAL CHECKS PASSED EMPIRICALLY WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runMilestone3Verification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
