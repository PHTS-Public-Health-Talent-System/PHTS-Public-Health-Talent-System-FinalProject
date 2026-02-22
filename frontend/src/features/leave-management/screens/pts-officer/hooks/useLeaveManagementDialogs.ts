import { useState } from 'react';
import type { LeaveRecord } from '@/features/leave-management/types/leaveManagement.types';

export function useLeaveManagementDialogs() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [editingReturnEventId, setEditingReturnEventId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');

  const openAddDialog = () => setShowAddDialog(true);
  const closeAddDialog = () => setShowAddDialog(false);

  const openEditDialog = (record: LeaveRecord) => {
    setSelectedLeave(record);
    setShowEditDialog(true);
  };
  const closeEditDialog = () => setShowEditDialog(false);

  const openDetailDialog = (record: LeaveRecord) => {
    setSelectedLeave(record);
    setShowDetailDialog(true);
  };
  const closeDetailDialog = () => setShowDetailDialog(false);

  const openDeleteAlert = (record: LeaveRecord) => {
    setSelectedLeave(record);
    setShowDeleteAlert(true);
  };
  const closeDeleteAlert = () => setShowDeleteAlert(false);

  const openReportDialog = (record: LeaveRecord) => {
    setSelectedLeave(record);
    setEditingReturnEventId(null);
    setShowReportDialog(true);
  };
  const closeReportDialog = () => {
    setShowReportDialog(false);
    setEditingReturnEventId(null);
  };

  const openEditReturnEventDialog = (eventId: number) => {
    setEditingReturnEventId(eventId);
    setShowDetailDialog(false);
    setShowReportDialog(true);
  };

  const openEditFromDetailDialog = () => {
    setShowDetailDialog(false);
    setShowEditDialog(true);
  };

  const openPreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const clearSelection = () => setSelectedLeave(null);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessDialog(true);
  };
  const closeSuccessDialog = () => setShowSuccessDialog(false);

  return {
    showAddDialog,
    showEditDialog,
    showDetailDialog,
    showReportDialog,
    showDeleteAlert,
    showSuccessDialog,
    successMessage,
    selectedLeave,
    editingReturnEventId,
    previewOpen,
    previewUrl,
    previewName,
    setShowAddDialog,
    setShowEditDialog,
    setShowDetailDialog,
    setShowReportDialog,
    setShowDeleteAlert,
    setShowSuccessDialog,
    setEditingReturnEventId,
    setPreviewOpen,
    openAddDialog,
    closeAddDialog,
    openEditDialog,
    closeEditDialog,
    openDetailDialog,
    closeDetailDialog,
    openDeleteAlert,
    closeDeleteAlert,
    openReportDialog,
    closeReportDialog,
    openEditReturnEventDialog,
    openEditFromDetailDialog,
    openPreview,
    clearSelection,
    showSuccess,
    closeSuccessDialog,
  };
}
