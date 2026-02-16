import type { NavItem } from '@/features/navigation/components/unified-sidebar';
import type { NavigationItem, NavigationPayload } from './types';

export const mapNavigationItems = (
  items: NavigationItem[] | undefined,
  badges: NavigationPayload['badges'] | undefined,
): NavItem[] =>
  (items ?? []).map((item) => ({
    name: item.label,
    href: item.href,
    iconKey: item.iconKey,
    badge: item.badgeKey ? badges?.[item.badgeKey] ?? 0 : undefined,
  }));
