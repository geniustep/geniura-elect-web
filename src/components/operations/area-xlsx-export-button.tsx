"use client";

import { useState } from "react";

import type {
  ConstituencyCoverageOffice,
  PollingOffice,
} from "@/lib/elect/types";
import {
  downloadPollingAreaWorkbook,
  type PollingAreaExportRow,
} from "@/lib/client/polling-area-xlsx-export";

type Props = {
  areaName: string;
  sourceFilename?: string | null;
  electionDate: string;
  coverageOffices: ConstituencyCoverageOffice[];
  structuralOffices: PollingOffice[];
};

export function AreaXlsxExportButton({
  areaName,
  sourceFilename,
  electionDate,
  coverageOffices,
  structuralOffices,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runExport() {
    setBusy(true);
    setError("");

    try {
      const structureById = new Map(
        structuralOffices.map((office) => [office.id, office]),
      );

      const rows: PollingAreaExportRow[] = coverageOffices.map((office) => {
        const structure = structureById.get(office.id);
        const representative = office.representative;

        return {
          compensation: structure?.source_compensation ?? null,
          phone: representative?.phone ?? "",
          voterNumber: representative?.voter_number ?? "",
          rbo: representative?.rbo ?? "",
          observerName: representative?.name ?? "",
          registeredVoters:
            structure?.registered_voters_known &&
            structure.registered_voters !== null
              ? structure.registered_voters
              : null,
          officeNumber: office.number,
          pollingCenterName: office.center.name,
          centralOfficeName: office.central_office?.name ?? "",
          centralOfficeNumber: office.central_office?.number ?? null,
          hasRepresentative: Boolean(representative),
        };
      });

      await downloadPollingAreaWorkbook({
        areaName,
        sourceFilename,
        electionDate,
        rows,
      });
    } catch {
      setError("تعذر إنشاء ملف Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="polling-area-export">
      <button type="button" onClick={() => void runExport()} disabled={busy}>
        {busy ? "جارٍ إنشاء Excel…" : "تصدير Excel"}
      </button>
      <small>بنفس نموذج وتنسيق ملف الجماعة الأصلي</small>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
