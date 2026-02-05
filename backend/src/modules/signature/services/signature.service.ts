import { signatureRepository } from '@/modules/signature/repositories/signature.repository.js';

export const getSignatureBase64 = async (userId: number) => {
  const signature = await signatureRepository.findByUserId(userId);
  if (!signature) return null;
  const base64 = signature.signature_image.toString("base64");
  return `data:image/png;base64,${base64}`;
};

export const hasSignature = async (userId: number) => {
  return signatureRepository.hasSignature(userId);
};
