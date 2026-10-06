// YouMart RN theme: brand tokens come straight from @youmart/shared-client (the SAME values the
// web uses), so the app matches the brand exactly. RN StyleSheet instead of Tailwind.
import { colors, radii } from '@youmart/shared-client';

export { colors, radii };

/** Font families registered in app/_layout.tsx via @expo-google-fonts (the live brand fonts). */
export const font = {
  body: 'Arimo_400Regular',
  bodyBold: 'Arimo_700Bold',
  ui: 'Outfit_400Regular',
  uiMedium: 'Outfit_500Medium',
  uiSemibold: 'Outfit_600SemiBold',
  uiBold: 'Outfit_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
