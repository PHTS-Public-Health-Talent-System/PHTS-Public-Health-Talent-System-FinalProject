import "express";
import type { UserRole } from '@/types/auth.js';

declare global {
  namespace Express {
    interface User {
      userId: number;
      citizenId: string;
      role: UserRole;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}
