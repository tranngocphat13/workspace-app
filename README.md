# Real-time Workspace UI (`workspace-app`)

Modern Real-time Workspace Communication Platform built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand, Lucide React, and Supabase (Auth, PostgreSQL with Row Level Security & Realtime Channels).

![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat&logo=tailwindcss)
![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=flat)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Realtime-3ecf8e?style=flat&logo=supabase)

---

## 🚀 Features

- **Two-Column Slack/Discord-Style Layout**: Responsive layout featuring a channel sidebar and chat area.
- **Channel Switching & Scoping**: Smooth navigation between multiple channels (`#general`, `#random`, `#announcements`, `#development`) with strictly isolated channel-scoped message streams.
- **Supabase Authentication**: Native authentication workflow (email/password sign-up, sign-in, sign-out) with session persistence and auto-recovery on page reload.
- **State Isolation & Memory Security**: Clean state and cache purging on logout or account switch, preventing cross-account data bleed and post-logout cache resurrection.
- **Row Level Security (RLS)**: Fine-grained PostgreSQL access control protecting messages and channels, anti-spoofing enforcement (`sender_id = auth.uid()`), and anti-recursion helper functions.
- **Real-time Message Streaming**: Live WebSocket synchronization via Supabase Realtime channel subscriptions scoped per active channel.
- **Deterministic Deduplication**: Client-generated `client_message_id` reconciles optimistic messages with server confirmations, eliminating duplicate chat bubbles.
- **Optimistic UI Updates**: Immediate message dispatch in `sending` status transitioning to `sent` on confirmation, or `failed` with visual distinction.
- **Idempotent Retry Resilience**: Inline retry button recovering from network timeouts or PostgreSQL `23505` (unique constraint) conflicts.
- **Dual-Mode Offline Safety**: Seamless offline fallback mode when environment credentials are not present, ensuring 100% test pass rate without external dependencies.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library**: React 19
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Backend / Database**: Supabase (PostgreSQL, GoTrue Auth, Realtime)
- **Icons**: Lucide React
- **Testing**: TSX runner, Jest/DOM harnesses & 4-tier comprehensive test suites

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # Workspace coordinator with auth guard & session recovery
│   └── globals.css
├── components/
│   ├── Auth/
│   │   └── AuthPage.tsx       # Sign-in and sign-up form with input validation
│   ├── Chat/
│   │   ├── ChatArea.tsx       # Main chat viewport coordinator & realtime subscription
│   │   ├── ChatHeader.tsx     # Channel header info and topic
│   │   ├── MessageInput.tsx   # Message input box with auto-clear & validation
│   │   ├── MessageItem.tsx    # Message bubble with sender, status & retry button
│   │   ├── MessageList.tsx    # Auto-scrolling message stream
│   │   └── StatusIndicator.tsx# Sending (Clock), Sent (Check), Failed (AlertCircle) indicators
│   └── Sidebar/
│       ├── ChannelItem.tsx    # Channel button with Lucide icon
│       ├── ChannelList.tsx    # List of active channels
│       ├── Sidebar.tsx        # Left sidebar navigation container
│       ├── SidebarHeader.tsx  # Workspace branding & header
│       └── UserFooter.tsx     # Active user profile badge & sign-out trigger
├── lib/
│   └── supabase.ts            # Typed Supabase client & message data mapper
├── store/
│   ├── useAuthStore.ts        # Zustand store for Supabase Auth & session lifecycle
│   └── useWorkspaceStore.ts   # Zustand store for channels, messages, deduplication & retries
└── types/
    └── index.ts               # Shared TypeScript data models and database contracts
supabase/
└── migrations/
    └── 20261028000000_initial_schema.sql # Production PostgreSQL migration & RLS schema
```

---

## 📚 Supabase Backend Setup

For detailed, step-by-step instructions on setting up Supabase (Cloud Dashboard or Local Docker CLI), executing database migrations, configuring RLS, and setting up authentication, please consult the setup guide:

👉 **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

---

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm, yarn, or pnpm
- (Optional) Supabase project credentials for live backend synchronization

### Installation

```bash
# Clone the repository
git clone https://github.com/tranngocphat13/workspace-app.git

# Navigate to the workspace directory
cd workspace-app

# Install dependencies
npm install
```

### Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Note**: If `.env.local` is omitted, the application operates in **safe offline mode** with local storage and simulated delays, allowing immediate testing and evaluation.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing

Run all test suites and static analysis checks:

```bash
# 1. ESLint check (must exit 0 with 0 errors)
npx eslint src

# 2. TypeScript compilation check (must exit 0 with 0 errors)
npx tsc --noEmit

# 3. Next.js production build check
npm run build

# 4. Master regression suite (122 tests across Tier 1 - 4)
npm test

# 5. Targeted Supabase Auth unit tests
npx tsx tests/supabase-auth.test.ts

# 6. Real-time chat sync, deduplication & retry resilience tests
npx tsx tests/realtime-chat-sync.test.ts

# 7. Comprehensive end-to-end Supabase integration test suite
npx tsx tests/supabase-integration.test.ts
```

---

## 📄 License

MIT License.
