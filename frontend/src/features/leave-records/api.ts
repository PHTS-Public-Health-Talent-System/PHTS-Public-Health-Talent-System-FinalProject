import api from '@/shared/api/axios'
import type { ApiResponse } from '@/shared/api/types'

export type LeaveRecordApiRow = {
  id: number
  citizen_id: string
  leave_type: string
  start_date: string
  end_date: string
  remark?: string | null
  first_name?: string | null
  last_name?: string | null
  position_name?: string | null
  department?: string | null
  sub_department?: string | null
  profession_code?: string | null
  extension_id?: number | null
  document_start_date?: string | null
  document_end_date?: string | null
  document_duration_days?: number | null
  require_return_report?: number | null
  return_report_status?: string | null
  return_date?: string | null
  return_remark?: string | null
  pay_exception?: number | null
  is_no_pay?: number | null
  pay_exception_reason?: string | null
  study_institution?: string | null
  study_program?: string | null
  study_major?: string | null
  study_start_date?: string | null
  study_note?: string | null
  note?: string | null
}

export type LeavePersonnelRow = {
  citizen_id: string
  title?: string | null
  first_name?: string | null
  last_name?: string | null
  position_name?: string | null
  department?: string | null
  profession_code?: string | null
}

export type LeaveRecordListResponse = {
  items: LeaveRecordApiRow[]
  total: number
  limit?: number | null
  offset?: number
}

export type LeaveRecordStats = {
  total: number
  study: number
  pending_report: number
}

export type LeaveRecordExtensionPayload = {
  leave_record_id: number
  document_start_date?: string
  document_end_date?: string
  document_duration_days?: number
  require_return_report?: boolean
  return_report_status?: 'PENDING' | 'DONE' | 'NOT_REQUIRED'
  return_date?: string
  return_remark?: string
  pay_exception?: boolean
  is_no_pay?: boolean
  pay_exception_reason?: string
  study_institution?: string
  study_program?: string
  study_major?: string
  study_start_date?: string
  study_note?: string
  note?: string
}

export type LeaveRecordCreatePayload = {
  citizen_id: string
  leave_type: string
  start_date: string
  end_date: string
  duration_days?: number
  remark?: string
}

export type LeaveRecordDocumentRow = {
  document_id: number
  leave_record_id: number
  file_name: string
  file_type: string
  file_size: number
  file_path: string
  uploaded_by?: number | null
  uploaded_at: string
}

export async function listLeaveRecords(params?: {
  citizen_id?: string
  leave_type?: string
  profession_code?: string
  fiscal_year?: number
  pending_report?: boolean
  search?: string
  limit?: number
  offset?: number
  sort_by?: 'start_date' | 'name'
  sort_dir?: 'asc' | 'desc'
}) {
  const res = await api.get<ApiResponse<LeaveRecordApiRow[]> & {
    meta?: { total?: number; limit?: number | null; offset?: number }
  }>('/leave-records', { params })
  return {
    items: res.data.data ?? [],
    total: res.data.meta?.total ?? res.data.data?.length ?? 0,
    limit: res.data.meta?.limit ?? null,
    offset: res.data.meta?.offset ?? 0,
  } satisfies LeaveRecordListResponse
}

export async function listLeavePersonnel(params?: { q?: string; limit?: number }) {
  const res = await api.get<ApiResponse<LeavePersonnelRow[]>>('/leave-records/personnel', { params })
  return res.data.data ?? []
}

export async function createLeaveRecord(payload: LeaveRecordCreatePayload) {
  const res = await api.post<ApiResponse<{ id: number }>>('/leave-records', payload)
  return res.data.data
}

export async function upsertLeaveRecordExtension(payload: LeaveRecordExtensionPayload) {
  const res = await api.put<ApiResponse<{ ok: boolean }>>('/leave-records/extensions', payload)
  return res.data.data
}

export async function deleteLeaveRecordExtension(leaveRecordId: number | string) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/leave-records/extensions/${leaveRecordId}`)
  return res.data.data
}

export async function listLeaveRecordDocuments(leaveRecordId: number | string) {
  const res = await api.get<ApiResponse<LeaveRecordDocumentRow[]>>(`/leave-records/${leaveRecordId}/documents`)
  return res.data.data
}

export async function addLeaveRecordDocuments(leaveRecordId: number | string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  const res = await api.post<ApiResponse<{ document_ids: number[] }>>(
    `/leave-records/${leaveRecordId}/documents`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  )
  return res.data.data
}

export async function deleteLeaveRecordDocument(documentId: number | string) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/leave-records/documents/${documentId}`)
  return res.data.data
}

export async function getLeaveRecordStats() {
  const res = await api.get<ApiResponse<LeaveRecordStats>>('/leave-records/stats')
  return res.data.data
}
