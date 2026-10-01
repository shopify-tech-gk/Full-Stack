import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { storeCategories } from '@/lib/categories';

// Live inner pages keep the desktop category strip (no mobile grid).
export default function MyAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      {children}
    </>
  );
}
