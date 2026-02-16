import { RowDataPacket } from "mysql2";
import pool from '@config/database.js';
import { UserSignature } from '@/modules/signature/entities/signature.entity.js';

class SignatureRepository {
  async findByCitizenId(citizenId: string): Promise<UserSignature | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT signature_id, citizen_id, signature_image, created_at, updated_at
       FROM sig_images
       WHERE citizen_id = ?
       LIMIT 1`,
      [citizenId],
    );
    if (!rows.length) return null;
    return rows[0] as UserSignature;
  }

  async hasSignature(citizenId: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT signature_id FROM sig_images WHERE citizen_id = ? LIMIT 1",
      [citizenId],
    );
    return rows.length > 0;
  }
}

export const signatureRepository = new SignatureRepository();
