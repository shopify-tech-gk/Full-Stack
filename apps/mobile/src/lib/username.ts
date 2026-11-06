import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

// v1.18 Usernames: the same rule as the server (3-20 letters, numbers, _ or ., starting with a
// letter) and a debounced "is it free?" check, shared by Register and the username sheet.

export const USERNAME_RX = /^[a-z][a-z0-9_.]{2,19}$/;

export type UsernameCheck = {
  state: 'idle' | 'checking' | 'ok' | 'bad';
  message: string | null;
};

export const cleanUsername = (raw: string) => raw.replace(/\s+/g, '').toLowerCase();

export const passwordRules = (password: string) => ({
  length: password.length >= 8,
  letter: /[a-z]/i.test(password),
  number: /\d/.test(password),
});

export const passwordOk = (password: string) => {
  const r = passwordRules(password);
  return r.length && r.letter && r.number;
};

export function useUsernameCheck(username: string): UsernameCheck {
  const [check, setCheck] = useState<UsernameCheck>({ state: 'idle', message: null });
  const seq = useRef(0);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    const mine = ++seq.current;
    if (!u) {
      setCheck({ state: 'idle', message: null });
      return;
    }
    if (!USERNAME_RX.test(u)) {
      setCheck({ state: 'bad', message: '3-20 letters, numbers, _ or . - start with a letter' });
      return;
    }
    setCheck({ state: 'checking', message: null });
    const t = setTimeout(() => {
      api.auth
        .checkUsername(u)
        .then((r) => {
          if (mine !== seq.current) return;
          setCheck(
            r.available
              ? { state: 'ok', message: `@${r.username} is available` }
              : { state: 'bad', message: r.reason ?? 'Not available' },
          );
        })
        .catch(() => mine === seq.current && setCheck({ state: 'idle', message: null }));
    }, 450);
    return () => clearTimeout(t);
  }, [username]);

  return check;
}
