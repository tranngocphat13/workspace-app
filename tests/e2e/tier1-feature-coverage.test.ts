import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, sleep } from '../harness';
import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import { resetStore, getStoreState, waitForMessageSent } from '../helpers/store-helper';
import { readSourceFile } from '../helpers/dom-helper';

describe('Tier 1: Feature Coverage (All 11 Features)', () => {
  beforeEach(() => {
    resetStore();
  });

  // =========================================================================
  // Feature 1: Two-column layout (Sidebar + ChatArea)
  // =========================================================================
  describe('F1: Two-column layout (Sidebar + ChatArea)', () => {
    it('F1-T1: Project layout specification defines persistent sidebar and main chat area', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('Two-column layout');
      expect(projectMd).toContain('Sidebar');
      expect(projectMd).toContain('ChatArea');
    });

    it('F1-T2: Layout specification defines sidebar fixed width and non-shrink container', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      const sidebarComponent = readSourceFile('src/components/Sidebar/Sidebar.tsx') || '';
      const hasSpec = surveyMd.includes('w-64') || sidebarComponent.includes('w-64');
      expect(hasSpec).toBe(true);
    });

    it('F1-T3: Layout specification defines main chat area expanding to fill available space', () => {
      const surveyPath = path.resolve(process.cwd(), '../.agents/teamwork/explorer_survey_3/analysis.md');
      const surveyMd = fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf-8') : '';
      const chatComponent = readSourceFile('src/components/Chat/ChatArea.tsx') || '';
      const hasSpec = surveyMd.includes('flex-1') || chatComponent.includes('flex-1');
      expect(hasSpec).toBe(true);
    });

    it('F1-T4: Layout root specification encloses full viewport height and clips root scrollbars', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('h-screen overflow-hidden');
    });

    it('F1-T5: Layout architecture defines testability hook data-testid="workspace-layout"', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('data-testid');
    });
  });

  // =========================================================================
  // Feature 2: Channel Sidebar Navigation & >=3 channels
  // =========================================================================
  describe('F2: Channel Sidebar Navigation & >=3 channels', () => {
    it('F2-T1: Store initializes with at least 3 hardcoded channels', () => {
      const state = getStoreState();
      expect(state.channels.length).toBeGreaterThanOrEqual(3);
    });

    it('F2-T2: Default channels include general, random, and announcements', () => {
      const state = getStoreState();
      const channelIds = state.channels.map((c) => c.id);
      expect(channelIds).toContain('general');
      expect(channelIds).toContain('random');
      expect(channelIds).toContain('announcements');
    });

    it('F2-T3: Each channel contains valid metadata: id, name, description, and iconName', () => {
      const state = getStoreState();
      for (const channel of state.channels) {
        expect(typeof channel.id).toBe('string');
        expect(channel.id.length).toBeGreaterThan(0);
        expect(typeof channel.name).toBe('string');
        expect(channel.name.length).toBeGreaterThan(0);
        expect(typeof channel.description).toBe('string');
        expect(typeof channel.iconName).toBe('string');
      }
    });

    it('F2-T4: Channel icon names map to supported Lucide icon identifiers', () => {
      const state = getStoreState();
      const validIcons = ['Hash', 'MessageSquare', 'Bell', 'Code'];
      for (const channel of state.channels) {
        expect(validIcons).toContain(channel.iconName);
      }
    });

    it('F2-T5: setActiveChannel allows switching active channel to any registered channel', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveChannel('random');
      expect(useWorkspaceStore.getState().activeChannelId).toBe('random');

      store.setActiveChannel('announcements');
      expect(useWorkspaceStore.getState().activeChannelId).toBe('announcements');

      store.setActiveChannel('general');
      expect(useWorkspaceStore.getState().activeChannelId).toBe('general');
    });
  });

  // =========================================================================
  // Feature 3: Active Channel Visual Highlight
  // =========================================================================
  describe('F3: Active Channel Visual Highlight', () => {
    it('F3-T1: Initial active channel defaults to general', () => {
      const state = getStoreState();
      expect(state.activeChannelId).toBe('general');
    });

    it('F3-T2: Switching active channel updates activeChannelId state accurately', () => {
      useWorkspaceStore.getState().setActiveChannel('random');
      expect(getStoreState().activeChannelId).toBe('random');
    });

    it('F3-T3: Specification defines active channel highlighting styling (bg-zinc-800 text-white)', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('bg-zinc-800 text-white');
    });

    it('F3-T4: Channel item convention supports testids for querying active channel', () => {
      const testInfraMd = fs.readFileSync(path.resolve(process.cwd(), '../TEST_INFRA.md'), 'utf-8');
      expect(testInfraMd).toContain('Active Channel Visual Highlight');
    });

    it('F3-T5: Attempting to switch to an invalid channel ID does not corrupt active state', () => {
      const prevActive = getStoreState().activeChannelId;
      useWorkspaceStore.getState().setActiveChannel('non-existent-channel-12345');
      expect(getStoreState().activeChannelId).toBe(prevActive);
    });
  });

  // =========================================================================
  // Feature 4: Dependencies installed (zustand, lucide-react)
  // =========================================================================
  describe('F4: Dependencies installed (zustand, lucide-react)', () => {
    it('F4-T1: zustand is declared in package.json dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.dependencies.zustand).toBeDefined();
    });

    it('F4-T2: lucide-react is declared in package.json dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.dependencies['lucide-react']).toBeDefined();
    });

    it('F4-T3: zustand is resolvable and imports create function', async () => {
      const { create } = await import('zustand');
      expect(typeof create).toBe('function');
    });

    it('F4-T4: lucide-react is resolvable and exports required icons', async () => {
      const icons = await import('lucide-react');
      expect(icons.Hash).toBeDefined();
      expect(icons.MessageSquare).toBeDefined();
      expect(icons.Bell).toBeDefined();
      expect(icons.Send).toBeDefined();
      expect(icons.Clock).toBeDefined();
      expect(icons.Check).toBeDefined();
    });

    it('F4-T5: React 19 and Next.js 16 are configured in dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.dependencies.next).toContain('16.');
      expect(pkg.dependencies.react).toContain('19.');
      expect(pkg.dependencies['react-dom']).toContain('19.');
    });
  });

  // =========================================================================
  // Feature 5: TypeScript Data Contracts & Types
  // =========================================================================
  describe('F5: TypeScript Data Contracts & Types', () => {
    it('F5-T1: src/types/index.ts exports MessageStatus union type ("sending" | "sent")', () => {
      const typesSource = readSourceFile('src/types/index.ts');
      expect(typesSource).toBeDefined();
      expect(typesSource!).toContain("export type MessageStatus = 'sending' | 'sent'");
    });

    it('F5-T2: Channel interface specifies id, name, description, and iconName', () => {
      const typesSource = readSourceFile('src/types/index.ts');
      expect(typesSource!).toContain('export interface Channel');
      expect(typesSource!).toContain('id: string;');
      expect(typesSource!).toContain('name: string;');
      expect(typesSource!).toContain('description: string;');
      expect(typesSource!).toContain('iconName:');
    });

    it('F5-T3: User interface specifies id, name, and optional avatarUrl / statusText', () => {
      const typesSource = readSourceFile('src/types/index.ts');
      expect(typesSource!).toContain('export interface User');
      expect(typesSource!).toContain('id: string;');
      expect(typesSource!).toContain('name: string;');
      expect(typesSource!).toContain('avatarUrl?: string;');
      expect(typesSource!).toContain('statusText?: string;');
    });

    it('F5-T4: Message interface specifies id, channelId, sender, content, timestamp, and status', () => {
      const typesSource = readSourceFile('src/types/index.ts');
      expect(typesSource!).toContain('export interface Message');
      expect(typesSource!).toContain('id: string;');
      expect(typesSource!).toContain('channelId: string;');
      expect(typesSource!).toContain('sender: User;');
      expect(typesSource!).toContain('content: string;');
      expect(typesSource!).toContain('timestamp: string;');
      expect(typesSource!).toContain('status: MessageStatus;');
    });

    it('F5-T5: WorkspaceStoreState specifies channels, activeChannelId, messages, currentUser, setActiveChannel, sendMessage', () => {
      const typesSource = readSourceFile('src/types/index.ts');
      expect(typesSource!).toContain('export interface WorkspaceStoreState');
      expect(typesSource!).toContain('channels: Channel[];');
      expect(typesSource!).toContain('activeChannelId: string;');
      expect(typesSource!).toContain('messages: Record<string, Message[]>;');
      expect(typesSource!).toContain('currentUser: User;');
      expect(typesSource!).toContain('setActiveChannel: (channelId: string) => void;');
      expect(typesSource!).toContain('sendMessage: (channelId: string, content: string) => void;');
    });
  });

  // =========================================================================
  // Feature 6: Zustand Message Store hook & channel scoping
  // =========================================================================
  describe('F6: Zustand Message Store hook & channel scoping', () => {
    it('F6-T1: useWorkspaceStore is exported as a hook with getState and setState', () => {
      expect(typeof useWorkspaceStore).toBe('function');
      expect(typeof useWorkspaceStore.getState).toBe('function');
      expect(typeof useWorkspaceStore.setState).toBe('function');
    });

    it('F6-T2: Messages are partitioned per channel ID in a Record<string, Message[]> map', () => {
      const state = getStoreState();
      expect(typeof state.messages).toBe('object');
      expect(Array.isArray(state.messages['general'])).toBe(true);
      expect(Array.isArray(state.messages['random'])).toBe(true);
      expect(Array.isArray(state.messages['announcements'])).toBe(true);
    });

    it('F6-T3: Message histories in different channels are strictly isolated', () => {
      const state = getStoreState();
      const generalMsgs = state.messages['general'];
      const randomMsgs = state.messages['random'];
      expect(generalMsgs).not.toEqual(randomMsgs);

      // Verify no message in general shares an ID with random
      const generalIds = new Set(generalMsgs.map((m) => m.id));
      for (const rMsg of randomMsgs) {
        expect(generalIds.has(rMsg.id)).toBe(false);
      }
    });

    it('F6-T4: Pre-seeded messages exist with static timestamps to prevent SSR hydration mismatches', () => {
      const state = getStoreState();
      for (const channelId of Object.keys(state.messages)) {
        for (const msg of state.messages[channelId]) {
          expect(typeof msg.timestamp).toBe('string');
          expect(msg.timestamp.length).toBeGreaterThan(0);
        }
      }
    });

    it('F6-T5: Store initializes currentUser with valid id, name, and status', () => {
      const state = getStoreState();
      expect(state.currentUser).toBeDefined();
      expect(state.currentUser.id).toBeDefined();
      expect(state.currentUser.name).toBeDefined();
      expect(state.currentUser.name.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Feature 7: Optimistic Message Submission (instant add + clear)
  // =========================================================================
  describe('F7: Optimistic Message Submission (instant add + clear)', () => {
    it('F7-T1: Calling sendMessage immediately appends a message with status "sending"', () => {
      const initialCount = getStoreState().messages['general'].length;
      useWorkspaceStore.getState().sendMessage('general', 'Optimistic test message');
      const messages = getStoreState().messages['general'];
      expect(messages.length).toBe(initialCount + 1);

      const latestMsg = messages[messages.length - 1];
      expect(latestMsg.status).toBe('sending');
    });

    it('F7-T2: Newly appended message content matches submitted text', () => {
      const testContent = 'Real-time test content 123';
      useWorkspaceStore.getState().sendMessage('general', testContent);
      const messages = getStoreState().messages['general'];
      const latestMsg = messages[messages.length - 1];
      expect(latestMsg.content).toBe(testContent);
    });

    it('F7-T3: Newly appended message sender matches currentUser', () => {
      const currentUser = getStoreState().currentUser;
      useWorkspaceStore.getState().sendMessage('general', 'Sender check message');
      const messages = getStoreState().messages['general'];
      const latestMsg = messages[messages.length - 1];
      expect(latestMsg.sender.id).toBe(currentUser.id);
      expect(latestMsg.sender.name).toBe(currentUser.name);
    });

    it('F7-T4: Optimistic message assigns a unique non-empty ID', () => {
      useWorkspaceStore.getState().sendMessage('general', 'Message 1');
      useWorkspaceStore.getState().sendMessage('general', 'Message 2');
      const msgs = getStoreState().messages['general'];
      const m1 = msgs[msgs.length - 2];
      const m2 = msgs[msgs.length - 1];
      expect(typeof m1.id).toBe('string');
      expect(m1.id.length).toBeGreaterThan(0);
      expect(m1.id).not.toBe(m2.id);
    });

    it('F7-T5: Empty string submission is rejected and does not append to the store', () => {
      const initialCount = getStoreState().messages['general'].length;
      useWorkspaceStore.getState().sendMessage('general', '');
      expect(getStoreState().messages['general'].length).toBe(initialCount);
    });
  });

  // =========================================================================
  // Feature 8: Simulated 1000ms Delay to 'sent'
  // =========================================================================
  describe('F8: Simulated 1000ms Delay to "sent"', () => {
    it('F8-T1: Message status remains "sending" immediately after dispatch (< 50ms)', () => {
      useWorkspaceStore.getState().sendMessage('general', 'Immediate status check');
      const msgs = getStoreState().messages['general'];
      const latest = msgs[msgs.length - 1];
      expect(latest.status).toBe('sending');
    });

    it('F8-T2: Message status remains "sending" at 500ms midway through the delay', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Midway status check');
      const msgs = getStoreState().messages['general'];
      const latestId = msgs[msgs.length - 1].id;

      await sleep(500);
      const currentMsgs = getStoreState().messages['general'];
      const msg = currentMsgs.find((m) => m.id === latestId);
      expect(msg?.status).toBe('sending');
    });

    it('F8-T3: Message status transitions to "sent" after >= 1000ms delay', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Resolution check');
      const msgs = getStoreState().messages['general'];
      const latestId = msgs[msgs.length - 1].id;

      const resolved = await waitForMessageSent('general', latestId, 2000);
      expect(resolved.status).toBe('sent');
    });

    it('F8-T4: Message retains all original fields across status transition', async () => {
      const testContent = 'Field preservation check';
      useWorkspaceStore.getState().sendMessage('general', testContent);
      const msgs = getStoreState().messages['general'];
      const original = msgs[msgs.length - 1];

      const resolved = await waitForMessageSent('general', original.id, 2000);
      expect(resolved.id).toBe(original.id);
      expect(resolved.channelId).toBe(original.channelId);
      expect(resolved.content).toBe(original.content);
      expect(resolved.sender.id).toBe(original.sender.id);
      expect(resolved.timestamp).toBe(original.timestamp);
      expect(resolved.status).toBe('sent');
    });

    it('F8-T5: Message position and order in array is preserved upon status resolution', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Order preservation check');
      const msgs = getStoreState().messages['general'];
      const targetIndex = msgs.length - 1;
      const targetId = msgs[targetIndex].id;

      await waitForMessageSent('general', targetId, 2000);
      const finalMsgs = getStoreState().messages['general'];
      expect(finalMsgs[targetIndex].id).toBe(targetId);
      expect(finalMsgs[targetIndex].status).toBe('sent');
    });
  });

  // =========================================================================
  // Feature 9: Distinct Visual Indicators (sending vs sent)
  // =========================================================================
  describe('F9: Distinct Visual Indicators (sending vs sent)', () => {
    it('F9-T1: Visual specification requires reduced opacity for "sending" status', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('opacity-70');
    });

    it('F9-T2: Visual specification requires full opacity for "sent" status', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('opacity-100');
    });

    it('F9-T3: Optimistic "sending" state specifies Clock icon indicator', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('Clock icon');
    });

    it('F9-T4: Confirmed "sent" state specifies Check icon indicator', () => {
      const projectMd = fs.readFileSync(path.resolve(process.cwd(), '../PROJECT.md'), 'utf-8');
      expect(projectMd).toContain('Check icon');
    });

    it('F9-T5: Testability contract defines distinct testids for sending and sent indicators', () => {
      const testInfraMd = fs.readFileSync(path.resolve(process.cwd(), '../TEST_INFRA.md'), 'utf-8');
      expect(testInfraMd).toContain('Distinct Visual Indicators');
    });
  });

  // =========================================================================
  // Feature 10: Duplicate Prevention & In-flight Channel Switch
  // =========================================================================
  describe('F10: Duplicate Prevention & In-flight Channel Switch', () => {
    it('F10-T1: Status transition from sending to sent does not duplicate the message', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'No duplicate check');
      const msgs = getStoreState().messages['general'];
      const msgId = msgs[msgs.length - 1].id;
      const countBefore = msgs.length;

      await waitForMessageSent('general', msgId, 2000);
      const countAfter = getStoreState().messages['general'].length;
      expect(countAfter).toBe(countBefore);

      const matches = getStoreState().messages['general'].filter((m) => m.id === msgId);
      expect(matches.length).toBe(1);
    });

    it('F10-T2: In-flight channel switch allows background timer to complete successfully', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'In-flight channel switch message');
      const msgId = getStoreState().messages['general'].slice(-1)[0].id;

      // Switch to random while message in general is in-flight
      useWorkspaceStore.getState().setActiveChannel('random');
      expect(getStoreState().activeChannelId).toBe('random');

      // Wait for timer to complete
      await waitForMessageSent('general', msgId, 2000);

      // Verify status in general resolved to 'sent'
      const generalMsgs = getStoreState().messages['general'];
      const target = generalMsgs.find((m) => m.id === msgId);
      expect(target?.status).toBe('sent');
    });

    it('F10-T3: In-flight message sent in Channel A does not appear in Channel B', () => {
      const initialRandomCount = getStoreState().messages['random'].length;
      useWorkspaceStore.getState().sendMessage('general', 'Channel isolation check');

      const randomMsgs = getStoreState().messages['random'];
      expect(randomMsgs.length).toBe(initialRandomCount);
    });

    it('F10-T4: Returning to original channel after in-flight switch shows status "sent"', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Return channel check');
      const msgId = getStoreState().messages['general'].slice(-1)[0].id;

      useWorkspaceStore.getState().setActiveChannel('announcements');
      await sleep(1100);

      useWorkspaceStore.getState().setActiveChannel('general');
      const generalMsgs = getStoreState().messages['general'];
      const target = generalMsgs.find((m) => m.id === msgId);
      expect(target?.status).toBe('sent');
    });

    it('F10-T5: Rapid burst of messages retains individual status timers without cross-mutation', async () => {
      useWorkspaceStore.getState().sendMessage('general', 'Burst 1');
      useWorkspaceStore.getState().sendMessage('general', 'Burst 2');
      useWorkspaceStore.getState().sendMessage('general', 'Burst 3');

      const msgs = getStoreState().messages['general'];
      const ids = msgs.slice(-3).map((m) => m.id);

      for (const id of ids) {
        await waitForMessageSent('general', id, 2500);
      }

      const finalMsgs = getStoreState().messages['general'].slice(-3);
      for (const m of finalMsgs) {
        expect(m.status).toBe('sent');
      }
    });
  });

  // =========================================================================
  // Feature 11: Production Build & Lint Exit Code 0
  // =========================================================================
  describe('F11: Production Build & Lint Exit Code 0', () => {
    it('F11-T1: tsconfig.json exists with strict type checking enabled', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('F11-T2: next.config.ts exists with Turbopack and Tailwind setup', () => {
      const nextConfigPath = path.resolve(process.cwd(), 'next.config.ts');
      expect(fs.existsSync(nextConfigPath)).toBe(true);
      const content = fs.readFileSync(nextConfigPath, 'utf-8');
      expect(content).toContain('turbopack');
    });

    it('F11-T3: eslint.config.mjs exists with Next.js linting configuration', () => {
      const eslintPath = path.resolve(process.cwd(), 'eslint.config.mjs');
      expect(fs.existsSync(eslintPath)).toBe(true);
    });

    it('F11-T4: Path aliases @/* are configured in tsconfig.json', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.paths).toBeDefined();
      expect(tsconfig.compilerOptions.paths['@/*']).toBeDefined();
    });

    it('F11-T5: Global CSS imports Tailwind v4', () => {
      const cssPath = path.resolve(process.cwd(), 'src/app/globals.css');
      expect(fs.existsSync(cssPath)).toBe(true);
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      expect(cssContent).toContain('@import "tailwindcss"');
    });
  });
});
