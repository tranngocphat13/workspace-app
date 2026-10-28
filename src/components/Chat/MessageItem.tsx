'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Pencil, Trash2, Check, X, FileText, Download, ExternalLink } from 'lucide-react';
import type { Message } from '../../types';
import { StatusIndicator } from './StatusIndicator';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getSignedUrl, isStoragePath } from '../../lib/storage';

export interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const rawAttachmentUrl = message.attachment?.url;
  const isPath = rawAttachmentUrl ? isStoragePath(rawAttachmentUrl) : false;

  // Resolved URL for private-bucket paths (fetched as 1-hour signed URL).
  // For legacy public / data: URLs, rawAttachmentUrl is used directly.
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [attachmentUrlExpired, setAttachmentUrlExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!rawAttachmentUrl || !isPath) {
      return;
    }

    getSignedUrl(rawAttachmentUrl).then((url) => {
      if (cancelled) return;
      if (url) {
        setSignedUrl(url);
      } else {
        setAttachmentUrlExpired(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rawAttachmentUrl, isPath]);

  const resolvedAttachmentUrl = isPath ? signedUrl : rawAttachmentUrl || null;

  const currentUser = useWorkspaceStore((state) => state.currentUser);
  const editMessage = useWorkspaceStore((state) => state.editMessage);
  const deleteMessage = useWorkspaceStore((state) => state.deleteMessage);
  const retryMessage = useWorkspaceStore((state) => state.retryMessage);

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
  const isFailed = message.status === 'failed';
  const isOwnMessage = currentUser?.id === message.sender?.id;

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    await editMessage(message.channelId, message.id, trimmed);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      await deleteMessage(message.channelId, message.id);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div
      data-testid="message-item"
      data-message-id={message.id}
      data-status={message.status}
      className={`group relative flex items-start gap-3 p-2 rounded-lg transition-opacity ${
        isSending
          ? 'opacity-70 text-zinc-300'
          : isFailed
          ? 'opacity-100 text-zinc-100 border border-red-500/30 bg-red-950/20'
          : 'opacity-100 text-zinc-100 hover:bg-zinc-800/40'
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

          {message.isEdited && (
            <span
              data-testid="message-edited"
              className="text-[11px] text-zinc-500 italic select-none"
              title="This message was edited"
            >
              (edited)
            </span>
          )}

          {isFailed && (
            <button
              type="button"
              data-testid="retry-button"
              onClick={() => retryMessage(message.channelId, message.id)}
              className="ml-2 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
              title="Retry sending"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}

          {/* Action buttons on hover for message owner */}
          {isOwnMessage && !isSending && !isEditing && (
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditContent(message.content);
                  setIsEditing(true);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title="Delete message"
                aria-label="Delete message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
              <span className="text-[11px] text-zinc-500 ml-1">
                Press Enter to save, Esc to cancel
              </span>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
              <p
                data-testid="message-content"
                className="text-sm break-words whitespace-pre-wrap leading-relaxed mt-1"
              >
                {message.content}
              </p>
            )}

            {/* Attachment preview / download link */}
            {message.attachment && (
              <div className="mt-2">
                {/* Show a subtle notice while the signed URL is being fetched */}
                {!resolvedAttachmentUrl && !attachmentUrlExpired && (
                  <p className="text-xs text-zinc-500 italic">Loading attachment…</p>
                )}

                {/* Graceful expired / unavailable state */}
                {attachmentUrlExpired && (
                  <div className="inline-flex items-center gap-2 p-2 rounded-lg border border-zinc-700/60 bg-zinc-800/60 text-xs text-zinc-400">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="font-medium text-zinc-300">{message.attachment.name}</span>
                      {' — '}attachment unavailable (link expired or access denied)
                    </span>
                  </div>
                )}

                {resolvedAttachmentUrl && (
                  <>
                    {message.attachment.type.startsWith('image/') ? (
                      <div className="max-w-xs sm:max-w-sm rounded-lg overflow-hidden border border-zinc-700/80 bg-zinc-800/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolvedAttachmentUrl}
                          alt={message.attachment.name}
                          className="max-h-60 w-auto object-cover rounded-t-lg"
                        />
                        <div className="p-2 flex items-center justify-between text-xs text-zinc-300">
                          <span className="truncate max-w-[180px] font-medium">
                            {message.attachment.name}
                          </span>
                          <a
                            href={resolvedAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 ml-2"
                            title="Open image"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-3 p-2.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 max-w-sm">
                        <div className="p-2 rounded bg-blue-950/60 text-blue-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {message.attachment.name}
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            {formatFileSize(message.attachment.size)}
                          </p>
                        </div>
                        <a
                          href={resolvedAttachmentUrl}
                          download={message.attachment.name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
