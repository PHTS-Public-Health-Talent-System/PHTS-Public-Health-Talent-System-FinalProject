import { RetirementsRepository } from '@/modules/workforce-compliance/repositories/retirements.repository.js';
import type {
  RetirementInput,
  RetirementRecord,
} from '@/modules/workforce-compliance/entities/workforce-compliance.entity.js';

export async function createRetirement(
  input: RetirementInput,
  createdBy: number,
): Promise<RetirementRecord | null> {
  if (!createdBy) {
    throw new Error("Missing creator user id");
  }
  const id = await RetirementsRepository.upsert(input, createdBy);
  if (!id) return null;
  return RetirementsRepository.findById(id);
}

export async function updateRetirement(
  retirementId: number,
  input: RetirementInput,
  updatedBy: number,
): Promise<void> {
  if (!updatedBy) {
    throw new Error("Missing updater user id");
  }
  await RetirementsRepository.update(retirementId, input, updatedBy);
}
