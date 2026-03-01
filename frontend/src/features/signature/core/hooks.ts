/**
 * signature module - React query hooks
 *
 */
"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { getMySignature, checkSignature, refreshMySignature } from "./api";

export function useMySignature() {
  return useQuery({
    queryKey: ["my-signature"],
    queryFn: getMySignature,
  });
}

export function useCheckSignature() {
  return useQuery({
    queryKey: ["signature-check"],
    queryFn: checkSignature,
  });
}

export function useRefreshSignature() {
  return useMutation({
    mutationFn: refreshMySignature,
  });
}
