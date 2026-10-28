'use client';

import React, { useState } from 'react';
import type { Message } from '../../types';
import { StatusIndicator } from './StatusIndicator';

export interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const senderName = message.sender?.name || 'Anonymous';
  const initials = getInitials(senderName) || 'U';
  const isSending = message.status === 'sending';

  return (
    <div
      data-testid="message-item"
      data-message-id={message.id}
      data-status={message.status}
      className={`group flex items-start gap-3 p-2 rounded-lg transition-opacity ${
        isSending ? 'opacity-70 text-zinc-300' : 'opacity-100 text-zinc-100'
      }`}
    >
      <div className="relative shrink-0 mt-0.5">
        {message.sender?.avatarUrl && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.sender.avatarUrl}
            alt={senderName}
            onError={() => setImageError(true)}
            className="w-9 h-9 rounded-full object-cover border border-zinc-700/80 bg-zinc-800"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200 truncate">
            {senderName}
          </span>
          <span
            data-testid="message-timestamp"
            className="text-xs text-zinc-500"
          >
            {message.timestamp}
          </span>
          <StatusIndicator status={message.status} />
        </div>

        <p
          data-testid="message-content"
          className="text-sm break-words whitespace-pre-wrap leading-relaxed mt-1"
        >
          {message.content}
        </p>
      </div>
    </div>
  );
};
