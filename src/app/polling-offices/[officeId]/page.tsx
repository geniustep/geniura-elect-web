import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { CheckInButton } from "@/components/polling/check-in-button";
import type { PollingOffice } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type OfficePayload = { polling_office: PollingOffice };

export default async function PollingOfficePage({
  params,
}: {
  params: Promise<{ officeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { officeId } = await params;
  const sessionId = await readElectSessionId();

  let office: PollingOffice;
  try {
    const data = await backendRequest<OfficePayload>(
      `/api/v1/polling-offices/${officeId}`,
      { method: "GET", sessionId },
    );
    office = data.polling_office;
  } catch {
    notFound();
  }

  const representative = office.primary_representative;
  const isPresent = representative?.status === "present";

  return (
    <main className="dashboard-shell">
      <AppHeader user={user} />
      <section className="dashboard-content">
        <nav className="breadcrumbs">
          <Link href="/dashboard">الرئيسية</Link>
          <span>/</span>
          <strong>مكتب {office.number}</strong>
        </nav>

        <div className="page-heading">
          <div>
            <p className="eyebrow">{office.code}</p>
            <h1>مكتب التصويت رقم {office.number}</h1>
            <p>{office.center.name} · {office.constituency.name}</p>
          </div>
          <span className={`coverage-chip ${office.coverage_state}`}>
            {office.coverage_state}
          </span>
        </div>

        <div className="detail-grid">
          <article className="detail-card">
            <p className="eyebrow">LOCATION</p>
            <h2>{office.center.name}</h2>
            <dl className="detail-list">
              <div>
                <dt>الجماعة</dt>
                <dd>{office.center.commune || "—"}</dd>
              </div>
              <div>
                <dt>العنوان</dt>
                <dd>{office.center.address || "—"}</dd>
              </div>
              <div>
                <dt>المسجلون</dt>
                <dd>{office.registered_voters}</dd>
              </div>
            </dl>
          </article>

          <article className="detail-card">
            <p className="eyebrow">REPRESENTATIVE</p>
            <h2>{representative?.name || "لا يوجد موكل أساسي"}</h2>
            <p className="detail-muted">
              {representative
                ? `الحالة: ${representative.status}`
                : "هذا المكتب غير مغطى بموكل أساسي."}
            </p>
            {!isPresent && representative ? (
              <CheckInButton officeId={office.id} />
            ) : null}
          </article>
        </div>

        <section className="protocol-callout">
          <div>
            <p className="eyebrow">PROTOCOL / PV</p>
            <h2>
              {office.protocol
                ? `المحضر: ${office.protocol.state}`
                : "المحضر لم يُدخل بعد"}
            </h2>
            <p>
              أدخل أرقام المحضر وارفع الوثيقة الأصلية قبل الانتقال إلى
              التحقق والمراجعة.
            </p>
          </div>
          <Link
            className="primary-link"
            href={`/polling-offices/${office.id}/protocol`}
          >
            {office.protocol ? "فتح المحضر" : "بدء إدخال المحضر"}
          </Link>
        </section>
      </section>
    </main>
  );
}
