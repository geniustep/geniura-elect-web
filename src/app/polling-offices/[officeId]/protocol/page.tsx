import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { ProtocolEntryForm } from "@/components/protocol/protocol-entry-form";
import { ProtocolWorkflow } from "@/components/protocol/protocol-workflow";
import type {
  PollingOffice,
  ProtocolRecord,
  ProtocolTemplate,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ProtocolPayload = {
  protocol: ProtocolRecord | null;
  template: ProtocolTemplate;
};

type OfficePayload = {
  polling_office: PollingOffice;
};

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ officeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { officeId } = await params;
  const sessionId = await readElectSessionId();

  let data: ProtocolPayload;
  let office: PollingOffice;
  try {
    const [protocolData, officeData] = await Promise.all([
      backendRequest<ProtocolPayload>(
        `/api/v1/polling-offices/${officeId}/protocol`,
        { method: "GET", sessionId },
      ),
      backendRequest<OfficePayload>(
        `/api/v1/polling-offices/${officeId}`,
        { method: "GET", sessionId },
      ),
    ]);
    data = protocolData;
    office = officeData.polling_office;
  } catch {
    notFound();
  }

  return (
    <main className="dashboard-shell">
      <AppHeader user={user} />
      <section className="dashboard-content">
        <nav className="breadcrumbs">
          <Link href={`/polling-offices/${officeId}`}>
            مكتب التصويت
          </Link>
          <span>/</span>
          <strong>المحضر</strong>
        </nav>

        <div className="page-heading">
          <div>
            <p className="eyebrow">PROTOCOL / PV</p>
            <h1>إدخال محضر مكتب التصويت</h1>
            <p>
              استخدم الجدول السريع على الحاسوب أو الإدخال المتسلسل على الهاتف.
              ينتقل Enter إلى اللائحة التالية، ويُحفظ تقدمك محليًا على الجهاز
              إلى أن تحفظ المحضر في النظام.
            </p>
          </div>
          <span className="state-pill">
            {data.protocol?.state ?? "جديد"}
          </span>
        </div>

        <article className="protocol-office-card" aria-label="هوية مكتب التصويت">
          <div>
            <p className="eyebrow">OFFICE CONFIRMATION</p>
            <h2>مكتب التصويت رقم {office.number}</h2>
            <p>{office.center.name}</p>
          </div>
          <dl className="protocol-office-grid">
            <div>
              <dt>الجماعة / المقاطعة</dt>
              <dd>{office.area?.name || office.center.commune || "—"}</dd>
            </div>
            <div>
              <dt>العنوان</dt>
              <dd>{office.center.address || "—"}</dd>
            </div>
            <div>
              <dt>المكتب المركزي</dt>
              <dd>
                {office.central_office
                  ? `${office.central_office.number} · ${office.central_office.name || "—"}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>الدائرة</dt>
              <dd>{office.constituency.name}</dd>
            </div>
          </dl>
        </article>

        <div className="protocol-layout">
          <ProtocolEntryForm
            officeId={Number(officeId)}
            protocol={data.protocol}
            template={data.template}
          />
          <ProtocolWorkflow
            protocol={data.protocol}
            role={user.role}
          />
        </div>
      </section>
    </main>
  );
}
