import { Request, Response } from "express";
import { SupportService } from '@/modules/support/services/support.service.js';
import { ApiResponse } from '@/types/auth.js';
import { AuthenticationError, ValidationError, catchAsync } from '@shared/utils/errors.js';
import path from "node:path";

const parseMetadata = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
};

const mapUploadedFiles = (
  files: { [fieldname: string]: Express.Multer.File[] } | undefined,
  uploadedBy: number,
) => {
  const allFiles = [...(files?.["attachments"] || []), ...(files?.["attachments[]"] || [])];
  return allFiles
    .filter((file) => Boolean(file.path))
    .map((file) => {
      const relativePath = path.isAbsolute(file.path)
        ? path.relative(process.cwd(), file.path)
        : file.path;
      return {
        uploaded_by: uploadedBy,
        file_name: file.originalname,
        file_path: relativePath.split(path.sep).join("/"),
        file_type: file.mimetype ?? null,
        file_size: file.size ?? null,
      };
    });
};

export const createTicket = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const { subject, description, page_url, user_agent, metadata } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const attachments = mapUploadedFiles(files, req.user.userId);

  const ticketId = await SupportService.createTicket({
    userId: req.user.userId,
    citizenId: req.user.citizenId ?? null,
    subject,
    description,
    pageUrl: page_url ?? null,
    userAgent: user_agent ?? null,
    metadata: parseMetadata(metadata),
    attachments,
  });

  res.status(201).json({ success: true, data: { id: ticketId } });
});

export const listTickets = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  const { status, page, limit } = req.query as any;
  const result = await SupportService.listTickets({
    status,
    page: Number(page),
    limit: Number(limit),
  });
  res.json({ success: true, data: result });
});

export const listMyTickets = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const rows = await SupportService.listMyTickets(req.user.userId);
  res.json({ success: true, data: rows });
});

export const getTicket = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to view this ticket");
  }
  res.json({ success: true, data: ticket });
});

export const updateStatus = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  const ticketId = Number(req.params.ticketId);
  const { status } = req.body as { status: string };
  await SupportService.updateStatus(ticketId, status as any);
  res.json({ success: true, message: "Updated" });
});

export const reopenTicket = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to reopen this ticket");
  }
  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
    throw new ValidationError("Only RESOLVED or CLOSED tickets can be reopened");
  }
  await SupportService.reopen(ticketId);
  res.json({ success: true, message: "Reopened" });
});

export const listMessages = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to view this ticket");
  }
  const messages = await SupportService.listMessages(ticketId);
  res.json({ success: true, data: messages });
});

export const createMessage = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to post on this ticket");
  }
  if (!isAdmin && !["OPEN", "IN_PROGRESS", "REOPENED"].includes(ticket.status)) {
    throw new ValidationError("Ticket is not open for responses");
  }
  if (isAdmin && ["CLOSED", "RESOLVED"].includes(ticket.status)) {
    throw new ValidationError("Reopen ticket before replying");
  }
  const { message } = req.body as { message: string };
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const attachments = mapUploadedFiles(files, req.user.userId);
  const messageId = await SupportService.createMessage({
    ticketId,
    senderUserId: req.user.userId,
    senderRole: req.user.role,
    message,
    attachments,
  });
  res.status(201).json({ success: true, data: { id: messageId } });
});

export const closeTicket = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to close this ticket");
  }
  if (ticket.status === "CLOSED") {
    res.json({ success: true, message: "Already closed" });
    return;
  }
  await SupportService.close(ticketId);
  res.json({ success: true, message: "Closed" });
});

export const deleteTicket = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
  if (!req.user) throw new AuthenticationError("Unauthorized access");
  const ticketId = Number(req.params.ticketId);
  const ticket = await SupportService.getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ success: false, error: "Ticket not found" });
    return;
  }
  const isOwner = ticket.user_id === req.user.userId;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ValidationError("You do not have permission to delete this ticket");
  }
  await SupportService.deleteTicket(ticketId);
  res.json({ success: true, message: "Deleted" });
});
