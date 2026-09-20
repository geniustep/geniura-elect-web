import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { AreaOfficeObserverTable } from "@/components/operations/area-office-observer-table";
import type { ConstituencyCoverageDashboard } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function PollingAreaPage({
  params,
}: {
  params: Promise<{
    electionId: string;
    constituencyId: string;
    areaId: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId, constituencyId, areaId } = await params;
  if (user.role === "observer") {
    redirect(`/elections/${electionId}`);
  }

  const numericAreaId = Number(areaId);
  if (!Number.isInteger(numericAreaId) || numericAreaId <= 0) {
    notFound();
  }

  const sessionId = await readElectSessionId();
  let dashboard: ConstituencyCoverageDashboard;
  try {
    dashboard = await backendRequest<ConstituencyCoverageDashboard>(
      `/api/v1/elections/${encodeURIComponent(electionId)}/constituencies/${encodeURIComponent(constituencyId)}/dashboard`,
      {
        method: "GET",
        sessionId,
      },
    );
  } catch {
    notFound();
  }

  const area = dashboard.areas.find((item) => item.id === numericAreaId);
  if (!area) notFound();

  const offices = dashboard.offices
    .filter((office) => office.area?.id === numericAreaId)
    .sort((a, b) => a.number - b.number);

  const percentage = area.total ? (100 * area.covered) / area.total : 0;

  return (
    <main className="dashboard-shell polling-area-page">
      <AppHeader user={user} />

      <section className="dashboard-content polling-area-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>
            {dashboard.election.name}
          </Link>
          <span>/</span>
          <Link
            href={`/elections/${electionId}/constituencies/${constituencyId}`}
          >
            {dashboard.constituency.name}
          </Link>
          <span>/</span>
          <strong>{area.name}</strong>
        </nav>

        <section className="polling-area-hero">
          <div>
            <span>النطاق الترابي</span>
            <h1>{area.name}</h1>
            <p>
              لائحة مكاتب التصويت والمراقبين داخل هذا النطاق، مع إظهار
              المكاتب غير المغطاة ونواقص بيانات المراقبين.
            </p>
          </div>
          <div className="polling-area-hero-stats">
            <div>
              <strong>{area.total}</strong>
              <span>مكتب</span>
            </div>
            <div>
              <strong>{area.covered}</strong>
              <span>لديه مراقب</span>
            </div>
            <div>
              <strong>{area.uncovered}</strong>
              <span>بدون مراقب</span>
            </div>
            <div>
              <strong>{percentage.toFixed(0)}%</strong>
              <span>تغطية</span>
            </div>
          </div>
        </section>

        <AreaOfficeObserverTable
          electionId={electionId}
          offices={offices}
          canEdit={user.role === "manager"}
        />
      </section>
    </main>
  );
}
