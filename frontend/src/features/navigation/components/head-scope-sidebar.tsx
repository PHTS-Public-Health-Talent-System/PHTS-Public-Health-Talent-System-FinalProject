'use client';

import { UnifiedSidebar, type SidebarConfig } from './unified-sidebar';
import { useAuth } from '@/components/providers/auth-provider';
import { useNavigation } from '@/features/navigation/hooks';
import { mapNavigationItems } from '@/features/navigation/navigation.mappers';

type HeadScopeSidebarProps = {
  role: 'head-ward' | 'head-dept';
  roleLabel: string;
  roleBgColor: SidebarConfig['roleBgColor'];
  defaultTitle: string;
};

const resolveInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.trim()?.charAt(0) ?? '';
  const last = lastName?.trim()?.charAt(0) ?? '';
  return first + last || '-';
};

export function HeadScopeSidebar({
  role,
  roleLabel,
  roleBgColor,
  defaultTitle,
}: HeadScopeSidebarProps) {
  const { user } = useAuth();
  const navigationQuery = useNavigation();

  const baseConfig: Omit<SidebarConfig, 'user'> = {
    role,
    roleLabel,
    roleBgColor,
    navigation: [],
    secondaryNavigation: [],
    secondaryLabel: 'งานของฉัน',
    notificationCount: 0,
  };

  const config: SidebarConfig = (() => {
    const nav = navigationQuery.data;
    const badges = nav?.badges;
    const firstName = user?.firstName ?? '';
    const lastName = user?.lastName ?? '';
    const displayName =
      nav?.user?.name || [firstName, lastName].filter(Boolean).join(' ').trim() || 'ผู้ใช้งาน';
    const title = nav?.user?.title || user?.position || defaultTitle;

    return {
      ...baseConfig,
      navigation: nav ? mapNavigationItems(nav.menu, badges) : [],
      secondaryNavigation: nav ? mapNavigationItems(nav.secondaryMenu, badges) : [],
      secondaryLabel: nav?.secondaryLabel || baseConfig.secondaryLabel,
      notificationCount: badges?.notifications ?? 0,
      user: {
        name: displayName,
        title,
        initials: resolveInitials(firstName, lastName),
      },
    };
  })();

  if (navigationQuery.isLoading || navigationQuery.isError) return null;
  if (config.navigation.length === 0 && (config.secondaryNavigation?.length ?? 0) === 0) return null;

  return <UnifiedSidebar config={config} />;
}
