"use client";

import ExcelJS from "@andreeewill/exceljs/dist/exceljs.min.js";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AreaOption = {
  id?: number | null;
  name: string;
};

type ImportRow = {
  row: number;
  office_number: number;
  observer_name: string;
  phone: string;
  voter_number: string;
  rbo: string;
};

type ManualObserverDraft = {
  observer_name: string;
  phone: string;
  voter_number: string;
  rbo: string;
};

type PreviewIssue = {
  code: string;
  message: string;
  row?: number;
  field?: string;
  office_number?: number;
  office_numbers?: number[];
  fields?: string[];
  matched_rows?: number[];
  matched_office_numbers?: number[];
  identity_field?: string;
  identity_value?: string | number | null;
  representative_id?: number;
  current?: ImportConflictPerson;
  imported?: ImportConflictPerson;
};

type ImportConflictPerson = {
  name?: string | null;
  phone?: string | null;
  voter_number?: string | null;
  rbo?: string | null;
};

type ImportConflict = {
  office_number: number;
  row: number;
  code: string;
  message: string;
  current: ImportConflictPerson & {
    representative_id: number;
    assignment_id: number;
  };
  imported: ImportConflictPerson;
  differences: string[];
  selected_action: "skip" | "replace";
  allowed_actions: Array<"skip" | "replace">;
};

type PreviewData = {
  valid: boolean;
  row_count: number;
  constituency: { id: number; name: string; code: string };
  area: { id: number; name: string; code: string };
  offices: {
    matched: number;
    with_observer: number;
    without_observer: number;
    missing: number;
  };
  representatives: {
    new: number;
    reused: number;
    enriched: number;
    incomplete: number;
    skipped_without_name: number;
  };
  assignments: {
    new: number;
    reused: number;
    conflicts: number;
    replace_selected: number;
    skip_selected: number;
  };
  conflicts: ImportConflict[];
  source_updates: number;
  errors: PreviewIssue[];
  warnings: PreviewIssue[];
  row_reviews: PreviewIssue[];
};

type CommitData = {
  counts: {
    representatives_created: number;
    representatives_reused: number;
    representatives_enriched: number;
    assignments_created: number;
    assignments_reused: number;
    assignments_replaced?: number;
    conflicts_skipped?: number;
    offices_source_updated: number;
  };
};

type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type Props = {
  electionId: string;
  constituencyId: number;
  areas: AreaOption[];
};

type BrowserXlsxLoader = {
  load(data: ArrayBuffer): Promise<ExcelJS.Workbook>;
};

type HeaderMap = {
  row: number;
  officeNumber: number;
  observerName: number;
  phone: number | null;
  voterNumber: number | null;
  rbo: number | null;
};

type ParsedObserverWorkbook = {
  rows: ImportRow[];
  worksheetName: string;
  headerRow: number;
  detectedFields: {
    phone: boolean;
    voterNumber: boolean;
    rbo: boolean;
  };
};

const previewFieldLabels: Record<string, string> = {
  observer_name: "اسم المراقب",
  name: "الاسم",
  phone: "رقم الهاتف",
  voter_number: "رقم الناخب",
  rbo: "ر ب و",
  office_number: "رقم مكتب التصويت",
  assignment: "التعيين",
  representative: "المراقب",
  row: "السطر",
};

function previewIssueMessage(issue: PreviewIssue) {
  const fields = (issue.fields ?? [])
    .map((field) => previewFieldLabels[field] ?? field)
    .join("، ");

  switch (issue.code) {
    case "observer_missing_skipped":
      return "لا يوجد اسم مراقب في هذا السطر؛ سيبقى مكتب التصويت بدون مراقب، ولن يمنع ذلك استيراد بقية اللائحة.";
    case "missing_observer_fields":
      return fields
        ? `بيانات المراقب غير مكتملة. الحقول الناقصة: ${fields}.`
        : "بيانات المراقب غير مكتملة.";
    case "duplicate_phone":
      return "رقم الهاتف نفسه مستعمل لأكثر من مراقب في اللائحة.";
    case "duplicate_voter_number":
      return "رقم الناخب نفسه مستعمل لأكثر من مراقب في اللائحة.";
    case "duplicate_rbo":
      return "رقم ر ب و نفسه مستعمل لأكثر من مراقب في اللائحة.";
    case "source_observer_metadata_change":
      return "ستتغير بيانات المراقب المسجلة كمصدر لهذا المكتب إذا تم تنفيذ الاستيراد.";
    case "invalid_row":
      return "تعذر قراءة هذا السطر من ملف Excel.";
    case "invalid_office_number":
      return "رقم مكتب التصويت غير صالح؛ يجب أن يكون رقمًا صحيحًا موجبًا.";
    case "duplicate_office_number":
      return "مكتب التصويت نفسه مكرر أكثر من مرة داخل الملف.";
    case "office_not_found":
      return "رقم مكتب التصويت غير موجود ضمن الجماعة / المقاطعة المختارة.";
    case "batch_identity_review": {
      const identityLabel =
        issue.identity_field === "rbo"
          ? "ر ب و"
          : issue.identity_field === "voter_number"
            ? "رقم الناخب"
            : issue.identity_field === "phone_name"
              ? "الهاتف + الاسم"
              : "هوية المراقب";
      const rowRefs = issue.matched_rows?.length
        ? `السطر ${issue.matched_rows.join("، ")}`
        : "سطر آخر";
      const officeRefs = issue.matched_office_numbers?.length
        ? ` (مكتب ${issue.matched_office_numbers.join("، ")})`
        : "";
      const diff = fields ? ` وتختلف الحقول: ${fields}` : "";
      return `${identityLabel} «${issue.identity_value ?? "—"}» مطابق لـ ${rowRefs}${officeRefs}${diff}. تم قبول هذا السطر كمراقب مستقل ويحتاج إلى مراجعة.`;
    }
    case "existing_representative_review": {
      const officeRefs = issue.matched_office_numbers?.length
        ? ` وهو مرتبط حاليًا بالمكتب/المكاتب ${issue.matched_office_numbers.join("، ")}`
        : "";
      const diff = fields ? ` الحقول المختلفة: ${fields}.` : "";
      return `يوجد مراقب مسجل في النظام بنفس الهوية (السجل #${issue.representative_id ?? "—"})${officeRefs}، لكن بياناته تختلف عن هذا السطر.${diff} تم قبول السطر كسجل مستقل دون الكتابة فوق السجل الموجود.`;
    }
    case "batch_identity_conflict":
      return "بيانات المراقب نفسه متعارضة بين أكثر من سطر في الملف.";
    case "ambiguous_existing_representative":
      return "يوجد أكثر من مراقب مسجل يطابق هذه الهوية؛ يلزم حسم السجل الصحيح.";
    case "existing_representative_conflict":
      return "بيانات المراقب الموجود في النظام تتعارض مع البيانات الواردة في الملف.";
    case "existing_primary_assignment_conflict":
      return "مكتب التصويت لديه مراقب أساسي مختلف مسجل حاليًا.";
    default:
      return "توجد ملاحظة على هذا السطر تحتاج إلى مراجعة قبل الاستيراد.";
  }
}

function safeArabicBackendMessage(
  message: string | undefined,
  fallback: string,
) {
  return message && /[\u0600-\u06FF]/.test(message) ? message : fallback;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

function excelCellValueText(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") return "";

  const complex = value as {
    text?: unknown;
    richText?: Array<{ text?: unknown } | null>;
    result?: unknown;
    formula?: unknown;
    sharedFormula?: unknown;
  };

  if (Array.isArray(complex.richText)) {
    return complex.richText
      .map((part) => excelCellValueText(part?.text))
      .join("");
  }

  if (complex.text !== null && complex.text !== undefined) {
    return excelCellValueText(complex.text);
  }

  if (complex.result !== null && complex.result !== undefined) {
    return excelCellValueText(complex.result);
  }

  if (complex.formula !== null && complex.formula !== undefined) {
    return excelCellValueText(complex.formula);
  }

  if (
    complex.sharedFormula !== null &&
    complex.sharedFormula !== undefined
  ) {
    return excelCellValueText(complex.sharedFormula);
  }

  return "";
}

function safeCellText(cell: ExcelJS.Cell) {
  try {
    return excelCellValueText(cell.value);
  } catch {
    return "";
  }
}

function workbookReadErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  return message && /[\u0600-\u06FF]/.test(message)
    ? message
    : "تعذر قراءة بعض خلايا ملف Excel بسبب تنسيق داخلي غير معتاد. لا تعدّل الملف؛ أعد اختياره بعد تحديث الصفحة، وإذا استمر الخطأ فأرسل الملف نفسه للفحص.";
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function positiveInteger(value: unknown) {
  const parsed = Number(normalizeDigits(normalizeText(value)));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function findHeaders(worksheet: ExcelJS.Worksheet): HeaderMap | null {
  const maxRows = Math.min(worksheet.rowCount, 40);

  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells = new Map<string, number>();
    const maxColumns = Math.max(row.cellCount, 12);

    for (let column = 1; column <= maxColumns; column += 1) {
      const key = normalizeText(safeCellText(row.getCell(column)));
      if (key) cells.set(key, column);
    }

    const entries = [...cells.entries()];
    const officeNumber = entries.find(
      ([key]) =>
        key.includes("رقم") &&
        key.includes("مكتب") &&
        key.includes("التصويت"),
    )?.[1];
    const observerName = entries.find(
      ([key]) =>
        key.includes("اسم المراقب") ||
        key.includes("الاسم الكامل"),
    )?.[1];
    const phone = entries.find(
      ([key]) => key.includes("رقم الهاتف") || key === "الهاتف",
    )?.[1];
    const voterNumber = entries.find(
      ([key]) => key.includes("رقم الناخب"),
    )?.[1];
    const rbo = entries.find(
      ([key]) => key.replace(/\s+/g, "") === "ربو",
    )?.[1];

    if (officeNumber && observerName) {
      return {
        row: rowNumber,
        officeNumber,
        observerName,
        phone: phone ?? null,
        voterNumber: voterNumber ?? null,
        rbo: rbo ?? null,
      };
    }
  }

  return null;
}

async function parseObserverWorkbook(
  file: File,
): Promise<ParsedObserverWorkbook> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("الصيغة المطلوبة هي XLSX فقط.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("حجم الملف يتجاوز 8 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  const browserXlsx = workbook.xlsx as unknown as BrowserXlsxLoader;
  await browserXlsx.load(await file.arrayBuffer());

  const preferred = workbook.getWorksheet("معطيات المراقبين");
  const worksheets = [
    ...(preferred ? [preferred] : []),
    ...workbook.worksheets.filter((sheet) => sheet !== preferred),
  ];

  let worksheet: ExcelJS.Worksheet | null = null;
  let header: HeaderMap | null = null;

  for (const candidate of worksheets) {
    const detected = findHeaders(candidate);
    if (detected) {
      worksheet = candidate;
      header = detected;
      break;
    }
  }

  if (!worksheet || !header) {
    throw new Error(
      "لم أتعرف على تنسيق الملف: يجب أن يحتوي على «رقم مكتب التصويت» و«الإسم الكامل/اسم المراقب».",
    );
  }

  const rows: ImportRow[] = [];

  for (
    let rowNumber = header.row + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const officeNumber = positiveInteger(
      safeCellText(row.getCell(header.officeNumber)),
    );
    const observerName = normalizeText(
      safeCellText(row.getCell(header.observerName)),
    );

    if (!officeNumber && !observerName) continue;
    if (!officeNumber) {
      throw new Error(`السطر ${rowNumber}: رقم مكتب التصويت غير صالح.`);
    }

    rows.push({
      row: rowNumber,
      office_number: officeNumber,
      observer_name: observerName,
      phone: header.phone
        ? normalizeText(safeCellText(row.getCell(header.phone)))
        : "",
      voter_number: header.voterNumber
        ? normalizeText(safeCellText(row.getCell(header.voterNumber)))
        : "",
      rbo: header.rbo
        ? normalizeText(safeCellText(row.getCell(header.rbo)))
        : "",
    });
  }

  if (!rows.length) {
    throw new Error("لم أجد صفوف مراقبين قابلة للقراءة.");
  }

  return {
    rows,
    worksheetName: worksheet.name,
    headerRow: header.row,
    detectedFields: {
      phone: Boolean(header.phone),
      voterNumber: Boolean(header.voterNumber),
      rbo: Boolean(header.rbo),
    },
  };
}

export function RepresentativeImportWorkspace({
  electionId,
  constituencyId,
  areas,
}: Props) {
  const router = useRouter();
  const selectableAreas = areas.filter(
    (area): area is AreaOption & { id: number } => Boolean(area.id),
  );
  const [areaId, setAreaId] = useState(
    selectableAreas.length === 1 ? String(selectableAreas[0].id) : "",
  );
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [sourceInfo, setSourceInfo] = useState<ParsedObserverWorkbook | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, "skip" | "replace">
  >({});
  const [commit, setCommit] = useState<CommitData | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [manualRows, setManualRows] = useState<number[]>([]);
  const [rowDraft, setRowDraft] = useState<ManualObserverDraft>({
    observer_name: "",
    phone: "",
    voter_number: "",
    rbo: "",
  });
  const [rowEditError, setRowEditError] = useState("");

  async function onFileChange(file: File | undefined) {
    setError("");
    setPreview(null);
    setConflictChoices({});
    setCommit(null);
    setConfirmed(false);
    setEditingRow(null);
    setManualRows([]);
    setRowEditError("");
    if (!file) {
      setFileName("");
      setRows([]);
      setSourceInfo(null);
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseObserverWorkbook(file);
      setFileName(file.name);
      setRows(parsed.rows);
      setSourceInfo(parsed);
    } catch (cause) {
      setRows([]);
      setSourceInfo(null);
      setFileName("");
      setError(workbookReadErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function payload(inputRows: ImportRow[] = rows) {
    return {
      local_constituency_id: constituencyId,
      polling_area_id: Number(areaId),
      source_filename: fileName,
      rows: inputRows,
      conflict_resolutions: conflictChoices,
    };
  }

  async function runPreview(inputRows: ImportRow[] = rows) {
    if (!areaId || !inputRows.length) {
      setError("اختر الجماعة / المقاطعة وحمّل ملف XLSX أولًا.");
      return;
    }

    setBusy(true);
    setError("");
    setCommit(null);
    setConfirmed(false);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/representative-import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(inputRows)),
        },
      );
      const envelope = (await response
        .json()
        .catch(() => null)) as Envelope<PreviewData> | null;
      if (!response.ok || !envelope?.success || !envelope.data) {
        setError(
          safeArabicBackendMessage(
            envelope?.error?.message,
            "تعذر تنفيذ معاينة اللائحة. راجع البيانات ثم أعد المحاولة.",
          ),
        );
        return;
      }
      setPreview(envelope.data);
      setConflictChoices(
        Object.fromEntries(
          envelope.data.conflicts.map((conflict) => [
            String(conflict.office_number),
            conflict.selected_action ?? "skip",
          ]),
        ),
      );
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  function beginManualObserver(row: ImportRow) {
    setEditingRow(row.row);
    setRowDraft({
      observer_name: row.observer_name,
      phone: row.phone,
      voter_number: row.voter_number,
      rbo: row.rbo,
    });
    setRowEditError("");
  }

  function cancelManualObserver() {
    setEditingRow(null);
    setRowEditError("");
  }

  async function saveManualObserver(row: ImportRow) {
    const observerName = normalizeText(rowDraft.observer_name);
    if (!observerName) {
      setRowEditError("اسم المراقب مطلوب.");
      return;
    }

    const nextRows = rows.map((item) =>
      item.row === row.row
        ? {
            ...item,
            observer_name: observerName,
            phone: normalizeText(rowDraft.phone),
            voter_number: normalizeText(rowDraft.voter_number),
            rbo: normalizeText(rowDraft.rbo),
          }
        : item,
    );

    setRows(nextRows);
    setManualRows((current) =>
      current.includes(row.row) ? current : [...current, row.row],
    );
    setEditingRow(null);
    setRowEditError("");
    await runPreview(nextRows);
  }

  async function runCommit() {
    if (!preview?.valid || !confirmed) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/representative-import/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const envelope = (await response
        .json()
        .catch(() => null)) as Envelope<CommitData> | null;
      if (!response.ok || !envelope?.success || !envelope.data) {
        setError(
          safeArabicBackendMessage(
            envelope?.error?.message,
            "تعذر تنفيذ استيراد لائحة المراقبين.",
          ),
        );
        return;
      }
      setCommit(envelope.data);
      setConfirmed(false);
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  const reviewByRow = new Map<number, PreviewIssue[]>();
  for (const review of preview?.row_reviews ?? []) {
    if (!review.row) continue;
    const current = reviewByRow.get(review.row) ?? [];
    current.push(review);
    reviewByRow.set(review.row, current);
  }
  for (const warning of preview?.warnings ?? []) {
    if (
      warning.code !== "observer_missing_skipped" ||
      !warning.row
    ) {
      continue;
    }
    const current = reviewByRow.get(warning.row) ?? [];
    if (!current.some((item) => item.code === warning.code)) {
      current.push(warning);
      reviewByRow.set(warning.row, current);
    }
  }

  return (
    <section className="representative-import-card">
      <div className="representative-import-head">
        <div>
          <span>Excel · مراقبو مكاتب التصويت</span>
          <h2>استيراد الملف المعتمد كما هو</h2>
          <p>
            لا تحتاج إلى إعداد Template خاص بـ Geniura أو تعديل الملف الخارجي.
            نكتشف الورقة وصف العناوين وترتيب الأعمدة تلقائيًا، ثم نربط بالدائرة
            + الجماعة / المقاطعة + رقم مكتب التصويت، وليس برقم المكتب المركزي.
          </p>
        </div>
      </div>

      <div className="representative-import-controls">
        <label>
          <span>الجماعة / المقاطعة</span>
          <select
            value={areaId}
            disabled={selectableAreas.length === 1}
            onChange={(event) => {
              setAreaId(event.target.value);
              setPreview(null);
              setConflictChoices({});
              setCommit(null);
              setConfirmed(false);
            }}
          >
            <option value="">اختر الجماعة / المقاطعة</option>
            {selectableAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="representative-import-file">
          <span>لائحة XLSX</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) =>
              void onFileChange(event.target.files?.[0])
            }
          />
          <small>
            {fileName
              ? `${fileName} · ${rows.length} صف`
              : "ارفع ملف XLSX الأصلي كما استلمته دون تعديل"}
          </small>
          {sourceInfo ? (
            <small className="representative-import-detected">
              تم التعرف على التنسيق: الورقة «{sourceInfo.worksheetName}» · صف
              العناوين {sourceInfo.headerRow} · الهاتف{" "}
              {sourceInfo.detectedFields.phone ? "✓" : "—"} · رقم الناخب{" "}
              {sourceInfo.detectedFields.voterNumber ? "✓" : "—"} · ر ب و{" "}
              {sourceInfo.detectedFields.rbo ? "✓" : "—"}
            </small>
          ) : null}
        </label>

        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={busy || !areaId || !rows.length}
        >
          {busy ? "جارٍ الفحص…" : "معاينة قبل الدمج"}
        </button>
      </div>

      {error ? (
        <div className="representative-import-message is-error">
          {error}
        </div>
      ) : null}

      {preview ? (
        <div className="representative-import-preview">
          <div className="representative-import-kpis">
            <div>
              <span>الصفوف</span>
              <strong>{preview.row_count}</strong>
            </div>
            <div>
              <span>مكاتب مطابقة</span>
              <strong>{preview.offices.matched}</strong>
            </div>
            <div>
              <span>بدون مراقب</span>
              <strong>{preview.offices.without_observer}</strong>
            </div>
            <div>
              <span>مراقبون جدد</span>
              <strong>{preview.representatives.new}</strong>
            </div>
            <div>
              <span>مراقبون موجودون</span>
              <strong>{preview.representatives.reused}</strong>
            </div>
            <div>
              <span>تعيينات جديدة</span>
              <strong>{preview.assignments.new}</strong>
            </div>
            <div>
              <span>بيانات ناقصة</span>
              <strong>{preview.representatives.incomplete}</strong>
            </div>
          </div>

          <section className="representative-import-row-preview">
            <div className="representative-import-row-preview-head">
              <div>
                <strong>معاينة أسطر الملف</strong>
                <p>
                  الأسطر ذات اللون المختلف مقبولة في الاستيراد، لكنها تحمل
                  ملاحظة مراجعة مع الإحالة إلى السطر أو السجل المطابق.
                </p>
              </div>
              <span>{rows.length} سطر</span>
            </div>

            <div className="representative-import-row-table">
              <div className="representative-import-row is-head">
                <span>السطر</span>
                <span>المكتب</span>
                <span>المراقب</span>
                <span>الهاتف</span>
                <span>رقم الناخب</span>
                <span>ر ب و</span>
                <span>المراجعة</span>
              </div>

              {rows.map((row) => {
                const reviews = reviewByRow.get(row.row) ?? [];
                const isEditing = editingRow === row.row;
                const isBlankObserver = !row.observer_name.trim();
                const isManual = manualRows.includes(row.row);

                return (
                  <div
                    className={`representative-import-row${reviews.length ? " has-review" : ""}${isBlankObserver ? " is-empty-observer" : ""}${isEditing ? " is-inline-editing" : ""}`}
                    id={`import-row-${row.row}`}
                    key={`${row.row}-${row.office_number}`}
                  >
                    <strong>{row.row}</strong>
                    <strong>{row.office_number}</strong>

                    {isEditing ? (
                      <>
                        <input
                          value={rowDraft.observer_name}
                          onChange={(event) =>
                            setRowDraft((current) => ({
                              ...current,
                              observer_name: event.target.value,
                            }))
                          }
                          placeholder="اسم المراقب"
                          autoFocus
                        />
                        <input
                          value={rowDraft.phone}
                          onChange={(event) =>
                            setRowDraft((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          placeholder="الهاتف"
                        />
                        <input
                          value={rowDraft.voter_number}
                          onChange={(event) =>
                            setRowDraft((current) => ({
                              ...current,
                              voter_number: event.target.value,
                            }))
                          }
                          placeholder="رقم الناخب"
                        />
                        <input
                          value={rowDraft.rbo}
                          onChange={(event) =>
                            setRowDraft((current) => ({
                              ...current,
                              rbo: event.target.value,
                            }))
                          }
                          placeholder="ر ب و"
                        />
                        <div className="representative-import-row-review representative-import-row-editor-actions">
                          {rowEditError ? (
                            <p className="is-inline-error">{rowEditError}</p>
                          ) : null}
                          <div>
                            <button
                              type="button"
                              onClick={() => void saveManualObserver(row)}
                              disabled={busy}
                            >
                              {busy ? "فحص…" : "حفظ وإعادة المعاينة"}
                            </button>
                            <button
                              type="button"
                              className="is-secondary"
                              onClick={cancelManualObserver}
                              disabled={busy}
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>{row.observer_name || "—"}</span>
                        <span>{row.phone || "—"}</span>
                        <span>{row.voter_number || "—"}</span>
                        <span>{row.rbo || "—"}</span>
                        <div className="representative-import-row-review">
                          {reviews.length ? (
                            reviews.map((review, index) => (
                              <div key={`${review.code}-${index}`}>
                                <strong>
                                  {review.code === "observer_missing_skipped"
                                    ? "المكتب بدون مراقب"
                                    : "مقبول مع مراجعة"}
                                </strong>
                                <p>{previewIssueMessage(review)}</p>
                                {review.matched_rows?.length ? (
                                  <div className="representative-import-row-refs">
                                    {review.matched_rows.map((matchedRow) => (
                                      <a
                                        href={`#import-row-${matchedRow}`}
                                        key={matchedRow}
                                      >
                                        السطر {matchedRow}
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <span className="is-ok">
                              {isManual ? "أضيف يدويًا · سليم" : "سليم"}
                            </span>
                          )}

                          {isBlankObserver || isManual ? (
                            <button
                              type="button"
                              className="representative-import-inline-add"
                              onClick={() => beginManualObserver(row)}
                              disabled={busy}
                            >
                              {isBlankObserver ? "+ إضافة مراقب" : "تعديل"}
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {preview.conflicts.length ? (
            <div className="representative-import-conflicts">
              <div className="representative-import-conflicts-head">
                <div>
                  <strong>مكاتب تصويت لديها مراقب مسجل</strong>
                  <p>
                    قارن بيانات المراقب الحالي مع بيانات ملف Excel، ثم اختر
                    القرار لكل مكتب بشكل مستقل.
                  </p>
                </div>
                <span>{preview.conflicts.length}</span>
              </div>

              <div className="representative-import-conflict-grid">
                {preview.conflicts.map((conflict) => {
                  const choice =
                    conflictChoices[String(conflict.office_number)] ?? "skip";
                  const fields = [
                    ["name", "الاسم"],
                    ["phone", "الهاتف"],
                    ["voter_number", "رقم الناخب"],
                    ["rbo", "ر ب و"],
                  ] as const;

                  return (
                    <article
                      className="representative-import-conflict-card"
                      key={conflict.office_number}
                    >
                      <div className="representative-import-conflict-title">
                        <div>
                          <span>مكتب التصويت</span>
                          <strong>{conflict.office_number}</strong>
                        </div>
                        <small>السطر {conflict.row}</small>
                      </div>

                      <div className="representative-import-compare">
                        <div className="is-current">
                          <span>المراقب الحالي</span>
                          {fields.map(([field, label]) => (
                            <div
                              className={
                                conflict.differences.includes(field)
                                  ? "is-different"
                                  : ""
                              }
                              key={field}
                            >
                              <small>{label}</small>
                              <strong>{conflict.current[field] || "—"}</strong>
                            </div>
                          ))}
                        </div>

                        <div className="is-imported">
                          <span>المراقب في ملف Excel</span>
                          {fields.map(([field, label]) => (
                            <div
                              className={
                                conflict.differences.includes(field)
                                  ? "is-different"
                                  : ""
                              }
                              key={field}
                            >
                              <small>{label}</small>
                              <strong>{conflict.imported[field] || "—"}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="representative-import-conflict-actions">
                        <button
                          type="button"
                          className={choice === "skip" ? "is-selected" : ""}
                          onClick={() =>
                            setConflictChoices((current) => ({
                              ...current,
                              [String(conflict.office_number)]: "skip",
                            }))
                          }
                        >
                          عدم استيراد هذا السطر
                          <small>الإبقاء على المراقب الحالي</small>
                        </button>

                        <button
                          type="button"
                          className={
                            choice === "replace"
                              ? "is-selected is-replace"
                              : "is-replace"
                          }
                          onClick={() =>
                            setConflictChoices((current) => ({
                              ...current,
                              [String(conflict.office_number)]: "replace",
                            }))
                          }
                        >
                          استبدال المراقب
                          <small>الاحتفاظ بالسابق كسجل مستبدل</small>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {preview.errors.length ? (
            <div className="representative-import-issues is-error">
              <strong>أخطاء فعلية تمنع الاستيراد</strong>
              {preview.errors.map((issue, index) => (
                <p key={`${issue.code}-${index}`}>
                  {issue.office_number
                    ? `مكتب ${issue.office_number}: `
                    : ""}
                  {previewIssueMessage(issue)}
                </p>
              ))}
            </div>
          ) : null}

          {preview.warnings.length ? (
            <div className="representative-import-issues is-warning">
              <strong>تنبيهات للمراجعة</strong>
              {preview.warnings.map((issue, index) => (
                <p key={`${issue.code}-${index}`}>
                  {issue.office_numbers?.length
                    ? `المكاتب ${issue.office_numbers.join("، ")}: `
                    : issue.office_number
                      ? `مكتب ${issue.office_number}: `
                      : ""}
                  {previewIssueMessage(issue)}
                </p>
              ))}
            </div>
          ) : null}

          {preview.valid ? (
            <div className="representative-import-confirm">
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  راجعت المعاينة والتنبيهات وقرارات المقارنة، وأوافق على
                  تنفيذ الاستيراد وفق الاختيارات الظاهرة.
                </span>
              </label>
              <button
                type="button"
                onClick={() => void runCommit()}
                disabled={busy || !confirmed}
              >
                {busy ? "جارٍ الدمج…" : "تنفيذ الدمج"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {commit ? (
        <div className="representative-import-message is-success">
          تم الدمج: {commit.counts.representatives_created} مراقب جديد،{" "}
          {commit.counts.assignments_created} تعيين جديد، و{" "}
          {commit.counts.representatives_reused} مراقب موجود أُعيد استخدامه
          {commit.counts.assignments_replaced
            ? `، وتم استبدال ${commit.counts.assignments_replaced} تعيين`
            : ""}
          {commit.counts.conflicts_skipped
            ? `، وتم تجاوز ${commit.counts.conflicts_skipped} سطر متعارض`
            : ""}.
        </div>
      ) : null}
    </section>
  );
}
