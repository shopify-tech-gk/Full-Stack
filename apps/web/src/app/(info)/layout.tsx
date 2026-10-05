import { CategoryBar } from '@/components/category/CategoryBar';
import { categoryBarMains } from '@/lib/category-taxonomy';

// Desktop category navigation (no mobile grid on inner pages).
export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      {children}
    </>
  );
}
