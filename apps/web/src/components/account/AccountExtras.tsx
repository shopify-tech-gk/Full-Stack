'use client';

import { useEffect, useRef, useState } from 'react';
import { AtSign, Camera, KeyRound, Loader2, Lock, Trash2 } from 'lucide-react';
import { ApiError, authUserLabel, type AuthUser } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { applyUserUpdate, useSession } from '@/lib/session';
import { cleanUsername, passwordOk, useUsernameCheck } from '@/lib/username';
import { PasswordRules, UsernameHint } from './PasswordAuthForms';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SMALL, Banner, INPUT, Panel } from './ui';

/** Longest side of the stored profile photo (the server caps the data URL at ~450 KB). */
const AVATAR_SIDE = 320;

/** Resizes a picked image to a square-ish small JPEG data URL. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Not an image'));
      el.src = url;
    });
    // Centre-crop to a square, then scale down.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(AVATAR_SIDE, side);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function initials(user: AuthUser): string {
  const base = user.name?.trim() || user.username || authUserLabel(user);
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Profile header: photo (upload / change / remove), name, username. */
export function ProfileCard() {
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.auth
      .getAvatar()
      .then((r) => setAvatar(r.avatar))
      .catch(() => setAvatar(null));
  }, []);

  if (!user) return null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const data = await toAvatarDataUrl(file);
      const saved = await api.auth.setAvatar(data);
      setAvatar(saved.avatar);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That photo couldn’t be used. Try a JPG or PNG.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.auth.removeAvatar();
      setAvatar(null);
    } catch {
      setError('Could not remove the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-[20px] overflow-hidden rounded-[16px] border border-catalog-rule bg-white shadow-rail-card">
      <div className="h-[72px] bg-[linear-gradient(135deg,#0142aa,#0d66ad_60%,#1e88e5)]" />
      <div className="flex flex-wrap items-end gap-[18px] px-[22px] pb-[18px]">
        <div className="relative -mt-[44px]">
          <span className="flex size-[96px] items-center justify-center overflow-hidden rounded-full border-[4px] border-white bg-[#eef3fc] font-ui text-[30px] font-semibold text-brand shadow-rail-card">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              initials(user)
            )}
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label={avatar ? 'Change profile photo' : 'Add profile photo'}
            className="absolute bottom-[2px] right-[2px] flex size-[32px] items-center justify-center rounded-full border-[3px] border-white bg-brand text-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-[14px] animate-spin" /> : <Camera aria-hidden="true" className="size-[14px]" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 flex-1 pb-[4px] font-ui">
          <p className="truncate text-[20px] font-semibold text-heading">{user.name || authUserLabel(user)}</p>
          <p className="text-[14px] text-ink-muted">
            {user.username ? `@${user.username}` : 'No username yet'}
          </p>
        </div>
        {avatar ? (
          <button type="button" onClick={() => void remove()} disabled={busy} className={BTN_SMALL}>
            <Trash2 aria-hidden="true" className="size-[14px]" /> Remove photo
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="px-[22px] pb-[14px]">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}
    </section>
  );
}

/** v1.18 Sign-in & security: the username (set once) and a password for username login. */
export function LoginSecurityPanel() {
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState<'username' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const uname = cleanUsername(username);
  const check = useUsernameCheck(editing === 'username' ? uname : '');

  if (!user) return null;

  const save = async (body: { username?: string; password?: string }, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      applyUserUpdate(await api.auth.setLogin(body));
      setEditing(null);
      setUsername('');
      setPassword('');
      setMessage({ tone: 'success', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const row = (Icon: typeof AtSign, label: string, value: React.ReactNode, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-[14px] border-b border-catalog-rule py-[14px] font-ui last:border-0">
      <span className="flex size-[40px] items-center justify-center rounded-[10px] bg-[#eef3fc] text-brand">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-muted">{label}</p>
        <p className="text-[15px] font-semibold text-heading">{value}</p>
      </div>
      {action}
    </div>
  );

  return (
    <Panel title="Sign-in & security">
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {row(
        AtSign,
        'Username',
        user.username ? `@${user.username}` : <span className="font-normal text-ink-muted">Not set</span>,
        user.username ? (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-[#f1f5f9] px-[10px] py-[3px] font-ui text-[12px] font-semibold text-ink-muted">
            <Lock aria-hidden="true" className="size-[12px]" /> Permanent
          </span>
        ) : editing !== 'username' ? (
          <button type="button" onClick={() => setEditing('username')} className={BTN_SMALL}>
            Choose username
          </button>
        ) : null,
      )}
      {editing === 'username' && !user.username ? (
        <div className="mb-[8px] rounded-[12px] bg-[#f6f8fb] p-[14px]">
          <label htmlFor="sec-username" className="mb-[6px] block font-ui text-[13.5px] font-semibold text-heading">
            New username
          </label>
          <input id="sec-username" value={username} onChange={(e) => setUsername(cleanUsername(e.target.value))} maxLength={20} autoComplete="username" className={INPUT} />
          <UsernameHint state={check.state} message={check.message} />
          <div className="mt-[12px] flex gap-[8px]">
            <button
              type="button"
              disabled={busy || check.state !== 'ok'}
              onClick={() => void save({ username: uname }, `Your username is now @${uname}.`)}
              className={BTN_PRIMARY}
            >
              {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              Save username
            </button>
            <button type="button" onClick={() => setEditing(null)} className={BTN_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {user.username
        ? row(
            KeyRound,
            'Password',
            user.hasPassword ? '••••••••' : <span className="font-normal text-ink-muted">Not set - OTP login only</span>,
            editing !== 'password' ? (
              <button type="button" onClick={() => setEditing('password')} className={BTN_SMALL}>
                {user.hasPassword ? 'Change password' : 'Set password'}
              </button>
            ) : null,
          )
        : null}
      {editing === 'password' ? (
        <div className="rounded-[12px] bg-[#f6f8fb] p-[14px]">
          <label htmlFor="sec-password" className="mb-[6px] block font-ui text-[13.5px] font-semibold text-heading">
            New password
          </label>
          <input id="sec-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={INPUT} />
          <PasswordRules password={password} />
          <div className="mt-[12px] flex gap-[8px]">
            <button
              type="button"
              disabled={busy || !passwordOk(password)}
              onClick={() => void save({ password }, 'Password saved - you can log in with your username now.')}
              className={BTN_PRIMARY}
            >
              {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              Save password
            </button>
            <button type="button" onClick={() => setEditing(null)} className={BTN_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {!user.username ? (
        <p className="mt-[8px] font-ui text-[13px] text-ink-muted">
          Choose a username to also log in with a password instead of an OTP.
        </p>
      ) : null}
    </Panel>
  );
}
