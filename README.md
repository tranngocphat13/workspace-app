# Real-time Workspace UI (`workspace-app`)

Modern Real-time Workspace Communication Platform built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand & Lucide React.

![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat&logo=tailwindcss)
![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=flat)

---

## 🚀 Features

- **Two-Column Slack/Discord-Style Layout**: Responsive layout featuring a channel sidebar and chat area.
- **Channel Switching**: Smooth navigation between multiple channels (`#general`, `#random`, `#announcements`) with channel-scoped message feeds.
- **Optimistic UI Updates**: Instant message rendering upon sending with state (`sending` ➔ `sent`).
- **Simulated Real-time Resolution**: Non-blocking asynchronous message state resolution with seamless background channel switching.
- **Zustand State Management**: Lightweight, typed in-memory client state store.
- **Zero Duplicates & Order Preservation**: Strict message immutability and stable ordering.
- **Comprehensive Test Suite**: End-to-end and adversarial test coverage included.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Icons**: Lucide React
- **Testing**: TSX test runner & comprehensive test suites

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # Main workspace layout (Sidebar + ChatArea)
│   └── globals.css
├── components/
│   ├── Chat/
│   │   ├── ChatArea.tsx       # Main chat viewport coordinator
│   │   ├── ChatHeader.tsx     # Channel header info
│   │   ├── MessageInput.tsx   # Input box with auto-clear & validation
│   │   ├── MessageItem.tsx    # Message bubble with sender and status
│   │   ├── MessageList.tsx    # Auto-scrolling message list
│   │   └── StatusIndicator.tsx# Sending vs. Sent visual indicator
│   └── Sidebar/
│       ├── ChannelItem.tsx    # Individual channel button with Lucide icon
│       ├── ChannelList.tsx    # List of active channels
│       ├── Sidebar.tsx        # Left sidebar navigation container
│       ├── SidebarHeader.tsx  # Workspace branding
│       └── UserFooter.tsx     # Current user profile badge
├── store/
│   └── useWorkspaceStore.ts   # Zustand store for channels, messages, and active user
└── types/
    └── index.ts               # Shared TypeScript data contracts
```

---

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/tranngocphat13/workspace-app.git

# Navigate to the workspace directory
cd workspace-app

# Install dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

---

## 📄 License

MIT License.
