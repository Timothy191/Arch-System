import type { ReactNode } from 'react';

export interface Panel {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  image: string;
  video?: string;
  stats?: { label: string; value: string };
  status: string;
  icon: ReactNode;
  iconBgColor: string;
  primary: { href: string; label: string; icon: ReactNode };
  secondary?: { href: string; label: string; icon: ReactNode };
  assetOverline?: string;
  assetSubtitle?: string;
}
