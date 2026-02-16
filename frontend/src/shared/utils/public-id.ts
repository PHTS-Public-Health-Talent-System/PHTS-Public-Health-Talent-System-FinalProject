const HASH_MULTIPLIER = 2654435761;
const MAX_UINT32 = 0xffffffff;

export function toPublicId(id: number | string): string {
  const numeric = typeof id === "string" ? Number(id) : id;
  if (!Number.isFinite(numeric)) return String(id);
  const hashed = (Math.abs(numeric) * HASH_MULTIPLIER) >>> 0;
  const base36 = (hashed & MAX_UINT32).toString(36).toUpperCase();
  const cleaned = base36.replace(/[^A-Z0-9]/g, "");
  return cleaned.padStart(7, "0");
}

export function toRequestDisplayId(
  id: number | string,
  createdAt?: string | Date | null,
): string {
  const numeric = typeof id === "string" ? Number(id) : id;
  if (!Number.isFinite(numeric)) return String(id);
  const createdDate = createdAt ? new Date(createdAt) : new Date();
  const beYear = createdDate.getFullYear() + 543;
  const seq = String(Math.abs(Math.trunc(numeric)));
  return `REQ-${beYear}-${seq}`;
}
