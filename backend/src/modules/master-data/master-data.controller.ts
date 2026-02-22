/**
 * master-data module - request orchestration
 *
 */
import { Request, Response } from "express";
import * as holidayService from "@/modules/master-data/services/holiday.service.js";
import * as rateService from "@/modules/master-data/services/rate.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { UserRole } from "@/types/auth.js";
import {
  AuthorizationError,
  AuthenticationError,
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
export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { year } = req.query as unknown as GetHolidaysQuery;
    // Year is already transformed to number by Zod if present
    const holidays = await holidayService.getHolidays(year?.toString());
    res.json({ success: true, data: holidays });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addHoliday = async (req: Request, res: Response) => {
  try {
    const { date, name, type } = req.body as CreateHolidayDTO;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await holidayService.addHoliday(date, name, type, actorId);
    res.json({ success: true, message: "Holiday saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateHoliday = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await holidayService.deleteHoliday(date, actorId);
    res.json({ success: true, message: "Holiday deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Master Rates
export const getMasterRates = async (_req: Request, res: Response) => {
  try {
    const rates = await rateService.getMasterRates();
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateMasterRate = async (req: Request, res: Response) => {
  try {
    const { rateId } = req.params;
    const body = req.body as UpdateRateBody;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const existing = await rateService.getMasterRateById(Number(rateId));
    if (!existing) {
      res.status(404).json({ success: false, error: "Rate not found" });
      return;
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMasterRate = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMasterRate = async (req: Request, res: Response) => {
  try {
    const { rateId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    await rateService.deleteMasterRate(Number(rateId), actorId);
    res.json({ success: true, message: "Rate deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get rates filtered by profession code
export const getRatesByProfession = async (req: Request, res: Response) => {
  try {
    const { professionCode } = req.params;
    const userProfession = await getUserProfessionCode(req);
    if (req.user?.role !== UserRole.PTS_OFFICER) {
      if (!userProfession || userProfession !== professionCode) {
        throw new AuthorizationError("ไม่มีสิทธิ์เข้าถึงอัตราของวิชาชีพนี้");
      }
    }
    const rates = await rateService.getRatesByProfession(professionCode);
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get list of professions that have active rates
export const getProfessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) throw new AuthenticationError("Unauthorized access");
    const professions = await rateService.getProfessions();
    if (req.user.role === UserRole.PTS_OFFICER) {
      res.json({ success: true, data: professions });
      return;
    }
    const userProfession = await getUserProfessionCode(req);
    res.json({ success: true, data: userProfession ? [userProfession] : [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get full rate hierarchy
export const getRateHierarchy = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getUserProfessionCode = async (req: Request): Promise<string | null> => {
  if (!req.user?.citizenId) return null;
  const profile = await requestRepository.findEmployeeProfile(
    req.user.citizenId,
  );
  if (!profile) return null;
  return resolveProfessionCode(profile.position_name || "");
};
