import { RetirementsRepository } from "../repositories/retirements.repository.js";
import type { RetirementInput, RetirementRecord } from "../entities/alerts.entity.js";

export async function listRetirements(): Promise<RetirementRecord[]> {
  return RetirementsRepository.list();
}

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

export async function deleteRetirement(retirementId: number): Promise<void> {
  await RetirementsRepository.delete(retirementId);
}
