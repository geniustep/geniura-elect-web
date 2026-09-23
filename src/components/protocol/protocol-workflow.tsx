"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ElectRole,
  ProtocolDocument,
  ProtocolRecord,
} from "@/lib/elect/types";

const UI_UPLOAD_LIMIT = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const documentKindLabel = {
  local: "محضر الانتخاب المحلي",
  regional: "محضر الانتخاب الجهوي",
} as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-MA", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function documentsByKind(
  documents: ProtocolDocument[],
  kind: "local" | "regional",
) {
  return documents.filter((document) => document.section_kind === kind);
}

export function ProtocolWorkflow({
  protocol,
  role,
}: {
  protocol: ProtocolRecord | null;
  role: ElectRole;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!protocol) {
    return (
      <aside className="workflow-panel">
        <p className="eyebrow">DOCUMENT & REVIEW</p>
        <h2>احفظ الأرقام أولًا</h2>
        <p>
          بعد أول حفظ سيصبح بإمكانك رفع محضر الانتخاب المحلي ومحضر الانتخاب
          الجهوي ومتابعة التحقق.
        </p>
      </aside>
    );
  }

  const activeProtocol = protocol;
  const localDocuments = documentsByKind(
    activeProtocol.document.items,
    "local",
  );
  const regionalDocuments = documentsByKind(
    activeProtocol.document.items,
    "regional",
  );

  async function upload(
    sectionKind: "local" | "regional",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setMessage(`${file.name}: الصيغة المسموحة JPEG أو PNG أو PDF.`);
        return;
      }
      if (file.size > UI_UPLOAD_LIMIT) {
        setMessage(`${file.name}: الحد الأقصى 10 MB لكل ملف.`);
        return;
      }
    }

    const pendingKey = `upload-${sectionKind}`;
    setPending(pendingKey);
    setMessage(null);
    try {
      for (const file of files) {
        const content = await fileToBase64(file);
        const response = await fetch(
          `/api/operations/protocols/${activeProtocol.id}/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section_kind: sectionKind,
              filename: file.name,
              mimetype: file.type,
              content_base64: content,
            }),
          },
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          setMessage(
            payload?.error?.message ??
              `تعذر رفع ${documentKindLabel[sectionKind]}.`,
          );
          return;
        }
      }
      setMessage(
        `تم رفع ${files.length} ملف إلى ${documentKindLabel[sectionKind]}.`,
      );
      router.refresh();
    } catch {
      setMessage("تعذر رفع الوثيقة.");
    } finally {
      setPending(null);
    }
  }

  async function runAction(
    action: "validate" | "verify" | "reject" | "reopen",
  ) {
    let body: Record<string, string> | undefined;
    if (action === "reject" || action === "reopen") {
      const reason = window.prompt(
        action === "reject"
          ? "اكتب سبب رفض المحضر"
          : "اكتب سبب إعادة فتح المحضر للتصحيح",
      );
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    }

    setPending(action);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/operations/protocols/${activeProtocol.id}/${action}`,
        {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload?.error?.message ?? "تعذر تنفيذ العملية.");
        return;
      }
      setMessage("تم تنفيذ العملية بنجاح.");
      router.refresh();
    } catch {
      setMessage("تعذر تنفيذ العملية.");
    } finally {
      setPending(null);
    }
  }

  const canUpload =
    activeProtocol.state !== "validated" && activeProtocol.state !== "verified";
  const canValidate =
    role !== "observer" &&
    activeProtocol.workflow.can_validate &&
    activeProtocol.state !== "verified";
  const canVerify =
    role === "manager" && activeProtocol.workflow.can_verify;
  const canReject =
    role !== "observer" && activeProtocol.state !== "verified";
  const canReopen =
    role === "manager" && activeProtocol.state === "validated";

  function documentGroup(
    kind: "local" | "regional",
    documents: ProtocolDocument[],
  ) {
    const pendingKey = `upload-${kind}`;
    return (
      <section className="document-group" key={kind}>
        <div className="document-group-heading">
          <div>
            <strong>{documentKindLabel[kind]}</strong>
            <small>{documents.length} ملف</small>
          </div>
          {canUpload ? (
            <label className="secondary-button file-button">
              {pending === pendingKey ? "جارٍ الرفع..." : "إضافة صورة/ملف"}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={(event) => upload(kind, event)}
                disabled={Boolean(pending)}
              />
            </label>
          ) : null}
        </div>

        {documents.length ? (
          <div className="document-list">
            {documents.map((item) => (
              <div className="document-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.mimetype || "document"}
                    {item.file_size
                      ? ` · ${Math.ceil(item.file_size / 1024)} KB`
                      : ""}
                  </small>
                </div>
                <a
                  className="document-download"
                  href={`/api/operations/protocols/${activeProtocol.id}/documents/${item.id}`}
                >
                  فتح / تنزيل
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="document-empty">لا توجد وثيقة مرفوعة لهذا القسم.</p>
        )}
      </section>
    );
  }

  return (
    <aside className="workflow-panel">
      <div className="workflow-heading">
        <div>
          <p className="eyebrow">DOCUMENT & REVIEW</p>
          <h2>الوثائق ومسار المحضر</h2>
        </div>
        <span className="state-pill">{activeProtocol.state}</span>
      </div>

      {activeProtocol.warnings?.has_warnings ? (
        <div className="protocol-alert protocol-alert-warning" role="status">
          <strong>تنبيه</strong>
          <span>{activeProtocol.warnings.message}</span>
        </div>
      ) : null}

      {activeProtocol.consistency.state === "inconsistent" ? (
        <div className="protocol-alert protocol-alert-error" role="alert">
          <strong>عدم اتساق</strong>
          <span>{activeProtocol.consistency.message}</span>
        </div>
      ) : null}

      <dl className="workflow-stats">
        <div>
          <dt>الوثائق</dt>
          <dd>{activeProtocol.document.count}</dd>
        </div>
        <div>
          <dt>سلامة الوثيقة</dt>
          <dd>{activeProtocol.document.integrity_state}</dd>
        </div>
        <div>
          <dt>توازن الأرقام</dt>
          <dd>{activeProtocol.consistency.state}</dd>
        </div>
      </dl>

      <div className="document-groups">
        {documentGroup("local", localDocuments)}
        {documentGroup("regional", regionalDocuments)}
      </div>

      <dl className="workflow-audit">
        <div>
          <dt>أدخل بواسطة</dt>
          <dd>{activeProtocol.workflow.entered_by?.name || "—"}</dd>
          <small>{formatDate(activeProtocol.workflow.entered_at)}</small>
        </div>
        <div>
          <dt>تحقق بواسطة</dt>
          <dd>{activeProtocol.workflow.validated_by?.name || "—"}</dd>
          <small>{formatDate(activeProtocol.workflow.validated_at)}</small>
        </div>
        <div>
          <dt>اعتمد بواسطة</dt>
          <dd>{activeProtocol.workflow.verified_by?.name || "—"}</dd>
          <small>{formatDate(activeProtocol.workflow.verified_at)}</small>
        </div>
      </dl>

      <div className="workflow-actions">
        {canValidate ? (
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => runAction("validate")}
          >
            التحقق من المحضر
          </button>
        ) : null}

        {canVerify ? (
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => runAction("verify")}
          >
            اعتماد المحضر
          </button>
        ) : null}

        {canReopen ? (
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => runAction("reopen")}
          >
            إعادة فتح للتصحيح
          </button>
        ) : null}

        {canReject ? (
          <button
            className="danger-button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => runAction("reject")}
          >
            رفض المحضر
          </button>
        ) : null}
      </div>

      {activeProtocol.state === "validated" ||
      activeProtocol.state === "verified" ? (
        <p className="inline-message">
          المحضر مقفل بعد التحقق/الاعتماد. يلزم مسار التصحيح المحكوم لتعديله.
        </p>
      ) : null}

      {message ? <p className="inline-message">{message}</p> : null}
    </aside>
  );
}
