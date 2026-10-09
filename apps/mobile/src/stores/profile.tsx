import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';

// The profile photo belongs to the ACCOUNT (auth-service `avatar`), so it follows the customer
// across devices and sign-ins and never leaks to whoever signs in next on this phone. Photos are
// resized to a small square JPEG on-device before upload. Guests have no photo (initials avatar).
const LEGACY_KEY = 'ym.profile.avatarUri';
const SIZE = 320;

interface AvatarContextValue {
  /** Image URI to show (a data URL from the account), or null for the initials avatar. */
  uri: string | null;
  saving: boolean;
  setAvatar: (localUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const [uri, setUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The old device-only photo must not survive into anyone's account view.
  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
  }, []);

  // Load the signed-in account's photo; clear it on sign-out or account switch.
  useEffect(() => {
    let active = true;
    setUri(null);
    if (!userId) return;
    api.auth
      .getAvatar()
      .then(({ avatar }) => active && setUri(avatar))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const setAvatar = useCallback(
    async (localUri: string) => {
      if (!userId) return;
      const previous = uri;
      setUri(localUri); // instant preview while it uploads
      setSaving(true);
      try {
        const rendered = await ImageManipulator.manipulate(localUri)
          .resize({ width: SIZE, height: SIZE })
          .renderAsync();
        const saved = await rendered.saveAsync({
          compress: 0.72,
          format: SaveFormat.JPEG,
          base64: true,
        });
        if (!saved.base64) throw new Error('No image data');
        const { avatar } = await api.auth.setAvatar(`data:image/jpeg;base64,${saved.base64}`);
        setUri(avatar);
      } catch {
        setUri(previous);
        Alert.alert('Could not update photo', 'Please check your connection and try again.');
      } finally {
        setSaving(false);
      }
    },
    [userId, uri],
  );

  const removeAvatar = useCallback(async () => {
    if (!userId) return;
    const previous = uri;
    setUri(null);
    try {
      await api.auth.removeAvatar();
    } catch {
      setUri(previous);
      Alert.alert('Could not remove photo', 'Please try again.');
    }
  }, [userId, uri]);

  return (
    <AvatarContext.Provider value={{ uri, saving, setAvatar, removeAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar(): AvatarContextValue {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('useAvatar must be used within an AvatarProvider');
  return ctx;
}
