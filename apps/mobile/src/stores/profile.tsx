import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The profile photo is a personalisation stored ON THE DEVICE (the auth API has no avatar field):
// the picked image's local URI is persisted in AsyncStorage and shown in the account icon/screen.
const KEY = 'ym.profile.avatarUri';

interface AvatarContextValue {
  uri: string | null;
  setAvatar: (uri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((value) => active && setUri(value))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setAvatar = async (next: string) => {
    setUri(next);
    try {
      await AsyncStorage.setItem(KEY, next);
    } catch {
      /* best-effort persistence */
    }
  };

  const removeAvatar = async () => {
    setUri(null);
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* best-effort */
    }
  };

  return (
    <AvatarContext.Provider value={{ uri, setAvatar, removeAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar(): AvatarContextValue {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('useAvatar must be used within an AvatarProvider');
  return ctx;
}
