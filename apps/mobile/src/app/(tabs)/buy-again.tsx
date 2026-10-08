import { View, StyleSheet } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { WishlistList } from '@/components/WishlistList';
import { SwipeTabs } from '@/components/SwipeTabs';
import { colors } from '@/theme';

export default function BuyAgainScreen() {
  return (
    <SwipeTabs index={1} style={styles.screen}>
      <AppHeader />
      <View style={styles.body}>
        <WishlistList />
      </View>
    </SwipeTabs>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { flex: 1 },
});
