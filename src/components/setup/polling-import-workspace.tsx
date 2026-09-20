"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useState } from "react";

type ImportRow = {
  constituency_code: string;
  center_code: string;
  center_name: string;
  commune: string;
  address: string;
  office_code: string;
  office_number: string;
  registered_voters: string;
};

type PreviewError = {
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
    row: number;
    constituency_code: string;
    constituency_name?: string | null;
    center_code: string;
    center_name: string;
    commune?: string | null;
    address?: string | null;
    office_code?: string | null;
    office_number?: number | null;
    registered_voters?: number | null;
  }>;
};

type CommitResult = {
  created: {
    center_ids: number[];
    office_ids: number[];
  };
  reused: {
    center_ids: number[];
    office_ids: number[];
  };
  counts: {
    centers_created: number;
    centers_reused: number;
    offices_created: number;
    offices_reused: number;
  };
};

type Props = {
  electionId: string;
};

const headerAliases: Record<string, keyof ImportRow> = {
  constituency_code: "constituency_code",
  "رمز الدائرة": "constituency_code",
  "كود الدائرة": "constituency_code",
  center_code: "center_code",
  "رمز المركز": "center_code",
  "كود المركز": "center_code",
  center_name: "center_name",
  "اسم المركز": "center_name",
  commune: "commune",
  "الجماعة": "commune",
  address: "address",
  "العنوان": "address",
  office_code: "office_code",
  "رمز المكتب": "office_code",
  "كود المكتب": "office_code",
  office_number: "office_number",
  "رقم المكتب": "office_number",
  registered_voters: "registered_voters",
  "عدد المسجلين": "registered_voters",
  "المسجلون": "registered_voters",
};

const requiredHeaders: Array<keyof ImportRow> = [
  "constituency_code",
  "center_code",
  "center_name",
  "office_code",
  "office_number",
];

function detectDelimiter(text: string) {
  const firstLine =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .find((line) => line.trim()) ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function parseImportFile(text: string): ImportRow[] {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(normalizedText);
  const matrix = parseDelimited(normalizedText, delimiter);

  if (matrix.length < 2) {
    throw new Error("الملف لا يحتوي على صفوف بيانات قابلة للاستيراد.");
  }

  const mappedHeaders = matrix[0].map((value) => {
    const normalized = value.trim().toLowerCase();
    return headerAliases[normalized] ?? headerAliases[value.trim()] ?? null;
  });

  for (const required of requiredHeaders) {
    if (!mappedHeaders.includes(required)) {
      throw new Error(
        `العمود المطلوب غير موجود: ${required}. استخدم النموذج المقترح.`,
      );
    }
  }

  const rows: ImportRow[] = matrix.slice(1).map((values) => {
    const item: ImportRow = {
      constituency_code: "",
      center_code: "",
      center_name: "",
      commune: "",
      address: "",
      office_code: "",
      office_number: "",
      registered_voters: "",
    };

    mappedHeaders.forEach((key, index) => {
      if (key) {
        item[key] = (values[index] ?? "").trim();
      }
    });

    return item;
  });

  if (rows.length > 10000) {
    throw new Error("الحد الأقصى هو 10000 صف في كل عملية استيراد.");
  }

  return rows;
}

function downloadTemplate() {
  const csv = [
    [
      "رمز الدائرة",
      "رمز المركز",
      "اسم المركز",
      "الجماعة",
      "العنوان",
      "رمز المكتب",
      "رقم المكتب",
      "عدد المسجلين",
    ],
    [
      "LOCAL-CODE",
      "CENTER-001",
      "اسم المركز",
      "اسم الجماعة",
      "العنوان",
      "OFFICE-001",
      "1",
      "",
    ],
  ]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "geniura-elect-polling-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PollingImportWorkspace({ electionId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const sampleRows = useMemo(() => rows.slice(0, 5), [rows]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");

    if (!file) {
      setRows([]);
      setFileName("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setRows([]);
      setFileName("");
      setError("حجم الملف يتجاوز 5 MB.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseImportFile(text);
      setRows(parsed);
      setFileName(file.name);
    } catch (reason) {
      setRows([]);
      setFileName("");
      setError(
        reason instanceof Error
          ? reason.message
          : "تعذر قراءة الملف. تحقق من صيغة CSV.",
      );
    }
  }

  async function runPreview() {
    if (!rows.length) return;

    setPreviewing(true);
    setError("");
    setResult(null);
    setConfirmed(false);

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/polling-import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setPreview(null);
        setError(
          payload?.error?.message ||
            "تعذر تنفيذ المعاينة على الخادم. راجع الملف وأعد المحاولة.",
        );
        return;
      }

      setPreview(payload.data as PreviewData);
    } catch {
      setPreview(null);
      setError("تعذر الاتصال بالخدمة أثناء المعاينة.");
    } finally {
      setPreviewing(false);
    }
  }

  async function commitImport() {
    if (!rows.length || !preview?.valid || !confirmed) return;

    setCommitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/polling-import/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setError(
          payload?.error?.message ||
            "تعذر تنفيذ الاستيراد. لم يتم اعتماد العملية.",
        );
        return;
      }

      setResult(payload.data as CommitResult);
      router.refresh();
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
        <strong>استيراد المراكز والمكاتب</strong>
      </nav>

      <section className="setup-form-card">
        <div className="presentation-kicker">استيراد جماعي محكوم</div>
        <h1>استيراد المراكز ومكاتب التصويت</h1>
        <p>
          ارفع ملف CSV متوافقًا مع Excel. تبدأ العملية بمعاينة فقط، ولا تُنشأ
          أي سجلات قبل اجتياز التحقق وتأكيدك الصريح داخل الصفحة.
        </p>

        <div className="setup-form-grid">
          <label className="setup-field setup-field--full">
            <span>ملف CSV</span>
            <input
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              onChange={chooseFile}
            />
            <small>
              الحد الأقصى 10000 صف. يمكن ترك «عدد المسجلين» فارغًا وسيبقى
              العدد موسومًا كغير معروف.
            </small>
          </label>
        </div>

        <div className="setup-form-actions">
          <button
            className="setup-cancel-button"
            type="button"
            onClick={downloadTemplate}
          >
            تنزيل نموذج CSV
          </button>
          <button
            className="setup-submit-button"
            type="button"
            disabled={!rows.length || previewing}
            onClick={runPreview}
          >
            {previewing ? "جارٍ التحقق..." : "معاينة والتحقق"}
          </button>
        </div>

        {fileName ? (
          <div className="setup-note">
            الملف: <strong>{fileName}</strong> · {rows.length} صف بيانات
          </div>
        ) : null}

        {error ? <div className="setup-form-alert">{error}</div> : null}

        {!preview && sampleRows.length ? (
          <section className="setup-management-section">
            <div className="setup-section-heading">
              <div>
                <span>معاينة محلية</span>
                <h2>أول الصفوف المقروءة</h2>
                <p>هذه القراءة محلية في المتصفح ولم تُعتمد بعد.</p>
              </div>
            </div>
            <div className="setup-table">
              {sampleRows.map((item, index) => (
                <div className="setup-row" key={`${item.center_code}-${item.office_code}-${index}`}>
                  <div className="setup-row-main">
                    <strong>{item.center_name || "—"}</strong>
                    <small>{item.center_code || "—"}</small>
                  </div>
                  <span>{item.constituency_code || "—"}</span>
                  <span>{item.office_number || "مركز فقط"}</span>
                  <span>{item.registered_voters || "غير معروف"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {preview ? (
          <>
            <section className="setup-management-section">
              <div className="setup-section-heading">
                <div>
                  <span>نتيجة التحقق</span>
                  <h2>{preview.valid ? "الملف صالح للاستيراد" : "توجد أخطاء يجب إصلاحها"}</h2>
                  <p>{preview.row_count} صف تم فحصه على الخادم.</p>
                </div>
              </div>

              <div className="setup-summary-grid">
                <div>
                  <span>المراكز الجديدة</span>
                  <strong>{preview.centers.new}</strong>
                  <small>من أصل {preview.centers.total}</small>
                </div>
                <div>
                  <span>المراكز المعاد استخدامها</span>
                  <strong>{preview.centers.reused}</strong>
                  <small>بدون إنشاء مكرر</small>
                </div>
                <div>
                  <span>المكاتب الجديدة</span>
                  <strong>{preview.offices.new}</strong>
                  <small>من أصل {preview.offices.total}</small>
                </div>
                <div>
                  <span>المكاتب المعاد استخدامها</span>
                  <strong>{preview.offices.reused}</strong>
                  <small>استيراد قابل للإعادة بأمان</small>
                </div>
                <div>
                  <span>عدد المسجلين غير معروف</span>
                  <strong>{preview.offices.registered_voters_unknown}</strong>
                  <small>لن يُعرض كصفر</small>
                </div>
              </div>

              {preview.warnings.map((warning) => (
                <div className="setup-form-prerequisite" key={warning.code}>
                  {warning.message}
                  {warning.count ? ` (${warning.count})` : ""}
                </div>
              ))}

              {preview.errors.length ? (
                <div className="setup-table">
                  <div className="setup-row setup-row--header">
                    <span>السطر</span>
                    <span>الحقل</span>
                    <span>الرمز</span>
                    <span>الخطأ</span>
                  </div>
                  {preview.errors.slice(0, 100).map((item, index) => (
                    <div className="setup-row" key={`${item.row}-${item.code}-${index}`}>
                      <strong>{item.row || "عام"}</strong>
                      <span>{item.field}</span>
                      <span>{item.code}</span>
                      <span>{item.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {preview.valid && !result ? (
              <section className="setup-management-section">
                <label className="setup-field setup-field--full">
                  <span>تأكيد الاستيراد</span>
                  <span>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />{" "}
                    راجعت المعاينة وأوافق على إنشاء السجلات الجديدة الظاهرة
                    أعلاه.
                  </span>
                </label>

                <div className="setup-form-actions">
                  <button
                    className="setup-submit-button"
                    type="button"
                    disabled={!confirmed || committing}
                    onClick={commitImport}
                  >
                    {committing ? "جارٍ الاستيراد..." : "تنفيذ الاستيراد"}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {result ? (
          <section className="setup-management-section">
            <div className="setup-section-heading">
              <div>
                <span>اكتملت العملية</span>
                <h2>تم استيراد الهيكلة الميدانية</h2>
                <p>يمكن الآن مراجعة المراكز والمكاتب من صفحة إعداد الاستحقاق.</p>
              </div>
            </div>

            <div className="setup-summary-grid">
              <div>
                <span>مراكز أُنشئت</span>
                <strong>{result.counts.centers_created}</strong>
                <small>جديد</small>
              </div>
              <div>
                <span>مراكز أُعيد استخدامها</span>
                <strong>{result.counts.centers_reused}</strong>
                <small>مطابقة</small>
              </div>
              <div>
                <span>مكاتب أُنشئت</span>
                <strong>{result.counts.offices_created}</strong>
                <small>جديد</small>
              </div>
              <div>
                <span>مكاتب أُعيد استخدامها</span>
                <strong>{result.counts.offices_reused}</strong>
                <small>مطابقة</small>
              </div>
            </div>

            <div className="setup-form-actions">
              <Link
                className="setup-create-button"
                href={`/elections/${electionId}/setup`}
              >
                العودة إلى إعداد الاستحقاق
              </Link>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
