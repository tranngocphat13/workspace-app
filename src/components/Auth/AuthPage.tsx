'use client';

import React, { useState } from 'react';
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

type Mode = 'login' | 'register';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const { login, register, isLoading, error } = useAuthStore();

  function switchMode(next: Mode) {
    setMode(next);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
    useAuthStore.setState({ error: null });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setValidationError('Tên phải có ít nhất 2 ký tự.');
        return;
      }
      if (password.length < 6) {
        setValidationError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setValidationError('Mật khẩu xác nhận không khớp.');
        return;
      }
      await register(name, email, password);
    } else {
      await login(email, password);
    }
  }

  const displayError = validationError || error;

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-md bg-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-7 h-7 text-yellow-300" />
            <span className="text-2xl font-bold text-white tracking-tight">
              WorkSpace
            </span>
          </div>
          <p className="text-violet-200 text-sm">
            {mode === 'login'
              ? 'Chào mừng trở lại!'
              : 'Tạo tài khoản mới'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-700">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'text-violet-400 border-b-2 border-violet-400 bg-zinc-800'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-850'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mode === 'register'
                ? 'text-violet-400 border-b-2 border-violet-400 bg-zinc-800'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Đăng ký
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          {/* Name — register only */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                Họ và tên
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                autoFocus
                className="w-full bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus={mode === 'login'}
              className="w-full bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Ít nhất 6 ký tự' : '••••••••'}
                required
                className="w-full bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password — register only */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                Xác nhận mật khẩu
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                required
                className="w-full bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
          )}

          {/* Error / Notification */}
          {displayError && (
            <p
              className={`text-sm rounded-lg px-4 py-2.5 border ${
                displayError.includes('thành công')
                  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}
            >
              {displayError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
              </>
            ) : mode === 'login' ? (
              'Đăng nhập'
            ) : (
              'Tạo tài khoản'
            )}
          </button>

          {/* Demo hint */}
          {mode === 'login' && (
            <p className="text-center text-xs text-zinc-500 pt-1">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-violet-400 hover:text-violet-300 underline transition"
              >
                Đăng ký ngay
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
