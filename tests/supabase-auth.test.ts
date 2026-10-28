// ==============================================================================
// Milestone B (Supabase Authentication) Integration & Behavior Test Suite
// Run directly via: npx tsx tests/supabase-auth.test.ts
// ==============================================================================

import { useAuthStore } from '../src/store/useAuthStore';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { supabase, isSupabaseConfigured, mapSupabaseMessage } from '../src/lib/supabase';
import type { Message, User } from '../src/types';

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

async function runMilestoneBTests() {
  console.log('\n================================================================');
  console.log('   MILESTONE B: SUPABASE AUTHENTICATION INTEGRATION TESTS');
  console.log('================================================================\n');

  // ─── Test 1: useAuthStore Interface & Initial State ────────────────────────
  console.log('--- Test 1: Store Structure & Initial State ---');
  const initial = useAuthStore.getState();
  assert(initial.user === null, 'Initial user is null');
  assert(initial.isLoading === false, 'Initial isLoading is false');
  assert(initial.isInitialized === false, 'Initial isInitialized is false');
  assert(initial.error === null, 'Initial error is null');
  assert(typeof initial.initAuth === 'function', 'initAuth is defined');
  assert(typeof initial.login === 'function', 'login is defined');
  assert(typeof initial.register === 'function', 'register is defined');
  assert(typeof initial.logout === 'function', 'logout is defined');
  assert(typeof initial.signIn === 'function', 'signIn alias is defined');
  assert(typeof initial.signUp === 'function', 'signUp alias is defined');
  assert(typeof initial.signOut === 'function', 'signOut alias is defined');

  // ─── Test 2: initAuth Lifecycle ────────────────────────────────────────────
  console.log('\n--- Test 2: initAuth Lifecycle ---');
  initial.initAuth();
  assert(useAuthStore.getState().isInitialized === true, 'initAuth marks isInitialized as true');

  // ─── Test 3: Authentication & useWorkspaceStore Synchronization ────────────
  console.log('\n--- Test 3: Login & Workspace Store Sync ---');
  const testEmail = 'lead-dev@workspace.org';
  const testPassword = 'Password123!';

  await useAuthStore.getState().login(testEmail, testPassword);
  const loggedInUser = useAuthStore.getState().user;
  assert(loggedInUser !== null, 'login sets authenticated user');
  assert(loggedInUser?.email === testEmail, 'authenticated user has correct email');
  assert(typeof loggedInUser?.name === 'string' && loggedInUser.name.length > 0, 'user name is populated');
  assert(typeof loggedInUser?.avatarUrl === 'string' && loggedInUser.avatarUrl.includes('api.dicebear.com'), 'avatar URL is generated');
  assert(useAuthStore.getState().isLoading === false, 'isLoading is false after login completion');
  assert(useAuthStore.getState().error === null, 'error is null after successful login');

  // Verify synchronization with useWorkspaceStore.currentUser
  const workspaceUser = useWorkspaceStore.getState().currentUser;
  assert(workspaceUser.id === loggedInUser?.id, 'useWorkspaceStore.currentUser.id synced with auth user');
  assert(workspaceUser.name === loggedInUser?.name, 'useWorkspaceStore.currentUser.name synced with auth user');

  // ─── Test 4: State Purging on Logout ───────────────────────────────────────
  console.log('\n--- Test 4: Logout & State Purging ---');
  await useAuthStore.getState().logout();
  assert(useAuthStore.getState().user === null, 'logout clears user in auth store');
  assert(useAuthStore.getState().error === null, 'logout resets error');
  // Workspace state reset verified
  const postLogoutWorkspaceUser = useWorkspaceStore.getState().currentUser;
  assert(postLogoutWorkspaceUser.id === 'user-current', 'resetWorkspaceState restores default user');

  // ─── Test 5: Registration & Sign-Up Flow ───────────────────────────────────
  console.log('\n--- Test 5: Registration Flow ---');
  const regName = 'Dr. Jane Foster';
  const regEmail = 'jane.foster@workspace.org';
  await useAuthStore.getState().register(regName, regEmail, testPassword);

  const registeredUser = useAuthStore.getState().user;
  assert(registeredUser !== null, 'register sets authenticated user');
  assert(registeredUser?.name === regName, 'registered user preserves exact name');
  assert(registeredUser?.email === regEmail, 'registered user preserves exact email');
  assert(useWorkspaceStore.getState().currentUser.name === regName, 'useWorkspaceStore synced on registration');

  // Cleanup after registration test
  await useAuthStore.getState().logout();

  // ─── Test 6: Supabase Client & Dual Mode Safety ────────────────────────────
  console.log('\n--- Test 6: Supabase Client Dual Mode & Mapper ---');
  assert(typeof isSupabaseConfigured === 'boolean', 'isSupabaseConfigured exports boolean');
  if (!isSupabaseConfigured) {
    assert(supabase === null, 'supabase client is null when unconfigured (safe dual mode)');
  }

  // Strictly typed mapSupabaseMessage verification
  const rawMessage = {
    id: 'msg-real-999',
    channel_id: 'general',
    content: 'Native Supabase Auth operational',
    sender: {
      id: 'usr-jane',
      name: 'Jane Foster',
      avatar_url: 'https://example.com/jane.jpg',
      status_text: 'Active',
    },
    created_at: new Date().toISOString(),
    status: 'sent',
    client_message_id: 'client-uuid-1234',
  };

  const mapped: Message = mapSupabaseMessage(rawMessage);
  assert(mapped.id === 'msg-real-999', 'mapSupabaseMessage maps ID');
  assert(mapped.channelId === 'general', 'mapSupabaseMessage maps channelId');
  assert(mapped.sender.name === 'Jane Foster', 'mapSupabaseMessage extracts sender.name');
  assert(mapped.sender.avatarUrl === 'https://example.com/jane.jpg', 'mapSupabaseMessage extracts avatar_url');
  assert(mapped.clientMessageId === 'client-uuid-1234', 'mapSupabaseMessage preserves clientMessageId');
  assert(mapped.status === 'sent', 'mapSupabaseMessage preserves status');

  // Summary
  console.log('\n================================================================');
  console.log(`Milestone B Tests: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMilestoneBTests().catch((err) => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
