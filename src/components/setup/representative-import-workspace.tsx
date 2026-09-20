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

type PreviewIssue = {
  code: string;
  message: string;
  field?: string;
  office_number?: number;
  office_numbers?: number[];
  fields?: string[];
};

type PreviewData = {
  valid: boolean;
  row_count: number;
  constituency: { id: number; name: string; code: string };
  area: { id: number; name: string; code: string };
  offices: { matched: number; missing: number };
  representatives: {
    new: number;
    reused: number;
    enriched: number;
    incomplete: number;
  };
  assignments: {
    new: number;
    reused: number;
    conflicts: number;
  };
  source_updates: number;
  errors: PreviewIssue[];
  warnings: PreviewIssue[];
};

type CommitData = {
  counts: {
    representatives_created: number;
    representatives_reused: number;
    representatives_enriched: number;
    assignments_created: number;
    assignments_reused: number;
    offices_source_updated: number;
  };
};

type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type Props = {
  electionId: string;
  constituencyId: number;
  areas: AreaOption[];
};

type BrowserXlsxLoader = {
  load(data: ArrayBuffer): Promise<ExcelJS.Workbook>;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
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

function findHeaders(worksheet: ExcelJS.Worksheet) {
  const maxRows = Math.min(worksheet.rowCount, 25);

  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells = new Map<string, number>();
    const maxColumns = Math.max(row.cellCount, 10);

    for (let column = 1; column <= maxColumns; column += 1) {
      const key = normalizeText(row.getCell(column).text);
      if (key) cells.set(key, column);
    }

    const entries = [...cells.entries()];
    const officeNumber = entries.find(
      ([key]) => key.includes("رقم مكتب") && key.includes("التصويت"),
    )?.[1];
    const observerName = entries.find(
      ([key]) =>
        key.includes("اسم المراقب") ||
        key.includes("الاسم الكامل"),
    )?.[1];
    const phone = entries.find(([key]) => key.includes("رقم الهاتف"))?.[1];
    const voterNumber = entries.find(([key]) =>
      key.includes("رقم الناخب"),
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

  throw new Error(
    "لم أجد عمودي «رقم مكتب التصويت» و«الاسم الكامل/اسم المراقب» في الملف.",
  );
}

async function parseObserverWorkbook(file: File): Promise<ImportRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("الصيغة المطلوبة هي XLSX فقط.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("حجم الملف يتجاوز 8 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  const browserXlsx = workbook.xlsx as unknown as BrowserXlsxLoader;
  await browserXlsx.load(await file.arrayBuffer());

  const worksheet =
    workbook.getWorksheet("معطيات المراقبين") ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("لا توجد ورقة بيانات داخل الملف.");
  }

  const header = findHeaders(worksheet);
  const rows: ImportRow[] = [];

  for (
    let rowNumber = header.row + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const officeNumber = positiveInteger(
      row.getCell(header.officeNumber).text,
    );
    const observerName = normalizeText(
      row.getCell(header.observerName).text,
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
        ? normalizeText(row.getCell(header.phone).text)
        : "",
      voter_number: header.voterNumber
        ? normalizeText(row.getCell(header.voterNumber).text)
        : "",
      rbo: header.rbo
        ? normalizeText(row.getCell(header.rbo).text)
        : "",
    });
  }

  if (!rows.length) {
    throw new Error("لم أجد صفوف مراقبين قابلة للقراءة.");
  }
  return rows;
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
  const [areaId, setAreaId] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [commit, setCommit] = useState<CommitData | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFileChange(file: File | undefined) {
    setError("");
    setPreview(null);
    setCommit(null);
    setConfirmed(false);
    if (!file) {
      setFileName("");
      setRows([]);
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseObserverWorkbook(file);
      setFileName(file.name);
      setRows(parsed);
    } catch (cause) {
      setRows([]);
      setFileName("");
      setError(
        cause instanceof Error ? cause.message : "تعذر قراءة ملف Excel.",
      );
    } finally {
      setBusy(false);
    }
  }

  function payload() {
    return {
      local_constituency_id: constituencyId,
      polling_area_id: Number(areaId),
      source_filename: fileName,
      rows,
    };
  }

  async function runPreview() {
    if (!areaId || !rows.length) {
      setError("اختر النطاق وحمّل ملف XLSX أولًا.");
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
          body: JSON.stringify(payload()),
        },
      );
      const envelope = (await response
        .json()
        .catch(() => null)) as Envelope<PreviewData> | null;
      if (!response.ok || !envelope?.success || !envelope.data) {
        setError(
          envelope?.error?.message || "تعذر تنفيذ معاينة اللائحة.",
        );
        return;
      }
      setPreview(envelope.data);
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
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
          envelope?.error?.message || "تعذر دمج لائحة المراقبين.",
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

  return (
    <section className="representative-import-card">
      <div className="representative-import-head">
        <div>
          <span>Excel · مراقبو مكاتب التصويت</span>
          <h2>دمج لائحة المراقبين</h2>
          <p>
            الربط يتم بالدائرة + النطاق + رقم مكتب التصويت، وليس برقم المكتب
            المركزي.
          </p>
        </div>
      </div>

      <div className="representative-import-controls">
        <label>
          <span>النطاق الترابي</span>
          <select
            value={areaId}
            onChange={(event) => {
              setAreaId(event.target.value);
              setPreview(null);
              setCommit(null);
              setConfirmed(false);
            }}
          >
            <option value="">اختر النطاق</option>
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
              : "اختر ملف لائحة المراقبين"}
          </small>
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

          {preview.errors.length ? (
            <div className="representative-import-issues is-error">
              <strong>أخطاء تمنع الدمج</strong>
              {preview.errors.map((issue, index) => (
                <p key={`${issue.code}-${index}`}>
                  {issue.office_number
                    ? `مكتب ${issue.office_number}: `
                    : ""}
                  {issue.message}
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
                  {issue.message}
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
                  راجعت المعاينة والتنبيهات وأوافق على إنشاء/ربط المراقبين
                  الظاهرين في هذه اللائحة.
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
          تم الدمج: {commit.counts.representatives_created} مراقب جديد،
          {" "}
          {commit.counts.assignments_created} تعيين جديد، و
          {commit.counts.representatives_reused} مراقب موجود أُعيد استخدامه.
        </div>
      ) : null}
    </section>
  );
}
