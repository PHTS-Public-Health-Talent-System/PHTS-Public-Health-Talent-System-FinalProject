/**
 * master-data module - request orchestration
 *
 */
import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import * as holidayService from "@/modules/master-data/services/holiday.service.js";
import * as rateService from "@/modules/master-data/services/rate.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { UserRole } from "@/types/auth.js";
import {
  AuthorizationError,
  AuthenticationError,
  NotFoundError,
} from "@shared/utils/errors.js";
import { resolveProfessionCode } from "@shared/utils/profession.js";
import {
  CreateHolidayDTO,
  GetHolidaysQuery,
  UpdateHolidayDTO,
  CreateRateDTO,
  UpdateRateBody,
} from "@/modules/master-data/master-data.schema.js";

// Holidays
export const getHolidays = asyncHandler(async (req: Request, res: Response) => {
  const { year } = req.query as unknown as GetHolidaysQuery;
  const yearQuery =
    typeof year === "number" ? String(year) : typeof year === "string" ? year : undefined;
  const holidays = await holidayService.getHolidays(yearQuery);
  res.json({ success: true, data: holidays });
});

export const addHoliday = asyncHandler(async (req: Request, res: Response) => {
  const { date, name, type } = req.body as CreateHolidayDTO;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
  await holidayService.addHoliday(date, name, type, actorId);
  res.json({ success: true, message: "Holiday saved successfully" });
});

export const updateHoliday = asyncHandler(async (req: Request, res: Response) => {
  const { date: originalDate } = req.params;
  const { date, name, type } = req.body as UpdateHolidayDTO;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
  await holidayService.updateHoliday(
    originalDate,
    date,
    name,
    type,
    actorId,
  );
  res.json({ success: true, message: "Holiday updated successfully" });
});

export const deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
  await holidayService.deleteHoliday(date, actorId);
  res.json({ success: true, message: "Holiday deleted successfully" });
});

// Master Rates
export const getMasterRates = asyncHandler(async (_req: Request, res: Response) => {
  const rates = await rateService.getMasterRates();
  res.json({ success: true, data: rates });
});

export const updateMasterRate = asyncHandler(async (req: Request, res: Response) => {
  const { rateId } = req.params;
  const body = req.body as UpdateRateBody;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

  const existing = await rateService.getMasterRateById(Number(rateId));
  if (!existing) {
    throw new NotFoundError("อัตราเงิน", rateId);
  }

  const existingRate = existing as Record<string, unknown>;
  const hasItemNo = Object.hasOwn(body, "item_no");
  const hasSubItemNo = Object.hasOwn(body, "sub_item_no");

  let itemNo: string | null;
  if (hasItemNo) {
    itemNo = body.item_no ?? null;
  } else if (existingRate.item_no != null) {
    itemNo = String(existingRate.item_no);
  } else {
    itemNo = null;
  }

  let subItemNo: string | null;
  if (hasSubItemNo) {
    subItemNo = body.sub_item_no ?? null;
  } else if (existingRate.sub_item_no != null) {
    subItemNo = String(existingRate.sub_item_no);
  } else {
    subItemNo = null;
  }

  const merged = {
    profession_code:
      String(body.profession_code ?? existingRate.profession_code ?? ""),
    group_no: body.group_no ?? Number(existingRate.group_no),
    item_no: itemNo,
    sub_item_no: subItemNo,
    amount: body.amount ?? Number(existingRate.amount),
    condition_desc:
      String(body.condition_desc ?? existingRate.condition_desc ?? ""),
    detailed_desc:
      String(body.detailed_desc ?? existingRate.detailed_desc ?? ""),
    is_active:
      typeof body.is_active === "boolean"
        ? body.is_active
        : Boolean(existingRate.is_active ?? true),
  };

  await rateService.updateMasterRate(Number(rateId), merged, actorId);
  res.json({ success: true, message: "Rate updated successfully" });
});

export const createMasterRate = asyncHandler(async (req: Request, res: Response) => {
  const {
    profession_code,
    group_no,
    item_no,
    sub_item_no,
    amount,
    condition_desc,
    detailed_desc,
    is_active,
  } = req.body as CreateRateDTO;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

  const rateId = await rateService.createMasterRate({
    profession_code,
    group_no,
    item_no: item_no ?? null,
    sub_item_no: sub_item_no ?? null,
    amount,
    condition_desc,
    detailed_desc,
    is_active: is_active ? 1 : 0,
    actorId,
  });
  res.json({
    success: true,
    data: { rateId },
    message: "Rate created successfully",
  });
});

export const deleteMasterRate = asyncHandler(async (req: Request, res: Response) => {
  const { rateId } = req.params;
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

  await rateService.deleteMasterRate(Number(rateId), actorId);
  res.json({ success: true, message: "Rate deleted successfully" });
});

// Get rates filtered by profession code
export const getRatesByProfession = asyncHandler(async (req: Request, res: Response) => {
  const { professionCode } = req.params;
  const userProfession = await getUserProfessionCode(req);
  if (req.user?.role !== UserRole.PTS_OFFICER) {
    if (!userProfession || userProfession !== professionCode) {
      throw new AuthorizationError("ไม่มีสิทธิ์เข้าถึงอัตราของวิชาชีพนี้");
    }
  }
  const rates = await rateService.getRatesByProfession(professionCode);
  res.json({ success: true, data: rates });
});

// Get list of professions that have active rates
export const getProfessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const professions = await rateService.getProfessions();
  if (req.user.role === UserRole.PTS_OFFICER) {
    res.json({ success: true, data: professions });
    return;
  }
  const userProfession = await getUserProfessionCode(req);
  res.json({ success: true, data: userProfession ? [userProfession] : [] });
});

// Get full rate hierarchy
export const getRateHierarchy = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const data = await rateService.getRateHierarchy();
  if (
    req.user.role === UserRole.PTS_OFFICER ||
    req.user.role === UserRole.HEAD_HR ||
    req.user.role === UserRole.HEAD_FINANCE ||
    req.user.role === UserRole.DIRECTOR ||
    req.user.role === UserRole.ADMIN
  ) {
    res.json({ success: true, data });
    return;
  }
  const userProfession = await getUserProfessionCode(req);
  const filtered = userProfession
    ? data.filter((entry) => entry.id === userProfession)
    : [];
  res.json({ success: true, data: filtered });
});

const getUserProfessionCode = async (req: Request): Promise<string | null> => {
  if (!req.user?.citizenId) return null;
  const profile = await requestRepository.findEmployeeProfile(
    req.user.citizenId,
  );
  if (!profile) return null;
  return resolveProfessionCode(profile.position_name || "");
};
