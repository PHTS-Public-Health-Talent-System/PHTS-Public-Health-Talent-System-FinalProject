import { Request, Response } from "express";
import * as masterDataService from "./services/master-data.service.js";
import {
  CreateHolidayDTO,
  GetHolidaysQuery,
  UpdateRateBody,
} from "./master-data.schema.js";

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
    const rates = await masterDataService.getRatesByProfession(professionCode);
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get list of professions that have active rates
export const getProfessions = async (_req: Request, res: Response) => {
  try {
    const professions = await masterDataService.getProfessions();
    res.json({ success: true, data: professions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get full rate hierarchy
export const getRateHierarchy = async (_req: Request, res: Response) => {
  try {
    const data = await masterDataService.getRateHierarchy();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
