/**
 * Adversarial Verification & Stress Test Suite: Milestone 2 (Workspace Layout & Sidebar)
 * Archetype: Empirical Challenger
 *
 * This test suite directly executes React component rendering, DOM output inspection,
 * state interactions, and adversarial edge cases for:
 * - Workspace Layout (page.tsx)
 * - Sidebar and subcomponents (SidebarHeader, ChannelList, ChannelItem, UserFooter)
 * - useWorkspaceStore synchronization and click handling
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';
import { Sidebar } from '../src/components/Sidebar/Sidebar';
import { SidebarHeader } from '../src/components/Sidebar/SidebarHeader';
import { ChannelList } from '../src/components/Sidebar/ChannelList';
import { ChannelItem } from '../src/components/Sidebar/ChannelItem';
import { UserFooter } from '../src/components/Sidebar/UserFooter';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { useAuthStore } from '../src/store/useAuthStore';
import type { Channel } from '../src/types';

// ============================================================================
// Setup Mock React Dispatcher and Sync Live Store State for SSR
// ============================================================================
// Ensure SSR renderToStaticMarkup uses live store snapshot instead of stale initial state
(React as any).useSyncExternalStore = (_sub: any, getSnapshot: any) => getSnapshot();

const hookDispatcherProxy = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === 'useCallback') return (fn: any) => fn;
    if (prop === 'useSyncExternalStore') return (_sub: any, snap: any) => snap();
    if (prop === 'useState') return (init: any) => [typeof init === 'function' ? init() : init, () => {}];
    if (prop === 'useId') return () => ':r-challenger:';
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

function resetTestStore(): void {
  useAuthStore.setState({
    isInitialized: true,
    user: { id: 'usr-1', email: '', name: 'Alex Johnson' },
  });
  useWorkspaceStore.setState({
    channels: [
      { id: 'general', name: 'general', description: 'General workspace chat', iconName: 'Hash' },
      { id: 'random', name: 'random', description: 'Random watercooler conversations', iconName: 'MessageSquare' },
      { id: 'announcements', name: 'announcements', description: 'Important workspace announcements', iconName: 'Bell' },
      { id: 'development', name: 'development', description: 'Engineering and developer talk', iconName: 'Code' },
    ],
    activeChannelId: 'general',
    messages: {
      general: [],
      random: [],
      announcements: [],
      development: [],
    },
    currentUser: {
      id: 'usr-1',
      name: 'Alex Johnson',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      statusText: 'Focusing on Next.js',
    },
  });
}

// ============================================================================
// Test Suites
// ============================================================================

async function runAllSuites() {
  console.log('\n================================================================');
  console.log('   CHALLENGER ADVERSARIAL SUITE: MILESTONE 2 VERIFICATION');
  console.log('================================================================\n');

  installHookDispatcher();

  // --------------------------------------------------------------------------
  // SUITE 1: DOM Structure & Required data-testid Attributes
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: DOM Structure & data-testid Attributes ---');
  resetTestStore();

  const homeHtml = renderToStaticMarkup(React.createElement(Home));
  const sidebarHtml = renderToStaticMarkup(React.createElement(Sidebar));
  const headerHtml = renderToStaticMarkup(React.createElement(SidebarHeader));
  const listHtml = renderToStaticMarkup(React.createElement(ChannelList));
  const footerHtml = renderToStaticMarkup(React.createElement(UserFooter));

  // 1.1 Root Layout
  assert(
    homeHtml.includes('data-testid="workspace-layout"'),
    '1.1 Root layout contains data-testid="workspace-layout"',
  );
  assert(
    homeHtml.includes('h-screen') && homeHtml.includes('overflow-hidden') && homeHtml.includes('flex'),
    '1.2 Root layout has viewport filling classes: h-screen, overflow-hidden, flex',
  );

  // 1.2 Sidebar
  assert(
    sidebarHtml.includes('data-testid="sidebar"'),
    '1.3 Sidebar contains data-testid="sidebar"',
  );
  assert(
    sidebarHtml.includes('w-64') && sidebarHtml.includes('flex-shrink-0') && sidebarHtml.includes('h-full'),
    '1.4 Sidebar has fixed width and non-shrink container: w-64, flex-shrink-0, h-full',
  );
  assert(
    sidebarHtml.includes('<aside') && sidebarHtml.includes('aria-label="Workspace Sidebar"'),
    '1.5 Sidebar renders semantic <aside> with aria-label="Workspace Sidebar"',
  );

  // 1.3 Sidebar Header
  assert(
    headerHtml.includes('data-testid="workspace-header"') && headerHtml.includes('data-testid="sidebar-header"'),
    '1.6 SidebarHeader includes workspace-header and sidebar-header testids',
  );
  assert(
    headerHtml.includes('Dev Workspace'),
    '1.7 SidebarHeader renders default workspace name',
  );

  // 1.4 Channel List
  assert(
    listHtml.includes('data-testid="channel-list"'),
    '1.8 ChannelList contains data-testid="channel-list"',
  );
  assert(
    listHtml.includes('overflow-y-auto') && listHtml.includes('flex-1'),
    '1.9 ChannelList is scrollable and flex-1',
  );
  assert(
    listHtml.includes('<nav') && listHtml.includes('aria-label="Channels"'),
    '1.10 ChannelList renders semantic <nav> with aria-label="Channels"',
  );

  // 1.5 Channel Item testids
  assert(
    listHtml.includes('data-testid="channel-item active-channel"'),
    '1.11 Active channel item includes data-testid="channel-item active-channel"',
  );
  assert(
    listHtml.includes('data-testid="channel-item"') && !listHtml.includes('data-testid="channel-item" data-active="true"'),
    '1.12 Inactive channel items include data-testid="channel-item" without active-channel class',
  );
  assert(
    listHtml.includes('data-testid="active-channel"'),
    '1.13 ChannelList contains dedicated data-testid="active-channel" badge',
  );

  // 1.6 User Footer
  assert(
    footerHtml.includes('data-testid="user-footer"') && footerHtml.includes('data-testid="sidebar-footer"'),
    '1.14 UserFooter contains user-footer and sidebar-footer testids',
  );
  assert(
    footerHtml.includes('Alex Johnson') && footerHtml.includes('Focusing on Next.js'),
    '1.15 UserFooter renders current user name and status text',
  );

  // 1.7 Chat Area placeholder in Home
  assert(
    homeHtml.includes('data-testid="chat-area"'),
    '1.16 Home page layout includes data-testid="chat-area"',
  );
  assert(
    homeHtml.includes('data-testid="chat-header"') && homeHtml.includes('data-testid="chat-channel-name"'),
    '1.17 Home page layout includes chat-header and chat-channel-name',
  );
  assert(
    homeHtml.includes('general'),
    '1.18 Chat header dynamically reflects active channel name (general)',
  );

  // --------------------------------------------------------------------------
  // SUITE 2: Designated Icons Verification (Hash, MessageSquare, Bell, Code)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Designated Channel Icons Verification ---');
  resetTestStore();

  const channels = useWorkspaceStore.getState().channels;

  for (const channel of channels) {
    const itemHtml = renderToStaticMarkup(
      React.createElement(ChannelItem, { channel, isActive: false }),
    );

    let expectedClass = '';
    let expectedSvgFeature = '';

    switch (channel.iconName) {
      case 'Hash':
        expectedClass = 'lucide-hash';
        expectedSvgFeature = 'x1="4"';
        break;
      case 'MessageSquare':
        expectedClass = 'lucide-message-square';
        expectedSvgFeature = 'M22 17';
        break;
      case 'Bell':
        expectedClass = 'lucide-bell';
        expectedSvgFeature = 'M10.268 21';
        break;
      case 'Code':
        expectedClass = 'lucide-code';
        expectedSvgFeature = 'm16 18';
        break;
    }

    assert(
      itemHtml.includes(expectedClass),
      `2.1 Channel #${channel.name} (${channel.iconName}) renders icon with class "${expectedClass}"`,
    );
    assert(
      itemHtml.includes(expectedSvgFeature),
      `2.2 Channel #${channel.name} (${channel.iconName}) renders expected SVG path definition`,
    );
    assert(
      itemHtml.includes(`class="lucide ${expectedClass} w-4 h-4 shrink-0 transition-colors`),
      `2.3 Channel #${channel.name} icon includes sizing (w-4 h-4 shrink-0)`,
    );
  }

  // 2.4 Verify all 4 icon names in full ChannelList render
  const fullListHtml = renderToStaticMarkup(React.createElement(ChannelList));
  assert(
    fullListHtml.includes('lucide-hash') &&
    fullListHtml.includes('lucide-message-square') &&
    fullListHtml.includes('lucide-bell') &&
    fullListHtml.includes('lucide-code'),
    '2.4 All 4 designated icons (Hash, MessageSquare, Bell, Code) are present concurrently in ChannelList',
  );

  // 2.5 Adversarial Icon Fallback: Unmapped or invalid iconName defaults to Hash
  const customBadChannel: Channel = {
    id: 'corrupt-icon-chan',
    name: 'corrupted',
    description: 'Channel with unknown icon',
    iconName: 'NonExistentIcon' as any,
  };
  const fallbackHtml = renderToStaticMarkup(
    React.createElement(ChannelItem, { channel: customBadChannel, isActive: false }),
  );
  assert(
    fallbackHtml.includes('lucide-hash'),
    '2.5 Channel with unmapped/unknown iconName safely falls back to Hash icon',
  );

  // --------------------------------------------------------------------------
  // SUITE 3: Active Channel Visual Highlighting & Class Toggling
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Active Channel Visual Highlighting & Class Toggling ---');
  resetTestStore();

  const activeGeneralHtml = renderToStaticMarkup(
    React.createElement(ChannelItem, { channel: channels[0], isActive: true }),
  );
  const inactiveGeneralHtml = renderToStaticMarkup(
    React.createElement(ChannelItem, { channel: channels[0], isActive: false }),
  );

  // 3.1 Active state styles
  assert(
    activeGeneralHtml.includes('bg-zinc-800') &&
    activeGeneralHtml.includes('text-white') &&
    activeGeneralHtml.includes('font-medium'),
    '3.1 Active channel includes bg-zinc-800 text-white font-medium',
  );
  assert(
    activeGeneralHtml.includes('data-active="true"'),
    '3.2 Active channel has data-active="true"',
  );
  assert(
    activeGeneralHtml.includes('aria-current="page"'),
    '3.3 Active channel has aria-current="page"',
  );
  assert(
    activeGeneralHtml.includes('data-testid="active-channel"'),
    '3.4 Active channel contains child with data-testid="active-channel"',
  );

  // 3.2 Inactive state styles
  assert(
    inactiveGeneralHtml.includes('text-zinc-400') &&
    inactiveGeneralHtml.includes('font-normal') &&
    inactiveGeneralHtml.includes('hover:bg-zinc-900/60'),
    '3.5 Inactive channel includes text-zinc-400 font-normal hover:bg-zinc-900/60',
  );
  assert(
    !inactiveGeneralHtml.includes('bg-zinc-800') && !inactiveGeneralHtml.includes('text-white'),
    '3.6 Inactive channel DOES NOT contain active highlight classes (bg-zinc-800, text-white)',
  );
  assert(
    inactiveGeneralHtml.includes('data-active="false"'),
    '3.7 Inactive channel has data-active="false"',
  );
  assert(
    !inactiveGeneralHtml.includes('aria-current="page"'),
    '3.8 Inactive channel DOES NOT have aria-current="page"',
  );
  assert(
    !inactiveGeneralHtml.includes('data-testid="active-channel"'),
    '3.9 Inactive channel DOES NOT contain data-testid="active-channel"',
  );

  // 3.3 Dynamic toggling across all channels
  for (const channel of channels) {
    useWorkspaceStore.getState().setActiveChannel(channel.id);
    const renderedList = renderToStaticMarkup(React.createElement(ChannelList));

    // Count occurrences of data-active="true"
    const trueMatches = (renderedList.match(/data-active="true"/g) || []).length;
    const falseMatches = (renderedList.match(/data-active="false"/g) || []).length;
    const activeTestidMatches = (renderedList.match(/data-testid="active-channel"/g) || []).length;

    assert(
      trueMatches === 1 && falseMatches === channels.length - 1,
      `3.10 Exactly 1 channel has data-active="true" and ${channels.length - 1} have data-active="false" when #${channel.name} is active`,
    );
    assert(
      activeTestidMatches === 1,
      `3.11 Exactly 1 active-channel testid badge rendered when #${channel.name} is active`,
    );
    assert(
      renderedList.includes(`data-channel-id="${channel.id}" data-active="true"`),
      `3.12 Channel #${channel.name} (id: ${channel.id}) is explicitly marked data-active="true"`,
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 4: State Interaction & Direct Click Simulation
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: State Interaction & Click Simulation ---');
  resetTestStore();

  // 4.1 Direct click on ChannelItem component element
  for (const channel of channels) {
    // Render ChannelItem component directly to extract click handler
    const el = (ChannelItem as any)({ channel, isActive: false });
    assert(
      typeof el.props.onClick === 'function',
      `4.1 ChannelItem #${channel.name} returns button element with functional onClick prop`,
    );

    // Invoke the click handler
    el.props.onClick();

    assert(
      useWorkspaceStore.getState().activeChannelId === channel.id,
      `4.2 Invoking onClick for #${channel.name} mutates store.activeChannelId to "${channel.id}"`,
    );

    // Verify Home page re-renders with the newly activated channel
    const currentHome = renderToStaticMarkup(React.createElement(Home));
    assert(
      currentHome.includes(`Welcome to #${channel.name}!`) &&
      currentHome.includes(`data-channel-id="${channel.id}" data-active="true"`),
      `4.3 Root page dynamically displays Welcome to #${channel.name}! after click`,
    );
  }

  // 4.4 Stress Test: 100 rapid sequential channel clicks
  console.log('    Running stress test: 100 rapid sequential channel switches...');
  const order = ['announcements', 'development', 'general', 'random'];
  for (let i = 0; i < 100; i++) {
    const targetId = order[i % order.length];
    const targetChannel = channels.find((c) => c.id === targetId)!;
    const el = (ChannelItem as any)({ channel: targetChannel, isActive: false });
    el.props.onClick();
  }
  const expectedLastId = order[99 % order.length];
  assert(
    useWorkspaceStore.getState().activeChannelId === expectedLastId,
    `4.4 Store correctly stabilizes at "${expectedLastId}" after 100 rapid clicks`,
  );

  // 4.5 Idempotency: Repeated clicks on the already active channel
  const activeId = useWorkspaceStore.getState().activeChannelId;
  const activeChan = channels.find((c) => c.id === activeId)!;
  for (let i = 0; i < 10; i++) {
    const el = (ChannelItem as any)({ channel: activeChan, isActive: true });
    el.props.onClick();
  }
  assert(
    useWorkspaceStore.getState().activeChannelId === activeId,
    '4.5 Repeated clicks on active channel are completely idempotent',
  );

  // 4.6 State mutation isolation: clicking channels preserves messages & currentUser
  const storeBefore = useWorkspaceStore.getState();
  const el = (ChannelItem as any)({ channel: channels[1], isActive: false });
  el.props.onClick();
  const storeAfter = useWorkspaceStore.getState();

  assert(
    storeBefore.currentUser === storeAfter.currentUser,
    '4.6 Channel switching does NOT mutate or re-instantiate currentUser object',
  );
  assert(
    storeBefore.channels === storeAfter.channels,
    '4.7 Channel switching does NOT mutate or re-instantiate channels array',
  );

  // --------------------------------------------------------------------------
  // SUITE 5: Adversarial Edge Cases & Boundary Conditions
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Adversarial Edge Cases & Boundaries ---');
  resetTestStore();

  // 5.1 Extreme channel name length (120 chars) - Truncation check
  const longChannel: Channel = {
    id: 'chan-extreme-length',
    name: 'a'.repeat(120),
    description: 'Channel with super long name',
    iconName: 'Hash',
  };
  const longHtml = renderToStaticMarkup(
    React.createElement(ChannelItem, { channel: longChannel, isActive: false }),
  );
  assert(
    longHtml.includes('class="truncate"') && longHtml.includes(longChannel.name),
    '5.1 Extreme channel name (120 chars) has CSS truncate class to prevent layout distortion',
  );

  // 5.2 Special characters and HTML-like strings in channel name
  const xssChannel: Channel = {
    id: 'chan-xss',
    name: '<script>alert(1)</script>&"\'',
    description: 'XSS test channel',
    iconName: 'Code',
  };
  const xssHtml = renderToStaticMarkup(
    React.createElement(ChannelItem, { channel: xssChannel, isActive: false }),
  );
  assert(
    !xssHtml.includes('<script>') && xssHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#x27;'),
    '5.2 Malicious / special characters in channel name are properly escaped by React',
  );

  // 5.3 Missing user avatar - Initials fallback
  useWorkspaceStore.setState({
    currentUser: {
      id: 'usr-no-avatar',
      name: 'Maria Garcia',
      avatarUrl: undefined,
      statusText: 'No photo',
    },
  });
  const fallbackFooterHtml = renderToStaticMarkup(React.createElement(UserFooter));
  assert(
    fallbackFooterHtml.includes('MG'),
    '5.3 User without avatarUrl displays initials fallback "MG"',
  );
  assert(
    !fallbackFooterHtml.includes('<img'),
    '5.4 User without avatarUrl does not render broken <img> element',
  );

  // 5.4 Empty user name fallback
  useWorkspaceStore.setState({
    currentUser: {
      id: 'usr-empty-name',
      name: '',
      avatarUrl: undefined,
      statusText: undefined,
    },
  });
  const anonymousFooterHtml = renderToStaticMarkup(React.createElement(UserFooter));
  assert(
    anonymousFooterHtml.includes('Anonymous') && anonymousFooterHtml.includes('Online'),
    '5.5 Empty user name and status defaults cleanly to "Anonymous" and "Online"',
  );

  // 5.5 High channel volume (50 channels in ChannelList)
  const manyChannels: Channel[] = Array.from({ length: 50 }, (_, i) => ({
    id: `chan-${i}`,
    name: `channel-${i}`,
    description: `Channel number ${i}`,
    iconName: (['Hash', 'MessageSquare', 'Bell', 'Code'] as const)[i % 4],
  }));
  useWorkspaceStore.setState({
    channels: manyChannels,
    activeChannelId: 'chan-25',
  });
  const manyChannelsHtml = renderToStaticMarkup(React.createElement(ChannelList));
  const channelCount = (manyChannelsHtml.match(/data-channel-id="chan-/g) || []).length;
  assert(
    channelCount === 50,
    `5.6 ChannelList cleanly renders high volume of 50 channels (counted: ${channelCount})`,
  );
  assert(
    manyChannelsHtml.includes('data-channel-id="chan-25" data-active="true"'),
    '5.7 ChannelList maintains active highlight on chan-25 in high-volume list',
  );

  // 5.6 Channel with empty description in Home page
  const chanNoDesc: Channel = {
    id: 'chan-no-desc',
    name: 'nodesc',
    description: '',
    iconName: 'Hash',
  };
  useWorkspaceStore.setState({
    channels: [chanNoDesc],
    activeChannelId: 'chan-no-desc',
  });
  const homeNoDescHtml = renderToStaticMarkup(React.createElement(Home));
  assert(
    homeNoDescHtml.includes('Welcome to #nodesc!'),
    '5.8 Home page gracefully handles channel with empty description without crashing',
  );

  // --------------------------------------------------------------------------
  // Summary & Exit
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                    CHALLENGER TEST SUMMARY');
  console.log('================================================================');
  console.log(`Total Assertions: ${totalPassed + totalFailed}`);
  console.log(`Passed:           ${totalPassed}`);
  console.log(`Failed:           ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Adversarial suite failed with ${totalFailed} failure(s):`);
    for (const f of failureDetails) {
      console.error(f);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY (100% PASS RATE).');
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal unhandled error in adversarial suite:', err);
  process.exit(1);
});
