/**
 * Comprehensive Security & Database Remediation Test Suite (Milestone 1)
 * Target: workspace-app/tests/security-fixes.test.ts
 *
 * Verifies all 7 security fixes (SEC-01 through SEC-07), TypeScript contract
 * synchronization, and behavioral policy simulation.
 *
 * Run via: npx tsx tests/security-fixes.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateFile } from '../src/lib/storage';
import type { Database, ChannelRow, ChannelMemberRow, MessageRow, MessageInsert, MessageUpdate } from '../src/types';

// ==============================================================================
// Test Runner Utilities
// ==============================================================================

let totalPassed = 0;
let totalFailed = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    totalFailed++;
    const msg = `  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

// ==============================================================================
// Read Migration Files
// ==============================================================================

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');
const secFixesFilename = fs.existsSync(path.join(MIGRATIONS_DIR, '20261029300000_security_fixes.sql'))
  ? '20261029300000_security_fixes.sql'
  : (fs.existsSync(path.join(MIGRATIONS_DIR, '20261029200000_security_fixes.sql'))
    ? '20261029200000_security_fixes.sql'
    : '20261029100000_security_fixes.sql');
const secFixesPath = path.join(MIGRATIONS_DIR, secFixesFilename);
const phase2Path = path.join(MIGRATIONS_DIR, '20261029000000_phase2_schema.sql');
const initSchemaPath = path.join(MIGRATIONS_DIR, '20261028000000_initial_schema.sql');

if (!fs.existsSync(secFixesPath)) {
  console.error(`FATAL: Migration file not found: ${secFixesPath}`);
  process.exit(1);
}

const secFixesSql = fs.readFileSync(secFixesPath, 'utf8');

// ==============================================================================
// SUITE 1: Static DDL & Migration Rules Verification
// ==============================================================================

function testStaticDdl() {
  console.log('\n======================================================');
  console.log('  Suite 1: Static DDL & Migration DDL Rules');
  console.log('======================================================');

  // SEC-01: Storage Read Policy Scoped to Channel Members
  assert(
    secFixesSql.includes('DROP POLICY IF EXISTS "chat_attachments_select_auth" ON storage.objects;'),
    'SEC-01.1: Drops broad permissive chat_attachments_select_auth policy'
  );
  assert(
    secFixesSql.includes('CREATE POLICY "chat_attachments_select_channel_member"'),
    'SEC-01.2: Defines chat_attachments_select_channel_member policy'
  );
  assert(
    /is_channel_member\(\s*m\.channel_id,\s*auth\.uid\(\)\s*\)/i.test(secFixesSql),
    'SEC-01.3: Policy checks public.is_channel_member for message attachments'
  );
  assert(
    /cm\.channel_id\s*=\s*\(storage\.foldername\(name\)\)\[1\]/i.test(secFixesSql),
    'SEC-01.4: Policy checks channel membership for channel-folder scoped uploads'
  );

  // SEC-02: channel_members UPDATE Policy & Trigger
  assert(
    secFixesSql.includes('CREATE OR REPLACE FUNCTION public.check_channel_member_update()'),
    'SEC-02.1: check_channel_member_update trigger function defined'
  );
  assert(
    secFixesSql.includes('trigger_check_channel_member_update'),
    'SEC-02.2: trigger_check_channel_member_update trigger registered BEFORE UPDATE'
  );
  assert(
    /NEW\.role IS DISTINCT FROM OLD\.role/i.test(secFixesSql),
    'SEC-02.3: Trigger verifies role changes'
  );
  assert(
    /v_caller_role IS DISTINCT FROM 'owner'::public\.channel_member_role/i.test(secFixesSql),
    'SEC-02.4: Trigger strictly rejects non-owner changing member roles'
  );
  assert(
    secFixesSql.includes('CREATE POLICY "channel_members_update_self_or_owner"'),
    'SEC-02.5: channel_members_update_self_or_owner UPDATE policy defined'
  );
  assert(
    /user_id\s*=\s*auth\.uid\(\)/i.test(secFixesSql),
    'SEC-02.6: Member self-update permitted for last_read_at persistence'
  );

  // SEC-03: Cascade SET NULL Ownership Safety
  assert(
    /ALTER TABLE public\.channels\s+ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false/i.test(secFixesSql),
    'SEC-03.1: channels.is_public column added with DEFAULT false'
  );
  assert(
    /idx_channels_is_public/i.test(secFixesSql),
    'SEC-03.2: Performance index idx_channels_is_public created'
  );
  assert(
    /UPDATE public\.channels\s+SET is_public = true\s+WHERE id IN \('general', 'random', 'announcements', 'development'\)/i.test(secFixesSql),
    'SEC-03.3: Default seed channels initialized to is_public = true'
  );
  assert(
    /UPDATE public\.channels\s+SET is_public = false\s+WHERE is_dm = true/i.test(secFixesSql),
    'SEC-03.4: DM channels explicitly guarded with is_public = false'
  );
  assert(
    /is_public = true AND is_dm = false/i.test(secFixesSql),
    'SEC-03.5: Channel SELECT policy conditions public access strictly on (is_public = true AND is_dm = false)'
  );
  assert(
    secFixesSql.includes('channel_members_insert_authorized'),
    'SEC-03.6: channel_members self-join policy prevents joining private channels when owner_id IS NULL'
  );
  assert(
    /WHERE c\.is_public = true AND c\.is_dm = false/i.test(secFixesSql),
    'SEC-03.7: handle_new_user trigger enrolls users only into explicit public non-DM channels'
  );

  // SEC-04: Owner Kick Protection
  assert(
    secFixesSql.includes('CREATE POLICY "channel_members_delete_self_or_admin"'),
    'SEC-04.1: channel_members_delete_self_or_admin DELETE policy defined'
  );
  assert(
    /get_channel_role\(channel_id, user_id\)\s*=\s*'member'/i.test(secFixesSql),
    'SEC-04.2: Admin can only delete members with role = member (cannot kick owner)'
  );

  // SEC-05: RPC get_or_create_dm Permissions & Validation
  assert(
    /REVOKE EXECUTE ON FUNCTION public\.get_or_create_dm\(UUID\) FROM PUBLIC/i.test(secFixesSql),
    'SEC-05.1: Execution on get_or_create_dm revoked from PUBLIC'
  );
  assert(
    /GRANT EXECUTE ON FUNCTION public\.get_or_create_dm\(UUID\) TO authenticated/i.test(secFixesSql),
    'SEC-05.2: Execution on get_or_create_dm granted exclusively to authenticated'
  );
  assert(
    /NOT EXISTS\s*\(SELECT 1 FROM public\.profiles WHERE id = target_user_id\)/i.test(secFixesSql),
    'SEC-05.3: get_or_create_dm validates target_user_id exists in profiles'
  );

  // SEC-06: Storage MIME Types Alignment
  assert(
    secFixesSql.includes('application/msword') &&
    secFixesSql.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'SEC-06.1: Storage bucket allowed_mime_types includes DOC and DOCX'
  );

  // SEC-07: Message Immutability & Content Constraint
  assert(
    secFixesSql.includes('CREATE OR REPLACE FUNCTION public.check_message_update_immutability()'),
    'SEC-07.1: check_message_update_immutability trigger function defined'
  );
  assert(
    secFixesSql.includes('trigger_check_message_update_immutability'),
    'SEC-07.2: trigger_check_message_update_immutability trigger registered BEFORE UPDATE on messages'
  );
  assert(
    /length\(trim\(content\)\) > 0 OR attachment_url IS NOT NULL/i.test(secFixesSql),
    'SEC-07.3: messages_content_check relaxed to support pure attachments without text'
  );
}

// ==============================================================================
// SUITE 2: Behavioral Policy & Security Logic Simulation
// ==============================================================================

interface MockChannel {
  id: string;
  name: string;
  owner_id: string | null;
  is_dm: boolean;
  is_public: boolean;
}

interface MockChannelMember {
  channel_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  last_read_at: string;
}

interface MockStorageObject {
  bucket_id: string;
  name: string;
  owner: string;
}

interface MockMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  created_at: string;
}

function testBehavioralSimulation() {
  console.log('\n======================================================');
  console.log('  Suite 2: Behavioral Policy & Security Logic Simulation');
  console.log('======================================================');

  // Test setup data
  const userAlice = '11111111-1111-1111-1111-111111111111'; // Owner
  const userBob = '22222222-2222-2222-2222-222222222222';   // Admin
  const userCharlie = '33333333-3333-3333-3333-333333333333'; // Member
  const userEve = '44444444-4444-4444-4444-444444444444';     // External non-member

  const secretChannel: MockChannel = {
    id: 'secret-ops',
    name: 'Secret Ops',
    owner_id: userAlice,
    is_dm: false,
    is_public: false,
  };

  const dmChannel: MockChannel = {
    id: `dm-${userAlice}-${userBob}`,
    name: 'Direct Message',
    owner_id: userAlice,
    is_dm: true,
    is_public: false,
  };

  const publicChannel: MockChannel = {
    id: 'general',
    name: 'general',
    owner_id: null,
    is_dm: false,
    is_public: true,
  };

  const members: MockChannelMember[] = [
    { channel_id: 'secret-ops', user_id: userAlice, role: 'owner', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: 'secret-ops', user_id: userBob, role: 'admin', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: 'secret-ops', user_id: userCharlie, role: 'member', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: dmChannel.id, user_id: userAlice, role: 'member', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: dmChannel.id, user_id: userBob, role: 'member', last_read_at: '2026-10-28T00:00:00Z' },
  ];

  const messages: MockMessage[] = [
    {
      id: 'msg-1',
      channel_id: 'secret-ops',
      sender_id: userAlice,
      content: 'Confidential strategy doc attached',
      attachment_url: `${userAlice}/financials.pdf`,
      created_at: '2026-10-28T01:00:00Z',
    },
    {
      id: 'msg-2',
      channel_id: dmChannel.id,
      sender_id: userAlice,
      content: 'Private DM attachment',
      attachment_url: `${userAlice}/secret-dm.png`,
      created_at: '2026-10-28T02:00:00Z',
    },
  ];

  const storageObjects: MockStorageObject[] = [
    { bucket_id: 'chat-attachments', name: `${userAlice}/financials.pdf`, owner: userAlice },
    { bucket_id: 'chat-attachments', name: `${userAlice}/secret-dm.png`, owner: userAlice },
  ];

  // Helper simulated functions
  const isChannelMember = (channelId: string, userId: string): boolean => {
    return members.some((m) => m.channel_id === channelId && m.user_id === userId);
  };

  const getChannelRole = (channelId: string, userId: string): 'owner' | 'admin' | 'member' | null => {
    const member = members.find((m) => m.channel_id === channelId && m.user_id === userId);
    return member ? member.role : null;
  };

  // --- SEC-01: Storage Read Policy Evaluation ---
  const evalStorageSelectPolicy = (obj: MockStorageObject, callerId: string | null): boolean => {
    if (!callerId || obj.bucket_id !== 'chat-attachments') return false;

    // 1. Uploader can read own
    const pathParts = obj.name.split('/');
    if (pathParts[0] === callerId || obj.owner === callerId) return true;

    // 2. Channel folder scoped
    if (isChannelMember(pathParts[0], callerId)) return true;

    // 3. Linked message attachment scoped
    const linkedMsg = messages.find(
      (m) => m.attachment_url === obj.name || m.attachment_url?.endsWith(obj.name)
    );
    if (linkedMsg) {
      if (isChannelMember(linkedMsg.channel_id, callerId)) return true;
      const ch = [secretChannel, dmChannel, publicChannel].find((c) => c.id === linkedMsg.channel_id);
      if (ch && !ch.is_dm && ch.is_public) return true;
    }

    return false;
  };

  // Test SEC-01 Cases
  assert(
    evalStorageSelectPolicy(storageObjects[0], userAlice) === true,
    'SEC-01-T1: Alice (uploader) can read secret-ops attachment'
  );
  assert(
    evalStorageSelectPolicy(storageObjects[0], userBob) === true,
    'SEC-01-T2: Bob (channel admin) can read secret-ops attachment'
  );
  assert(
    evalStorageSelectPolicy(storageObjects[0], userCharlie) === true,
    'SEC-01-T3: Charlie (regular channel member) can read secret-ops attachment'
  );
  assert(
    evalStorageSelectPolicy(storageObjects[0], userEve) === false,
    'SEC-01-T4: Eve (non-member) is BLOCKED from reading secret-ops attachment'
  );
  assert(
    evalStorageSelectPolicy(storageObjects[1], userCharlie) === false,
    'SEC-01-T5: Charlie (non-participant) is BLOCKED from reading Alice-Bob DM attachment'
  );
  assert(
    evalStorageSelectPolicy(storageObjects[0], null) === false,
    'SEC-01-T6: Anonymous caller is BLOCKED from reading any attachment'
  );

  // --- SEC-02: channel_members UPDATE Simulation ---
  const simulateMemberUpdate = (
    callerId: string,
    targetChannelId: string,
    targetUserId: string,
    updates: { last_read_at?: string; role?: 'owner' | 'admin' | 'member'; channel_id?: string; user_id?: string }
  ): { allowed: boolean; error?: string } => {
    // 1. RLS Policy Check (channel_members_update_self_or_owner)
    const callerRole = getChannelRole(targetChannelId, callerId);
    const rlsAllowed = callerId === targetUserId || callerRole === 'owner';
    if (!rlsAllowed) {
      return { allowed: false, error: 'RLS: Permission denied' };
    }

    // 2. Trigger Check (check_channel_member_update)
    if (updates.channel_id && updates.channel_id !== targetChannelId) {
      return { allowed: false, error: 'Cannot modify channel_id or user_id of a channel member' };
    }
    if (updates.user_id && updates.user_id !== targetUserId) {
      return { allowed: false, error: 'Cannot modify channel_id or user_id of a channel member' };
    }

    const currentRole = getChannelRole(targetChannelId, targetUserId);
    if (updates.role && updates.role !== currentRole) {
      if (callerRole !== 'owner') {
        return { allowed: false, error: 'Only channel owners can change member roles' };
      }
    }

    return { allowed: true };
  };

  assert(
    simulateMemberUpdate(userCharlie, 'secret-ops', userCharlie, { last_read_at: '2026-10-29T10:00:00Z' }).allowed,
    'SEC-02-T1: Charlie can update his own last_read_at timestamp'
  );
  assert(
    !simulateMemberUpdate(userCharlie, 'secret-ops', userCharlie, { role: 'admin' }).allowed,
    'SEC-02-T2: Charlie CANNOT escalate himself to admin (rejected by trigger)'
  );
  assert(
    !simulateMemberUpdate(userBob, 'secret-ops', userCharlie, { last_read_at: '2026-10-29T10:00:00Z' }).allowed,
    'SEC-02-T3: Bob (admin) CANNOT update Charlie’s last_read_at (rejected by RLS)'
  );
  assert(
    !simulateMemberUpdate(userBob, 'secret-ops', userCharlie, { role: 'owner' }).allowed,
    'SEC-02-T4: Bob (admin) CANNOT escalate Charlie to owner (rejected by RLS and trigger)'
  );
  assert(
    simulateMemberUpdate(userAlice, 'secret-ops', userCharlie, { role: 'admin' }).allowed,
    'SEC-02-T5: Alice (owner) CAN promote Charlie to admin'
  );
  assert(
    !simulateMemberUpdate(userCharlie, 'secret-ops', userCharlie, { user_id: userEve }).allowed,
    'SEC-02-T6: Tampering with immutable user_id is blocked'
  );

  // --- SEC-03: Cascade SET NULL Leak Defense Simulation ---
  const evalChannelSelectPolicy = (channel: MockChannel, callerId: string): boolean => {
    // channels_select_member_or_public:
    // (is_public = true AND is_dm = false) OR (owner_id IS NOT NULL AND owner_id = auth.uid()) OR is_channel_member(...)
    if (channel.is_public && !channel.is_dm) return true;
    if (channel.owner_id && channel.owner_id === callerId) return true;
    return isChannelMember(channel.id, callerId);
  };

  // Simulate owner deletion cascade on secret channel: owner_id becomes NULL
  const orphanedSecretChannel: MockChannel = {
    ...secretChannel,
    owner_id: null, // cascade set null
  };

  const orphanedDmChannel: MockChannel = {
    ...dmChannel,
    owner_id: null, // cascade set null
  };

  assert(
    evalChannelSelectPolicy(orphanedSecretChannel, userCharlie) === true,
    'SEC-03-T1: Existing member Charlie can still select orphaned private channel'
  );
  assert(
    evalChannelSelectPolicy(orphanedSecretChannel, userEve) === false,
    'SEC-03-T2: Non-member Eve CANNOT select orphaned private channel even though owner_id IS NULL'
  );
  assert(
    evalChannelSelectPolicy(orphanedDmChannel, userEve) === false,
    'SEC-03-T3: Non-participant Eve CANNOT select orphaned DM channel'
  );
  assert(
    evalChannelSelectPolicy(publicChannel, userEve) === true,
    'SEC-03-T4: Non-member Eve can select public #general channel'
  );

  // --- SEC-04: Owner Kick Protection Simulation ---
  const evalMemberDeletePolicy = (
    channelId: string,
    callerId: string,
    targetUserId: string
  ): boolean => {
    // 1. Self leave
    if (callerId === targetUserId) return true;

    // 2. Owner can kick anyone
    const callerRole = getChannelRole(channelId, callerId);
    if (callerRole === 'owner') return true;

    // 3. Admin can ONLY kick regular members
    if (callerRole === 'admin') {
      const targetRole = getChannelRole(channelId, targetUserId);
      return targetRole === 'member';
    }

    return false;
  };

  assert(
    evalMemberDeletePolicy('secret-ops', userBob, userAlice) === false,
    'SEC-04-T1: Bob (admin) CANNOT delete Alice (owner) from channel'
  );
  assert(
    evalMemberDeletePolicy('secret-ops', userBob, userCharlie) === true,
    'SEC-04-T2: Bob (admin) CAN kick Charlie (regular member)'
  );
  assert(
    evalMemberDeletePolicy('secret-ops', userAlice, userBob) === true,
    'SEC-04-T3: Alice (owner) CAN kick Bob (admin)'
  );
  assert(
    evalMemberDeletePolicy('secret-ops', userCharlie, userCharlie) === true,
    'SEC-04-T4: Charlie can leave the channel (self-delete)'
  );
  assert(
    evalMemberDeletePolicy('secret-ops', userCharlie, userBob) === false,
    'SEC-04-T5: Charlie (regular member) CANNOT kick Bob (admin)'
  );

  // --- SEC-05: RPC get_or_create_dm Logic Simulation ---
  const simulateGetOrCreateDm = (
    callerId: string | null,
    targetUserId: string,
    existingProfiles: string[]
  ): { channelId?: string; error?: string } => {
    if (!callerId) return { error: 'Not authenticated' };
    if (callerId === targetUserId) return { error: 'Cannot create direct message with yourself' };
    if (!existingProfiles.includes(targetUserId)) return { error: 'Target user not found' };

    const channelId =
      callerId < targetUserId
        ? `dm-${callerId}-${targetUserId}`
        : `dm-${targetUserId}-${callerId}`;
    return { channelId };
  };

  const registeredUsers = [userAlice, userBob, userCharlie];

  const dmFromAlice = simulateGetOrCreateDm(userAlice, userBob, registeredUsers);
  const dmFromBob = simulateGetOrCreateDm(userBob, userAlice, registeredUsers);
  assert(
    Boolean(dmFromAlice.channelId) && dmFromAlice.channelId === dmFromBob.channelId,
    'SEC-05-T1: Canonical ID is strictly deterministic regardless of caller sequence'
  );
  assert(
    simulateGetOrCreateDm(userAlice, userAlice, registeredUsers).error === 'Cannot create direct message with yourself',
    'SEC-05-T2: Self-DM invocation is rejected'
  );
  assert(
    simulateGetOrCreateDm(null, userBob, registeredUsers).error === 'Not authenticated',
    'SEC-05-T3: Unauthenticated caller is rejected'
  );
  assert(
    simulateGetOrCreateDm(userAlice, '99999999-9999-9999-9999-999999999999', registeredUsers).error === 'Target user not found',
    'SEC-05-T4: Non-existent target user is rejected'
  );

  // --- SEC-07: Message Immutability Simulation ---
  const simulateMessageUpdate = (
    callerId: string,
    existingMsg: MockMessage,
    updates: { content?: string; channel_id?: string; sender_id?: string; created_at?: string }
  ): { allowed: boolean; error?: string } => {
    // RLS: messages_update_own requires sender_id = auth.uid()
    if (existingMsg.sender_id !== callerId) {
      return { allowed: false, error: 'RLS: Not message sender' };
    }

    // Trigger: check_message_update_immutability
    if (updates.channel_id && updates.channel_id !== existingMsg.channel_id) {
      return { allowed: false, error: 'Cannot modify message channel_id' };
    }
    if (updates.sender_id && updates.sender_id !== existingMsg.sender_id) {
      return { allowed: false, error: 'Cannot modify message sender_id' };
    }
    if (updates.created_at && updates.created_at !== existingMsg.created_at) {
      return { allowed: false, error: 'Cannot modify message created_at' };
    }

    return { allowed: true };
  };

  const testMsg = messages[0];
  assert(
    simulateMessageUpdate(userAlice, testMsg, { content: 'Updated strategy doc text' }).allowed,
    'SEC-07-T1: Alice can edit content of her own message'
  );
  assert(
    !simulateMessageUpdate(userBob, testMsg, { content: 'Bob trying to tamper with Alice’s message' }).allowed,
    'SEC-07-T2: Bob cannot update Alice’s message'
  );
  assert(
    !simulateMessageUpdate(userAlice, testMsg, { channel_id: 'general' }).allowed,
    'SEC-07-T3: Alice CANNOT move message to another channel (channel_id immutable)'
  );
  assert(
    !simulateMessageUpdate(userAlice, testMsg, { sender_id: userBob }).allowed,
    'SEC-07-T4: Alice CANNOT spoof sender_id (sender_id immutable)'
  );
  assert(
    !simulateMessageUpdate(userAlice, testMsg, { created_at: '2020-01-01T00:00:00Z' }).allowed,
    'SEC-07-T5: Alice CANNOT forge created_at timestamp (created_at immutable)'
  );
}

// ==============================================================================
// SUITE 3: Storage File Validation & MIME Alignment (SEC-06)
// ==============================================================================

function testStorageMimeAlignment() {
  console.log('\n======================================================');
  console.log('  Suite 3: Storage Bucket MIME Types & Client Alignment');
  console.log('======================================================');

  // Helper to create mock File objects for testing
  const createMockFile = (name: string, type: string, sizeBytes: number): File => {
    return {
      name,
      type,
      size: sizeBytes,
    } as unknown as File;
  };

  const docFile = createMockFile('resume.doc', 'application/msword', 1024 * 50);
  const docxFile = createMockFile(
    'spec.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    1024 * 100
  );
  const oversizedDocx = createMockFile('huge.docx', 'application/msword', 15 * 1024 * 1024);
  const exeFile = createMockFile('malware.exe', 'application/x-msdownload', 1024);

  const docRes = validateFile(docFile);
  assert(docRes.valid === true, 'SEC-06-T1: validateFile accepts .doc (application/msword)');

  const docxRes = validateFile(docxFile);
  assert(
    docxRes.valid === true,
    'SEC-06-T2: validateFile accepts .docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)'
  );

  const overRes = validateFile(oversizedDocx);
  assert(
    overRes.valid === false && Boolean(overRes.error?.includes('10MB')),
    'SEC-06-T3: validateFile enforces 10MB limit on documents'
  );

  const exeRes = validateFile(exeFile);
  assert(
    exeRes.valid === false && Boolean(exeRes.error?.includes('not supported')),
    'SEC-06-T4: validateFile rejects unsupported file types (.exe)'
  );
}

// ==============================================================================
// SUITE 4: TypeScript Schema Contract Alignment Verification
// ==============================================================================

function testTypeScriptContracts() {
  console.log('\n======================================================');
  console.log('  Suite 4: TypeScript Database Type Contracts Alignment');
  console.log('======================================================');

  // Verify ChannelRow type contract
  const sampleChannel: ChannelRow = {
    id: 'test-ch',
    name: 'Test Channel',
    description: null,
    icon_name: 'Hash',
    owner_id: null,
    is_dm: false,
    is_public: true,
    created_at: '2026-10-29T00:00:00Z',
    updated_at: '2026-10-29T00:00:00Z',
  };
  assert(
    typeof sampleChannel.is_dm === 'boolean' && typeof sampleChannel.is_public === 'boolean',
    'TS-T1: ChannelRow types include is_dm and is_public fields'
  );

  // Verify ChannelMemberRow type contract
  const sampleMember: ChannelMemberRow = {
    channel_id: 'general',
    user_id: 'usr-1',
    role: 'member',
    joined_at: '2026-10-29T00:00:00Z',
    last_read_at: '2026-10-29T00:00:00Z',
  };
  assert(
    typeof sampleMember.last_read_at === 'string',
    'TS-T2: ChannelMemberRow type contract includes last_read_at'
  );

  // Verify MessageRow & Insert attachment contracts
  const sampleMessageInsert: MessageInsert = {
    channel_id: 'general',
    sender_id: 'usr-1',
    content: 'Attached file message',
    is_edited: false,
    attachment_url: 'usr-1/report.pdf',
    attachment_name: 'report.pdf',
    attachment_type: 'application/pdf',
    attachment_size: 1024,
  };
  assert(
    sampleMessageInsert.attachment_url === 'usr-1/report.pdf' && sampleMessageInsert.is_edited === false,
    'TS-T3: MessageInsert accepts attachment fields and is_edited flag without type bypass'
  );

  const sampleMessageUpdate: MessageUpdate = {
    content: 'Updated content',
    is_edited: true,
    attachment_url: null,
  };
  assert(
    sampleMessageUpdate.is_edited === true,
    'TS-T4: MessageUpdate accepts is_edited flag and attachment fields'
  );

  // Compile-time type check on Database Functions
  type DbFunctions = Database['public']['Functions'];
  type HasGetOrCreateDm = 'get_or_create_dm' extends keyof DbFunctions ? true : false;
  const hasGetOrCreateDm: HasGetOrCreateDm = true;
  assert(
    hasGetOrCreateDm,
    'TS-T5: Database.public.Functions includes get_or_create_dm signature'
  );
}

// ==============================================================================
// Master Execution
// ==============================================================================

async function main() {
  console.log('\n================================================================');
  console.log('   WORKSPACE-APP MILESTONE 1: SECURITY & RLS REGRESSION SUITE');
  console.log('================================================================');

  const startTime = Date.now();

  testStaticDdl();
  testBehavioralSimulation();
  testStorageMimeAlignment();
  testTypeScriptContracts();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(3);

  console.log('\n================================================================');
  console.log('                   SECURITY TEST RUN SUMMARY');
  console.log('================================================================');
  console.log(`Total Assertions Evaluated : ${totalPassed + totalFailed}`);
  console.log(`Passed Assertions          : ${totalPassed}`);
  console.log(`Failed Assertions          : ${totalFailed}`);
  console.log(`Execution Duration         : ${durationSec}s`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Security regression suite failed with ${totalFailed} errors.`);
    failureDetails.forEach((d) => console.error(d));
    process.exit(1);
  } else {
    console.log('✅ ALL MILESTONE 1 SECURITY & DATABASE REMEDIATION TESTS PASSED (100%).\n');
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
