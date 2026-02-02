"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { usePrefill } from "@/features/request/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createRequest,
  updateRequest,
  getRequestById,
  submitRequest,
  updateClassification,
  confirmAttachments as confirmAttachmentsApi,
} from "@/features/request/api";
import { toast } from "sonner";
import { mapRequestToFormData } from "./request-form-mapper";

const parseGroupItem = (groupId: string, itemId: string) => {
  const groupMatch = groupId.match(/\d+/);
  const group_no = groupMatch ? Number(groupMatch[0]) : null;

  const rawItem = itemId.replace(/^item/, "");
  if (!rawItem) {
    return { group_no, item_no: null, sub_item_no: null };
  }

  const [itemPart, subPart] = rawItem.split("_");
  return {
    group_no,
    item_no: itemPart || null,
    sub_item_no: subPart || null,
  };
};

const shouldPollAttachments = (attachments: RequestFormData["attachments"]) => {
  const targets = (attachments ?? []).filter(
    (att) => att.file_type && att.file_type !== "SIGNATURE",
  );
  return targets.some((att) => att.ocr_status !== "COMPLETED");
};

export function useRequestForm(options?: { initialRequest?: RequestWithDetails }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prefill } = usePrefill();
  const initializedRef = useRef(false);
  const [formData, setFormData] = useState<RequestFormData>({
    requestType: "NEW",
    title: "",
    firstName: "",
    lastName: "",
    citizenId: "",
    employeeType: "CIVIL_SERVANT",
    positionName: "",
    positionNumber: "",
    department: "",
    subDepartment: "",
    employmentRegion: "REGIONAL",
    effectiveDate: "",
    missionGroup: "",
    workAttributes: {
      operation: false,
      planning: false,
      coordination: false,
      service: false,
    },
    files: {
      LICENSE: null,
      ORDER: null,
      OTHER: null,
    },
    ocrResult: null,
    recommendedClassification: null,
    classification: {
      groupId: "",
      itemId: "",
      amount: 0,
    },
    signatureMode: undefined,
    saveSignature: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [prefillOriginal, setPrefillOriginal] = useState<typeof prefill | null>(null);
  const [isOcrPolling, setIsOcrPolling] = useState(false);

  const updateFormData = useCallback((key: keyof RequestFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleUploadFile = (
    type: keyof RequestFormData["files"],
    file: File
  ) => {
    setFormData((prev) => ({
      ...prev,
      files: { ...prev.files, [type]: file },
    }));
  };

  const removeFile = (type: keyof RequestFormData["files"]) => {
    setFormData((prev) => ({
      ...prev,
      files: { ...prev.files, [type]: null },
    }));
  };

  useEffect(() => {
    if (!options?.initialRequest || initializedRef.current) return;
    const mapped = mapRequestToFormData(options.initialRequest);
    setFormData((prev) => ({
      ...prev,
      ...mapped,
      workAttributes: mapped.workAttributes ?? prev.workAttributes,
      classification: mapped.classification ?? prev.classification,
    }));
    setDraftRequestId(options.initialRequest.request_id);
    setIsOcrPolling(shouldPollAttachments(mapped.attachments));
    initializedRef.current = true;
  }, [options?.initialRequest]);

  useEffect(() => {
    if (!prefill) return;
    if (!prefillOriginal) setPrefillOriginal(prefill);

    if (prefill.mission_group && !formData.missionGroup) {
      updateFormData("missionGroup", prefill.mission_group);
    }

    if (!formData.title && prefill.title) updateFormData("title", prefill.title);
    if (!formData.firstName && prefill.first_name) updateFormData("firstName", prefill.first_name);
    if (!formData.lastName && prefill.last_name) updateFormData("lastName", prefill.last_name);
    if (!formData.citizenId && prefill.citizen_id) updateFormData("citizenId", prefill.citizen_id);
    if (!formData.positionName && prefill.position_name) updateFormData("positionName", prefill.position_name);
    if (!formData.positionNumber && prefill.position_number) {
      updateFormData("positionNumber", prefill.position_number);
    }
    if (!formData.department && prefill.department) updateFormData("department", prefill.department);
    if (!formData.subDepartment && prefill.sub_department) {
      updateFormData("subDepartment", prefill.sub_department);
    }
    if (!formData.effectiveDate && prefill.first_entry_date) {
      updateFormData("effectiveDate", prefill.first_entry_date);
    }

    if (prefill.employee_type && formData.employeeType === "CIVIL_SERVANT") {
      const normalized = String(prefill.employee_type).trim().toUpperCase();
      const directMap: Record<string, RequestFormData["employeeType"]> = {
        CIVIL_SERVANT: "CIVIL_SERVANT",
        GOV_EMPLOYEE: "GOV_EMPLOYEE",
        GOVERNMENT_EMPLOYEE: "GOV_EMPLOYEE",
        PH_EMPLOYEE: "PH_EMPLOYEE",
        PUBLIC_HEALTH_EMPLOYEE: "PH_EMPLOYEE",
        TEMP_EMPLOYEE: "TEMP_EMPLOYEE",
        TEMPORARY_EMPLOYEE: "TEMP_EMPLOYEE",
      };

      const mapped =
        directMap[normalized] ||
        (normalized.includes("ข้าราชการ") ? "CIVIL_SERVANT" : "") ||
        (normalized.includes("พนักงานราชการ") ? "GOV_EMPLOYEE" : "") ||
        (normalized.includes("พนักงานกระทรวงสาธารณสุข") ? "PH_EMPLOYEE" : "") ||
        (normalized.includes("ลูกจ้างชั่วคราว") ? "TEMP_EMPLOYEE" : "") ||
        "CIVIL_SERVANT";

      updateFormData("employeeType", mapped as RequestFormData["employeeType"]);
    }
  }, [
    prefill,
    prefillOriginal,
    formData.missionGroup,
    formData.title,
    formData.firstName,
    formData.lastName,
    formData.citizenId,
    formData.positionName,
    formData.positionNumber,
    formData.department,
    formData.subDepartment,
    formData.effectiveDate,
    formData.employeeType,
    updateFormData,
  ]);

  useEffect(() => {
    if (formData.firstName || formData.lastName) return;
    const fullName = prefill
      ? `${prefill.first_name ?? ""} ${prefill.last_name ?? ""}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    const [first, ...rest] = fullName.split(" ");
    if (!formData.firstName) updateFormData("firstName", first || "");
    if (!formData.lastName) updateFormData("lastName", rest.join(" ") || "");
  }, [prefill, user, formData.firstName, formData.lastName, updateFormData]);

  useEffect(() => {
    if (formData.effectiveDate) return;
    const today = new Date().toISOString().split("T")[0];
    updateFormData("effectiveDate", today);
  }, [formData.effectiveDate, updateFormData]);

  useEffect(() => {
    if (!draftRequestId) return;
    let isActive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const request = await getRequestById(draftRequestId);
        if (!isActive) return;
        updateFormData("attachments", request.attachments ?? []);
        const polling = shouldPollAttachments(request.attachments ?? []);
        setIsOcrPolling(polling);
        if (!polling && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch {
        // Silent retry; OCR can be slow
      }
    };

    poll();
    timer = setInterval(poll, 3000);

    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
    };
  }, [draftRequestId, updateFormData]);

  const buildFormData = (includeSignature = true): FormData => {
    const fd = new FormData();

    // Map wizard requestType to backend request_type
    const typeMap: Record<string, string> = {
      NEW: "NEW_ENTRY",
      EDIT: "EDIT_INFO_SAME_RATE",
      CHANGE_RATE: "EDIT_INFO_NEW_RATE",
    };
    fd.append("request_type", typeMap[formData.requestType] ?? formData.requestType);
    fd.append("personnel_type", formData.employeeType);
    const submissionData = {
      title: formData.title,
      first_name: formData.firstName,
      last_name: formData.lastName,
      position_name: formData.positionName,
      department: formData.department,
      sub_department: formData.subDepartment,
      employment_region: formData.employmentRegion,
    };
    fd.append("submission_data", JSON.stringify(submissionData));
    fd.append("citizen_id", formData.citizenId);
    fd.append("position_number", formData.positionNumber);
    fd.append("department_group", formData.department);
    fd.append("main_duty", formData.missionGroup);
    fd.append("requested_amount", String(formData.classification.amount ?? 0));
    fd.append(
      "effective_date",
      formData.effectiveDate || new Date().toISOString().split("T")[0]
    );
    fd.append("work_attributes", JSON.stringify(formData.workAttributes));

    if (formData.files.LICENSE) fd.append("license_file", formData.files.LICENSE);
    if (formData.files.ORDER) fd.append("files", formData.files.ORDER);
    if (formData.files.OTHER) fd.append("files", formData.files.OTHER);

    if (includeSignature && formData.signatureMode === "NEW" && formData.signature) {
      const byteString = atob(formData.signature.split(",")[1] ?? "");
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: "image/png" });
      fd.append("applicant_signature", blob, `signature_${Date.now()}.png`);
      if (formData.saveSignature === false) {
        fd.append("save_signature", "false");
      }
    }

    return fd;
  };

  const confirmAttachments = async () => {
    setIsSubmitting(true);
    try {
      const form = buildFormData(false);
      const request = draftRequestId
        ? await updateRequest(draftRequestId, form)
        : await createRequest(form);

      if (!draftRequestId) setDraftRequestId(request.request_id);
      updateFormData("id", String(request.request_id));
      updateFormData("attachments", request.attachments ?? []);

      const attachments = request.attachments ?? [];
      const license = attachments.find((att) => att.file_type === "LICENSE");

      if (license?.attachment_id) {
        await confirmAttachmentsApi(request.request_id);
        updateFormData("ocrResult", {
          licenseNo: "-",
          expiryDate: "-",
          confidence: 0,
          attachmentId: license.attachment_id,
        });
      }

      if (!license?.attachment_id) {
        updateFormData("ocrResult", null);
        updateFormData("recommendedClassification", null);
        toast.warning("ไม่พบไฟล์ใบอนุญาตสำหรับ OCR");
        return false;
      }

      return true;
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRequestFlow = async () => {
    setIsSubmitting(true);
    try {
      const attachments = formData.attachments ?? [];
      const ocrTargets = attachments.filter(
        (att) => att.file_type && att.file_type !== "SIGNATURE",
      );
      const ocrPending = ocrTargets.filter((att) => att.ocr_status !== "COMPLETED");
      const ocrFailed = ocrTargets.filter((att) => att.ocr_status === "FAILED");
      if (ocrFailed.length > 0) {
        toast.error("OCR ล้มเหลว กรุณาอัปโหลดเอกสารใหม่ก่อนยื่นคำขอ");
        return;
      }
      if (ocrTargets.length > 0 && ocrPending.length > 0) {
        toast.error("กำลังวิเคราะห์เอกสาร กรุณารอให้ OCR เสร็จครบก่อนยื่นคำขอ");
        return;
      }
      const form = buildFormData(true);
      const request = draftRequestId
        ? await updateRequest(draftRequestId, form)
        : await createRequest(form);
      updateFormData("attachments", request.attachments ?? []);

      const parsed = parseGroupItem(formData.classification.groupId, formData.classification.itemId);
      if (parsed.group_no && parsed.item_no) {
        await updateClassification(request.request_id, {
          group_no: parsed.group_no,
          item_no: parsed.item_no,
          sub_item_no: parsed.sub_item_no,
        });
      }

      await submitRequest(request.request_id);
      toast.success("ยื่นคำขอเรียบร้อยแล้ว");
      router.push("/dashboard/user");
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งคำขอ";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateStep = (): boolean => true;

  return {
    formData,
    updateFormData,
    handleUploadFile,
    removeFile,
    isSubmitting,
    submitRequest: submitRequestFlow,
    validateStep,
    confirmAttachments,
    prefillOriginal,
    isOcrPolling,
  };
}
