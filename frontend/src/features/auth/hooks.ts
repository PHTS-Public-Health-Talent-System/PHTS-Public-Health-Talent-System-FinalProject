"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateCurrentUserProfile } from './api';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });
}

export function useUpdateCurrentUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });
}
