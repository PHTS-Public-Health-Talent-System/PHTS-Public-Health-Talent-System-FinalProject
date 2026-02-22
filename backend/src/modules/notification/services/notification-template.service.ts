import { NotificationType } from "@/modules/notification/entities/notification.entity.js";

export type NotificationTemplateKey =
  | "WORKFORCE_LICENSE_EXPIRED_USER"
  | "WORKFORCE_LICENSE_RESTORED_USER"
  | "WORKFORCE_LICENSE_EXPIRING_USER"
  | "WORKFORCE_RETIREMENT_CUTOFF_OFFICER"
  | "WORKFORCE_MOVEMENT_OUT_CUTOFF_OFFICER"
  | "WORKFORCE_SLA_DIGEST_ROLE"
  | "WORKFORCE_LEAVE_REPORT_DUE_USER"
  | "WORKFORCE_LEAVE_REPORT_OVERDUE_USER"
  | "WORKFORCE_LICENSE_DIGEST_DAILY_OFFICER"
  | "WORKFORCE_LICENSE_DIGEST_WEEKLY_OFFICER";

export type NotificationTemplatePayload = {
  title: string;
  message: string;
  link: string;
  type: NotificationType;
};

const toNumber = (value: unknown): number => Number(value ?? 0);
const toStringValue = (value: unknown): string => String(value ?? "");

export const renderNotificationTemplate = (
  templateKey: NotificationTemplateKey,
  params: Record<string, unknown>,
): NotificationTemplatePayload => {
  switch (templateKey) {
    case "WORKFORCE_LICENSE_EXPIRED_USER":
      return {
        title: "ใบอนุญาตหมดอายุ",
        message: `ใบอนุญาตของท่านหมดอายุแล้ว (วันหมดอายุ: ${toStringValue(params.expiryDate)})`,
        link: "/dashboard/user/requests",
        type: NotificationType.LICENSE,
      };
    case "WORKFORCE_LICENSE_RESTORED_USER":
      return {
        title: "ใบอนุญาตต่ออายุแล้ว",
        message: "ระบบเปิดสิทธิรับเงินเพิ่มให้ท่านอีกครั้งหลังต่ออายุใบอนุญาต",
        link: "/dashboard/user/requests",
        type: NotificationType.LICENSE,
      };
    case "WORKFORCE_LICENSE_EXPIRING_USER":
      return {
        title: "แจ้งเตือนใบอนุญาตประกอบวิชาชีพ",
        message: `${toStringValue(params.prefix)} กรุณาตรวจสอบและดำเนินการต่ออายุ`,
        link: "/dashboard/user/settings",
        type: NotificationType.LICENSE,
      };
    case "WORKFORCE_RETIREMENT_CUTOFF_OFFICER":
      return {
        title: "ตัดสิทธิเนื่องจากเกษียณ",
        message: `ตัดสิทธิเงินเพิ่ม พ.ต.ส. (เกษียณ) ตั้งแต่ ${toStringValue(params.retireDate)} สำหรับ ${toStringValue(params.citizenId)}`,
        link: "/dashboard/officer",
        type: NotificationType.REMINDER,
      };
    case "WORKFORCE_MOVEMENT_OUT_CUTOFF_OFFICER":
      return {
        title: "ตัดสิทธิเนื่องจากย้ายออก",
        message: `ตัดสิทธิเงินเพิ่ม พ.ต.ส. (ย้ายออก) ตั้งแต่ ${toStringValue(params.effectiveDate)} สำหรับ ${toStringValue(params.citizenId)}`,
        link: "/dashboard/officer",
        type: NotificationType.REMINDER,
      };
    case "WORKFORCE_SLA_DIGEST_ROLE":
      return {
        title: "สรุปคำขอค้าง (SLA)",
        message: `มีคำขอค้างทั้งหมด ${toNumber(params.count)} รายการ (เกินกำหนด ${toNumber(params.overdue)})`,
        link: "/dashboard",
        type: NotificationType.REMINDER,
      };
    case "WORKFORCE_LEAVE_REPORT_DUE_USER":
      return {
        title: "แจ้งเตือนรายงานตัวกลับ",
        message: `กรุณารายงานตัวกลับภายใน ${toNumber(params.maxDays)} วันหลังสิ้นสุดการลา`,
        link: "/dashboard/user/requests",
        type: NotificationType.LEAVE,
      };
    case "WORKFORCE_LEAVE_REPORT_OVERDUE_USER":
      return {
        title: "แจ้งเตือนรายงานตัวกลับ (เกินกำหนด)",
        message: `ครบกำหนดรายงานตัวกลับจากการลาแล้ว (${toNumber(params.daysSinceEnd)} วันหลังวันสิ้นสุดการลา)`,
        link: "/dashboard/user/requests",
        type: NotificationType.LEAVE,
      };
    case "WORKFORCE_LICENSE_DIGEST_DAILY_OFFICER":
      return {
        title: "License Alerts (รายวัน)",
        message: toStringValue(params.summaryText),
        link: "/dashboard/officer/license-alerts",
        type: NotificationType.SYSTEM,
      };
    case "WORKFORCE_LICENSE_DIGEST_WEEKLY_OFFICER":
      return {
        title: "License Alerts (รายสัปดาห์)",
        message: toStringValue(params.summaryText),
        link: "/dashboard/officer/license-alerts",
        type: NotificationType.SYSTEM,
      };
    default:
      return {
        title: "แจ้งเตือนระบบ",
        message: "มีการแจ้งเตือนใหม่",
        link: "/dashboard",
        type: NotificationType.SYSTEM,
      };
  }
};
