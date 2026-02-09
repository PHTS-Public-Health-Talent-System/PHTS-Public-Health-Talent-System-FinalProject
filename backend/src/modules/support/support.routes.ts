import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
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

export default router;
