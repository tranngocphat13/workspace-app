'use client';

import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { validateFile, uploadAttachment } from '../../lib/storage';

export const MessageInput: React.FC = () => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const currentUser = useWorkspaceStore((state) => state.currentUser);
  const sendMessage = useWorkspaceStore((state) => state.sendMessage);
  const sendMessageWithAttachment = useWorkspaceStore(
    (state) => state.sendMessageWithAttachment
  );

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) || channels[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = content.trim();

    // If no text and no file, return
    if (!trimmed && !selectedFile) {
      return;
    }

    if (selectedFile && sendMessageWithAttachment) {
      try {
        setIsUploading(true);
        const attachment = await uploadAttachment(selectedFile, currentUser.id);
        await sendMessageWithAttachment(activeChannelId, trimmed, attachment);
        setContent('');
        setSelectedFile(null);
        setFileError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setFileError(errorMsg);
      } finally {
        setIsUploading(false);
      }
    } else if (trimmed) {
      sendMessage(activeChannelId, trimmed);
      setContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSendDisabled = (!content.trim() && !selectedFile) || isUploading;

  return (
    <form
      data-testid="chat-input-form"
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-800 bg-zinc-900/60 backdrop-blur-xs shrink-0 select-none space-y-2"
    >
      {/* File error toast */}
      {fileError && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
          <span>{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="text-red-400 hover:text-red-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected file preview pill */}
      {selectedFile && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 max-w-full">
          {selectedFile.type?.startsWith('image/') ? (
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate max-w-[200px] font-medium">
            {selectedFile.name}
          </span>
          <span className="text-[10px] text-zinc-400 shrink-0">
            ({(selectedFile.size / 1024).toFixed(0)} KB)
          </span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-zinc-400 hover:text-white p-0.5 ml-1"
            title="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative flex items-center">
        {/* Attachment upload button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain"
          className="hidden"
          data-testid="file-upload-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Attach file or image"
          aria-label="Attach file"
          className="absolute left-2.5 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          data-testid="message-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isUploading}
          placeholder={
            activeChannel?.isDm
              ? `Message @${activeChannel?.name}...`
              : `Message #${activeChannel?.name || 'general'}...`
          }
          className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-11 pr-12 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-transparent transition-all shadow-inner"
        />

        <button
          type="submit"
          data-testid="send-button"
          disabled={isSendDisabled}
          aria-label="Send message"
          className={`absolute right-2 p-2 rounded-lg transition-all flex items-center justify-center ${
            !isSendDisabled
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md'
              : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed opacity-50'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
};
