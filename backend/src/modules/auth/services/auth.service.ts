/**
 * Auth Module - Service
 *
 * Business logic for authentication operations
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from '@config/jwt.js';
import { isValidCitizenId } from '@shared/utils/validationUtils.js';
import { AuthRepository } from '@/modules/auth/repositories/auth.repository.js';
import {
  UserProfile,
  LoginResult,
  JwtPayload,
} from '@/modules/auth/entities/auth.entity.js';
import {
  emitAuditEvent,
  AuditEventType,
} from '@/modules/audit/services/audit.service.js';

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AccountDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDisabledError";
  }
}

export class InvalidCitizenIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCitizenIdError";
  }
}

// ─── AuthService ──────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Authenticate user with citizen_id and password
   */
  static async login(
    citizenId: string,
    password: string,
    requestInfo?: { ipAddress: string; userAgent: string },
  ): Promise<LoginResult> {
    // Validate citizen ID format
    if (!isValidCitizenId(citizenId)) {
      throw new InvalidCitizenIdError(
        "Invalid citizen ID. Must be 13 digits with a valid checksum.",
      );
    }

    // Find user
    const user = await AuthRepository.findByCitizenId(citizenId);
    if (!user) {
      throw new AuthenticationError("Invalid citizen ID or password");
    }

    // Check if account is active
    if (!user.is_active) {
      throw new AccountDisabledError(
        "Your account has been deactivated. Please contact administrator.",
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError("Invalid citizen ID or password");
    }

    // Update last login timestamp
    await AuthRepository.updateLastLogin(user.user_id);

    // Generate JWT token
    const jwtPayload: JwtPayload = {
      userId: user.user_id,
      citizenId: user.citizen_id,
      role: user.role,
    };

    const jwtSecret = getJwtSecret();
    const disableTokenExpiry =
      String(process.env.DEMO_DISABLE_TOKEN_EXPIRY || "").toLowerCase() === "true";
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";
    const token = disableTokenExpiry
      ? jwt.sign(jwtPayload, jwtSecret)
      : jwt.sign(jwtPayload, jwtSecret, { expiresIn: jwtExpiresIn });

    // Get user profile
    const userProfile = await AuthService.getUserProfile(user.user_id);

    // Log audit event
    await emitAuditEvent({
      eventType: AuditEventType.LOGIN,
      entityType: "user",
      entityId: user.user_id,
      actorId: user.user_id,
      actorRole: user.role,
      actionDetail: {
        citizen_id: user.citizen_id,
        login_time: new Date().toISOString(),
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return {
      token,
      user: userProfile,
    };
  }

  /**
   * Get user profile by user ID
   */
  static async getUserProfile(userId: number): Promise<UserProfile> {
    const user = await AuthRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const employeeProfile = await AuthRepository.findEmployeeProfileByCitizenId(
      user.citizen_id,
    );
    const licenseProfile = await AuthRepository.findLatestLicenseByCitizenId(
      user.citizen_id,
    );
    const licenseStatusRaw = licenseProfile?.status?.toUpperCase() ?? null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const licenseValidUntil = licenseProfile?.valid_until
      ? new Date(licenseProfile.valid_until)
      : null;
    let license_status: UserProfile['license_status'] = null;
    if (licenseProfile) {
      if (licenseStatusRaw && licenseStatusRaw !== 'ACTIVE') {
        license_status = 'INACTIVE';
      } else if (licenseValidUntil && licenseValidUntil < today) {
        license_status = 'EXPIRED';
      } else if (licenseValidUntil || licenseStatusRaw === 'ACTIVE' || licenseStatusRaw === null) {
        license_status = 'ACTIVE';
      } else {
        license_status = 'UNKNOWN';
      }
    }

    return {
      id: user.user_id,
      citizen_id: user.citizen_id,
      role: user.role,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      first_name: employeeProfile?.first_name ?? null,
      last_name: employeeProfile?.last_name ?? null,
      position: employeeProfile?.position ?? null,
      position_number: employeeProfile?.position_number ?? null,
      department: employeeProfile?.department ?? null,
      email: employeeProfile?.email ?? null,
      phone: employeeProfile?.phone ?? null,
      employee_type: employeeProfile?.employee_type ?? null,
      mission_group: employeeProfile?.mission_group ?? null,
      start_current_position: employeeProfile?.start_current_position ?? null,
      license_no: licenseProfile?.license_no ?? null,
      license_name: licenseProfile?.license_name ?? null,
      license_valid_from: licenseProfile?.valid_from ?? null,
      license_valid_until: licenseProfile?.valid_until ?? null,
      license_status,
    };
  }

  static async updateUserProfile(
    userId: number,
    payload: { first_name: string; last_name: string; email?: string; phone?: string },
    requestInfo?: { ipAddress: string; userAgent: string },
  ): Promise<UserProfile> {
    const user = await AuthRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updated = await AuthRepository.updateEmployeeProfileByCitizenId(
      user.citizen_id,
      {
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
      },
    );

    if (!updated) {
      throw new Error("Employee profile not found");
    }

    await emitAuditEvent({
      eventType: AuditEventType.USER_UPDATE,
      entityType: "user",
      entityId: user.user_id,
      actorId: user.user_id,
      actorRole: user.role,
      actionDetail: {
        updated_fields: ["first_name", "last_name", "email", "phone"],
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return AuthService.getUserProfile(userId);
  }

  /**
   * Log logout event
   */
  static async logout(
    userId: number,
    role: string,
    requestInfo?: { ipAddress: string; userAgent: string },
  ): Promise<void> {
    await emitAuditEvent({
      eventType: AuditEventType.LOGOUT,
      entityType: "user",
      entityId: userId,
      actorId: userId,
      actorRole: role,
      actionDetail: {
        logout_time: new Date().toISOString(),
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });
  }
}
