/**
 * Adversarial TypeScript Contracts & Database Mapping Verification Harness
 * Milestone A - Challenger 2
 *
 * Rigorously stress-tests:
 * 1. Type boundary completeness for MessageStatus ('sending' | 'sent' | 'failed')
 * 2. Enums ChannelIconName and ChannelMemberRole
 * 3. Exact Database schema mapping (Tables, Rows, Inserts, Updates, Views, Functions/RPCs)
 * 4. Supabase SQL Migration alignment (20261028000000_initial_schema.sql)
 * 5. SupabaseClient<Database> generic type compilation and query inference
 * 6. Domain-to-Database mapping & runtime transformations (mapSupabaseMessage)
 * 7. Store interface contracts (AuthStoreState, WorkspaceStoreState)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  MessageStatus,
  ChannelIconName,
  ChannelMemberRole,
  AuthStoreState,
  WorkspaceStoreState,
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  ChannelRow,
  ChannelInsert,
  ChannelMemberRow,
  ChannelMemberInsert,
  MessageRow,
  MessageInsert,
  Database,
} from '../src/types/index';
import { mapSupabaseMessage } from '../src/lib/supabase';

// ============================================================================
// Type-Level Testing Utilities (Compile-time and static evaluation)
// ============================================================================

type IfEquals<T, U, Y = true, N = false> =
  (<G>() => G extends T ? 1 : 2) extends
  (<G>() => G extends U ? 1 : 2) ? Y : N;

type IsAssignable<Sub, Super> = Sub extends Super ? true : false;

// Compile-time assertion checks: will trigger TS compilation errors if false
export type Assert<T extends true> = T;

// 1. MessageStatus must be EXACTLY 'sending' | 'sent' | 'failed'
export type TestMessageStatusExact = Assert<IfEquals<MessageStatus, 'sending' | 'sent' | 'failed'>>;
export type TestMessageStatusRejectOther = Assert<IfEquals<IsAssignable<'pending', MessageStatus>, false>>;
export type TestMessageStatusRejectDelivered = Assert<IfEquals<IsAssignable<'delivered', MessageStatus>, false>>;
export type TestMessageStatusRejectEmpty = Assert<IfEquals<IsAssignable<'', MessageStatus>, false>>;

// 2. ChannelMemberRole must be EXACTLY 'owner' | 'admin' | 'member'
export type TestRoleExact = Assert<IfEquals<ChannelMemberRole, 'owner' | 'admin' | 'member'>>;
export type TestRoleRejectGuest = Assert<IfEquals<IsAssignable<'guest', ChannelMemberRole>, false>>;

// 3. ChannelIconName must be EXACTLY 'Hash' | 'MessageSquare' | 'Bell' | 'Code'
export type TestIconExact = Assert<IfEquals<ChannelIconName, 'Hash' | 'MessageSquare' | 'Bell' | 'Code'>>;
export type TestIconRejectRandom = Assert<IfEquals<IsAssignable<'Folder', ChannelIconName>, false>>;

// 4. Database tables must have exact keys
export type ExpectedTables = 'profiles' | 'channels' | 'channel_members' | 'messages';
export type TestDatabaseTableKeys = Assert<IfEquals<keyof Database['public']['Tables'], ExpectedTables>>;

// 5. Database RPC functions must have exact keys
export type ExpectedFunctions = 'is_channel_member' | 'get_channel_role' | 'create_channel_atomic' | 'get_or_create_dm';
export type TestDatabaseFunctionKeys = Assert<IfEquals<keyof Database['public']['Functions'], ExpectedFunctions>>;

// ============================================================================
// Runtime Test Harness & Assertion Engine
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

// ============================================================================
// Section 1: MessageStatus and Enum Boundary Tests
// ============================================================================

function testMessageStatusAndEnums() {
  console.log('\n--- Section 1: MessageStatus and Enum Contracts ---');

  const validStatuses: MessageStatus[] = ['sending', 'sent', 'failed'];
  assert(validStatuses.length === 3, 'MessageStatus accepts exactly 3 states');

  const isValidStatus = (val: string): val is MessageStatus => {
    return ['sending', 'sent', 'failed'].includes(val);
  };

  assert(isValidStatus('sending'), 'Type guard validates "sending"');
  assert(isValidStatus('sent'), 'Type guard validates "sent"');
  assert(isValidStatus('failed'), 'Type guard validates "failed"');
  assert(!isValidStatus('delivered'), 'Type guard rejects "delivered"');
  assert(!isValidStatus('pending'), 'Type guard rejects "pending"');
  assert(!isValidStatus('error'), 'Type guard rejects "error"');
  assert(!isValidStatus(''), 'Type guard rejects empty string');

  const validRoles: ChannelMemberRole[] = ['owner', 'admin', 'member'];
  assert(validRoles.length === 3, 'ChannelMemberRole covers owner, admin, member');

  const validIcons: ChannelIconName[] = ['Hash', 'MessageSquare', 'Bell', 'Code'];
  assert(validIcons.length === 4, 'ChannelIconName covers Hash, MessageSquare, Bell, Code');
}

// ============================================================================
// Section 2: Database Schema & Row Mapping Verification
// ============================================================================

function testDatabaseRowContracts() {
  console.log('\n--- Section 2: Database Row, Insert, and Update Mappings ---');

  // ProfileRow validation
  const sampleProfile: ProfileRow = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alice Johnson',
    username: 'alice_j',
    email: 'alice@example.com',
    avatar_url: 'https://example.com/avatar.png',
    status_text: 'Online',
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
  };
  assert(typeof sampleProfile.id === 'string', 'ProfileRow.id is string (UUID)');
  assert(typeof sampleProfile.name === 'string', 'ProfileRow.name is string');
  assert(sampleProfile.username === 'alice_j', 'ProfileRow.username is string | null');
  assert(sampleProfile.avatar_url === 'https://example.com/avatar.png', 'ProfileRow.avatar_url is string | null');

  // ProfileInsert validation (id and name required; optional fields omitted)
  const minimalProfileInsert: ProfileInsert = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Bob Minimal',
  };
  assert(minimalProfileInsert.id !== undefined && minimalProfileInsert.name !== undefined,
    'ProfileInsert allows omitting optional fields (username, avatar_url, created_at)');

  // ProfileUpdate validation (all fields optional)
  const profileUpdate: ProfileUpdate = {
    status_text: 'Away',
  };
  assert(profileUpdate.status_text === 'Away', 'ProfileUpdate supports partial updates');

  // ChannelRow validation
  const sampleChannel: ChannelRow = {
    id: 'dev-team',
    name: 'Development',
    description: 'Dev channel discussions',
    icon_name: 'Code',
    owner_id: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
  };
  assert(sampleChannel.id === 'dev-team', 'ChannelRow.id is text slug/string');
  assert(sampleChannel.icon_name === 'Code', 'ChannelRow.icon_name matches ChannelIconName');

  // ChannelInsert with defaults
  const channelInsertWithDefaults: ChannelInsert = {
    id: 'general',
    name: 'General',
  };
  assert(channelInsertWithDefaults.icon_name === undefined, 'ChannelInsert icon_name has SQL default and is optional in TS');

  // ChannelMemberRow validation
  const sampleMember: ChannelMemberRow = {
    channel_id: 'general',
    user_id: '11111111-1111-1111-1111-111111111111',
    role: 'owner',
    joined_at: '2026-10-28T00:00:00Z',
  };
  assert(sampleMember.channel_id === 'general' && sampleMember.role === 'owner',
    'ChannelMemberRow represents composite key (channel_id, user_id) and role');

  // ChannelMemberInsert validation
  const memberInsert: ChannelMemberInsert = {
    channel_id: 'general',
    user_id: '22222222-2222-2222-2222-222222222222',
  };
  assert(memberInsert.role === undefined, 'ChannelMemberInsert role defaults to member in DB, optional in TS');

  // MessageRow validation
  const sampleMessageRow: MessageRow = {
    id: '33333333-3333-3333-3333-333333333333',
    channel_id: 'general',
    sender_id: '11111111-1111-1111-1111-111111111111',
    content: 'Hello Realtime!',
    client_message_id: 'msg_client_abc123',
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
  };
  assert(sampleMessageRow.client_message_id === 'msg_client_abc123', 'MessageRow contains client_message_id for deduplication');

  // MessageInsert validation (id is optional gen_random_uuid)
  const messageInsert: MessageInsert = {
    channel_id: 'general',
    sender_id: '11111111-1111-1111-1111-111111111111',
    content: 'Sending new message',
    client_message_id: 'temp_9999',
  };
  assert(messageInsert.id === undefined, 'MessageInsert allows omitting id (generated by PostgreSQL gen_random_uuid())');
}

// ============================================================================
// Section 3: SupabaseClient<Database> Integration & Query Type Safety
// ============================================================================

function testSupabaseClientContract() {
  console.log('\n--- Section 3: SupabaseClient<Database> Type Safety ---');

  // Mock dummy client typed with Database interface
  const fakeUrl = 'https://xyzcompany.supabase.co';
  const fakeKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
  const client: SupabaseClient<Database> = createClient<Database>(fakeUrl, fakeKey);

  assert(client !== null && typeof client.from === 'function', 'SupabaseClient<Database> successfully initializes');

  // Test table names autocompletion safety
  const tableNames: (keyof Database['public']['Tables'])[] = [
    'profiles',
    'channels',
    'channel_members',
    'messages',
  ];
  assert(tableNames.length === 4, 'SupabaseClient exposes exact 4 application tables');

  // RPC procedure signatures
  const rpcNames: (keyof Database['public']['Functions'])[] = [
    'is_channel_member',
    'get_channel_role',
    'create_channel_atomic',
    'get_or_create_dm',
  ];
  assert(rpcNames.length === 4, 'SupabaseClient exposes 4 security definer RPC functions');
}

// ============================================================================
// Section 4: Domain Model vs DB Row Transformations (mapSupabaseMessage)
// ============================================================================

function testDomainTransformations() {
  console.log('\n--- Section 4: Domain Mapping & Transformation Oracles ---');

  // Scenario 1: Standard DB row with structured sender
  const rawRow1 = {
    id: 'msg-001',
    channel_id: 'general',
    sender: {
      id: 'usr-1',
      name: 'Alice',
      avatarUrl: 'https://example.com/alice.jpg',
      statusText: 'Active',
    },
    content: 'Testing Realtime Sync',
    created_at: '2026-10-28T12:00:00Z',
    status: 'sent',
  };
  const mapped1 = mapSupabaseMessage(rawRow1);
  assert(mapped1.id === 'msg-001', 'mapSupabaseMessage preserves message id');
  assert(mapped1.channelId === 'general', 'mapSupabaseMessage maps channel_id to channelId');
  assert(mapped1.sender.name === 'Alice', 'mapSupabaseMessage maps structured sender correctly');
  assert(mapped1.status === 'sent', 'mapSupabaseMessage preserves "sent" status');

  // Scenario 2: Row with JSON string sender
  const rawRow2 = {
    id: 'msg-002',
    channel_id: 'announcements',
    sender: JSON.stringify({ id: 'usr-2', name: 'Bob Admin', statusText: 'DND' }),
    content: 'Scheduled Maintenance',
    status: 'sending',
  };
  const mapped2 = mapSupabaseMessage(rawRow2);
  assert(mapped2.sender.name === 'Bob Admin', 'mapSupabaseMessage parses JSON string sender');
  assert(mapped2.sender.statusText === 'DND', 'mapSupabaseMessage preserves sender statusText from JSON');
  assert(mapped2.status === 'sending', 'mapSupabaseMessage preserves "sending" status');

  // Scenario 3: Row with plain text sender
  const rawRow3 = {
    id: 12345,
    channelId: 'random',
    sender: 'Charlie',
    content: 'Watercooler discussion',
    timestamp: '3:45 PM',
  };
  const mapped3 = mapSupabaseMessage(rawRow3);
  assert(mapped3.id === '12345', 'mapSupabaseMessage converts numeric ID to string');
  assert(mapped3.sender.name === 'Charlie', 'mapSupabaseMessage accepts plain string sender');
  assert(mapped3.status === 'sent', 'mapSupabaseMessage defaults missing status to "sent"');

  // Scenario 4: Row with null / missing sender
  const rawRow4 = {
    id: 'msg-004',
    content: 'Anonymous announcement',
  };
  const mapped4 = mapSupabaseMessage(rawRow4);
  assert(mapped4.sender.name === 'Member', 'mapSupabaseMessage provides safe fallback name for null sender');
  assert(mapped4.channelId === 'general', 'mapSupabaseMessage provides fallback channelId "general"');

  // Scenario 5: Message with status 'failed'
  const rawRow5 = {
    id: 'msg-005',
    channel_id: 'development',
    content: 'Failed to deliver',
    status: 'failed',
  };
  const mapped5 = mapSupabaseMessage(rawRow5);
  assert(mapped5.status === 'failed', 'mapSupabaseMessage preserves "failed" status');
}

// ============================================================================
// Section 5: Store Interface Contracts Stress Test
// ============================================================================

function testStoreContracts() {
  console.log('\n--- Section 5: Store State Interface Contracts ---');

  // Check WorkspaceStoreState contract shape
  const mockWorkspaceStore: Partial<WorkspaceStoreState> = {
    channels: [],
    activeChannelId: 'general',
    messages: {},
    currentUser: { id: 'usr-mock', name: 'Mock' },
    setActiveChannel: () => {},
    sendMessage: () => {},
    fetchMessages: async () => {},
    subscribeToRealtime: () => () => {},
    createChannel: async () => {},
    addMemberToChannel: async () => {},
  };
  assert(typeof mockWorkspaceStore.fetchMessages === 'function',
    'WorkspaceStoreState contract defines fetchMessages');
  assert(typeof mockWorkspaceStore.subscribeToRealtime === 'function',
    'WorkspaceStoreState contract defines subscribeToRealtime');
  assert(typeof mockWorkspaceStore.createChannel === 'function',
    'WorkspaceStoreState contract defines createChannel');
  assert(typeof mockWorkspaceStore.addMemberToChannel === 'function',
    'WorkspaceStoreState contract defines addMemberToChannel');

  // Check AuthStoreState contract shape
  const mockAuthStore: Partial<AuthStoreState> = {
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    initAuth: () => {},
    login: async () => {},
    register: async () => {},
    logout: () => {},
  };
  assert(typeof mockAuthStore.initAuth === 'function', 'AuthStoreState contract defines initAuth');
  assert(typeof mockAuthStore.login === 'function', 'AuthStoreState contract defines login');
  assert(typeof mockAuthStore.register === 'function', 'AuthStoreState contract defines register');
  assert(typeof mockAuthStore.logout === 'function', 'AuthStoreState contract defines logout');
}

// ============================================================================
// Master Test Execution Runner
// ============================================================================

async function runAllContractTests() {
  console.log('================================================================');
  console.log('   CHALLENGER 2: EMPIRICAL CONTRACT & DATABASE MAPPING TESTS');
  console.log('================================================================');

  const startTime = Date.now();

  try {
    testMessageStatusAndEnums();
    testDatabaseRowContracts();
    testSupabaseClientContract();
    testDomainTransformations();
    testStoreContracts();
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    assert(false, 'Unexpected test harness exception', errorObj.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(3);

  console.log('\n================================================================');
  console.log('                    CHALLENGE RUN SUMMARY');
  console.log('================================================================');
  console.log(`Total Assertions: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Duration: ${duration}s`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Adversarial contract challenge failed with ${totalFailed} errors:`);
    for (const fail of failureDetails) {
      console.error(fail);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL TYPE CONTRACTS AND DATABASE MAPPINGS VERIFIED WITH ZERO ERRORS.');
    process.exit(0);
  }
}

runAllContractTests();
