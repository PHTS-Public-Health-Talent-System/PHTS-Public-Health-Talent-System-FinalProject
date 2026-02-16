"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPersonnelMovement,
  createRetirement,
  deletePersonnelMovement,
  deleteRetirement,
  getPersonnelMovements,
  getRetirements,
  updatePersonnelMovement,
  updateRetirement,
} from './api';

export function useRetirements() {
  return useQuery({
    queryKey: ['personnel-changes', 'retirements'],
    queryFn: getRetirements,
  });
}

export function usePersonnelMovements() {
  return useQuery({
    queryKey: ['personnel-changes', 'movements'],
    queryFn: getPersonnelMovements,
  });
}

export function useCreateRetirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRetirement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'retirements'] });
    },
  });
}

export function useUpdateRetirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ retirementId, payload }: { retirementId: number; payload: { citizen_id: string; retire_date: string; note?: string } }) =>
      updateRetirement(retirementId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'retirements'] });
    },
  });
}

export function useDeleteRetirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (retirementId: number) => deleteRetirement(retirementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'retirements'] });
    },
  });
}

export function useCreatePersonnelMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPersonnelMovement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'movements'] });
    },
  });
}

export function useUpdatePersonnelMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      movementId,
      payload,
    }: {
      movementId: number;
      payload: {
        citizen_id: string;
        movement_type: "RESIGN" | "TRANSFER_OUT";
        effective_date: string;
        remark?: string;
      };
    }) => updatePersonnelMovement(movementId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'movements'] });
    },
  });
}

export function useDeletePersonnelMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: number) => deletePersonnelMovement(movementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel-changes', 'movements'] });
    },
  });
}
