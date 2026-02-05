/**
 * src/modules/request/reassign/reassign.service.ts
 */
import { getConnection } from '@config/database.js';
import { RequestStatus, ActionType, ROLE_STEP_MAP } from '@/modules/request/request.types.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { getRequestLinkForRole } from '@/modules/request/services/helpers.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';

export interface ReassignRequestDTO {
  targetOfficerId: number;
  reason: string;
}

export interface ReassignResult {
  requestId: number;
  fromOfficerId: number;
  toOfficerId: number;
  reason: string;
  reassignedAt: Date;
}

export async function getAvailableOfficers(currentUserId: number) {
  const officers = await requestRepository.findAvailableOfficers(currentUserId);
  return officers.map(o => ({
      id: o.id,
      name: `${o.first_name} ${o.last_name}`.trim(),
      citizen_id: o.citizen_id,
      workload: o.workload_count
  }));
}

export async function reassignRequest(
  requestId: number,
  actorId: number,
  dto: ReassignRequestDTO
): Promise<ReassignResult> {
  const { targetOfficerId, reason } = dto;
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock Request
    const requestEntity = await requestRepository.findById(requestId, connection);
    if (!requestEntity) {
      throw new Error('Request not found');
    }

    const officerCount = await requestRepository.countActiveOfficers();
    if (officerCount < 2) {
      throw new Error('Reassign requires at least 2 active PTS_OFFICER');
    }

    if (requestEntity.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot reassign request with status: ${requestEntity.status}`);
    }

    // Check if current step is PTS_OFFICER step
    const officerStep = ROLE_STEP_MAP['PTS_OFFICER'];
    if (requestEntity.current_step !== officerStep) {
      throw new Error(`Request is not at PTS Officer stage. Current step: ${requestEntity.current_step}`);
    }

    if (actorId === targetOfficerId) {
        throw new Error("Cannot reassign to yourself");
    }

    // 2. Update Assignment
    await requestRepository.updateAssignedOfficer(requestId, targetOfficerId, connection);

    // 3. Record Action (REASSIGN)
    await requestRepository.insertApproval({
      request_id: requestId,
      actor_id: actorId,
      step_no: requestEntity.current_step,
      action: ActionType.REASSIGN,
      comment: `Reassigned to Officer ID ${targetOfficerId}: ${reason}`,
      signature_snapshot: null
    }, connection);

    await connection.commit();

    const requestNo = requestEntity.request_no;

    // 4. Notify new officer
    await NotificationService.notifyUser(
      targetOfficerId,
      'งานได้รับมอบหมายใหม่',
      `คำขอเลขที่ ${requestNo} ถูกโอนมาให้คุณดูแล`,
      getRequestLinkForRole('PTS_OFFICER', requestId),
      'INFO'
    );

    return {
        requestId,
        fromOfficerId: actorId,
        toOfficerId: targetOfficerId,
        reason,
        reassignedAt: new Date()
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getReassignmentHistory(requestId: number) {
  const actions = await requestRepository.findApprovalsWithActor(requestId);
  return actions
    .filter(a => a.action === ActionType.REASSIGN)
    .map(a => ({
        actionId: a.action_id,
        actorId: a.actor_id,
        actorName: `${a.actor_first_name} ${a.actor_last_name}`.trim(),
        reason: a.comment?.split(': ')[1] || a.comment, // Extract reason if formatted
        reassignedAt: a.created_at
    }));
}

/**
 * Get pending requests for a specific PTS_OFFICER
 *
 * Returns requests that are:
 * - At step 3 (PTS_OFFICER step)
 * - Either assigned to this officer OR not assigned to anyone (legacy/new)
 */
export async function getPendingForOfficer(officerId: number): Promise<any[]> {
    const ptsOfficerStep = ROLE_STEP_MAP["PTS_OFFICER"];
    const extraWhere = "AND (r.assigned_officer_id IS NULL OR r.assigned_officer_id = ?)";
    const extraParams = [officerId];

    return requestRepository.findPendingByStep(ptsOfficerStep, undefined, extraWhere, extraParams);
}
