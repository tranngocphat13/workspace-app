'use client';

import React from 'react';
import { Clock, Check, AlertCircle } from 'lucide-react';
import type { MessageStatus } from '../../types';

export interface StatusIndicatorProps {
  status: MessageStatus;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  if (status === 'sending') {
    return (
      <span
        data-testid="status-sending"
        title="Sending..."
        className="inline-flex items-center text-zinc-400"
      >
        <Clock className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
        <span className="sr-only">Sending...</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        data-testid="status-failed"
        title="Failed to send"
        className="inline-flex items-center text-red-400"
      >
        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="sr-only">Failed to send</span>
      </span>
    );
  }

  return (
    <span
      data-testid="status-sent"
      title="Sent"
      className="inline-flex items-center text-blue-400"
    >
      <Check className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="sr-only">Sent</span>
    </span>
  );
};
