import { getConnection } from '@config/database.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';

const parseSubmissionData = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

export class OcrRequestRepository {
  static async findRequestById(requestId: number) {
    return requestRepository.findById(requestId);
  }

  static async findAttachments(requestId: number) {
    return requestRepository.findAttachments(requestId);
  }

  static async updateRequestPrecheck(requestId: number, patch: Record<string, unknown>): Promise<void> {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      const requestEntity = await requestRepository.findById(requestId, connection);
      if (!requestEntity) {
        await connection.rollback();
        return;
      }

      const submissionData = parseSubmissionData(requestEntity.submission_data);
      const previousPrecheck =
        typeof submissionData.ocr_precheck === 'object' && submissionData.ocr_precheck
          ? (submissionData.ocr_precheck as Record<string, unknown>)
          : {};

      await requestRepository.update(
        requestId,
        {
          submission_data: {
            ...submissionData,
            ocr_precheck: {
              ...previousPrecheck,
              ...patch,
            },
          },
        },
        connection,
      );

      await connection.commit();
    } catch {
      await connection.rollback();
      throw new Error('Failed to update OCR precheck');
    } finally {
      connection.release();
    }
  }
}
