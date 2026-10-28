import { describe, it, expect, beforeEach, sleep } from '../harness';
import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import { resetStore, getStoreState, waitForMessageSent } from '../helpers/store-helper';

describe('Tier 3: Pairwise Combinations (Cross-Feature Interactions)', () => {
  beforeEach(() => {
    resetStore();
  });

  // =========================================================================
  // Combination 1: Channel switching during in-flight 1s delay (F2 + F6 + F7 + F8 + F10)
  // =========================================================================
  it('C1: Channel switching during in-flight 1s delay preserves message status resolution', async () => {
    // 1. Send message in 'general'
    useWorkspaceStore.getState().sendMessage('general', 'Flight test message');
    const genMsgs1 = getStoreState().messages['general'];
    const msgId = genMsgs1[genMsgs1.length - 1].id;
    expect(genMsgs1[genMsgs1.length - 1].status).toBe('sending');

    // 2. Switch to 'random' at 150ms
    await sleep(150);
    useWorkspaceStore.getState().setActiveChannel('random');
    expect(getStoreState().activeChannelId).toBe('random');

    // 3. Verify 'random' channel has not received the general message
    const randMsgs = getStoreState().messages['random'];
    expect(randMsgs.some((m) => m.id === msgId)).toBe(false);

    // 4. Wait until the 1s timer in general completes
    await sleep(1000);

    // 5. Switch back to 'general'
    useWorkspaceStore.getState().setActiveChannel('general');
    expect(getStoreState().activeChannelId).toBe('general');

    // 6. Verify the message resolved to 'sent'
    const genMsgsFinal = getStoreState().messages['general'];
    const target = genMsgsFinal.find((m) => m.id === msgId);
    expect(target).toBeDefined();
    expect(target?.status).toBe('sent');
  });

  // =========================================================================
  // Combination 2: Multi-channel concurrent sending with staggered timers (F6 + F7 + F8 + F10)
  // =========================================================================
  it('C2: Multi-channel concurrent sending with overlapping 1000ms timers resolves independently', async () => {
    // Dispatch in General at t=0
    useWorkspaceStore.getState().sendMessage('general', 'Concurrent Gen 1');
    const idGen = getStoreState().messages['general'].slice(-1)[0].id;

    // Dispatch in Random at t=200ms
    await sleep(200);
    useWorkspaceStore.getState().sendMessage('random', 'Concurrent Rnd 1');
    const idRnd = getStoreState().messages['random'].slice(-1)[0].id;

    // Dispatch in Announcements at t=400ms
    await sleep(200);
    useWorkspaceStore.getState().sendMessage('announcements', 'Concurrent Ann 1');
    const idAnn = getStoreState().messages['announcements'].slice(-1)[0].id;

    // At t=600ms: all three should still be 'sending'
    await sleep(200);
    expect(getStoreState().messages['general'].find((m) => m.id === idGen)?.status).toBe('sending');
    expect(getStoreState().messages['random'].find((m) => m.id === idRnd)?.status).toBe('sending');
    expect(getStoreState().messages['announcements'].find((m) => m.id === idAnn)?.status).toBe('sending');

    // At t=1100ms: idGen should be 'sent', while idRnd and idAnn are still 'sending'
    await sleep(500);
    expect(getStoreState().messages['general'].find((m) => m.id === idGen)?.status).toBe('sent');
    expect(getStoreState().messages['random'].find((m) => m.id === idRnd)?.status).toBe('sending');
    expect(getStoreState().messages['announcements'].find((m) => m.id === idAnn)?.status).toBe('sending');

    // At t=1350ms: idRnd should be 'sent' as well
    await sleep(250);
    expect(getStoreState().messages['random'].find((m) => m.id === idRnd)?.status).toBe('sent');
    expect(getStoreState().messages['announcements'].find((m) => m.id === idAnn)?.status).toBe('sending');

    // At t=1600ms: idAnn should be 'sent' as well
    await sleep(250);
    expect(getStoreState().messages['announcements'].find((m) => m.id === idAnn)?.status).toBe('sent');
  });

  // =========================================================================
  // Combination 3: Channel highlight synchronization with active channel message streams (F2 + F3 + F6)
  // =========================================================================
  it('C3: Channel highlight synchronization matches active channel message stream', () => {
    const channels = ['general', 'random', 'announcements', 'development'];

    for (const channelId of channels) {
      useWorkspaceStore.getState().setActiveChannel(channelId);
      const state = getStoreState();

      // Highlight contract: activeChannelId matches selected channel
      expect(state.activeChannelId).toBe(channelId);

      // Stream contract: messages scoped to activeChannelId are immediately available
      const activeMessages = state.messages[state.activeChannelId];
      expect(Array.isArray(activeMessages)).toBe(true);
      expect(activeMessages.length).toBeGreaterThanOrEqual(1);

      // Ensure every message in this stream belongs to activeChannelId
      for (const msg of activeMessages) {
        expect(msg.channelId).toBe(channelId);
      }
    }
  });

  // =========================================================================
  // Combination 4: Rapid burst submission followed by channel switch and switch-back (F3 + F7 + F8 + F10)
  // =========================================================================
  it('C4: Rapid burst submission in active channel followed by immediate channel switch and switch-back', async () => {
    // Send 3 burst messages in 'general'
    useWorkspaceStore.getState().sendMessage('general', 'Burst alpha');
    useWorkspaceStore.getState().sendMessage('general', 'Burst beta');
    useWorkspaceStore.getState().sendMessage('general', 'Burst gamma');

    const last3 = getStoreState().messages['general'].slice(-3);
    const ids = last3.map((m) => m.id);

    // Verify all 3 start as 'sending'
    for (const m of last3) {
      expect(m.status).toBe('sending');
    }

    // Immediately switch channel away
    useWorkspaceStore.getState().setActiveChannel('development');
    expect(getStoreState().activeChannelId).toBe('development');

    // Wait for all 3 timers to resolve in background
    await sleep(1200);

    // Switch back to general
    useWorkspaceStore.getState().setActiveChannel('general');
    expect(getStoreState().activeChannelId).toBe('general');

    // Verify all 3 messages resolved to 'sent' in original submission order
    const genFinal = getStoreState().messages['general'].slice(-3);
    expect(genFinal[0].id).toBe(ids[0]);
    expect(genFinal[0].status).toBe('sent');
    expect(genFinal[1].id).toBe(ids[1]);
    expect(genFinal[1].status).toBe('sent');
    expect(genFinal[2].id).toBe(ids[2]);
    expect(genFinal[2].status).toBe('sent');
  });

  // =========================================================================
  // Combination 5: Optimistic message rejection combined with active channel switching (F2 + F3 + F7 + F10)
  // =========================================================================
  it('C5: Invalid submissions in different channels are rejected without corrupting channel switch state', async () => {
    const genCountBefore = getStoreState().messages['general'].length;
    useWorkspaceStore.getState().sendMessage('general', '   ');
    expect(getStoreState().messages['general'].length).toBe(genCountBefore);

    useWorkspaceStore.getState().setActiveChannel('random');
    const rndCountBefore = getStoreState().messages['random'].length;
    useWorkspaceStore.getState().sendMessage('random', '');
    expect(getStoreState().messages['random'].length).toBe(rndCountBefore);

    // Now send valid message in random
    useWorkspaceStore.getState().sendMessage('random', 'Valid random message');
    expect(getStoreState().messages['random'].length).toBe(rndCountBefore + 1);
    const newMsg = getStoreState().messages['random'].slice(-1)[0];
    expect(newMsg.status).toBe('sending');

    // Return to general: verify general was never touched
    useWorkspaceStore.getState().setActiveChannel('general');
    expect(getStoreState().messages['general'].length).toBe(genCountBefore);

    // Wait for random message to resolve
    await waitForMessageSent('random', newMsg.id, 2000);
    expect(getStoreState().messages['random'].slice(-1)[0].status).toBe('sent');
  });

  // =========================================================================
  // Combination 6: High concurrency across all channels with channel flipping (F1 + F2 + F3 + F6 + F7 + F8 + F10)
  // =========================================================================
  it('C6: High concurrency across all channels with channel flipping preserves all 8 messages', async () => {
    const channels = ['general', 'random', 'announcements', 'development'];
    const messageMap: Record<string, string[]> = {};

    // Dispatch 2 messages per channel
    for (const ch of channels) {
      messageMap[ch] = [];
      useWorkspaceStore.getState().sendMessage(ch, `${ch} - msg 1`);
      messageMap[ch].push(getStoreState().messages[ch].slice(-1)[0].id);

      useWorkspaceStore.getState().sendMessage(ch, `${ch} - msg 2`);
      messageMap[ch].push(getStoreState().messages[ch].slice(-1)[0].id);
    }

    // Rapidly cycle through active channels during the 1s delay
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const ch of channels) {
        useWorkspaceStore.getState().setActiveChannel(ch);
        await sleep(50);
      }
    }

    // Wait for all messages to resolve
    await sleep(1200);

    // Verify all 8 messages are 'sent' in their respective channels
    for (const ch of channels) {
      const channelMsgs = getStoreState().messages[ch];
      for (const id of messageMap[ch]) {
        const found = channelMsgs.find((m) => m.id === id);
        expect(found).toBeDefined();
        expect(found?.status).toBe('sent');
      }
    }
  });
});
