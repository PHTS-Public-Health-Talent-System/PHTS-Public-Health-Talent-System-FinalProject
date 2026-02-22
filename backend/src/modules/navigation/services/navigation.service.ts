/**
 * navigation module - business logic
 *
 */
import { UserRole } from "@/types/auth.js";
import { NotificationService } from "@/modules/notification/services/notification.service.js";
import { AuthRepository } from "@/modules/auth/repositories/auth.repository.js";
import {
  getPendingPayrollCount,
  getPendingRequestCount,
} from "@/modules/dashboard/services/counters.service.js";
import {
  buildMenu,
  type NavigationBadgeKey,
  type NavigationItem,
} from "@/modules/navigation/services/navigation.menu.js";

export type { NavigationBadgeKey, NavigationItem };

export type NavigationPayload = {
  user: {
    id: number;
    role: UserRole;
    name: string;
    title: string;
  };
  badges: Record<NavigationBadgeKey, number>;
  menu: NavigationItem[];
  secondaryMenu?: NavigationItem[];
  secondaryLabel?: string;
};

export const getNavigationPayload = async (params: {
  userId: number;
  citizenId: string;
  role: UserRole;
}): Promise<NavigationPayload> => {
  const { userId, citizenId, role } = params;

  const [unreadCount, profile, pendingRequests, pendingPayroll] = await Promise.all([
    NotificationService.getUnreadCount(userId),
    AuthRepository.findEmployeeProfileByCitizenId(citizenId),
    getPendingRequestCount({ role, userId }),
    getPendingPayrollCount(role),
  ]);

  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const title = profile?.position ?? "";

  const menuConfig = buildMenu(role);

  return {
    user: {
      id: userId,
      role,
      name: name || "ผู้ใช้งาน",
      title: title || "ผู้ใช้งาน",
    },
    badges: {
      notifications: unreadCount ?? 0,
      pendingRequests: pendingRequests ?? 0,
      pendingPayroll: pendingPayroll ?? 0,
    },
    menu: menuConfig.menu,
    secondaryMenu: menuConfig.secondaryMenu,
    secondaryLabel: menuConfig.secondaryLabel,
  };
};
