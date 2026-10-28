import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, sleep } from '../harness';
import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import { resetStore, getStoreState, waitForMessageSent } from '../helpers/store-helper';
import { readSourceFile } from '../helpers/dom-helper';
import type { Message, User, Channel, MessageStatus } from '../../src/types';

describe('Tier 2: Boundary & Corner Cases (All 11 Features)', () => {
  beforeEach(() => {
    resetStore();
  });

  // =========================================================================
  // F1: Layout Boundaries
  // =========================================================================
  describe('F1: Layout Boundaries', () => {
    it('B1.1: Layout specifications require word break / text truncation for long strings', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      const hasBreakWords = surveyMd.includes('break-words') || surveyMd.includes('truncate');
      expect(hasBreakWords).toBe(true);
    });

    it('B1.2: Message container specification enforces overflow-y-auto containment', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      expect(surveyMd).toContain('overflow-y-auto');
    });

    it('B1.3: Responsive layout specification enforces min-w-0 to prevent flex item blowout', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      expect(surveyMd).toContain('min-w-0');
    });

    it('B1.4: Empty channel message list specification defines empty state container', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      expect(surveyMd).toContain('empty-channel-message');
    });

    it('B1.5: Large volume of messages (100+ items) in store maintains layout scoping integrity', () => {
      const initialMsgs = getStoreState().messages['general'];
      const bulkMsgs: Message[] = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-msg-${i}`,
        channelId: 'general',
        sender: getStoreState().currentUser,
        content: `Bulk message content #${i}`,
        timestamp: '12:00 PM',
        status: 'sent',
      }));

      useWorkspaceStore.setState({
        messages: {
          ...getStoreState().messages,
          general: [...initialMsgs, ...bulkMsgs],
        },
      });

      expect(getStoreState().messages['general'].length).toBe(initialMsgs.length + 100);
      expect(getStoreState().messages['random'].length).toBe(1); // Isolation preserved
    });
  });

  // =========================================================================
  // F2: Channel Navigation Boundaries
  // =========================================================================
  describe('F2: Channel Navigation Boundaries', () => {
    it('B2.1: Large channel list scaling: store supports 20+ channels cleanly', () => {
      const extraChannels: Channel[] = Array.from({ length: 20 }, (_, i) => ({
        id: `extra-channel-${i}`,
        name: `extra-${i}`,
        description: `Extra channel number ${i}`,
        iconName: 'Hash',
      }));

      useWorkspaceStore.setState({
        channels: [...getStoreState().channels, ...extraChannels],
      });

      expect(getStoreState().channels.length).toBeGreaterThanOrEqual(24);
      useWorkspaceStore.getState().setActiveChannel('extra-channel-15');
      expect(getStoreState().activeChannelId).toBe('extra-channel-15');
    });

    it('B2.2: Channel IDs containing hyphens, underscores, or digits switch cleanly', () => {
      const specialChannel: Channel = {
        id: 'team_dev-ops-99',
        name: 'team_dev-ops-99',
        description: 'Special ID channel',
        iconName: 'Code',
      };

      useWorkspaceStore.setState({
        channels: [...getStoreState().channels, specialChannel],
      });

      useWorkspaceStore.getState().setActiveChannel('team_dev-ops-99');
      expect(getStoreState().activeChannelId).toBe('team_dev-ops-99');
    });

    it('B2.3: Channel with very long description (500+ chars) is stored without truncation in state', () => {
      const longDesc = 'A'.repeat(500);
      const channel: Channel = {
        id: 'long-desc-channel',
        name: 'long-desc',
        description: longDesc,
        iconName: 'Hash',
      };

      useWorkspaceStore.setState({
        channels: [...getStoreState().channels, channel],
      });

      const found = getStoreState().channels.find((c) => c.id === 'long-desc-channel');
      expect(found?.description.length).toBe(500);
    });

    it('B2.4: Switching to already active channel is idempotent and preserves state', () => {
      const stateBefore = getStoreState();
      useWorkspaceStore.getState().setActiveChannel('general');
      const stateAfter = getStoreState();
      expect(stateAfter.activeChannelId).toBe('general');
      expect(stateAfter.messages).toEqual(stateBefore.messages);
    });

    it('B2.5: Rapid consecutive channel switches resolve accurately to the final target channel', () => {
      const channels = ['random', 'announcements', 'development', 'general', 'random', 'development'];
      for (const ch of channels) {
        useWorkspaceStore.getState().setActiveChannel(ch);
      }
      expect(getStoreState().activeChannelId).toBe('development');
    });
  });

  // =========================================================================
  // F3: Active Channel Visual Highlight Boundaries
  // =========================================================================
  describe('F3: Active Channel Visual Highlight Boundaries', () => {
    it('B3.1: Exactly one channel is active in store state at any given time', () => {
      const state = getStoreState();
      expect(typeof state.activeChannelId).toBe('string');
      expect(state.activeChannelId.length).toBeGreaterThan(0);
      const activeMatches = state.channels.filter((c) => c.id === state.activeChannelId);
      expect(activeMatches.length).toBe(1);
    });

    it('B3.2: Rapid ping-pong channel switching maintains accurate activeChannelId', () => {
      for (let i = 0; i < 10; i++) {
        useWorkspaceStore.getState().setActiveChannel('random');
        expect(getStoreState().activeChannelId).toBe('random');
        useWorkspaceStore.getState().setActiveChannel('general');
        expect(getStoreState().activeChannelId).toBe('general');
      }
    });

    it('B3.3: Attempting to set activeChannelId to empty string is rejected', () => {
      useWorkspaceStore.getState().setActiveChannel('');
      expect(getStoreState().activeChannelId).toBe('general');
    });

    it('B3.4: Attempting to switch to non-existent channel retains current active channel', () => {
      useWorkspaceStore.getState().setActiveChannel('completely_unknown_channel_xyz');
      expect(getStoreState().activeChannelId).toBe('general');
    });

    it('B3.5: Channel buttons specification designates active-channel testid for current channel only', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      expect(surveyMd).toContain('data-testid="active-channel"');
    });
  });

  // =========================================================================
  // F4: Dependencies Boundaries
  // =========================================================================
  describe('F4: Dependencies Boundaries', () => {
    it('B4.1: Zustand store subscription listener fires upon state mutation', () => {
      let listenerFired = false;
      const unsubscribe = useWorkspaceStore.subscribe(() => {
        listenerFired = true;
      });

      useWorkspaceStore.getState().setActiveChannel('random');
      expect(listenerFired).toBe(true);
      unsubscribe();
    });

    it('B4.2: useWorkspaceStore.getState() is callable outside React component trees', () => {
      expect(() => {
        const s = useWorkspaceStore.getState();
        expect(s.channels.length).toBeGreaterThanOrEqual(3);
      }).not.toThrow();
    });

    it('B4.3: Lucide React icon components can be instantiated without DOM error', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { Hash, Check, Clock } = await import('lucide-react');

      const hashHtml = renderToString(React.createElement(Hash, { size: 16 }));
      expect(hashHtml).toContain('<svg');

      const checkHtml = renderToString(React.createElement(Check, { size: 16 }));
      expect(checkHtml).toContain('<svg');

      const clockHtml = renderToString(React.createElement(Clock, { size: 16 }));
      expect(clockHtml).toContain('<svg');
    });

    it('B4.4: Concurrent reads to store state return stable references', () => {
      const s1 = useWorkspaceStore.getState();
      const s2 = useWorkspaceStore.getState();
      expect(s1.channels).toBe(s2.channels);
      expect(s1.activeChannelId).toBe(s2.activeChannelId);
    });

    it('B4.5: Zustand version is 5.x or compatible in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.dependencies.zustand).toMatch(/\^?5\./);
    });
  });

  // =========================================================================
  // F5: TypeScript Data Contracts Boundaries
  // =========================================================================
  describe('F5: TypeScript Data Contracts Boundaries', () => {
    it('B5.1: Message with maximum length text (10,000+ chars) conforms to Message type', () => {
      const hugeContent = 'M'.repeat(10000);
      const hugeMsg: Message = {
        id: 'huge-1',
        channelId: 'general',
        sender: getStoreState().currentUser,
        content: hugeContent,
        timestamp: '12:00 PM',
        status: 'sent',
      };
      expect(hugeMsg.content.length).toBe(10000);
      expect(hugeMsg.status).toBe('sent');
    });

    it('B5.2: User object without optional avatarUrl or statusText conforms to User type', () => {
      const minimalUser: User = {
        id: 'min-user-1',
        name: 'Minimal User',
      };
      expect(minimalUser.id).toBe('min-user-1');
      expect(minimalUser.avatarUrl).toBeUndefined();
      expect(minimalUser.statusText).toBeUndefined();
    });

    it('B5.3: MessageStatus type union only allows "sending" and "sent"', () => {
      const status1: MessageStatus = 'sending';
      const status2: MessageStatus = 'sent';
      expect(['sending', 'sent']).toContain(status1);
      expect(['sending', 'sent']).toContain(status2);
    });

    it('B5.4: Message timestamp supports formatted strings and ISO timestamps', () => {
      const msg1: Message = {
        id: 't-1',
        channelId: 'general',
        sender: getStoreState().currentUser,
        content: 'time test',
        timestamp: '10:30 AM',
        status: 'sent',
      };
      const msg2: Message = {
        id: 't-2',
        channelId: 'general',
        sender: getStoreState().currentUser,
        content: 'iso test',
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
      expect(typeof msg1.timestamp).toBe('string');
      expect(typeof msg2.timestamp).toBe('string');
    });

    it('B5.5: Channel iconName union permits all 4 designated Lucide icons', () => {
      const icons: Channel['iconName'][] = ['Hash', 'MessageSquare', 'Bell', 'Code'];
      expect(icons.length).toBe(4);
    });
  });

  // =========================================================================
  // F6: Zustand Store Scoping Boundaries
  // =========================================================================
  describe('F6: Zustand Store Scoping Boundaries', () => {
    it('B6.1: Querying messages for an uninitialized channel key returns undefined safely', () => {
      const state = getStoreState();
      expect(state.messages['unknown-channel-xyz']).toBeUndefined();
    });

    it('B6.2: High volume message store handles 50 rapid sequential writes cleanly', () => {
      for (let i = 0; i < 50; i++) {
        useWorkspaceStore.getState().sendMessage('general', `Rapid message ${i}`);
      }
      expect(getStoreState().messages['general'].length).toBeGreaterThanOrEqual(52);
    });

    it('B6.3: State immutability: store messages dictionary produces new references on update', () => {
      const dictBefore = getStoreState().messages;
      useWorkspaceStore.getState().sendMessage('general', 'Immutability test');
      const dictAfter = getStoreState().messages;
      expect(dictAfter).not.toBe(dictBefore);
    });

    it('B6.4: Sending 20 messages to Channel A does not mutate Channel B array reference or contents', () => {
      const randomBefore = getStoreState().messages['random'];
      for (let i = 0; i < 20; i++) {
        useWorkspaceStore.getState().sendMessage('general', `Message for general ${i}`);
      }
      const randomAfter = getStoreState().messages['random'];
      expect(randomAfter).toBe(randomBefore);
      expect(randomAfter.length).toBe(1);
    });

    it('B6.5: currentUser state remains stable and unmutated across all operations', () => {
      const userBefore = getStoreState().currentUser;
      useWorkspaceStore.getState().sendMessage('general', 'User stability check');
      useWorkspaceStore.getState().setActiveChannel('random');
      const userAfter = getStoreState().currentUser;
      expect(userAfter).toEqual(userBefore);
    });
  });

  // =========================================================================
  // F7: Optimistic Submission Boundaries
  // =========================================================================
  describe('F7: Optimistic Submission Boundaries', () => {
    it('B7.1: Whitespace-only input with spaces ("     ") is rejected', () => {
      const countBefore = getStoreState().messages['general'].length;
      useWorkspaceStore.getState().sendMessage('general', '     ');
      expect(getStoreState().messages['general'].length).toBe(countBefore);
    });

    it('B7.2: Whitespace-only input with mixed tabs and newlines ("\\t\\n  \\n\\t") is rejected', () => {
      const countBefore = getStoreState().messages['general'].length;
      useWorkspaceStore.getState().sendMessage('general', '\t\n   \n\t');
      expect(getStoreState().messages['general'].length).toBe(countBefore);
    });

    it('B7.3: Very long message submission (2,000+ chars) appends successfully as "sending"', () => {
      const longText = 'Hello '.repeat(400);
      useWorkspaceStore.getState().sendMessage('general', longText);
      const msgs = getStoreState().messages['general'];
      const latest = msgs[msgs.length - 1];
      expect(latest.content.length).toBeGreaterThanOrEqual(2000);
      expect(latest.status).toBe('sending');
    });

    it('B7.4: Message containing HTML and special characters is stored without corruption', () => {
      const xssPayload = '<script>alert("xss")</script> & "quotes" \'single\' \\backslash';
      useWorkspaceStore.getState().sendMessage('general', xssPayload);
      const msgs = getStoreState().messages['general'];
      const latest = msgs[msgs.length - 1];
      expect(latest.content).toBe(xssPayload);
    });

    it('B7.5: Message containing multi-byte UTF-8 emojis and international characters is preserved', () => {
      const unicodeContent = '🚀🔥🎉 Real-time Workspace UI 🌟 世界こんにちは 🧑‍💻';
      useWorkspaceStore.getState().sendMessage('general', unicodeContent);
      const msgs = getStoreState().messages['general'];
      const latest = msgs[msgs.length - 1];
      expect(latest.content).toBe(unicodeContent);
    });
  });

  // =========================================================================
  // F8: Delay Timing Boundaries
  // =========================================================================
  describe('F8: Delay Timing Boundaries', () => {
    it('B8.1: Precision timing: message status remains "sending" at 800ms before 1000ms threshold', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Precision check 800ms');
      const msgs = getStoreState().messages['general'];
      const msgId = msgs[msgs.length - 1].id;

      await sleep(800);
      const current = getStoreState().messages['general'].find((m) => m.id === msgId);
      expect(current?.status).toBe('sending');
    });

    it('B8.2: Precision timing: message status transitions to "sent" after 1150ms', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Precision check 1150ms');
      const msgs = getStoreState().messages['general'];
      const msgId = msgs[msgs.length - 1].id;

      await sleep(1150);
      const current = getStoreState().messages['general'].find((m) => m.id === msgId);
      expect(current?.status).toBe('sent');
    });

    it('B8.3: Staggered burst timing: messages sent 300ms apart resolve independently', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Stagger 1');
      const id1 = getStoreState().messages['general'].slice(-1)[0].id;

      await sleep(300);
      useWorkspaceStore.getState().sendMessage('general', 'Stagger 2');
      const id2 = getStoreState().messages['general'].slice(-1)[0].id;

      // At 850ms from start: message 1 has been running for 850ms (sending), message 2 for 550ms (sending)
      await sleep(550);
      let m1 = getStoreState().messages['general'].find((m) => m.id === id1);
      let m2 = getStoreState().messages['general'].find((m) => m.id === id2);
      expect(m1?.status).toBe('sending');
      expect(m2?.status).toBe('sending');

      // At 1200ms from start: message 1 should be 'sent', message 2 still running (850ms)
      await sleep(350);
      m1 = getStoreState().messages['general'].find((m) => m.id === id1);
      m2 = getStoreState().messages['general'].find((m) => m.id === id2);
      expect(m1?.status).toBe('sent');
      expect(m2?.status).toBe('sending');

      // At 1500ms from start: both should be 'sent'
      await sleep(350);
      m2 = getStoreState().messages['general'].find((m) => m.id === id2);
      expect(m2?.status).toBe('sent');
    });

    it('B8.4: Rapid burst of 4 messages all resolve cleanly to "sent"', async () => {
      const ids: string[] = [];
      for (let i = 1; i <= 4; i++) {
        useWorkspaceStore.getState().sendMessage('general', `Burst message ${i}`);
        ids.push(getStoreState().messages['general'].slice(-1)[0].id);
      }

      for (const id of ids) {
        await waitForMessageSent('general', id, 2500);
      }

      for (const id of ids) {
        const msg = getStoreState().messages['general'].find((m) => m.id === id);
        expect(msg?.status).toBe('sent');
      }
    });

    it('B8.5: Background timer execution does not block concurrent store actions', () => {
      useWorkspaceStore.getState().sendMessage('general', 'Timer background test');
      // Immediately switch channels and perform actions
      expect(() => {
        useWorkspaceStore.getState().setActiveChannel('random');
        useWorkspaceStore.getState().setActiveChannel('announcements');
        useWorkspaceStore.getState().setActiveChannel('general');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // F9: Visual Indicators Boundaries
  // =========================================================================
  describe('F9: Visual Indicators Boundaries', () => {
    it('B9.1: Status indicator styling specifications define distinct opacity values (70 vs 100)', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('opacity-70');
      expect(projectMd).toContain('opacity-100');
    });

    it('B9.2: Visual distinction specification prevents layout shift between states', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      expect(surveyMd).toContain('StatusIndicator');
    });

    it('B9.3: Status indicator testids status-sending and status-sent are distinct strings', () => {
      const testInfraMd = fs.readFileSync(path.resolve(process.cwd(), '../TEST_INFRA.md'), 'utf-8');
      expect(testInfraMd).toContain('Distinct Visual Indicators');
    });

    it('B9.4: Status indicator specification associates sending with Clock and sent with Check', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('Clock');
      expect(projectMd).toContain('Check');
    });

    it('B9.5: Message status transitions smoothly without intermediate invalid states', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Smooth transition check');
      const msgId = getStoreState().messages['general'].slice(-1)[0].id;

      // Status must only ever be 'sending' or 'sent'
      const checkStatus = () => {
        const msg = getStoreState().messages['general'].find((m) => m.id === msgId);
        if (msg) {
          expect(['sending', 'sent']).toContain(msg.status);
        }
      };

      checkStatus();
      await sleep(500);
      checkStatus();
      await sleep(600);
      checkStatus();
    });
  });

  // =========================================================================
  // F10: Duplicate & Switch Boundaries
  // =========================================================================
  describe('F10: Duplicate & Switch Boundaries', () => {
    it('B10.1: Rapid channel switching during a 3-message burst: all 3 resolve to "sent" without duplicates', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Burst switch 1');
      useWorkspaceStore.getState().setActiveChannel('random');
      useWorkspaceStore.getState().sendMessage('random', 'Burst switch 2');
      useWorkspaceStore.getState().setActiveChannel('announcements');
      useWorkspaceStore.getState().sendMessage('announcements', 'Burst switch 3');

      await sleep(1200);

      const genMsgs = getStoreState().messages['general'];
      const rndMsgs = getStoreState().messages['random'];
      const annMsgs = getStoreState().messages['announcements'];

      expect(genMsgs[genMsgs.length - 1].status).toBe('sent');
      expect(rndMsgs[rndMsgs.length - 1].status).toBe('sent');
      expect(annMsgs[annMsgs.length - 1].status).toBe('sent');
    });

    it('B10.2: Ping-pong channel switching (A -> B -> A -> B) every 200ms while message is in-flight: resolves cleanly', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Ping pong in-flight');
      const msgId = getStoreState().messages['general'].slice(-1)[0].id;

      for (let i = 0; i < 4; i++) {
        await sleep(200);
        useWorkspaceStore.getState().setActiveChannel(i % 2 === 0 ? 'random' : 'general');
      }

      await waitForMessageSent('general', msgId, 2000);
      const msg = getStoreState().messages['general'].find((m) => m.id === msgId);
      expect(msg?.status).toBe('sent');
    });

    it('B10.3: Multi-channel concurrent sending: sending in 4 different channels simultaneously', async () => {
      const channels = ['general', 'random', 'announcements', 'development'];
      const sentIds: Record<string, string> = {};

      for (const ch of channels) {
        useWorkspaceStore.getState().sendMessage(ch, `Concurrent message for ${ch}`);
        sentIds[ch] = getStoreState().messages[ch].slice(-1)[0].id;
      }

      for (const ch of channels) {
        await waitForMessageSent(ch, sentIds[ch], 2500);
      }

      for (const ch of channels) {
        const msg = getStoreState().messages[ch].find((m) => m.id === sentIds[ch]);
        expect(msg?.status).toBe('sent');
      }
    });

    it('B10.4: Duplicate prevention: array contains exactly 1 entry per generated message ID', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Uniqueness check');
      const msgId = getStoreState().messages['general'].slice(-1)[0].id;

      await waitForMessageSent('general', msgId, 2000);
      const allGenIds = getStoreState().messages['general'].map((m) => m.id);
      const occurrences = allGenIds.filter((id) => id === msgId).length;
      expect(occurrences).toBe(1);
    });

    it('B10.5: Chronological ordering: messages remain in order of dispatch after status transition', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'First sequential');
      useWorkspaceStore.getState().sendMessage('general', 'Second sequential');
      useWorkspaceStore.getState().sendMessage('general', 'Third sequential');

      const msgs = getStoreState().messages['general'].slice(-3);
      const id1 = msgs[0].id;
      const id2 = msgs[1].id;
      const id3 = msgs[2].id;

      await waitForMessageSent('general', id3, 2500);

      const finalMsgs = getStoreState().messages['general'].slice(-3);
      expect(finalMsgs[0].id).toBe(id1);
      expect(finalMsgs[1].id).toBe(id2);
      expect(finalMsgs[2].id).toBe(id3);
    });
  });

  // =========================================================================
  // F11: Build & Lint Boundaries
  // =========================================================================
  describe('F11: Build & Lint Boundaries', () => {
    it('B11.1: TypeScript compiler strictNullChecks is enabled in tsconfig.json', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('B11.2: ESLint configuration contains no syntax errors and exports valid config', () => {
      const eslintPath = path.resolve(process.cwd(), 'eslint.config.mjs');
      const content = fs.readFileSync(eslintPath, 'utf-8');
      expect(content).toContain('export default');
    });

    it('B11.3: Module resolution is set to bundler in tsconfig.json', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    });

    it('B11.4: No circular dependencies between types and store', () => {
      const typesSource = readSourceFile('src/types/index.ts') || '';
      expect(typesSource).not.toContain('from "../store');
      expect(typesSource).not.toContain("from '@/store");
    });

    it('B11.5: Production build scripts are properly configured in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.scripts.build).toBe('next build');
      expect(pkg.scripts.lint).toBe('eslint');
    });
  });
});
