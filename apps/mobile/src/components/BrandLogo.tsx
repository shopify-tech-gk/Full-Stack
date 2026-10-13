import { memo, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { avatarColor } from '@/components/Avatar';
import { BRAND_LOGO_HEADERS, brandLogoUrl, type BrandLogoType } from '@/lib/brand-logos';
import { font } from '@/theme';

type Props = {
  name: string;
  /** Box the logo is fitted into (dp). */
  width: number;
  height: number;
};

const STAGES: BrandLogoType[] = ['logo', 'icon'];

/**
 * A brand's logo fitted into a box: the wordmark first, then its square icon, and finally a
 * styled name "wordmark" when Brandfetch has neither (or the brand's domain is unknown).
 */
function BrandLogoBase({ name, width, height }: Props) {
  const [stage, setStage] = useState(0);
  const scale = Math.min(PixelRatio.get(), 3);
  const type = STAGES[stage];
  const uri = type ? brandLogoUrl(name, type, { w: width * scale, h: height * scale }) : null;

  if (!uri) {
    return (
      <View style={[styles.box, { width, height }]}>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[styles.word, { color: avatarColor(name) }]}
        >
          {name}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri, headers: BRAND_LOGO_HEADERS }}
      recyclingKey={uri}
      style={{ width, height }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={160}
      accessibilityLabel={`${name} logo`}
      onError={() => setStage((s) => s + 1)}
    />
  );
}

export const BrandLogo = memo(BrandLogoBase);

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  word: {
    fontFamily: font.uiBold,
    fontSize: 12.5,
    lineHeight: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
