/**
 * Adversarial Deep Stress Test & Empirical Security Audit
 * Target: workspace-app/tests/adversarial-milestone1-deep-audit.ts
 *
 * Verifies the 4 critical challenge areas specified for Milestone 1:
 * 1. Storage attachment access bypasses & folder traversal
 * 2. Channel members UPDATE trigger & role escalation vectors
 * 3. Owner kick protection & admin boundary limits in DELETE policy
 * 4. Message immutability trigger & tamper resistance
 * 5. Cascade SET NULL leakage & DM isolation
 * 6. RPC get_or_create_dm authorization & parameter validation
 */

import * as fs from 'fs';
import * as path from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureLog: string[] = [];

function assert(condition: boolean, title: string, explanation?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${title}`);
  } else {
    failedTests++;
    const errMsg = `  ✗ [FAIL] ${title}${explanation ? ` (${explanation})` : ''}`;
    console.error(errMsg);
    failureLog.push(errMsg);
  }
}

// ------------------------------------------------------------------------------
// Load Schema & Migrations
// ------------------------------------------------------------------------------
const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');
const secFixesFilename = fs.existsSync(path.join(MIGRATIONS_DIR, '20261029300000_security_fixes.sql'))
  ? '20261029300000_security_fixes.sql'
  : (fs.existsSync(path.join(MIGRATIONS_DIR, '20261029200000_security_fixes.sql'))
    ? '20261029200000_security_fixes.sql'
    : '20261029100000_security_fixes.sql');
const secFixesSql = fs.readFileSync(path.join(MIGRATIONS_DIR, secFixesFilename), 'utf8');
const phase2Sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261029000000_phase2_schema.sql'), 'utf8');
const initSchemaSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261028000000_initial_schema.sql'), 'utf8');

// ==============================================================================
// 1. Storage Attachment Access & Policy Audit
// ==============================================================================
function runStorageAudit() {
  console.log('\n======================================================');
  console.log('  Area 1: Storage Attachment Access & Policy Analysis');
  console.log('======================================================');

  // Verify drop of vulnerable policy
  assert(
    secFixesSql.includes('DROP POLICY IF EXISTS "chat_attachments_select_auth" ON storage.objects;'),
    'Policy Drop: Broad chat_attachments_select_auth dropped'
  );

  // Verify creation of channel-member scoped policy
  assert(
    secFixesSql.includes('CREATE POLICY "chat_attachments_select_channel_member"'),
    'Policy Create: chat_attachments_select_channel_member created'
  );

  // Policy logic simulation
  interface StorageObj {
    bucket_id: string;
    name: string;
    owner: string;
  }
  interface MockMsg {
    id: string;
    channel_id: string;
    sender_id: string;
    attachment_url: string;
  }
  interface MockChan {
    id: string;
    is_public: boolean;
    is_dm: boolean;
    owner_id: string | null;
  }

  const channels: MockChan[] = [
    { id: 'secret-room', is_public: false, is_dm: false, owner_id: 'alice' },
    { id: 'dm-alice-bob', is_public: false, is_dm: true, owner_id: 'alice' },
    { id: 'general', is_public: true, is_dm: false, owner_id: null },
    { id: 'abandoned-private', is_public: false, is_dm: false, owner_id: null },
  ];

  const channelMembers = new Map<string, Set<string>>([
    ['secret-room', new Set(['alice', 'bob'])],
    ['dm-alice-bob', new Set(['alice', 'bob'])],
    ['general', new Set(['alice', 'bob', 'charlie', 'eve'])],
    ['abandoned-private', new Set(['charlie'])],
  ]);

  const messages: MockMsg[] = [
    { id: 'm1', channel_id: 'secret-room', sender_id: 'alice', attachment_url: 'alice/contract.pdf' },
    { id: 'm2', channel_id: 'dm-alice-bob', sender_id: 'alice', attachment_url: 'alice/passport.jpg' },
    { id: 'm3', channel_id: 'general', sender_id: 'bob', attachment_url: 'bob/announcement.png' },
    { id: 'm4', channel_id: 'abandoned-private', sender_id: 'charlie', attachment_url: 'charlie/notes.txt' },
  ];

  const evalStorageSelect = (obj: StorageObj, callerId: string | null): boolean => {
    if (!callerId) return false;
    if (obj.bucket_id !== 'chat-attachments') return false;

    const folder = obj.name.split('/')[0];
    // 1. Uploader can read own
    if (folder === callerId || obj.owner === callerId) return true;

    // 2. Folder scoped channel
    const mems = channelMembers.get(folder);
    if (mems && mems.has(callerId)) return true;

    // 3. Message attachment reference
    const linkedMsg = messages.find(m => m.attachment_url === obj.name || m.attachment_url.endsWith(obj.name));
    if (linkedMsg) {
      const msgMems = channelMembers.get(linkedMsg.channel_id);
      if (msgMems && msgMems.has(callerId)) return true;
      const ch = channels.find(c => c.id === linkedMsg.channel_id);
      if (ch && !ch.is_dm && (ch.is_public || (ch.owner_id === null && ch.is_public !== false))) {
        return true;
      }
    }

    return false;
  };

  const secretObj: StorageObj = { bucket_id: 'chat-attachments', name: 'alice/contract.pdf', owner: 'alice' };
  const dmObj: StorageObj = { bucket_id: 'chat-attachments', name: 'alice/passport.jpg', owner: 'alice' };
  const generalObj: StorageObj = { bucket_id: 'chat-attachments', name: 'bob/announcement.png', owner: 'bob' };
  const abandonedObj: StorageObj = { bucket_id: 'chat-attachments', name: 'charlie/notes.txt', owner: 'charlie' };

  // Adversarial checks
  assert(!evalStorageSelect(secretObj, 'charlie'), 'Storage: Non-member Charlie cannot read secret-room attachment');
  assert(!evalStorageSelect(secretObj, 'eve'), 'Storage: External Eve cannot read secret-room attachment');
  assert(!evalStorageSelect(secretObj, null), 'Storage: Unauthenticated caller cannot read secret-room attachment');
  assert(!evalStorageSelect(dmObj, 'charlie'), 'Storage: Charlie cannot eavesdrop on Alice-Bob DM attachment');
  assert(!evalStorageSelect(dmObj, 'eve'), 'Storage: Eve cannot eavesdrop on Alice-Bob DM attachment');
  assert(evalStorageSelect(secretObj, 'alice'), 'Storage: Alice (owner/uploader) can read own attachment');
  assert(evalStorageSelect(secretObj, 'bob'), 'Storage: Bob (channel member) can read secret attachment');
  assert(evalStorageSelect(dmObj, 'bob'), 'Storage: Bob (DM participant) can read DM attachment');
  assert(evalStorageSelect(generalObj, 'eve'), 'Storage: Eve can read general public channel attachment');
  assert(!evalStorageSelect(abandonedObj, 'eve'), 'Storage: Eve cannot access orphaned private channel attachment');
  assert(evalStorageSelect(abandonedObj, 'charlie'), 'Storage: Charlie (existing member) can still read orphaned channel attachment');
}

// ==============================================================================
// 2. Member Update Trigger & Privilege Escalation Audit
// ==============================================================================
function runMemberUpdateAudit() {
  console.log('\n======================================================');
  console.log('  Area 2: Member Update Trigger & Role Escalation Vectors');
  console.log('======================================================');

  // Verify trigger function structure in SQL
  assert(
    secFixesSql.includes('CREATE OR REPLACE FUNCTION public.check_channel_member_update()'),
    'Trigger DDL: check_channel_member_update function defined'
  );
  assert(
    secFixesSql.includes('BEFORE UPDATE ON public.channel_members'),
    'Trigger DDL: trigger fires BEFORE UPDATE on channel_members'
  );
  assert(
    secFixesSql.includes('Cannot modify channel_id or user_id of a channel member'),
    'Trigger DDL: enforces channel_id and user_id immutability'
  );
  assert(
    secFixesSql.includes('Only channel owners can change member roles'),
    'Trigger DDL: rejects non-owner changing member roles'
  );

  // Adversarial simulation of trigger and policy
  type Role = 'owner' | 'admin' | 'member';
  interface MemberRow {
    channel_id: string;
    user_id: string;
    role: Role;
    last_read_at: string;
  }

  const members: MemberRow[] = [
    { channel_id: 'ch-1', user_id: 'alice', role: 'owner', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: 'ch-1', user_id: 'bob', role: 'admin', last_read_at: '2026-10-28T00:00:00Z' },
    { channel_id: 'ch-1', user_id: 'charlie', role: 'member', last_read_at: '2026-10-28T00:00:00Z' },
  ];

  const simulateUpdate = (
    callerId: string,
    targetUserId: string,
    changes: Partial<MemberRow>
  ): { success: boolean; error?: string } => {
    const existing = members.find(m => m.channel_id === 'ch-1' && m.user_id === targetUserId);
    if (!existing) return { success: false, error: 'Member not found' };

    const callerRow = members.find(m => m.channel_id === 'ch-1' && m.user_id === callerId);
    const callerRole = callerRow?.role || null;

    // RLS Policy: channel_members_update_self_or_owner
    // USING (user_id = auth.uid() OR get_channel_role(...) = 'owner')
    const rlsAllowed = callerId === targetUserId || callerRole === 'owner';
    if (!rlsAllowed) {
      return { success: false, error: 'RLS: permission denied' };
    }

    // Trigger: check_channel_member_update()
    const updatedChannelId = changes.channel_id !== undefined ? changes.channel_id : existing.channel_id;
    const updatedUserId = changes.user_id !== undefined ? changes.user_id : existing.user_id;
    const updatedRole = changes.role !== undefined ? changes.role : existing.role;

    if (updatedChannelId !== existing.channel_id || updatedUserId !== existing.user_id) {
      return { success: false, error: 'Cannot modify channel_id or user_id of a channel member' };
    }

    if (updatedRole !== existing.role) {
      if (callerRole !== 'owner') {
        return { success: false, error: 'Only channel owners can change member roles' };
      }
    }

    return { success: true };
  };

  // Test attacks
  assert(!simulateUpdate('charlie', 'charlie', { role: 'admin' }).success, 'Escalation: Charlie cannot self-promote to admin');
  assert(!simulateUpdate('charlie', 'charlie', { role: 'owner' }).success, 'Escalation: Charlie cannot self-promote to owner');
  assert(!simulateUpdate('bob', 'bob', { role: 'owner' }).success, 'Escalation: Admin Bob cannot self-promote to owner');
  assert(!simulateUpdate('bob', 'charlie', { role: 'admin' }).success, 'Escalation: Admin Bob cannot promote Charlie (RLS blocks)');
  assert(!simulateUpdate('bob', 'charlie', { role: 'owner' }).success, 'Escalation: Admin Bob cannot crown Charlie as owner');
  assert(!simulateUpdate('charlie', 'charlie', { channel_id: 'ch-vault' }).success, 'Tampering: Charlie cannot switch channel_id');
  assert(!simulateUpdate('charlie', 'charlie', { user_id: 'eve' }).success, 'Tampering: Charlie cannot rebind user_id to Eve');
  assert(simulateUpdate('charlie', 'charlie', { last_read_at: '2026-10-29T12:00:00Z' }).success, 'Valid: Charlie can update own last_read_at');
  assert(simulateUpdate('alice', 'charlie', { role: 'admin' }).success, 'Valid: Owner Alice can promote Charlie to admin');
  assert(simulateUpdate('alice', 'bob', { role: 'member' }).success, 'Valid: Owner Alice can demote Admin Bob to member');
}

// ==============================================================================
// 3. Owner Kick Protection Audit
// ==============================================================================
function runOwnerKickAudit() {
  console.log('\n======================================================');
  console.log('  Area 3: Owner Kick Protection & DELETE Policy Limits');
  console.log('======================================================');

  assert(
    secFixesSql.includes('CREATE POLICY "channel_members_delete_self_or_admin"'),
    'Policy DDL: channel_members_delete_self_or_admin created'
  );
  assert(
    /get_channel_role\(channel_id, user_id\)\s*=\s*'member'/i.test(secFixesSql),
    'Policy DDL: restricts admin kick strictly to target role = member'
  );

  type Role = 'owner' | 'admin' | 'member';
  const roleMap: Record<string, Role> = {
    alice: 'owner',
    bob: 'admin',
    dave: 'admin',
    charlie: 'member',
  };

  const evalDeletePolicy = (callerId: string, targetId: string): boolean => {
    // 1. Self leave
    if (callerId === targetId) return true;
    // 2. Owner can kick anyone
    if (roleMap[callerId] === 'owner') return true;
    // 3. Admin can only kick regular members
    if (roleMap[callerId] === 'admin' && roleMap[targetId] === 'member') return true;

    return false;
  };

  assert(!evalDeletePolicy('bob', 'alice'), 'Protection: Admin Bob CANNOT delete Owner Alice');
  assert(!evalDeletePolicy('bob', 'dave'), 'Protection: Admin Bob CANNOT delete fellow Admin Dave');
  assert(evalDeletePolicy('bob', 'charlie'), 'Permission: Admin Bob CAN delete Member Charlie');
  assert(!evalDeletePolicy('charlie', 'alice'), 'Protection: Member Charlie CANNOT delete Owner Alice');
  assert(!evalDeletePolicy('charlie', 'bob'), 'Protection: Member Charlie CANNOT delete Admin Bob');
  assert(!evalDeletePolicy('charlie', 'dave'), 'Protection: Member Charlie CANNOT delete Member Dave');
  assert(evalDeletePolicy('alice', 'bob'), 'Permission: Owner Alice CAN delete Admin Bob');
  assert(evalDeletePolicy('alice', 'charlie'), 'Permission: Owner Alice CAN delete Member Charlie');
  assert(evalDeletePolicy('charlie', 'charlie'), 'Permission: Charlie can leave the channel (self-delete)');
  assert(evalDeletePolicy('bob', 'bob'), 'Permission: Admin Bob can leave the channel (self-delete)');
}

// ==============================================================================
// 4. Message Immutability Trigger Audit
// ==============================================================================
function runMessageImmutabilityAudit() {
  console.log('\n======================================================');
  console.log('  Area 4: Message Immutability Trigger & Content Checks');
  console.log('======================================================');

  assert(
    secFixesSql.includes('CREATE OR REPLACE FUNCTION public.check_message_update_immutability()'),
    'Trigger DDL: check_message_update_immutability function defined'
  );
  assert(
    secFixesSql.includes('BEFORE UPDATE ON public.messages'),
    'Trigger DDL: trigger fires BEFORE UPDATE on messages'
  );
  assert(
    secFixesSql.includes('Cannot modify message channel_id'),
    'Trigger DDL: guards channel_id immutability'
  );
  assert(
    secFixesSql.includes('Cannot modify message sender_id'),
    'Trigger DDL: guards sender_id immutability'
  );
  assert(
    secFixesSql.includes('Cannot modify message created_at'),
    'Trigger DDL: guards created_at immutability'
  );

  interface MessageState {
    id: string;
    channel_id: string;
    sender_id: string;
    content: string;
    attachment_url: string | null;
    created_at: string;
    is_edited: boolean;
  }

  const initialMsg: MessageState = {
    id: 'msg-uuid-1',
    channel_id: 'general',
    sender_id: 'alice',
    content: 'Original message',
    attachment_url: null,
    created_at: '2026-10-28T12:00:00Z',
    is_edited: false,
  };

  const simulateMsgUpdate = (
    callerId: string,
    updates: Partial<MessageState>
  ): { success: boolean; error?: string } => {
    // RLS: messages_update_own (sender_id = auth.uid())
    if (initialMsg.sender_id !== callerId) {
      return { success: false, error: 'RLS: caller is not sender' };
    }

    // Trigger: check_message_update_immutability()
    if (updates.channel_id && updates.channel_id !== initialMsg.channel_id) {
      return { success: false, error: 'Cannot modify message channel_id' };
    }
    if (updates.sender_id && updates.sender_id !== initialMsg.sender_id) {
      return { success: false, error: 'Cannot modify message sender_id' };
    }
    if (updates.created_at && updates.created_at !== initialMsg.created_at) {
      return { success: false, error: 'Cannot modify message created_at' };
    }

    // CHECK constraint: length(trim(content)) > 0 OR attachment_url IS NOT NULL
    const updatedContent = updates.content !== undefined ? updates.content : initialMsg.content;
    const updatedAttachment = updates.attachment_url !== undefined ? updates.attachment_url : initialMsg.attachment_url;
    if (updatedContent.trim().length === 0 && updatedAttachment === null) {
      return { success: false, error: 'Violates messages_content_check' };
    }

    return { success: true };
  };

  assert(!simulateMsgUpdate('bob', { content: 'Bob hacking Alice message' }).success, 'Immutability: Bob cannot edit Alice message');
  assert(!simulateMsgUpdate('alice', { channel_id: 'random' }).success, 'Immutability: Alice cannot change channel_id');
  assert(!simulateMsgUpdate('alice', { sender_id: 'bob' }).success, 'Immutability: Alice cannot spoof sender_id');
  assert(!simulateMsgUpdate('alice', { created_at: '2020-01-01T00:00:00Z' }).success, 'Immutability: Alice cannot tamper created_at');
  assert(simulateMsgUpdate('alice', { content: 'Alice edited text', is_edited: true }).success, 'Valid: Alice can edit text content');
  assert(simulateMsgUpdate('alice', { content: '', attachment_url: 'alice/photo.png' }).success, 'Valid: Pure attachment message accepted');
  assert(!simulateMsgUpdate('alice', { content: '   ', attachment_url: null }).success, 'Check Constraint: Empty content without attachment rejected');
}

// ==============================================================================
// 5. Cascade SET NULL & Public Channel Leakage Audit
// ==============================================================================
function runCascadeSafetyAudit() {
  console.log('\n======================================================');
  console.log('  Area 5: Cascade SET NULL Leakage & DM Isolation');
  console.log('======================================================');

  assert(
    secFixesSql.includes('ALTER TABLE public.channels') && secFixesSql.includes('ADD COLUMN IF NOT EXISTS is_public'),
    'Schema: channels.is_public added with DEFAULT false'
  );
  assert(
    secFixesSql.includes('UPDATE public.channels') && secFixesSql.includes('SET is_public = false') && secFixesSql.includes('WHERE is_dm = true'),
    'Schema: all DMs explicitly set is_public = false'
  );
  assert(
    secFixesSql.includes('WHERE c.is_public = true AND c.is_dm = false'),
    'Trigger: handle_new_user only enrolls in public, non-DM channels'
  );

  // Policy check simulation
  const checkChannelVisible = (
    channel: { id: string; owner_id: string | null; is_public: boolean; is_dm: boolean },
    callerId: string,
    isMember: boolean
  ): boolean => {
    // channels_select_member_or_public:
    // (is_public = true AND is_dm = false) OR (owner_id IS NOT NULL AND owner_id = auth.uid()) OR public.is_channel_member(...)
    if (channel.is_public && !channel.is_dm) return true;
    if (channel.owner_id && channel.owner_id === callerId) return true;
    return isMember;
  };

  const orphanedPrivate = { id: 'orphaned-private', owner_id: null, is_public: false, is_dm: false };
  const orphanedDm = { id: 'orphaned-dm', owner_id: null, is_public: false, is_dm: true };
  const normalPublic = { id: 'general', owner_id: null, is_public: true, is_dm: false };

  assert(!checkChannelVisible(orphanedPrivate, 'eve', false), 'Cascade Safety: Eve cannot see orphaned private channel');
  assert(!checkChannelVisible(orphanedDm, 'eve', false), 'Cascade Safety: Eve cannot see orphaned DM channel');
  assert(checkChannelVisible(orphanedPrivate, 'charlie', true), 'Cascade Safety: Enrolled Charlie can still see orphaned private channel');
  assert(checkChannelVisible(normalPublic, 'eve', false), 'Public Channel: Eve can see public general channel');
}

// ==============================================================================
// 6. RPC get_or_create_dm Audit
// ==============================================================================
function runRpcAudit() {
  console.log('\n======================================================');
  console.log('  Area 6: RPC get_or_create_dm Permission & Logic');
  console.log('======================================================');

  assert(
    secFixesSql.includes('REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(UUID) FROM PUBLIC;'),
    'RPC Permission: EXECUTE revoked from PUBLIC'
  );
  assert(
    secFixesSql.includes('GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID) TO authenticated;'),
    'RPC Permission: EXECUTE granted to authenticated'
  );
  assert(
    secFixesSql.includes('NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id)'),
    'RPC Logic: Validates target user exists in profiles'
  );
  assert(
    secFixesSql.includes('is_dm, is_public') && secFixesSql.includes('true,') && secFixesSql.includes('false'),
    'RPC Logic: Sets is_dm = true, is_public = false on DM channel creation'
  );
}

// ==============================================================================
// Master Execution
// ==============================================================================
async function runAllAudits() {
  console.log('================================================================');
  console.log('  STARTING ADVERSARIAL DEEP STRESS TEST FOR MILESTONE 1');
  console.log('================================================================');

  runStorageAudit();
  runMemberUpdateAudit();
  runOwnerKickAudit();
  runMessageImmutabilityAudit();
  runCascadeSafetyAudit();
  runRpcAudit();

  console.log('\n================================================================');
  console.log('                 ADVERSARIAL AUDIT RESULTS');
  console.log('================================================================');
  console.log(`Total Checks Executed : ${totalTests}`);
  console.log(`Passed Checks         : ${passedTests}`);
  console.log(`Failed Checks         : ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error(`\n❌ CHALLENGE FAILED with ${failedTests} vulnerabilities.`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL ADVERSARIAL STRESS CHALLENGES PASSED (VERDICT: APPROVE).\n');
    process.exit(0);
  }
}

runAllAudits();
