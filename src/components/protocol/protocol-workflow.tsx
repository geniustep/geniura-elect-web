"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProtocolRecord } from "@/lib/elect/types";
import type { ElectRole } from "@/lib/elect/types";

const UI_UPLOAD_LIMIT = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

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
          بعد أول حفظ سيصبح بإمكانك رفع صورة المحضر وإرساله إلى مسار التحقق.
        </p>
      </aside>
    );
  }

  const activeProtocol = protocol;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setMessage("الصيغة المسموحة: JPEG أو PNG أو PDF.");
      return;
    }

    if (file.size > UI_UPLOAD_LIMIT) {
      setMessage("في هذه المرحلة يجب ألا يتجاوز الملف 3 MB.");
      return;
    }

    setPending("upload");
    setMessage(null);
    try {
      const content = await fileToBase64(file);
      const response = await fetch(
        `/api/operations/protocols/${activeProtocol.id}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimetype: file.type,
            content_base64: content,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload?.error?.message ?? "تعذر رفع المحضر.");
        return;
      }
      setMessage("تم رفع وثيقة المحضر.");
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

  return (
    <aside className="workflow-panel">
      <div className="workflow-heading">
        <div>
          <p className="eyebrow">DOCUMENT & REVIEW</p>
          <h2>وثيقة ومسار المحضر</h2>
        </div>
        <span className="state-pill">{activeProtocol.state}</span>
      </div>

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

      {activeProtocol.document.items.length ? (
        <div className="document-list">
          {activeProtocol.document.items.map((item) => (
            <div key={item.id}>
              <strong>{item.name}</strong>
              <small>
                {item.mimetype || "document"}
                {item.file_size
                  ? ` · ${Math.ceil(item.file_size / 1024)} KB`
                  : ""}
              </small>
            </div>
          ))}
        </div>
      ) : null}

      <div className="workflow-actions">
        {canUpload ? (
          <label className="secondary-button file-button">
            {pending === "upload" ? "جارٍ الرفع..." : "رفع صورة المحضر"}
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={upload}
              disabled={Boolean(pending)}
            />
          </label>
        ) : null}

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

      {message ? <p className="inline-message">{message}</p> : null}
    </aside>
  );
}
