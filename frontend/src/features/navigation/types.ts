export type NavigationBadgeKey = 'notifications' | 'pendingRequests' | 'pendingPayroll';

export type NavigationItem = {
  label: string;
  href: string;
  iconKey: string;
  badgeKey?: NavigationBadgeKey;
};

export type NavigationPayload = {
  user: {
    id: number;
    role: string;
    name: string;
    title: string;
  };
  badges: Record<NavigationBadgeKey, number>;
  menu: NavigationItem[];
  secondaryMenu?: NavigationItem[];
  secondaryLabel?: string;
};
