import { Request, Response } from "express";
import * as masterDataService from '@/modules/master-data/services/master-data.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';
import { UserRole } from '@/types/auth.js';
import { AuthorizationError, AuthenticationError } from '@shared/utils/errors.js';
import { resolveProfessionCode } from '@shared/utils/profession.js';
import {
  CreateHolidayDTO,
  GetHolidaysQuery,
  UpdateRateBody,
} from '@/modules/master-data/master-data.schema.js';

// Holidays
export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { year } = req.query as unknown as GetHolidaysQuery;
    // Year is already transformed to number by Zod if present
    const holidays = await masterDataService.getHolidays(year?.toString());
    res.json({ success: true, data: holidays });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addHoliday = async (req: Request, res: Response) => {
  try {
    const { date, name } = req.body as CreateHolidayDTO;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await masterDataService.addHoliday(date, name, actorId);
    res.json({ success: true, message: "Holiday saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await masterDataService.deleteHoliday(date, actorId);
    res.json({ success: true, message: "Holiday deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Master Rates
export const getMasterRates = async (_req: Request, res: Response) => {
  try {
    const rates = await masterDataService.getMasterRates();
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateMasterRate = async (req: Request, res: Response) => {
  try {
    const { rateId } = req.params;
    const { amount, condition_desc, is_active } = req.body as UpdateRateBody;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    await masterDataService.updateMasterRate(
      Number(rateId),
      amount,
      condition_desc,
      is_active ? 1 : 0,
      actorId,
    );
    res.json({ success: true, message: "Rate updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMasterRate = async (req: Request, res: Response) => {
  try {
    const { profession_code, group_no, item_no, sub_item_no, amount, condition_desc } = req.body;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const rateId = await masterDataService.createMasterRate(
      profession_code,
      group_no,
      item_no ?? null,
      sub_item_no ?? null,
      amount,
      condition_desc,
      actorId,
    );
    res.json({ success: true, data: { rateId }, message: "Rate created successfully" });
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
    const rates = await masterDataService.getRatesByProfession(professionCode);
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get list of professions that have active rates
export const getProfessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) throw new AuthenticationError("Unauthorized access");
    const professions = await masterDataService.getProfessions();
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
    const data = await masterDataService.getRateHierarchy();
    if (req.user.role === UserRole.PTS_OFFICER) {
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
  const profile = await requestRepository.findEmployeeProfile(req.user.citizenId);
  if (!profile) return null;
  return resolveProfessionCode(profile.position_name || "");
};
