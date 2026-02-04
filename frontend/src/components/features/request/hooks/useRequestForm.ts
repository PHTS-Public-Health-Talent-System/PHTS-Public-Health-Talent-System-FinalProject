"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { usePrefill } from "@/features/request/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createRequest,
  updateRequest,
  submitRequest,
  updateClassification,
  confirmAttachments as confirmAttachmentsApi,
} from "@/features/request/api";
import { toast } from "sonner";
import { mapRequestToFormData } from "./request-form-mapper";

const parseGroupItem = (groupId: string, itemId: string, subItemId?: string) => {
  const groupMatch = groupId.match(/\d+/);
  const group_no = groupMatch ? Number(groupMatch[0]) : null;

  // If itemId is empty, return nulls
  if (!itemId) {
    return { group_no, item_no: null, sub_item_no: null };
  }

  // Use itemId directly (assuming it matches DB e.g. "2.1", "2.2")
  // If subItemId is provided, use it directly (e.g. "2.2.1")
  return {
    group_no,
    item_no: itemId,
    sub_item_no: subItemId || null,
  };
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
      operation: true,
      planning: true,
      coordination: true,
      service: true,
    },
    files: [],
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

  const updateFormData = useCallback((key: keyof RequestFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleUploadFile = (file: File) => {
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, file],
    }));
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    if (!options?.initialRequest || initializedRef.current) return;
    const mapped = mapRequestToFormData(options.initialRequest);
    // Ensure files is initialized as array if coming from mapper as object (should handle mapper update too ideally, but here we can override)
    // Actually mapped.files might be problematic if mapper is not updated.
    // Let's assume mapper returns object, we ignore it for now or convert it?
    // attachments are separate.
    setFormData((prev) => ({
      ...prev,
      ...mapped,
      workAttributes: mapped.workAttributes ?? prev.workAttributes,
      classification: mapped.classification ?? prev.classification,
      files: [], // Reset local files on load, attachments handle existing
    }));
    setDraftRequestId(options.initialRequest.request_id);
    initializedRef.current = true;
  }, [options?.initialRequest]);

  // ... (prefill effects remain same) ...

  useEffect(() => {
    if (!prefill) return;
    if (!prefillOriginal) setPrefillOriginal(prefill);

    if (prefill.mission_group && !formData.missionGroup) {
      updateFormData("missionGroup", prefill.mission_group);
    }
    // ... (rest of prefill logic) ...
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

    // Auto-detect Profession from Position Name
    if (prefill.position_name && !formData.professionCode) {
      const pos = prefill.position_name;
      let detected: string | null = null;
      if (pos.includes("แพทย์")) detected = "DOCTOR";
      if (pos.includes("ทันตแพทย์")) detected = "DENTIST";
      else if (pos.includes("พยาบาล")) detected = "NURSE";
      else if (pos.includes("เภสัชกร")) detected = "PHARMACIST";
      else if (pos.includes("เทคนิคการแพทย์")) detected = "MED_TECH";
      else if (pos.includes("รังสี")) detected = "RAD_TECH";
      else if (pos.includes("กายภาพ")) detected = "PHYSIO";
      else if (pos.includes("จิตวิทยา")) detected = "CLIN_PSY";
      else if (pos.includes("กิจกรรมบำบัด")) detected = "OCC_THERAPY";
      else if (pos.includes("หัวใจและทรวงอก")) detected = "CARDIO_TECH";

      if (detected) {
        updateFormData("professionCode", detected);
        updateFormData("classification", {
          ...formData.classification,
          professionCode: detected,
        });
      }
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
    formData.professionCode,
    formData.classification,
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
      classification: {
        groupId: formData.classification.groupId,
        itemId: formData.classification.itemId,
        subItemId: formData.classification.subItemId,
        amount: formData.classification.amount,
        rateId: formData.classification.rateId,
        professionCode: formData.classification.professionCode,
      },
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

    // Append all files to 'files' key
    formData.files.forEach((file) => {
      fd.append("files", file);
    });

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
      const form = buildFormData(true);
      const request = draftRequestId
        ? await updateRequest(draftRequestId, form)
        : await createRequest(form);
      updateFormData("attachments", request.attachments ?? []);

      // Update classification with rateId if available
      const parsed = parseGroupItem(
        formData.classification.groupId,
        formData.classification.itemId,
        formData.classification.subItemId
      );
      if (parsed.group_no) {
        await updateClassification(request.request_id, {
          group_no: parsed.group_no,
          item_no: parsed.item_no || "",
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
  };
}
