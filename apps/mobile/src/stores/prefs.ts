import { useEffect, useState } from 'react';
import { getJSON, setJSON } from '@/lib/storage';

// A small persisted UI preference: how the home product rails are presented.
//  - 'stacked': the native mobile design (one horizontal rail per section).
//  - 'tabbed':  the desktop-style tabbed slider (all rails behind tabs).
export type RailLayout = 'stacked' | 'tabbed';

const KEY = 'ym_rail_layout';

export function useRailLayout(): [RailLayout, (next: RailLayout) => void] {
  const [layout, setLayout] = useState<RailLayout>('stacked');

  useEffect(() => {
    void getJSON<RailLayout>(KEY).then((v) => {
      if (v === 'stacked' || v === 'tabbed') setLayout(v);
    });
  }, []);

  const update = (next: RailLayout) => {
    setLayout(next);
    void setJSON(KEY, next);
  };

  return [layout, update];
}
