export interface UserSignature {
  signature_id: number;
  citizen_id: string | null;
  signature_image: Buffer;
  created_at: Date;
  updated_at: Date;
}
