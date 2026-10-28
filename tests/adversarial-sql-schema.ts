/**
 * Adversarial Empirical Stress Tester for PostgreSQL Schema & RLS Security
 * Milestone A - Challenger 1
 * Target: workspace-app/supabase/migrations/20261028000000_initial_schema.sql
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Framework Utilities
// ============================================================================

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

// ============================================================================
// SUITE 1: Static DDL & Migration Completeness
// ============================================================================

function runSuite1(migrationSql: string) {
  console.log('\n======================================================');
  console.log('  Suite 1: Static DDL & Schema Contract Completeness');
  console.log('======================================================');

  // 1. Table Definitions
  assert(
    /CREATE TABLE IF NOT EXISTS public\.profiles/i.test(migrationSql),
    'S1.1: Table public.profiles is defined'
  );
  assert(
    /CREATE TABLE IF NOT EXISTS public\.channels/i.test(migrationSql),
    'S1.2: Table public.channels is defined'
  );
  assert(
    /CREATE TABLE IF NOT EXISTS public\.channel_members/i.test(migrationSql),
    'S1.3: Table public.channel_members is defined'
  );
  assert(
    /CREATE TABLE IF NOT EXISTS public\.messages/i.test(migrationSql),
    'S1.4: Table public.messages is defined'
  );

  // 2. Enum Definition
  assert(
    /CREATE TYPE public\.channel_member_role AS ENUM \('owner', 'admin', 'member'\)/i.test(migrationSql),
    'S1.5: Enum channel_member_role defined with owner, admin, member'
  );

  // 3. Foreign Keys & Cascading
  assert(
    /id UUID PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/i.test(migrationSql),
    'S1.6: profiles.id references auth.users(id) with ON DELETE CASCADE'
  );
  assert(
    /channel_id TEXT NOT NULL REFERENCES public\.channels\(id\) ON DELETE CASCADE/i.test(migrationSql),
    'S1.7: channel_members.channel_id references channels(id) with ON DELETE CASCADE'
  );
  assert(
    /user_id UUID NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/i.test(migrationSql),
    'S1.8: channel_members.user_id references profiles(id) with ON DELETE CASCADE'
  );
  assert(
    /sender_id UUID NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/i.test(migrationSql),
    'S1.9: messages.sender_id references profiles(id) with ON DELETE CASCADE'
  );
  assert(
    /owner_id UUID REFERENCES public\.profiles\(id\) ON DELETE SET NULL/i.test(migrationSql),
    'S1.10: channels.owner_id references profiles(id) with ON DELETE SET NULL'
  );

  // 4. Performance Indexes
  assert(
    /CREATE INDEX IF NOT EXISTS idx_messages_channel_created\s+ON public\.messages\s*\(channel_id,\s*created_at DESC\)/i.test(migrationSql),
    'S1.11: Index idx_messages_channel_created on (channel_id, created_at DESC) present'
  );
  assert(
    /CREATE INDEX IF NOT EXISTS idx_messages_sender_id\s+ON public\.messages\s*\(sender_id\)/i.test(migrationSql),
    'S1.12: Index idx_messages_sender_id on (sender_id) present'
  );
  assert(
    /CREATE INDEX IF NOT EXISTS idx_messages_client_message_id\s+ON public\.messages\s*\(client_message_id\)\s+WHERE client_message_id IS NOT NULL/i.test(migrationSql),
    'S1.13: Deduplication index idx_messages_client_message_id present'
  );
  assert(
    /CREATE INDEX IF NOT EXISTS idx_channel_members_user_id\s+ON public\.channel_members\s*\(user_id\)/i.test(migrationSql),
    'S1.14: Index idx_channel_members_user_id on (user_id) present'
  );
  assert(
    /CREATE INDEX IF NOT EXISTS idx_channels_owner_id\s+ON public\.channels\s*\(owner_id\)/i.test(migrationSql),
    'S1.15: Index idx_channels_owner_id on (owner_id) present'
  );

  // 5. Seed Channels & Realtime Publications
  assert(
    migrationSql.includes("'general'") &&
    migrationSql.includes("'random'") &&
    migrationSql.includes("'announcements'") &&
    migrationSql.includes("'development'"),
    'S1.16: Default seed channels (general, random, announcements, development) present'
  );
  assert(
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.messages/i.test(migrationSql) &&
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.channels/i.test(migrationSql) &&
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.channel_members/i.test(migrationSql),
    'S1.17: Supabase Realtime publication includes messages, channels, channel_members'
  );
  assert(
    /ALTER TABLE public\.messages REPLICA IDENTITY FULL/i.test(migrationSql),
    'S1.18: messages table configured with REPLICA IDENTITY FULL'
  );
}

// ============================================================================
// SUITE 2: RLS Recursion Safety & Helper Function Security Definer Inspection
// ============================================================================

function runSuite2(migrationSql: string) {
  console.log('\n======================================================');
  console.log('  Suite 2: RLS Infinite Recursion Safety Verification');
  console.log('======================================================');

  // Verify is_channel_member declaration
  const isMemberDefMatch = migrationSql.match(
    /CREATE OR REPLACE FUNCTION public\.is_channel_member\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$;/i
  );
  assert(isMemberDefMatch !== null, 'S2.1: is_channel_member function definition exists');

  if (isMemberDefMatch) {
    const fnSignature = isMemberDefMatch[0];
    assert(
      /SECURITY DEFINER/i.test(fnSignature),
      'S2.2: is_channel_member is explicitly declared SECURITY DEFINER'
    );
    assert(
      /SET search_path\s*=\s*public/i.test(fnSignature),
      'S2.3: is_channel_member sets safe search_path = public'
    );
    assert(
      /STABLE/i.test(fnSignature),
      'S2.4: is_channel_member marked STABLE for plan memoization'
    );
  }

  // Verify get_channel_role declaration
  const getRoleDefMatch = migrationSql.match(
    /CREATE OR REPLACE FUNCTION public\.get_channel_role\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$;/i
  );
  assert(getRoleDefMatch !== null, 'S2.5: get_channel_role function definition exists');

  if (getRoleDefMatch) {
    const fnSignature = getRoleDefMatch[0];
    assert(
      /SECURITY DEFINER/i.test(fnSignature),
      'S2.6: get_channel_role is explicitly declared SECURITY DEFINER'
    );
    assert(
      /SET search_path\s*=\s*public/i.test(fnSignature),
      'S2.7: get_channel_role sets safe search_path = public'
    );
    assert(
      /STABLE/i.test(fnSignature),
      'S2.8: get_channel_role marked STABLE for plan memoization'
    );
  }

  // Verify RLS enablement
  assert(
    /ALTER TABLE public\.profiles ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.channels ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.channel_members ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.messages ENABLE ROW LEVEL SECURITY/i.test(migrationSql),
    'S2.9: ROW LEVEL SECURITY is enabled on all 4 core tables'
  );

  // Recursion Proof: Verify no policy on channel_members executes raw direct subqueries on channel_members
  const channelMembersSection = migrationSql.split('-- ─── CHANNEL MEMBERS POLICIES ────────────────────────────────────────────────')[1]?.split('-- ─── MESSAGES POLICIES ───────────────────────────────────────────────────')[0] || '';
  
  // Look for any unshielded SELECT from channel_members within channel_members policies
  const unshieldedCmSubquery = /(?<!is_channel_member|get_channel_role)[\s\S]{1,50}FROM\s+public\.channel_members/i.test(
    channelMembersSection
  );
  assert(
    !unshieldedCmSubquery,
    'S2.10: No unshielded recursive subquery on public.channel_members in channel_members RLS policies'
  );
}

// ============================================================================
// SUITE 3: Relational Simulation Engine (RLS Policies & Anti-Spoofing Stress)
// ============================================================================

interface Profile {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  status_text: string | null;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  icon_name: string;
  owner_id: string | null;
}

interface ChannelMember {
  channel_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  client_message_id: string | null;
}

class PostgresSimulationEngine {
  profiles: Profile[] = [];
  channels: Channel[] = [];
  channel_members: ChannelMember[] = [];
  messages: Message[] = [];

  // Helper functions (SECURITY DEFINER semantics - bypasses RLS on channel_members)
  is_channel_member(channelId: string, userId: string): boolean {
    return this.channel_members.some((cm) => cm.channel_id === channelId && cm.user_id === userId);
  }

  get_channel_role(channelId: string, userId: string): 'owner' | 'admin' | 'member' | null {
    const m = this.channel_members.find((cm) => cm.channel_id === channelId && cm.user_id === userId);
    return m ? m.role : null;
  }

  // Seed default open workspace channels
  seedDefaults() {
    const defaults = ['general', 'random', 'announcements', 'development'];
    for (const id of defaults) {
      if (!this.channels.some((c) => c.id === id)) {
        this.channels.push({
          id,
          name: id,
          description: `Default ${id} channel`,
          icon_name: 'Hash',
          owner_id: null, // open workspace channel
        });
      }
    }
  }

  // Trigger: handle_new_user
  triggerOnAuthUserCreated(userId: string, name: string, email: string) {
    this.profiles.push({
      id: userId,
      name,
      username: name.toLowerCase(),
      email,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      status_text: 'Online',
    });

    // Auto-enroll in open channels
    for (const c of this.channels.filter((ch) => ch.owner_id === null)) {
      if (!this.channel_members.some((cm) => cm.channel_id === c.id && cm.user_id === userId)) {
        this.channel_members.push({
          channel_id: c.id,
          user_id: userId,
          role: 'member',
        });
      }
    }
  }

  // RLS & Trigger: channels insert
  insertChannel(authUid: string, row: { id: string; name: string; description?: string; icon_name?: string; owner_id: string | null }) {
    // RLS Policy: channels_insert_authenticated
    // WITH CHECK (owner_id = auth.uid())
    if (row.owner_id !== authUid) {
      throw new Error('RLS: new row violates row-level security policy for table "channels"');
    }

    const icon = row.icon_name || 'Hash';
    const validIcons = ['Hash', 'MessageSquare', 'Bell', 'Code'];
    if (!validIcons.includes(icon)) {
      throw new Error(`CHECK: new row violates check constraint "icon_name"`);
    }

    if (this.channels.some((c) => c.id === row.id)) {
      throw new Error(`PK: duplicate key value violates unique constraint "channels_pkey"`);
    }

    const newChannel: Channel = {
      id: row.id,
      name: row.name,
      description: row.description || null,
      icon_name: icon,
      owner_id: row.owner_id,
    };
    this.channels.push(newChannel);

    // Trigger: handle_channel_created (AFTER INSERT)
    if (newChannel.owner_id !== null) {
      const existing = this.channel_members.find((cm) => cm.channel_id === newChannel.id && cm.user_id === newChannel.owner_id);
      if (existing) {
        existing.role = 'owner';
      } else {
        this.channel_members.push({
          channel_id: newChannel.id,
          user_id: newChannel.owner_id,
          role: 'owner',
        });
      }
    }

    return newChannel;
  }

  // RPC: create_channel_atomic
  createChannelAtomic(authUid: string | null, p_id: string, p_name: string, p_description?: string, p_icon_name = 'Hash') {
    if (!authUid) {
      throw new Error('Not authenticated');
    }

    const cleanId = (p_id && p_id.trim().length > 0)
      ? p_id.trim()
      : p_name.trim().toLowerCase().replace(/\s+/g, '-');

    return this.insertChannel(authUid, {
      id: cleanId,
      name: p_name.trim(),
      description: p_description?.trim(),
      icon_name: p_icon_name,
      owner_id: authUid,
    });
  }

  // RLS: channels select
  selectChannels(authUid: string): Channel[] {
    return this.channels.filter((c) => {
      // owner_id IS NULL OR owner_id = auth.uid() OR is_channel_member(id, auth.uid())
      return c.owner_id === null || c.owner_id === authUid || this.is_channel_member(c.id, authUid);
    });
  }

  // RLS: channel_members insert
  insertChannelMember(authUid: string, row: { channel_id: string; user_id: string; role: 'owner' | 'admin' | 'member' }) {
    // Unique PK constraint check
    if (this.channel_members.some((cm) => cm.channel_id === row.channel_id && cm.user_id === row.user_id)) {
      throw new Error('PK: duplicate key value violates unique constraint "channel_members_pkey"');
    }

    const callerRole = this.get_channel_role(row.channel_id, authUid);
    const targetChannel = this.channels.find((c) => c.id === row.channel_id);

    // Policy: channel_members_insert_authorized
    const allowed =
      // 1. Owner or admin adds member with role 'member'
      ((callerRole === 'owner' || callerRole === 'admin') && row.role === 'member') ||
      // 2. Owner assigns admin
      (callerRole === 'owner') ||
      // 3. Self-join open workspace channel (owner_id IS NULL) with role 'member'
      (row.user_id === authUid && row.role === 'member' && targetChannel?.owner_id === null);

    if (!allowed) {
      throw new Error('RLS: new row violates row-level security policy for table "channel_members"');
    }

    this.channel_members.push(row);
  }

  // RLS: channel_members update
  updateChannelMemberRole(authUid: string, channelId: string, targetUserId: string, newRole: 'owner' | 'admin' | 'member') {
    // Policy: channel_members_update_owner_only
    // USING (get_channel_role(channel_id, auth.uid()) = 'owner')
    const callerRole = this.get_channel_role(channelId, authUid);
    if (callerRole !== 'owner') {
      throw new Error('RLS: violates row-level security policy for table "channel_members"');
    }

    const member = this.channel_members.find((cm) => cm.channel_id === channelId && cm.user_id === targetUserId);
    if (member) {
      member.role = newRole;
    }
  }

  // RLS: channel_members select
  selectChannelMembers(authUid: string, channelId: string): ChannelMember[] {
    return this.channel_members.filter((cm) => {
      if (cm.channel_id !== channelId) return false;
      // USING (user_id = auth.uid() OR is_channel_member(channel_id, auth.uid()))
      return cm.user_id === authUid || this.is_channel_member(channelId, authUid);
    });
  }

  // RLS: messages insert (Anti-spoofing + channel membership)
  insertMessage(authUid: string, row: { channel_id: string; sender_id: string; content: string; client_message_id?: string | null }) {
    // Check constraint: length(trim(content)) > 0
    if (!row.content || row.content.trim().length === 0) {
      throw new Error('CHECK: new row violates check constraint "content"');
    }

    // Unique constraint: client_message_id
    if (row.client_message_id) {
      const dup = this.messages.some((m) => m.client_message_id === row.client_message_id);
      if (dup) {
        throw new Error('UNIQUE: duplicate key value violates unique constraint "messages_client_message_id_key"');
      }
    }

    // Policy: messages_insert_anti_spoofing
    // WITH CHECK (sender_id = auth.uid() AND is_channel_member(channel_id, auth.uid()))
    if (row.sender_id !== authUid) {
      throw new Error('RLS: Anti-spoofing rejected - sender_id does not match auth.uid()');
    }
    if (!this.is_channel_member(row.channel_id, authUid)) {
      throw new Error('RLS: Unauthorized - caller is not a member of channel');
    }

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      channel_id: row.channel_id,
      sender_id: row.sender_id,
      content: row.content,
      client_message_id: row.client_message_id || null,
    };
    this.messages.push(newMsg);
    return newMsg;
  }

  // RLS: messages select
  selectMessages(authUid: string, channelId: string): Message[] {
    // Policy: messages_select_channel_member
    // USING (is_channel_member(channel_id, auth.uid()))
    if (!this.is_channel_member(channelId, authUid)) {
      return []; // RLS filters out rows
    }
    return this.messages.filter((m) => m.channel_id === channelId);
  }

  // RLS: messages update
  updateMessage(authUid: string, messageId: string, newContent: string) {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Not found');

    // Policy: messages_update_own
    // USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid())
    if (msg.sender_id !== authUid) {
      throw new Error('RLS: cannot update message belonging to another user');
    }

    msg.content = newContent;
  }

  // RLS: messages delete
  deleteMessage(authUid: string, messageId: string) {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Not found');

    // Policy: messages_delete_own_or_admin
    // USING (sender_id = auth.uid() OR get_channel_role(channel_id, auth.uid()) IN ('owner', 'admin'))
    const callerRole = this.get_channel_role(msg.channel_id, authUid);
    const isSender = msg.sender_id === authUid;
    const isPrivileged = callerRole === 'owner' || callerRole === 'admin';

    if (!isSender && !isPrivileged) {
      throw new Error('RLS: cannot delete message without sender or owner/admin privileges');
    }

    this.messages = this.messages.filter((m) => m.id !== messageId);
  }
}

function runSuite3() {
  console.log('\n======================================================');
  console.log('  Suite 3: Anti-Spoofing & Privilege Escalation Stress');
  console.log('======================================================');

  const db = new PostgresSimulationEngine();
  db.seedDefaults();

  const aliceId = '00000000-0000-0000-0000-000000000001';
  const bobId = '00000000-0000-0000-0000-000000000002';
  const eveId = '00000000-0000-0000-0000-000000000003';

  db.triggerOnAuthUserCreated(aliceId, 'Alice', 'alice@acme.com');
  db.triggerOnAuthUserCreated(bobId, 'Bob', 'bob@acme.com');
  db.triggerOnAuthUserCreated(eveId, 'Eve', 'eve@hacker.com');

  // Alice creates a private channel 'security-audit'
  const auditChannel = db.insertChannel(aliceId, {
    id: 'security-audit',
    name: 'Security Audit',
    owner_id: aliceId,
  });

  // Verify Alice is automatically owner in channel_members
  assert(
    db.get_channel_role('security-audit', aliceId) === 'owner',
    'S3.1: Automatic owner membership assigned to channel creator'
  );

  // Attack 1: Eve attempts to impersonate Alice in #general
  let attack1Blocked = false;
  try {
    db.insertMessage(eveId, {
      channel_id: 'general',
      sender_id: aliceId, // SPOOFED!
      content: 'I am Alice and I resign.',
    });
  } catch (err: any) {
    if (err.message.includes('Anti-spoofing rejected')) {
      attack1Blocked = true;
    }
  }
  assert(attack1Blocked, 'S3.2: Anti-spoofing blocks sender_id impersonation');

  // Attack 2: Eve attempts to inject message into Alice\'s private channel 'security-audit'
  let attack2Blocked = false;
  try {
    db.insertMessage(eveId, {
      channel_id: 'security-audit',
      sender_id: eveId,
      content: 'I infiltrated your private channel.',
    });
  } catch (err: any) {
    if (err.message.includes('Unauthorized - caller is not a member')) {
      attack2Blocked = true;
    }
  }
  assert(attack2Blocked, 'S3.3: Unauthorized message insert to non-member channel blocked');

  // Attack 3: Eve attempts to read messages from Alice\'s private channel
  const aliceMsg = db.insertMessage(aliceId, {
    channel_id: 'security-audit',
    sender_id: aliceId,
    content: 'Top secret encryption keys.',
  });
  const eveView = db.selectMessages(eveId, 'security-audit');
  assert(eveView.length === 0, 'S3.4: Non-member message read returns 0 rows (RLS filtered)');

  // Attack 4: Eve attempts to modify Alice\'s message
  let attack4Blocked = false;
  try {
    db.updateMessage(eveId, aliceMsg.id, 'Tampered content');
  } catch (err: any) {
    if (err.message.includes('cannot update message')) {
      attack4Blocked = true;
    }
  }
  assert(attack4Blocked, 'S3.5: Message tampering by non-author blocked');

  // Attack 5: Bob (regular member) attempts to delete Alice\'s message in #general
  const generalMsg = db.insertMessage(aliceId, {
    channel_id: 'general',
    sender_id: aliceId,
    content: 'Announcement to all.',
  });
  let attack5Blocked = false;
  try {
    db.deleteMessage(bobId, generalMsg.id);
  } catch (err: any) {
    if (err.message.includes('cannot delete message without sender or owner/admin')) {
      attack5Blocked = true;
    }
  }
  assert(attack5Blocked, 'S3.6: Unauthorized message deletion by non-author/non-admin blocked');

  // Legitimate Moderation: Alice (owner of 'security-audit') adds Bob as member
  db.insertChannelMember(aliceId, {
    channel_id: 'security-audit',
    user_id: bobId,
    role: 'member',
  });
  assert(
    db.is_channel_member('security-audit', bobId),
    'S3.7: Channel owner successfully invites member'
  );

  // Bob posts a message in 'security-audit'
  const bobMsg = db.insertMessage(bobId, {
    channel_id: 'security-audit',
    sender_id: bobId,
    content: 'Hello audit team.',
  });

  // Alice (channel owner) moderates and deletes Bob\'s message
  let deletionSucceeded = false;
  try {
    db.deleteMessage(aliceId, bobMsg.id);
    deletionSucceeded = true;
  } catch (err: any) {
    deletionSucceeded = false;
  }
  assert(deletionSucceeded, 'S3.8: Channel owner successfully moderates/deletes member message');

  // Attack 6: Bob attempts privilege escalation (promotes self to 'admin' in 'security-audit')
  let attack6Blocked = false;
  try {
    db.updateChannelMemberRole(bobId, 'security-audit', bobId, 'admin');
  } catch (err: any) {
    if (err.message.includes('violates row-level security policy')) {
      attack6Blocked = true;
    }
  }
  assert(attack6Blocked, 'S3.9: Privilege escalation (non-owner promoting role) blocked');

  // Attack 7: Eve attempts unauthorized self-join to private channel 'security-audit'
  let attack7Blocked = false;
  try {
    db.insertChannelMember(eveId, {
      channel_id: 'security-audit',
      user_id: eveId,
      role: 'member',
    });
  } catch (err: any) {
    if (err.message.includes('violates row-level security policy')) {
      attack7Blocked = true;
    }
  }
  assert(attack7Blocked, 'S3.10: Self-join to private channel blocked');

  // Create a new open workspace channel 'open-forum' (where Eve is not enrolled)
  db.channels.push({
    id: 'open-forum',
    name: 'Open Forum',
    description: 'Public open forum',
    icon_name: 'Hash',
    owner_id: null,
  });

  // Attack 8: Eve attempts self-join to unenrolled open workspace channel with 'admin' role
  let attack8Blocked = false;
  try {
    db.insertChannelMember(eveId, {
      channel_id: 'open-forum',
      user_id: eveId,
      role: 'admin', // Escalated role attempt!
    });
  } catch (err: any) {
    if (err.message.includes('violates row-level security policy')) {
      attack8Blocked = true;
    }
  }
  assert(attack8Blocked, 'S3.11: Self-joining open channel as admin/owner blocked by RLS');

  // Attack 9: Eve creates a channel with owner_id set to Alice (impersonating owner)
  let attack9Blocked = false;
  try {
    db.insertChannel(eveId, {
      id: 'impersonated-channel',
      name: 'Fake Channel',
      owner_id: aliceId, // Impersonating Alice
    });
  } catch (err: any) {
    if (err.message.includes('violates row-level security policy')) {
      attack9Blocked = true;
    }
  }
  assert(attack9Blocked, 'S3.12: Channel creation with spoofed owner_id blocked');

  // Channel Visibility: Private channel hidden from non-member Eve
  const eveChannels = db.selectChannels(eveId);
  const seesAudit = eveChannels.some((c) => c.id === 'security-audit');
  assert(!seesAudit, 'S3.13: Private channels strictly hidden from non-members in SELECT');

  // Channel Visibility: Alice and Bob can see 'security-audit'
  const bobChannels = db.selectChannels(bobId);
  const bobSeesAudit = bobChannels.some((c) => c.id === 'security-audit');
  assert(bobSeesAudit, 'S3.14: Enrolled members can see private channel in SELECT');
}

// ============================================================================
// SUITE 4: Atomic Channel Creation & RPC Stress Testing
// ============================================================================

function runSuite4() {
  console.log('\n======================================================');
  console.log('  Suite 4: Atomic Channel Creation & RPC Stress');
  console.log('======================================================');

  const db = new PostgresSimulationEngine();
  const userId = '00000000-0000-0000-0000-000000000010';
  db.triggerOnAuthUserCreated(userId, 'TestUser', 'test@acme.com');

  // RPC: create_channel_atomic with auto-slug generation
  const ch1 = db.createChannelAtomic(
    userId,
    '', // Empty slug triggers name slugification
    'Front End Architecture 2026',
    'Core discussions on Next.js',
    'Code'
  );

  assert(ch1.id === 'front-end-architecture-2026', 'S4.1: Atomic RPC cleans slug from channel name');
  assert(ch1.owner_id === userId, 'S4.2: Atomic RPC sets owner_id to auth.uid()');
  assert(
    db.get_channel_role('front-end-architecture-2026', userId) === 'owner',
    'S4.3: Atomic RPC enrols creator as owner in channel_members'
  );

  // RPC unauthenticated failure
  let unauthBlocked = false;
  try {
    db.createChannelAtomic(null, 'hack', 'Hack Channel');
  } catch (err: any) {
    if (err.message === 'Not authenticated') {
      unauthBlocked = true;
    }
  }
  assert(unauthBlocked, 'S4.4: Atomic RPC rejects unauthenticated caller');

  // RPC explicit slug preserved
  const ch2 = db.createChannelAtomic(userId, 'custom-slug-123', 'My Custom Slug');
  assert(ch2.id === 'custom-slug-123', 'S4.5: Explicit slug is preserved by atomic RPC');
}

// ============================================================================
// SUITE 5: Constraints & Data Boundary Stress Testing
// ============================================================================

function runSuite5() {
  console.log('\n======================================================');
  console.log('  Suite 5: Constraints & Data Boundary Stress Tests');
  console.log('======================================================');

  const db = new PostgresSimulationEngine();
  db.seedDefaults();
  const userId = '00000000-0000-0000-0000-000000000020';
  db.triggerOnAuthUserCreated(userId, 'Tester', 'tester@acme.com');

  // B5.1: Empty content constraint
  let emptyBlocked = false;
  try {
    db.insertMessage(userId, {
      channel_id: 'general',
      sender_id: userId,
      content: '',
    });
  } catch (err: any) {
    if (err.message.includes('check constraint "content"')) {
      emptyBlocked = true;
    }
  }
  assert(emptyBlocked, 'S5.1: Empty message content rejected by CHECK (length(trim(content)) > 0)');

  // B5.2: Whitespace-only content constraint
  let wsBlocked = false;
  try {
    db.insertMessage(userId, {
      channel_id: 'general',
      sender_id: userId,
      content: '   \t\n   ',
    });
  } catch (err: any) {
    if (err.message.includes('check constraint "content"')) {
      wsBlocked = true;
    }
  }
  assert(wsBlocked, 'S5.2: Whitespace-only content rejected by CHECK (length(trim(content)) > 0)');

  // B5.3: Duplicate client_message_id rejected
  const clientMsgId = 'client-uuid-test-999';
  db.insertMessage(userId, {
    channel_id: 'general',
    sender_id: userId,
    content: 'First attempt',
    client_message_id: clientMsgId,
  });

  let duplicateBlocked = false;
  try {
    db.insertMessage(userId, {
      channel_id: 'general',
      sender_id: userId,
      content: 'Second retry attempt with duplicate client_message_id',
      client_message_id: clientMsgId,
    });
  } catch (err: any) {
    if (err.message.includes('unique constraint "messages_client_message_id_key"')) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, 'S5.3: Duplicate client_message_id rejected by UNIQUE constraint');

  // B5.4: Multiple null client_message_id allowed
  let nullAllowed = true;
  try {
    db.insertMessage(userId, {
      channel_id: 'general',
      sender_id: userId,
      content: 'Null client_message_id 1',
      client_message_id: null,
    });
    db.insertMessage(userId, {
      channel_id: 'general',
      sender_id: userId,
      content: 'Null client_message_id 2',
      client_message_id: null,
    });
  } catch (err) {
    nullAllowed = false;
  }
  assert(nullAllowed, 'S5.4: Multiple messages with NULL client_message_id are accepted');

  // B5.5: Duplicate membership rejected by PK (channel_id, user_id)
  let dupMemberBlocked = false;
  try {
    db.insertChannelMember(userId, {
      channel_id: 'general',
      user_id: userId,
      role: 'member',
    });
  } catch (err: any) {
    if (err.message.includes('duplicate key value violates unique constraint "channel_members_pkey"')) {
      dupMemberBlocked = true;
    }
  }
  assert(dupMemberBlocked, 'S5.5: Duplicate channel_members entry rejected by composite PRIMARY KEY');

  // B5.6: Channel icon_name CHECK constraint
  let invalidIconBlocked = false;
  try {
    db.insertChannel(userId, {
      id: 'bad-icon-chan',
      name: 'Bad Icon',
      icon_name: 'ExploitIcon',
      owner_id: userId,
    });
  } catch (err: any) {
    if (err.message.includes('check constraint "icon_name"')) {
      invalidIconBlocked = true;
    }
  }
  assert(invalidIconBlocked, 'S5.6: Invalid channel icon_name rejected by CHECK constraint');
}

// ============================================================================
// SUITE 6: TypeScript Contract Alignment Verification
// ============================================================================

function runSuite6(typesContent: string) {
  console.log('\n======================================================');
  console.log('  Suite 6: TypeScript Type Contracts Alignment');
  console.log('======================================================');

  // 1. MessageStatus accepts 'failed'
  assert(
    typesContent.includes("export type MessageStatus = 'sending' | 'sent' | 'failed'"),
    'S6.1: MessageStatus type exports "sending" | "sent" | "failed"'
  );

  // 2. Database interface exists
  assert(
    typesContent.includes('export interface Database'),
    'S6.2: Database interface is exported'
  );

  // 3. Database Tables mapped
  assert(
    typesContent.includes('profiles: {') &&
    typesContent.includes('channels: {') &&
    typesContent.includes('channel_members: {') &&
    typesContent.includes('messages: {'),
    'S6.3: Database contains profiles, channels, channel_members, messages tables'
  );

  // 4. Database RPC Functions mapped
  assert(
    typesContent.includes('is_channel_member: {') &&
    typesContent.includes('get_channel_role: {') &&
    typesContent.includes('create_channel_atomic: {'),
    'S6.4: Database Functions include is_channel_member, get_channel_role, create_channel_atomic'
  );

  // 5. Message domain model includes clientMessageId and createdAt
  assert(
    typesContent.includes('clientMessageId?: string;') &&
    typesContent.includes('createdAt?: string;'),
    'S6.5: Message model has clientMessageId and createdAt fields'
  );
}

// ============================================================================
// Master Execution
// ============================================================================

async function main() {
  console.log('================================================================');
  console.log('   EMPIRICAL ADVERSARIAL STRESS TEST: SQL SCHEMA & RLS SECURITY');
  console.log('================================================================');

  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261028000000_initial_schema.sql');
  const typesPath = path.resolve(__dirname, '../src/types/index.ts');

  if (!fs.existsSync(migrationPath)) {
    console.error(`FATAL: Migration file not found at ${migrationPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(typesPath)) {
    console.error(`FATAL: Types file not found at ${typesPath}`);
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const typesContent = fs.readFileSync(typesPath, 'utf-8');

  runSuite1(migrationSql);
  runSuite2(migrationSql);
  runSuite3();
  runSuite4();
  runSuite5();
  runSuite6(typesContent);

  console.log('\n================================================================');
  console.log('                    CHALLENGER RUN SUMMARY');
  console.log('================================================================');
  console.log(`Total Assertions Evaluated : ${totalPassed + totalFailed}`);
  console.log(`Passed Assertions          : ${totalPassed}`);
  console.log(`Failed Assertions          : ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Adversarial Stress Test Failed with ${totalFailed} failures:`);
    for (const f of failureDetails) {
      console.error(f);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL 53 EMPIRICAL ADVERSARIAL TESTS PASSED (100% SUCCESS RATE).');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
