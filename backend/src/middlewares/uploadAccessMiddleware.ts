import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { query } from "@config/database.js";
import { requestQueryService } from "@/modules/request/services/query.service.js";

function normalizeUploadPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath || "");
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, "");
  return `uploads/${normalized}`;
}

export async function authorizeUploadAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    if (req.user.role === "ADMIN") {
      next();
      return;
    }

    const normalizedPath = normalizeUploadPath(req.path);

    const requestAttachments = await query<Array<{ request_id: number }>>(
      `SELECT a.request_id
       FROM req_attachments a
       WHERE a.file_path = ?
       LIMIT 1`,
      [normalizedPath],
    );

    if (requestAttachments.length > 0) {
      try {
        await requestQueryService.getRequestById(
          Number(requestAttachments[0].request_id),
          req.user.userId,
          req.user.role,
        );
        next();
        return;
      } catch {
        res.status(403).json({ success: false, error: "Forbidden" });
        return;
      }
    }

    const supportAttachments = await query<Array<{ user_id: number }>>(
      `SELECT t.user_id
       FROM support_ticket_attachments a
       JOIN support_tickets t ON t.ticket_id = a.ticket_id
       WHERE a.file_path = ?
       LIMIT 1`,
      [normalizedPath],
    );

    if (supportAttachments.length > 0) {
      if (Number(supportAttachments[0].user_id) !== req.user.userId) {
        res.status(403).json({ success: false, error: "Forbidden" });
        return;
      }
      next();
      return;
    }

    res.status(404).json({ success: false, error: "File not found" });
  } catch (error) {
    next(error);
  }
}
