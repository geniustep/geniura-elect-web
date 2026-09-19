"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { ElectionIncident, ElectRole } from "@/lib/elect/types";

const categoryNames = {
  access: "الولوج إلى المكتب",
  operations: "تشغيل المكتب",
  voting: "عملية التصويت",
  counting: "الفرز",
  documentation: "الوثائق والمحاضر",
  other: "أخرى",
} as const;

const severityNames = {
  low: "عادية",
  medium: "تحتاج متابعة",
  high: "عاجلة",
} as const;

const stateNames = {
  reported: "مبلّغ عنها",
  acknowledged: "تم الاطلاع",
  resolved: "تمت المعالجة",
  closed: "مغلقة",
} as const;

export function IncidentPanel({
  officeId,
  role,
  incidents,
}: {
  officeId: number;
  role: ElectRole;
  incidents: ElectionIncident[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    if (!description) return;

    setPending("report");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/operations/polling-offices/${officeId}/incidents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: String(form.get("category") ?? "operations"),
            severity: String(form.get("severity") ?? "medium"),
            description,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload?.error?.message ?? "تعذر تسجيل البلاغ.");
        return;
      }

      event.currentTarget.reset();
      setMessage("تم تسجيل البلاغ.");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setPending(null);
    }
  }

  async function transition(
    incident: ElectionIncident,
    state: "acknowledged" | "resolved" | "closed",
  ) {
    let note: string | undefined;
    if (state === "resolved") {
      const value = window.prompt("اكتب ملاحظة المعالجة");
      if (!value?.trim()) return;
      note = value.trim();
    }

    setPending(`incident-${incident.id}`);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/operations/incidents/${incident.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, note }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload?.error?.message ?? "تعذر تحديث البلاغ.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("تعذر تحديث البلاغ.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="incident-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">INCIDENTS</p>
          <h2>البلاغات التشغيلية</h2>
        </div>
        <span>{incidents.length} بلاغ</span>
      </div>

      <form className="incident-form" onSubmit={report}>
        <div className="incident-form-grid">
          <label>
            <span>النوع</span>
            <select name="category" defaultValue="operations">
              {Object.entries(categoryNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>درجة المتابعة</span>
            <select name="severity" defaultValue="medium">
              {Object.entries(severityNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>وصف البلاغ</span>
          <textarea
            name="description"
            rows={3}
            required
            placeholder="اكتب ما حدث باختصار وبدقة..."
          />
        </label>
        <div className="incident-form-footer">
          {message ? <small>{message}</small> : <span />}
          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(pending)}
          >
            {pending === "report" ? "جارٍ التسجيل..." : "تسجيل البلاغ"}
          </button>
        </div>
      </form>

      {incidents.length ? (
        <div className="incident-list">
          {incidents.map((incident) => {
            const busy = pending === `incident-${incident.id}`;
            return (
              <article className="incident-row" key={incident.id}>
                <div className="incident-row-main">
                  <div className="incident-tags">
                    <span className={`incident-severity ${incident.severity}`}>
                      {severityNames[incident.severity]}
                    </span>
                    <span className="state-pill">
                      {stateNames[incident.state]}
                    </span>
                  </div>
                  <strong>{categoryNames[incident.category]}</strong>
                  <p>{incident.description}</p>
                  <small>
                    {incident.reported_by?.name ?? "مستخدم"} ·{" "}
                    {new Date(incident.reported_at).toLocaleString("ar-MA")}
                  </small>
                  {incident.resolution_note ? (
                    <div className="resolution-note">
                      المعالجة: {incident.resolution_note}
                    </div>
                  ) : null}
                </div>

                {role !== "observer" && incident.state !== "closed" ? (
                  <div className="incident-actions">
                    {incident.state === "reported" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => transition(incident, "acknowledged")}
                      >
                        تم الاطلاع
                      </button>
                    ) : null}
                    {incident.state === "reported" ||
                    incident.state === "acknowledged" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => transition(incident, "resolved")}
                      >
                        تمت المعالجة
                      </button>
                    ) : null}
                    {incident.state === "resolved" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => transition(incident, "closed")}
                      >
                        إغلاق
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">لا توجد بلاغات مسجلة لهذا المكتب.</div>
      )}
    </section>
  );
}
