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
  updateRateMapping,
  confirmAttachments as confirmAttachmentsApi,
} from "@/features/request/api";
import { toast } from "sonner";
import { mapRequestToFormData } from "./request-form-mapper";

const detectProfessionFromPosition = (positionName: string): string | null => {
  const pos = positionName.trim();
  if (!pos) return null;
  if (pos.includes("ทันตแพทย์")) return "DENTIST";
  if (pos.includes("เทคนิคการแพทย์")) return "MED_TECH";
  if (pos.includes("รังสีการแพทย์") || pos.includes("รังสี")) return "RAD_TECH";
  if (pos.includes("กายภาพ")) return "PHYSIO";
  if (pos.includes("กิจกรรมบำบัด")) return "OCC_THERAPY";
  if (pos.includes("จิตวิทยา")) return "CLIN_PSY";
  if (pos.includes("หัวใจและทรวงอก")) return "CARDIO_TECH";
  if (pos.includes("เภสัชกร")) return "PHARMACIST";
  if (pos.includes("พยาบาล")) return "NURSE";
  if (pos.includes("แพทย์") && !pos.includes("การแพทย์")) return "DOCTOR";
  return null;
};

const INITIAL_FORM_DATA: RequestFormData = {
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
  rateMapping: {
    groupId: "",
    itemId: "",
    amount: 0,
  },
  files: [],
  signatureMode: undefined,
};

const parseGroupItem = (groupId: string, itemId: string, subItemId?: string) => {
  const groupMatch = groupId.match(/\d+/);
  const group_no = groupMatch ? Number(groupMatch[0]) : null;

  // If itemId is empty, return nulls
  if (!itemId || itemId === "__NONE__") {
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


export function useRequestForm(options?: {
  initialRequest?: RequestWithDetails;
  returnPath?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prefill } = usePrefill();
  const initializedRef = useRef(false);
  const touchedKeysRef = useRef<Set<keyof RequestFormData>>(new Set());
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnPath = options?.returnPath ?? "/user/my-requests";
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [prefillOriginal, setPrefillOriginal] = useState<typeof prefill | null>(null);
  const prefillCitizenRef = useRef<string | null>(null);

  // Internal setter that must NOT mark the field as user-touched (used by prefill/system updates).
  const setFormDataField = useCallback((key: keyof RequestFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Public updater used by UI. Marks the field as touched so subsequent prefill won't overwrite it.
  const updateFormData = useCallback(
    (key: keyof RequestFormData, value: unknown) => {
      touchedKeysRef.current.add(key);
      setFormDataField(key, value);
    },
    [setFormDataField],
  );

  const handleUploadFile = (file: File) => {
    setFormData((prev) => ({
      ...prev,
      // Prevent duplicate selections in the same client session.
      files: prev.files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified,
      )
        ? prev.files
        : [...prev.files, file],
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
      rateMapping: mapped.rateMapping ?? prev.rateMapping,
      files: [], // Reset local files on load, attachments handle existing
    }));
    setDraftRequestId(options.initialRequest.request_id);
    initializedRef.current = true;
  }, [options?.initialRequest]);

  // ... (prefill effects remain same) ...

  useEffect(() => {
    if (options?.initialRequest) return;
    const currentCitizenId = String(prefill?.citizen_id ?? "").trim();
    if (!currentCitizenId) return;

    if (!prefillCitizenRef.current) {
      prefillCitizenRef.current = currentCitizenId;
      return;
    }
    if (prefillCitizenRef.current === currentCitizenId) return;

    prefillCitizenRef.current = currentCitizenId;
    touchedKeysRef.current.clear();
    setDraftRequestId(null);
    setPrefillOriginal(prefill);
    setFormData((prev) => ({
      ...INITIAL_FORM_DATA,
      requestType: prev.requestType,
    }));
  }, [options?.initialRequest, prefill]);

  useEffect(() => {
    if (!prefill) return;
    if (!prefillOriginal) setPrefillOriginal(prefill);

    const setPrefillIfEmpty = (key: keyof RequestFormData, value?: string | null) => {
      if (touchedKeysRef.current.has(key)) return;
      const next = String(value ?? "").trim();
      if (!next) return;
      setFormData((prev) => {
        const currentValue = prev[key];
        const current =
          typeof currentValue === "string"
            ? currentValue.trim()
            : String(currentValue ?? "").trim();
        if (current) return prev;
        return { ...prev, [key]: next };
      });
    };

    if (!touchedKeysRef.current.has("missionGroup")) {
      const position = (prefill.position_name || (prefill as { position?: string }).position || "").trim();
      const dept = prefill.department?.trim();
      const subDept = prefill.sub_department?.trim();
      const deptText = dept ? `${dept}${subDept ? `/${subDept}` : ""}` : "";
      const missionPrefill = [position, deptText].filter(Boolean).join(" ").trim();
      if (missionPrefill) setPrefillIfEmpty("missionGroup", missionPrefill);
    }

    setPrefillIfEmpty("title", prefill.title);
    setPrefillIfEmpty("firstName", prefill.first_name);
    setPrefillIfEmpty("lastName", prefill.last_name);
    setPrefillIfEmpty("citizenId", prefill.citizen_id);
    setPrefillIfEmpty("positionName", prefill.position_name);
    setPrefillIfEmpty("positionNumber", prefill.position_number);
    setPrefillIfEmpty("department", prefill.department);
    setPrefillIfEmpty("subDepartment", prefill.sub_department);
    setPrefillIfEmpty("effectiveDate", prefill.first_entry_date);

    if (!touchedKeysRef.current.has("employeeType") && prefill.employee_type && formData.employeeType === "CIVIL_SERVANT") {
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
  
        setFormDataField("employeeType", mapped as RequestFormData["employeeType"]);
    }

    // Auto-detect Profession from Position Name
    if (
      !touchedKeysRef.current.has("professionCode") &&
      !touchedKeysRef.current.has("rateMapping") &&
      prefill.position_name &&
      !formData.professionCode
    ) {
      const detected =
        (typeof (prefill as { profession_code?: string }).profession_code === "string"
          ? (prefill as { profession_code?: string }).profession_code!.trim().toUpperCase()
          : "") ||
        detectProfessionFromPosition(prefill.position_name) ||
        detectProfessionFromPosition(formData.positionName);

      if (detected) {
        setFormDataField("professionCode", detected);
        setFormDataField("rateMapping", {
          ...formData.rateMapping,
          professionCode: detected,
        });
      }
    }
  }, [
    prefill,
    prefillOriginal,
    formData.employeeType,
    formData.professionCode,
    formData.positionName,
    formData.rateMapping,
    setFormDataField,
  ]);

  useEffect(() => {
    if (touchedKeysRef.current.has("firstName") || touchedKeysRef.current.has("lastName")) return;
    if (formData.firstName || formData.lastName) return;
    const fullName = prefill
      ? `${prefill.first_name ?? ""} ${prefill.last_name ?? ""}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    const [first, ...rest] = fullName.split(" ");
    if (!formData.firstName) setFormDataField("firstName", first || "");
    if (!formData.lastName) setFormDataField("lastName", rest.join(" ") || "");
  }, [prefill, user, formData.firstName, formData.lastName, setFormDataField]);

  useEffect(() => {
    if (touchedKeysRef.current.has("effectiveDate")) return;
    if (formData.effectiveDate) return;
    const today = new Date().toISOString().split("T")[0];
    setFormDataField("effectiveDate", today);
  }, [formData.effectiveDate, setFormDataField]);


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
      rate_mapping: {
        groupId: formData.rateMapping.groupId,
        itemId: formData.rateMapping.itemId,
        subItemId: formData.rateMapping.subItemId,
        amount: formData.rateMapping.amount,
        rateId: formData.rateMapping.rateId,
        professionCode: formData.rateMapping.professionCode,
      },
    };
    fd.append("submission_data", JSON.stringify(submissionData));
    fd.append("citizen_id", formData.citizenId);
    fd.append("position_number", formData.positionNumber);
    fd.append("department_group", formData.department);
    fd.append("main_duty", formData.missionGroup);
    fd.append("requested_amount", String(formData.rateMapping.amount ?? 0));
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
      setFormDataField("id", String(request.request_id));
      setFormDataField("attachments", request.attachments ?? []);
      setFormDataField("files", []);

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
      setFormDataField("attachments", request.attachments ?? []);
      setFormDataField("files", []);

      // Update rate mapping with rateId if available
      const parsed = parseGroupItem(
        formData.rateMapping.groupId,
        formData.rateMapping.itemId,
        formData.rateMapping.subItemId
      );
      if (parsed.group_no) {
        await updateRateMapping(request.request_id, {
          group_no: parsed.group_no,
          item_no: parsed.item_no || "",
          sub_item_no: parsed.sub_item_no,
        });
      }

      await submitRequest(request.request_id);
      toast.success("ยื่นคำขอเรียบร้อยแล้ว");
      router.push(returnPath);
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
