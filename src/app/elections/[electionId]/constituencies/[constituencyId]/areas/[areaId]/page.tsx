import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { AreaOperationsTable } from "@/components/operations/area-operations-table";
import { AreaOfficeObserverTable } from "@/components/operations/area-office-observer-table";
import { AreaXlsxExportButton } from "@/components/operations/area-xlsx-export-button";
import { RepresentativeImportWorkspace } from "@/components/setup/representative-import-workspace";
import type {
  AreaManagementSnapshot,
  ConstituencyCoverageDashboard,
} from "@/lib/elect/types";
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

  const isAreaScopedCoordinator =
    user.role === "coordinator" &&
    user.scope_mode === "polling_areas" &&
    Boolean(
      user.polling_areas?.some(
        (item) =>
          item.id === numericAreaId &&
          item.election_id === Number(electionId),
      ),
    );

  const canRequestManagement =
    user.role === "manager" || isAreaScopedCoordinator;

  let management: AreaManagementSnapshot | null = null;
  if (canRequestManagement) {
    try {
      management = await backendRequest<AreaManagementSnapshot>(
        `/api/v1/elections/${encodeURIComponent(electionId)}/setup/areas/${numericAreaId}/management`,
        {
          method: "GET",
          sessionId,
        },
      );
    } catch {
      management = null;
    }
  }

  const offices = dashboard.offices
    .filter((office) => office.area?.id === numericAreaId)
    .sort((a, b) => a.number - b.number);

  const percentage = area.total ? (100 * area.covered) / area.total : 0;
  const needsAttention =
    area.missing_representative_info + area.needs_review;

  return (
    <main className="dashboard-shell polling-area-page">
      <AppHeader user={user} />

      <section className="dashboard-content polling-area-content polling-area-content--unified">
        <nav className="pjd-election-breadcrumbs">
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

        <section className="polling-area-hero polling-area-hero--unified">
          <div className="polling-area-hero-copy">
            <span>الجماعة / المقاطعة</span>
            <h1>{area.name}</h1>
            <div className="polling-area-hero-meta">
              <span>{dashboard.constituency.name}</span>
              <span>{area.total} مكتب تصويت</span>
              {management?.area.source_filename ? (
                <span>{management.area.source_filename}</span>
              ) : null}
            </div>
          </div>

          <div className="polling-area-hero-side">
            <div className="polling-area-hero-coverage">
              <span>التغطية</span>
              <strong>{percentage.toFixed(0)}%</strong>
              <div aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, percentage))}%`,
                  }}
                />
              </div>
              <small>
                {area.covered} من {area.total} مكتب
              </small>
            </div>

            {management ? (
              <AreaXlsxExportButton
                areaName={management.area.name}
                sourceFilename={management.area.source_filename}
                electionDate={dashboard.election.election_date}
                coverageOffices={offices}
                structuralOffices={management.offices}
              />
            ) : null}
          </div>
        </section>

        <div className="polling-area-quick-kpis">
          <div>
            <span>إجمالي المكاتب</span>
            <strong>{area.total}</strong>
          </div>
          <div className="is-success">
            <span>لديها مراقب</span>
            <strong>{area.covered}</strong>
          </div>
          <div className="is-danger">
            <span>بدون مراقب</span>
            <strong>{area.uncovered}</strong>
          </div>
          <div className="is-warning">
            <span>تحتاج معالجة</span>
            <strong>{needsAttention}</strong>
          </div>
        </div>

        {management ? (
          <>
            <details className="polling-area-import-drawer">
              <summary>
                <div>
                  <span>أداة عند الحاجة</span>
                  <strong>استيراد ومطابقة المراقبين من Excel</strong>
                </div>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="polling-area-import-body">
                <RepresentativeImportWorkspace
                  electionId={electionId}
                  constituencyId={Number(constituencyId)}
                  areas={[
                    {
                      id: numericAreaId,
                      name: management.area.name,
                    },
                  ]}
                />
              </div>
            </details>

            <AreaOperationsTable
              electionId={electionId}
              areaId={numericAreaId}
              initialArea={management.area}
              initialCentralOffices={management.central_offices}
              centers={management.centers}
              structuralOffices={management.offices}
              coverageOffices={offices}
              canEdit={Boolean(management.capabilities.edit)}
              canAssign={Boolean(
                management.capabilities.assign_representative ||
                  management.capabilities.edit,
              )}
              canCreate={Boolean(management.capabilities.create)}
              canArchive={Boolean(management.capabilities.archive)}
            />
          </>
        ) : (
          <AreaOfficeObserverTable
            electionId={electionId}
            areaId={numericAreaId}
            offices={offices}
            canEdit={false}
            canAssign={false}
            canDelete={false}
          />
        )}
      </section>
    </main>
  );
}
