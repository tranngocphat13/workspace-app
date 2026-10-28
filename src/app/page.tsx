'use client';

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/Chat';
import { AuthPage } from '../components/Auth';
import { useAuthStore } from '../store/useAuthStore';

export default function Home() {
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Loading state during SSR and initial hydration to prevent mismatch
  if (!isInitialized) {
    return (
      <div className="h-screen h-dvh flex items-center justify-center bg-zinc-900 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Not logged in → show auth screen
  if (!user) {
    return <AuthPage />;
  }

  // Logged in → show workspace
  return (
    <div
      className="h-screen h-dvh flex overflow-hidden bg-zinc-900 text-zinc-100"
      data-testid="workspace-layout"
    >
      <Sidebar />
      <ChatArea />
    </div>
  );
}
