import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import { requestUpload } from '@config/upload.js';
import {
  createSupportTicketSchema,
  listSupportTicketsSchema,
  supportTicketIdParamSchema,
  supportTicketMessageSchema,
  updateSupportStatusSchema,
} from '@/modules/support/support.schema.js';
import * as supportController from '@/modules/support/support.controller.js';

const router = Router();

router.use(protect);

router.post(
  "/tickets",
  requestUpload.fields([
    { name: "attachments", maxCount: 10 },
    { name: "attachments[]", maxCount: 10 },
  ]),
  validate(createSupportTicketSchema),
  supportController.createTicket,
);

router.get("/tickets/my", supportController.listMyTickets);

router.get(
  "/tickets",
  restrictTo(UserRole.ADMIN),
  validate(listSupportTicketsSchema),
  supportController.listTickets,
);

router.get(
  "/tickets/:ticketId",
  validate(supportTicketIdParamSchema),
  supportController.getTicket,
);

router.get(
  "/tickets/:ticketId/messages",
  validate(supportTicketIdParamSchema),
  supportController.listMessages,
);

router.post(
  "/tickets/:ticketId/messages",
  requestUpload.fields([
    { name: "attachments", maxCount: 10 },
    { name: "attachments[]", maxCount: 10 },
  ]),
  validate(supportTicketMessageSchema),
  supportController.createMessage,
);

router.put(
  "/tickets/:ticketId/status",
  restrictTo(UserRole.ADMIN),
  validate(updateSupportStatusSchema),
  supportController.updateStatus,
);

router.post(
  "/tickets/:ticketId/reopen",
  validate(supportTicketIdParamSchema),
  supportController.reopenTicket,
);

router.post(
  "/tickets/:ticketId/close",
  validate(supportTicketIdParamSchema),
  supportController.closeTicket,
);

router.delete(
  "/tickets/:ticketId",
  validate(supportTicketIdParamSchema),
  supportController.deleteTicket,
);

export default router;
