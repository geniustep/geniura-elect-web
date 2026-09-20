import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { ProtocolEntryForm } from "@/components/protocol/protocol-entry-form";
import { ProtocolWorkflow } from "@/components/protocol/protocol-workflow";
import type {
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
  try {
    data = await backendRequest<ProtocolPayload>(
      `/api/v1/polling-offices/${officeId}/protocol`,
      { method: "GET", sessionId },
    );
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
              أدخل الأرقام كما وردت في المحضر. لن يعتبر النظام النتيجة
              رسمية، وسيبقى التحقق والاعتماد مرحلتين منفصلتين.
            </p>
          </div>
          <span className="state-pill">
            {data.protocol?.state ?? "جديد"}
          </span>
        </div>

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
