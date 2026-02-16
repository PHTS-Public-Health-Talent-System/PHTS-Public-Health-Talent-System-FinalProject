import { Request, Response } from "express";
import { catchAsync } from '@shared/utils/errors.js';
import { announcementRepository } from '@/modules/announcement/repositories/announcement.repository.js';
import { AnnouncementService } from '@/modules/announcement/services/announcement.service.js';
import type { ApiResponse } from '@/types/auth.js';

export const getActiveAnnouncements = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const items = await announcementRepository.listActiveByRole(req.user.role);
    return res.json({ success: true, data: items });
  },
);

export const getAllAnnouncements = catchAsync(
  async (_req: Request, res: Response<ApiResponse>) => {
    const items = await announcementRepository.listAll();
    return res.json({ success: true, data: items });
  },
);

export const postAnnouncement = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    const { title, body, priority, is_active, start_at, end_at, roles } =
      req.body;
    const announcementId = await AnnouncementService.createAnnouncement({
      title,
      body,
      priority,
      is_active: is_active ?? true,
      start_at: start_at ?? null,
      end_at: end_at ?? null,
      roles,
      created_by: req.user?.userId ?? null,
    });
    return res.json({ success: true, data: { id: announcementId } });
  },
);

export const putAnnouncement = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    const announcementId = parseInt(req.params.id, 10);
    await AnnouncementService.updateAnnouncement(announcementId, req.body);
    return res.json({ success: true, message: "Updated" });
  },
);

export const activateAnnouncement = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    const announcementId = parseInt(req.params.id, 10);
    const announcement = await announcementRepository.getById(announcementId);
    if (!announcement) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    await AnnouncementService.setActive(
      announcementId,
      true,
      req.body.roles ?? undefined,
      announcement.priority as any,
    );
    return res.json({ success: true, message: "Activated" });
  },
);

export const deactivateAnnouncement = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    const announcementId = parseInt(req.params.id, 10);
    await AnnouncementService.setActive(announcementId, false);
    return res.json({ success: true, message: "Deactivated" });
  },
);
