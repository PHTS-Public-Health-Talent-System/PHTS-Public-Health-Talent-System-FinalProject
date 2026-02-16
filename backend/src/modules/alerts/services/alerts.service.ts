import { RetirementsRepository } from '@/modules/alerts/repositories/retirements.repository.js';
import { AlertsRepository } from '@/modules/alerts/repositories/alerts.repository.js';
import type {
  PersonnelMovementRecord,
  PersonnelMovementInput,
  RetirementInput,
  RetirementRecord,
} from '@/modules/alerts/entities/alerts.entity.js';

export async function listRetirements(): Promise<RetirementRecord[]> {
  return RetirementsRepository.list();
}

export async function listPersonnelMovements(): Promise<PersonnelMovementRecord[]> {
  return AlertsRepository.getPersonnelMovements();
}

export async function createPersonnelMovement(
  input: PersonnelMovementInput,
): Promise<void> {
  await AlertsRepository.createPersonnelMovement(input);
}

export async function updatePersonnelMovement(
  movementId: number,
  input: PersonnelMovementInput,
): Promise<void> {
  await AlertsRepository.updatePersonnelMovement(movementId, input);
}

export async function deletePersonnelMovement(movementId: number): Promise<void> {
  await AlertsRepository.deletePersonnelMovement(movementId);
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
