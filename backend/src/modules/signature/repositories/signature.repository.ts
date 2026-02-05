import { RowDataPacket } from "mysql2";
import pool from '@config/database.js';
import { UserSignature } from '@/modules/signature/entities/signature.entity.js';

class SignatureRepository {
  async findByUserId(userId: number): Promise<UserSignature | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT signature_id, user_id, signature_image, created_at, updated_at
       FROM sig_images
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    if (!rows.length) return null;
    return rows[0] as UserSignature;
  }

  async hasSignature(userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT signature_id FROM sig_images WHERE user_id = ? LIMIT 1",
      [userId],
    );
    return rows.length > 0;
  }
}

export const signatureRepository = new SignatureRepository();
