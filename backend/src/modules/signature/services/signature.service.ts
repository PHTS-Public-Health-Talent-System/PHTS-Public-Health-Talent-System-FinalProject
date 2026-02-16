import { signatureRepository } from '@/modules/signature/repositories/signature.repository.js';

export const getSignatureBase64 = async (citizenId: string) => {
  const signature = await signatureRepository.findByCitizenId(citizenId);
  if (!signature) return null;
  const base64 = signature.signature_image.toString("base64");
  return `data:image/png;base64,${base64}`;
};

export const hasSignature = async (citizenId: string) => {
  return signatureRepository.hasSignature(citizenId);
};
