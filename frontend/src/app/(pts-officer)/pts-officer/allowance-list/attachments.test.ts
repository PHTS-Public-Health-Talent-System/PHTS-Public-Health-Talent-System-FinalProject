import {
  buildAllowanceAttachmentOcrPolicy,
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceClearableOcrFileNameSet,
  buildAllowanceOcrDocuments,
  getAllowanceAttachmentOcrUiState,
  getAllowanceAttachmentNotice,
  getAllowanceAttachmentOcrDocumentTypeLabel,
  getAllowanceAttachmentOcrSummary,
  mergeAllowanceAttachments,
  shouldShowAllowanceAttachmentOcrAction,
} from "./attachments";

describe("mergeAllowanceAttachments", () => {
  test("prefers request source for OCR when the same file appears in both sources", () => {
    const items = mergeAllowanceAttachments({
      requestAttachments: [
        {
          attachment_id: 328,
          file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
          file_path: "uploads/request.pdf",
          file_type: "OTHER",
        },
      ],
      eligibilityAttachments: [
        {
          attachment_id: 11,
          file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
          file_path: "uploads/eligibility.pdf",
          file_type: "OTHER",
        },
      ],
    });

    expect(items).toEqual([
      {
        attachment_id: 328,
        delete_attachment_id: 11,
        file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
        file_path: "uploads/request.pdf",
        file_type: "OTHER",
        source: "request",
        sources: ["request", "eligibility"],
      },
    ]);
  });

  test("returns a clear notice when file has both source request and local copy", () => {
    const [item] = mergeAllowanceAttachments({
      requestAttachments: [
        {
          attachment_id: 328,
          file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
          file_path: "uploads/request.pdf",
          file_type: "OTHER",
        },
      ],
      eligibilityAttachments: [
        {
          attachment_id: 11,
          file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
          file_path: "uploads/eligibility.pdf",
          file_type: "OTHER",
        },
      ],
    });

    expect(getAllowanceAttachmentNotice(item)).toBe(
      "ไฟล์นี้มีทั้งต้นฉบับจากคำขอเดิมและสำเนาที่เพิ่มในหน้านี้ ปุ่มลบจะลบเฉพาะสำเนาที่เพิ่มในหน้านี้",
    );
  });

  test("returns OCR summary preview when OCR found text for the file", () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: "page-5-6.pdf",
        ok: true,
        markdown: "คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบ",
        document_kind: "general",
      }),
    ).toEqual({
      tone: "success",
      text: "OCR พบข้อความ: คำสั่งกลุ่มงานเภสัชกรรม",
    });
  });

  test("returns OCR summary when OCR completed but no text was found", () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: "page-5-6.pdf",
        ok: true,
        markdown: "",
      }),
    ).toEqual({
      tone: "muted",
      text: "ตรวจ OCR แล้ว แต่ยังไม่พบข้อความที่นำมาใช้ได้",
    });
  });

  test("skips noisy first line and shows first readable OCR line", () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: "page-2.pdf",
        ok: true,
        markdown: "ง 1 เร\nใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑",
      }),
    ).toEqual({
      tone: "success",
      text: "OCR พบข้อความ: ใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑",
    });
  });

  test("prefers latest OCR result immediately over stored results with same file name", () => {
    const resultMap = buildAllowanceAttachmentOcrResultMap({
      eligibilityResults: [
        {
          name: "page-5-6.pdf",
          ok: true,
          markdown: "ข้อความเก่า",
        },
      ],
      requestResults: [
        {
          name: "request.pdf",
          ok: true,
          markdown: "request text",
        },
      ],
      latestResults: [
        {
          name: "page-5-6.pdf",
          ok: true,
          markdown: "ข้อความใหม่",
        },
      ],
    });

    expect(resultMap.get("page-5-6.pdf")).toEqual(
      expect.objectContaining({
        markdown: "ข้อความใหม่",
      }),
    );
    expect(resultMap.get("request.pdf")).toEqual(
      expect.objectContaining({
        markdown: "request text",
      }),
    );
  });

  test("builds visible OCR documents from both source request and eligibility OCR", () => {
    const documents = buildAllowanceOcrDocuments({
      eligibilityResults: [
        {
          name: "page-5-6.pdf",
          ok: true,
          markdown: "คำสั่งกลุ่มงานเภสัชกรรม",
        },
      ],
      requestResults: [
        {
          name: "memo.pdf",
          ok: true,
          markdown: "บันทึกข้อความ",
        },
      ],
      visibleFileNames: ["page-5-6.pdf", "memo.pdf"],
    });

    expect(documents).toEqual([
      {
        fileName: "page-5-6.pdf",
        markdown: "คำสั่งกลุ่มงานเภสัชกรรม",
      },
      {
        fileName: "memo.pdf",
        markdown: "บันทึกข้อความ",
      },
    ]);
  });

  test("marks only eligibility-side OCR results as clearable", () => {
    const clearable = buildAllowanceClearableOcrFileNameSet({
      eligibilityResults: [
        {
          name: "page-5-6.pdf",
          ok: true,
          markdown: "คำสั่งกลุ่มงานเภสัชกรรม",
        },
      ],
      latestResults: [
        {
          name: "new-upload.pdf",
          ok: true,
          markdown: "ใหม่",
        },
      ],
      visibleFileNames: ["page-5-6.pdf", "new-upload.pdf"],
    });

    expect(clearable.has("page-5-6.pdf")).toBe(true);
    expect(clearable.has("new-upload.pdf")).toBe(true);
    expect(clearable.has("memo.pdf")).toBe(false);
  });

  test("ignores stale OCR results whose files are no longer visible in allowance attachments", () => {
    const resultMap = buildAllowanceAttachmentOcrResultMap({
      eligibilityResults: [
        {
          name: "20260213-004.pdf",
          ok: true,
          markdown: "บันทึกข้อความ",
        },
      ],
      requestResults: [
        {
          name: "page-5-6.pdf",
          ok: true,
          markdown: "คำสั่งกลุ่มงานเภสัชกรรม",
        },
      ],
      visibleFileNames: ["page-5-6.pdf"],
    });

    expect(resultMap.has("20260213-004.pdf")).toBe(false);
    expect(resultMap.has("page-5-6.pdf")).toBe(true);
  });

  test("hides OCR action when file already failed OCR or already passed OCR", () => {
    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: "general.pdf",
        ok: true,
        document_kind: "general",
      }),
    ).toBe(false);

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: "failed.pdf",
        ok: false,
        error: "ocr failed",
      }),
    ).toBe(false);

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: "assignment.pdf",
        ok: true,
        document_kind: "assignment_order",
      }),
    ).toBe(false);

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: "cleared.pdf",
        suppressed: true,
      }),
    ).toBe(true);

    expect(shouldShowAllowanceAttachmentOcrAction(undefined)).toBe(true);
  });

  test("builds OCR UI state centrally for suppressed warning-only files", () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: "page-5-6.pdf",
        result: {
          name: "page-5-6.pdf",
          ok: true,
          document_kind: "assignment_order",
        },
        documentLabel: "คำสั่งมอบหมายงาน",
        suppressActions: true,
        clearableFileNames: new Set(["page-5-6.pdf"]),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    });
  });

  test("builds OCR UI state centrally for license files", () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: "page-2.pdf",
        result: {
          name: "page-2.pdf",
          ok: true,
          document_kind: "license",
        },
        documentLabel: "ใบอนุญาต",
        suppressActions: false,
        clearableFileNames: new Set(["page-2.pdf"]),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    });
  });

  test("does not show OCR actions or reset hint for general documents", () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: "general.pdf",
        result: {
          name: "general.pdf",
          ok: true,
          document_kind: "general",
        },
        documentLabel: "เอกสารทั่วไป",
        suppressActions: false,
        clearableFileNames: new Set(["general.pdf"]),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    });
  });

  test("prefers backend document kind over noisy markdown re-detection", () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: "page-2.pdf",
        ok: true,
        markdown: "ง 1 เร",
        document_kind: "license",
      }),
    ).toBe("ใบอนุญาต");
  });

  test("falls back to frontend detection when backend still marks noisy assignment order as general", () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: "page-5-6.pdf",
        ok: true,
        markdown:
          "คําสังกลุ่มงานเภสัชกรรม\nที ๑/๒๕๒๐๕\nเรอง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน",
        document_kind: "general",
      }),
    ).toBe("คำสั่งมอบหมายงาน");
  });

  test("falls back to frontend detection when backend still marks noisy license as general", () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: "page-2.pdf",
        ok: true,
        markdown:
          "ใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑ ตออายุตรงที ๑\nใบอนุญาตประกอบวิชาจีตการแยายาลและการผดุงครรภ์",
        document_kind: "general",
      }),
    ).toBe("ใบอนุญาต");
  });

  test("builds unified OCR policy with warning-only state for assignment order that does not match person", () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: "page-5-6.pdf",
      personName: "นางสาวกันยกร กาญจนวัฒนากุล",
      result: {
        name: "page-5-6.pdf",
        ok: true,
        document_kind: "assignment_order",
        markdown:
          "คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบ\n1.2 นางสาวจริยา ใจใหญ่ เภสัชกรปฏิบัติการ",
      },
      clearableFileNames: new Set(["page-5-6.pdf"]),
    });

    expect(policy.documentLabel).toBe("คำสั่งมอบหมายงาน");
    expect(policy.notice).toBe(
      "เป็นคำสั่งมอบหมายงาน แต่ยังไม่พบชื่อบุคลากรคนนี้",
    );
    expect(policy.uiState).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    });
  });

  test("builds unified OCR policy with no run action for license files", () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: "page-2.pdf",
      personName: "นางสาวอัณศยาณัช แดงไฟ",
      result: {
        name: "page-2.pdf",
        ok: true,
        document_kind: "license",
        fields: {
          person_name: "นางสาวอัณศยาณัช แดงไฟ",
        },
      },
      clearableFileNames: new Set(["page-2.pdf"]),
    });

    expect(policy.documentLabel).toBe("ใบอนุญาต");
    expect(policy.notice).toBeNull();
    expect(policy.uiState.canRunOcr).toBe(false);
    expect(policy.uiState.canClearOcr).toBe(false);
    expect(policy.uiState.shouldShowResetHint).toBe(false);
  });
});
