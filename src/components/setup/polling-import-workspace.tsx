"use client";

import ExcelJS from "@andreeewill/exceljs/dist/exceljs.min.js";
import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ConstituencySummary,
  PollingOffice,
  SetupCentralOffice,
  SetupCenter,
  SetupPollingArea,
} from "@/lib/elect/types";

type ImportRow = {
  row: number;
  office_number: number | string;
  office_name: string;
  central_office_number: number | string;
  central_office_name: string;
  registered_voters: number | string | null;
};

type ImportArea = {
  area_name: string;
  source_filename: string;
  rows: ImportRow[];
};

type PreviewError = {
  area_name: string;
  source_filename: string;
  row: number;
  field: string;
  code: string;
  message: string;
};

type PreviewWarning = {
  code: string;
  count?: number;
  message: string;
};

type PreviewData = {
  valid: boolean;
  row_count: number;
  constituency: {
    id: number;
    name: string;
    code: string;
  };
  areas: {
    total: number;
    new: number;
    reused: number;
    items: Array<{
      name: string;
      source_filename?: string | null;
      office_count: number;
      central_office_count: number;
      new_offices: number;
      reused_offices: number;
    }>;
  };
  central_offices: {
    total: number;
    new: number;
    reused: number;
  };
  centers: {
    total: number;
    new: number;
    reused: number;
  };
  offices: {
    total: number;
    new: number;
    reused: number;
    registered_voters_unknown: number;
  };
  errors: PreviewError[];
  warnings: PreviewWarning[];
  sample: Array<{
    area_name: string;
    row: number;
    office_number: number;
    office_name: string;
    central_office_number: number;
    central_office_name: string;
    registered_voters?: number | null;
  }>;
};

type CommitResult = {
  created: {
    area_ids: number[];
    central_office_ids: number[];
    center_ids: number[];
    office_ids: number[];
  };
  reused: {
    area_ids: number[];
    central_office_ids: number[];
    center_ids: number[];
    office_ids: number[];
  };
  counts: {
    areas_created: number;
    areas_reused: number;
    central_offices_created: number;
    central_offices_reused: number;
    centers_created: number;
    centers_reused: number;
    offices_created: number;
    offices_reused: number;
  };
};

type ExportSnapshot = {
  areas: SetupPollingArea[];
  centralOffices: SetupCentralOffice[];
  centers: SetupCenter[];
  offices: PollingOffice[];
};

type Props = {
  electionId: string;
  localConstituencies: ConstituencySummary[];
  exportSnapshot: ExportSnapshot;
};

const exactHeaders = [
  "التعويض",
  "رقم الهاتف",
  "رقم الناخب",
  "ر ب و",
  "إسم المراقب",
  "عدد المسجَّلين",
  "رقم مكتب التصويت",
  "عنوان مكتب التصويت",
  "عنوان المكتب المركزي",
  "رقم المكتب المركزي",
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fileAreaName(filename: string) {
  return filename
    .replace(/\.xlsx$/i, "")
    .replace(/^modele-import-bureaux_\d+\s*/i, "")
    .trim();
}

function numericCell(value: unknown): number | string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = normalizeText(value);
  if (!text) return "";
  const normalizedDigits = text
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const parsed = Number(normalizedDigits);
  return Number.isFinite(parsed) ? parsed : text;
}

function cellText(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
) {
  return normalizeText(worksheet.getRow(rowNumber).getCell(columnNumber).text);
}

function findHeader(
  worksheet: ExcelJS.Worksheet,
): {
  row: number;
  registeredVoters: number | null;
  officeNumber: number;
  officeName: number;
  centralName: number;
  centralNumber: number;
} {
  const maxRows = Math.min(worksheet.rowCount, 25);

  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const map = new Map<string, number>();
    const row = worksheet.getRow(rowNumber);
    const maxColumns = Math.max(row.cellCount, 10);

    for (let column = 1; column <= maxColumns; column += 1) {
      const text = normalizeText(row.getCell(column).text);
      if (text) map.set(text, column);
    }

    const officeNumber = [...map.entries()].find(([key]) =>
      key.includes("رقم مكتب التصويت"),
    )?.[1];
    const officeName = [...map.entries()].find(([key]) =>
      key.includes("عنوان مكتب التصويت"),
    )?.[1];
    const centralName = [...map.entries()].find(([key]) =>
      key.includes("عنوان المكتب المركزي"),
    )?.[1];
    const centralNumber = [...map.entries()].find(([key]) =>
      key.includes("رقم المكتب المركزي"),
    )?.[1];
    const registeredVoters = [...map.entries()].find(([key]) =>
      key.includes("عدد المسجل"),
    )?.[1];

    if (officeNumber && officeName && centralName && centralNumber) {
      return {
        row: rowNumber,
        registeredVoters: registeredVoters ?? null,
        officeNumber,
        officeName,
        centralName,
        centralNumber,
      };
    }
  }

  throw new Error(
    "لم أجد أعمدة «رقم مكتب التصويت / عنوان مكتب التصويت / عنوان المكتب المركزي / رقم المكتب المركزي».",
  );
}

async function parseWorkbookFile(file: File): Promise<ImportArea> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error(`${file.name}: الصيغة المطلوبة هي XLSX فقط.`);
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(`${file.name}: حجم الملف يتجاوز 8 MB.`);
  }

  const workbook = new ExcelJS.Workbook();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await workbook.xlsx.load(bytes as unknown as Buffer);

  const worksheet =
    workbook.getWorksheet("معطيات المراقبين") ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`${file.name}: لا توجد ورقة بيانات.`);
  }

  const header = findHeader(worksheet);
  const rows: ImportRow[] = [];
  let lastCentralName = "";
  let lastCentralNumber: number | string = "";

  for (
    let rowNumber = header.row + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const officeNumber = numericCell(
      worksheet.getRow(rowNumber).getCell(header.officeNumber).value,
    );
    const officeName = cellText(worksheet, rowNumber, header.officeName);

    const centralNameCell = cellText(
      worksheet,
      rowNumber,
      header.centralName,
    );
    const centralNumberCell = numericCell(
      worksheet.getRow(rowNumber).getCell(header.centralNumber).value,
    );

    if (
      centralNumberCell !== "" &&
      centralNumberCell !== lastCentralNumber
    ) {
      lastCentralNumber = centralNumberCell;
      lastCentralName = centralNameCell;
    } else {
      if (centralNumberCell !== "") lastCentralNumber = centralNumberCell;
      if (centralNameCell) lastCentralName = centralNameCell;
    }

    if (officeNumber === "" && !officeName) {
      continue;
    }

    const registeredVoters = header.registeredVoters
      ? numericCell(
          worksheet
            .getRow(rowNumber)
            .getCell(header.registeredVoters).value,
        )
      : "";

    rows.push({
      row: rowNumber,
      office_number: officeNumber,
      office_name: officeName,
      central_office_number: lastCentralNumber,
      central_office_name: lastCentralName,
      registered_voters:
        registeredVoters === "" ? null : registeredVoters,
    });
  }

  if (!rows.length) {
    throw new Error(`${file.name}: لم أجد مكاتب تصويت قابلة للقراءة.`);
  }

  return {
    area_name: fileAreaName(file.name),
    source_filename: file.name,
    rows,
  };
}

function safeSheetName(name: string, used: Set<string>) {
  const base =
    name.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) ||
    "معطيات المراقبين";
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    const marker = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function styleExportSheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ rightToLeft: true }];
  worksheet.columns = [
    { width: 13 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 16 },
    { width: 18 },
    { width: 36 },
    { width: 36 },
    { width: 18 },
  ];

  const header = worksheet.getRow(4);
  header.height = 32;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE9EEF5" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFC8D0DB" } },
      bottom: { style: "thin", color: { argb: "FFC8D0DB" } },
      left: { style: "thin", color: { argb: "FFC8D0DB" } },
      right: { style: "thin", color: { argb: "FFC8D0DB" } },
    };
  });
  worksheet.autoFilter = "A4:J4";
  worksheet.views = [{ state: "frozen", ySplit: 4, rightToLeft: true }];
}

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("معطيات المراقبين");
  worksheet.addRow([]);
  worksheet.addRow([]);
  worksheet.addRow([]);
  worksheet.addRow(exactHeaders);
  worksheet.addRow(["", "", "", "", "", "", 1, "اسم مقر التصويت", "اسم المكتب المركزي", 1]);
  styleExportSheet(worksheet);
  await saveWorkbook(workbook, "نموذج-مكاتب-التصويت.xlsx");
}

async function exportCurrentStructure(snapshot: ExportSnapshot) {
  if (!snapshot.areas.length) return;

  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  for (const area of snapshot.areas) {
    const worksheet = workbook.addWorksheet(
      safeSheetName(area.name, usedSheetNames),
    );
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(exactHeaders);

    const areaCenters = new Map(
      snapshot.centers
        .filter((center) => center.area?.id === area.id)
        .map((center) => [center.id, center]),
    );

    const offices = snapshot.offices
      .filter(
        (office) =>
          office.area?.id === area.id && areaCenters.has(office.center.id),
      )
      .sort((a, b) => a.number - b.number);

    for (const office of offices) {
      worksheet.addRow([
        "",
        "",
        "",
        "",
        "",
        office.registered_voters ?? "",
        office.number,
        office.center.name,
        office.central_office?.name ?? "",
        office.central_office?.number ?? "",
      ]);
    }

    styleExportSheet(worksheet);

    let groupStart = 5;
    for (let row = 6; row <= worksheet.rowCount + 1; row += 1) {
      const previous = worksheet.getCell(`J${row - 1}`).text;
      const current =
        row <= worksheet.rowCount ? worksheet.getCell(`J${row}`).text : "";
      if (previous && previous === current) continue;

      if (row - groupStart > 1) {
        worksheet.mergeCells(`I${groupStart}:I${row - 1}`);
        worksheet.mergeCells(`J${groupStart}:J${row - 1}`);
        worksheet.getCell(`I${groupStart}`).alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        worksheet.getCell(`J${groupStart}`).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
      groupStart = row;
    }
  }

  await saveWorkbook(workbook, "هيكلة-مكاتب-التصويت.xlsx");
}

export function PollingImportWorkspace({
  electionId,
  localConstituencies,
  exportSnapshot,
}: Props) {
  const [areas, setAreas] = useState<ImportArea[]>([]);
  const [constituencyId, setConstituencyId] = useState(
    String(localConstituencies[0]?.id ?? ""),
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const rowCount = useMemo(
    () => areas.reduce((total, area) => total + area.rows.length, 0),
    [areas],
  );

  async function chooseFiles(files: FileList | null) {
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");

    if (!files?.length) {
      setAreas([]);
      return;
    }

    setReading(true);
    try {
      const parsed = await Promise.all(
        Array.from(files).map((file) => parseWorkbookFile(file)),
      );
      const duplicateNames = parsed
        .map((item) => item.area_name.toLocaleLowerCase("ar"))
        .filter((name, index, all) => all.indexOf(name) !== index);

      if (duplicateNames.length) {
        throw new Error(
          "هناك ملفان يحملان نفس اسم النطاق بعد التنظيف. عدّل أسماء الملفات أو ارفعها على دفعتين.",
        );
      }

      setAreas(parsed);
    } catch (reason) {
      setAreas([]);
      setError(
        reason instanceof Error ? reason.message : "تعذر قراءة ملفات Excel.",
      );
    } finally {
      setReading(false);
    }
  }

  function renameArea(index: number, value: string) {
    setAreas((current) =>
      current.map((area, areaIndex) =>
        areaIndex === index ? { ...area, area_name: value } : area,
      ),
    );
    setPreview(null);
    setResult(null);
    setConfirmed(false);
  }

  function requestBody() {
    return {
      local_constituency_id: Number(constituencyId),
      areas,
    };
  }

  async function runPreview() {
    if (!areas.length || !constituencyId) return;
    setPreviewing(true);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/polling-import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody()),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setError(
          payload?.error?.message ||
            "تعذر التحقق من ملفات Excel.",
        );
        return;
      }

      setPreview(payload.data as PreviewData);
    } catch {
      setError("تعذر الاتصال بالخدمة أثناء التحقق.");
    } finally {
      setPreviewing(false);
    }
  }

  async function commitImport() {
    if (!preview?.valid || !confirmed) return;
    setCommitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/polling-import/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody()),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setError(
          payload?.error?.message ||
            "تعذر اعتماد الاستيراد.",
        );
        return;
      }

      setResult(payload.data as CommitResult);
    } catch {
      setError("تعذر الاتصال بالخدمة أثناء الاستيراد.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="setup-form-shell">
      <nav className="breadcrumbs presentation-breadcrumbs">
        <Link href={`/elections/${electionId}/setup`}>إعداد الاستحقاق</Link>
        <span>/</span>
        <strong>Excel</strong>
      </nav>

      <section className="setup-form-card">
        <div className="presentation-kicker">Excel</div>
        <h1>مكاتب التصويت</h1>

        <div className="setup-form-grid">
          <label className="setup-field">
            <span>الدائرة المحلية</span>
            <select
              value={constituencyId}
              onChange={(event) => {
                setConstituencyId(event.target.value);
                setPreview(null);
                setResult(null);
                setConfirmed(false);
              }}
            >
              {localConstituencies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="setup-field setup-field--full">
            <span>ملفات Excel</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              disabled={reading}
              onChange={(event) => void chooseFiles(event.target.files)}
            />
          </label>
        </div>

        <div className="setup-form-actions">
          <button
            className="setup-cancel-button"
            type="button"
            onClick={() => void downloadTemplate()}
          >
            نموذج Excel
          </button>
          <button
            className="setup-cancel-button"
            type="button"
            disabled={!exportSnapshot.areas.length}
            onClick={() => void exportCurrentStructure(exportSnapshot)}
          >
            تصدير Excel
          </button>
          <button
            className="setup-submit-button"
            type="button"
            disabled={
              !areas.length || !constituencyId || reading || previewing
            }
            onClick={() => void runPreview()}
          >
            {previewing ? "جارٍ التحقق..." : "معاينة"}
          </button>
        </div>

        {reading ? <div className="setup-note">جارٍ قراءة Excel...</div> : null}
        {error ? <div className="setup-form-alert">{error}</div> : null}

        {areas.length ? (
          <section className="setup-management-section">
            <div className="setup-section-heading">
              <div>
                <span>الملفات</span>
                <h2>{areas.length} ملف · {rowCount} مكتب</h2>
              </div>
            </div>

            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>النطاق</span>
                <span>الملف</span>
                <span>المكاتب</span>
                <span />
              </div>
              {areas.map((area, index) => (
                <div className="setup-row" key={area.source_filename}>
                  <label className="setup-row-main">
                    <input
                      value={area.area_name}
                      onChange={(event) =>
                        renameArea(index, event.target.value)
                      }
                    />
                  </label>
                  <span>{area.source_filename}</span>
                  <strong>{area.rows.length}</strong>
                  <span />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {preview ? (
          <section className="setup-management-section">
            <div className="setup-section-heading">
              <div>
                <span>المعاينة</span>
                <h2>
                  {preview.valid
                    ? "البيانات جاهزة"
                    : "توجد تعارضات"}
                </h2>
              </div>
            </div>

            <div className="setup-summary-grid">
              <div>
                <span>النطاقات</span>
                <strong>{preview.areas.total}</strong>
                <small>{preview.areas.new} جديد</small>
              </div>
              <div>
                <span>المكاتب المركزية</span>
                <strong>{preview.central_offices.total}</strong>
                <small>{preview.central_offices.new} جديد</small>
              </div>
              <div>
                <span>مقار التصويت</span>
                <strong>{preview.centers.total}</strong>
                <small>{preview.centers.new} جديد</small>
              </div>
              <div>
                <span>مكاتب التصويت</span>
                <strong>{preview.offices.total}</strong>
                <small>{preview.offices.new} جديد</small>
              </div>
              <div>
                <span>عدد المسجلين غير معروف</span>
                <strong>{preview.offices.registered_voters_unknown}</strong>
                <small>يبقى فارغًا</small>
              </div>
            </div>

            {preview.errors.length ? (
              <div className="setup-table">
                <div className="setup-row setup-row--header">
                  <span>النطاق / السطر</span>
                  <span>الحقل</span>
                  <span>الرمز</span>
                  <span>الخطأ</span>
                </div>
                {preview.errors.slice(0, 120).map((item, index) => (
                  <div
                    className="setup-row"
                    key={`${item.source_filename}-${item.row}-${item.code}-${index}`}
                  >
                    <strong>
                      {item.area_name || item.source_filename || "عام"}
                      {item.row ? ` · ${item.row}` : ""}
                    </strong>
                    <span>{item.field}</span>
                    <span>{item.code}</span>
                    <span>{item.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {preview.warnings.map((warning) => (
              <div className="setup-form-prerequisite" key={warning.code}>
                {warning.message}
                {warning.count ? ` (${warning.count})` : ""}
              </div>
            ))}

            {preview.valid && !result ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) =>
                        setConfirmed(event.target.checked)
                      }
                    />{" "}
                    تأكيد إدماج البيانات كما تظهر في المعاينة
                  </span>
                </label>

                <div className="setup-form-actions">
                  <button
                    className="setup-submit-button"
                    type="button"
                    disabled={!confirmed || committing}
                    onClick={() => void commitImport()}
                  >
                    {committing ? "جارٍ الإدماج..." : "إدماج"}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {result ? (
          <section className="setup-management-section">
            <div className="setup-section-heading">
              <div>
                <span>تم</span>
                <h2>اكتمل الإدماج</h2>
              </div>
            </div>
            <div className="setup-summary-grid">
              <div>
                <span>نطاقات جديدة</span>
                <strong>{result.counts.areas_created}</strong>
              </div>
              <div>
                <span>مكاتب مركزية جديدة</span>
                <strong>{result.counts.central_offices_created}</strong>
              </div>
              <div>
                <span>مقار جديدة</span>
                <strong>{result.counts.centers_created}</strong>
              </div>
              <div>
                <span>مكاتب جديدة</span>
                <strong>{result.counts.offices_created}</strong>
              </div>
            </div>
            <div className="setup-form-actions">
              <Link
                className="setup-create-button"
                href={`/elections/${electionId}/setup`}
              >
                العودة
              </Link>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
