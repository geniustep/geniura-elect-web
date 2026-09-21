"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type {
  ConstituencyCoverageOffice,
  PollingOffice,
  SetupCentralOffice,
  SetupCenter,
  SetupPollingArea,
  SetupRepresentative,
} from "@/lib/elect/types";

type Props = {
  electionId: string;
  areaId: number;
  initialArea: SetupPollingArea;
  initialCentralOffices: SetupCentralOffice[];
  centers: SetupCenter[];
  structuralOffices: PollingOffice[];
  coverageOffices: ConstituencyCoverageOffice[];
  canEdit: boolean;
  canAssign: boolean;
  canCreate: boolean;
  canArchive: boolean;
};

type StructuralEnvelope<T> = {
  success: boolean;
  data?: { item: T };
  error?: { message?: string };
};

type RepresentativeEnvelope = {
  success: boolean;
  data?: { item: SetupRepresentative };
  error?: { message?: string };
};

type AssignmentEnvelope = {
  success: boolean;
  data?: {
    representative: SetupRepresentative;
    assignment: {
      id: number;
      status: string;
      check_in_at?: string | null;
    };
    representative_reused: boolean;
  };
  error?: { message?: string };
};

type ObserverDraft = {
  name: string;
  phone: string;
  voterNumber: string;
  rbo: string;
};

type OfficeDraft = {
  centralOfficeId: string;
  number: string;
  centerId: string;
  code: string;
  registeredVoters: string;
};

const emptyObserverDraft: ObserverDraft = {
  name: "",
  phone: "",
  voterNumber: "",
  rbo: "",
};

const emptyOfficeDraft: OfficeDraft = {
  centralOfficeId: "",
  number: "",
  centerId: "",
  code: "",
  registeredVoters: "",
};

const missingLabels: Record<string, string> = {
  name: "الاسم",
  phone: "الهاتف",
  voter_number: "رقم الناخب",
  rbo: "ر ب و",
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا");
}

function primaryStatus(office: ConstituencyCoverageOffice) {
  if (!office.representative) {
    return office.source_observer?.name
      ? { key: "source", label: "من المصدر فقط" }
      : { key: "uncovered", label: "بدون مراقب" };
  }
  if (office.review_flags.length) {
    return { key: "review", label: "تحتاج مراجعة" };
  }
  if (office.missing_fields.length) {
    return { key: "missing", label: "بيانات ناقصة" };
  }
  return { key: "complete", label: "مكتمل" };
}

export function AreaOperationsTable({
  electionId,
  areaId,
  initialArea,
  initialCentralOffices,
  centers,
  structuralOffices,
  coverageOffices,
  canEdit,
  canAssign,
  canCreate,
  canArchive,
}: Props) {
  const router = useRouter();

  const [area, setArea] = useState(initialArea);
  const [centralOffices, setCentralOffices] = useState(
    [...initialCentralOffices].sort((a, b) => a.number - b.number),
  );
  const [structureItems, setStructureItems] = useState(
    [...structuralOffices].sort((a, b) => a.number - b.number),
  );
  const [coverageItems, setCoverageItems] = useState(coverageOffices);

  const [query, setQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<
    "all" | "covered" | "uncovered"
  >("all");
  const [centralFilter, setCentralFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "complete" | "missing" | "review" | "source"
  >("all");

  const [areaName, setAreaName] = useState(initialArea.name);
  const [areaCode, setAreaCode] = useState(initialArea.code);
  const [newCentralNumber, setNewCentralNumber] = useState("");
  const [newCentralName, setNewCentralName] = useState("");
  const [editingCentralId, setEditingCentralId] = useState<number | null>(null);
  const [centralNumber, setCentralNumber] = useState("");
  const [centralName, setCentralName] = useState("");

  const [officeDraft, setOfficeDraft] = useState<OfficeDraft>(emptyOfficeDraft);
  const [editingOfficeId, setEditingOfficeId] = useState<number | null>(null);
  const [editingOfficeNumber, setEditingOfficeNumber] = useState("");
  const [editingRegisteredVoters, setEditingRegisteredVoters] = useState("");

  const [editingObserverId, setEditingObserverId] = useState<number | null>(null);
  const [creatingObserverId, setCreatingObserverId] = useState<number | null>(null);
  const [observerDraft, setObserverDraft] =
    useState<ObserverDraft>(emptyObserverDraft);

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [savedOfficeId, setSavedOfficeId] = useState<number | null>(null);

  useEffect(() => {
    setArea(initialArea);
    setAreaName(initialArea.name);
    setAreaCode(initialArea.code);
  }, [initialArea]);

  useEffect(() => {
    setCentralOffices(
      [...initialCentralOffices].sort((a, b) => a.number - b.number),
    );
  }, [initialCentralOffices]);

  useEffect(() => {
    setStructureItems([...structuralOffices].sort((a, b) => a.number - b.number));
  }, [structuralOffices]);

  useEffect(() => {
    setCoverageItems(coverageOffices);
  }, [coverageOffices]);

  const structureById = useMemo(
    () => new Map(structureItems.map((office) => [office.id, office])),
    [structureItems],
  );

  const visible = useMemo(() => {
    const needle = normalizeSearch(query);

    return coverageItems
      .filter((office) => {
        const covered = Boolean(office.assignment && office.representative);
        if (coverageFilter === "covered" && !covered) return false;
        if (coverageFilter === "uncovered" && covered) return false;

        const centralId = office.central_office?.id;
        if (
          centralFilter !== "all" &&
          (centralFilter === "none"
            ? Boolean(centralId)
            : String(centralId ?? "") !== centralFilter)
        ) {
          return false;
        }

        const status = primaryStatus(office);
        if (statusFilter !== "all" && status.key !== statusFilter) return false;

        if (!needle) return true;

        const structure = structureById.get(office.id);
        const representative = office.representative;
        const source = office.source_observer;
        const haystack = normalizeSearch(
          [
            office.number,
            office.center.name,
            office.central_office?.number ?? "",
            office.central_office?.name ?? "",
            structure?.registered_voters ?? "",
            representative?.name ?? "",
            representative?.phone ?? "",
            representative?.voter_number ?? "",
            representative?.rbo ?? "",
            source?.name ?? "",
            source?.phone ?? "",
          ].join(" "),
        );

        return haystack.includes(needle);
      })
      .sort((a, b) => {
        const centralA = a.central_office?.number ?? Number.MAX_SAFE_INTEGER;
        const centralB = b.central_office?.number ?? Number.MAX_SAFE_INTEGER;
        return centralA - centralB || a.number - b.number;
      });
  }, [
    centralFilter,
    coverageFilter,
    coverageItems,
    query,
    statusFilter,
    structureById,
  ]);

  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        central: ConstituencyCoverageOffice["central_office"];
        offices: ConstituencyCoverageOffice[];
      }
    >();

    for (const office of visible) {
      const key = office.central_office ? String(office.central_office.id) : "none";
      const current = grouped.get(key);
      if (current) {
        current.offices.push(office);
      } else {
        grouped.set(key, {
          central: office.central_office ?? null,
          offices: [office],
        });
      }
    }

    return [...grouped.values()];
  }, [visible]);

  const totals = useMemo(() => {
    const covered = coverageItems.filter(
      (office) => office.assignment && office.representative,
    ).length;
    const attention = coverageItems.filter((office) => {
      const status = primaryStatus(office).key;
      return status === "missing" || status === "review";
    }).length;

    return {
      total: coverageItems.length,
      covered,
      uncovered: coverageItems.length - covered,
      attention,
    };
  }, [coverageItems]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function clearRowError(officeId: number) {
    setRowError((current) => {
      const next = { ...current };
      delete next[officeId];
      return next;
    });
  }

  async function requestStructure<T>(
    routePath: string,
    method: "POST" | "PUT",
    body: Record<string, unknown>,
  ) {
    const response = await fetch(
      `/api/operations/elections/${encodeURIComponent(electionId)}/setup/${routePath}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response
      .json()
      .catch(() => null)) as StructuralEnvelope<T> | null;

    if (!response.ok || !payload?.success || !payload.data?.item) {
      throw new Error(payload?.error?.message || "تعذر حفظ التغييرات.");
    }

    return payload.data.item;
  }

  async function saveArea() {
    if (!canEdit) return;
    clearFeedback();

    if (!areaName.trim() || !areaCode.trim()) {
      setError("اسم الجماعة / المقاطعة والرمز مطلوبان.");
      return;
    }

    setBusy("area");
    try {
      const item = await requestStructure<SetupPollingArea>(
        `areas/${area.id}/management`,
        "PUT",
        { name: areaName.trim(), code: areaCode.trim() },
      );
      setArea(item);
      setAreaName(item.name);
      setAreaCode(item.code);
      setMessage("تم حفظ بيانات الجماعة / المقاطعة.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ البيانات.");
    } finally {
      setBusy("");
    }
  }

  async function createCentralOffice() {
    if (!canCreate) return;
    clearFeedback();

    const number = Number(newCentralNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setError("أدخل رقمًا صحيحًا للمكتب المركزي.");
      return;
    }

    setBusy("central-new");
    try {
      const item = await requestStructure<SetupCentralOffice>(
        "central-offices",
        "POST",
        {
          polling_area_id: area.id,
          number,
          name: newCentralName.trim(),
        },
      );
      setCentralOffices((current) =>
        [...current, item].sort((a, b) => a.number - b.number),
      );
      setNewCentralNumber("");
      setNewCentralName("");
      setMessage("تمت إضافة المكتب المركزي.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إضافة المكتب المركزي.");
    } finally {
      setBusy("");
    }
  }

  function beginCentralEdit(item: SetupCentralOffice) {
    setEditingCentralId(item.id);
    setCentralNumber(String(item.number));
    setCentralName(item.name ?? "");
    clearFeedback();
  }

  async function saveCentralOffice(item: SetupCentralOffice) {
    if (!canEdit) return;

    const number = Number(centralNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setError("رقم المكتب المركزي غير صالح.");
      return;
    }

    setBusy(`central-${item.id}`);
    try {
      const saved = await requestStructure<SetupCentralOffice>(
        `areas/${area.id}/central-offices/${item.id}`,
        "PUT",
        { number, name: centralName.trim() },
      );

      setCentralOffices((current) =>
        current
          .map((entry) => (entry.id === saved.id ? saved : entry))
          .sort((a, b) => a.number - b.number),
      );

      setStructureItems((current) =>
        current.map((office) =>
          office.central_office?.id === saved.id
            ? {
                ...office,
                central_office: {
                  ...office.central_office,
                  number: saved.number,
                  name: saved.name,
                },
              }
            : office,
        ),
      );

      setCoverageItems((current) =>
        current.map((office) =>
          office.central_office?.id === saved.id
            ? {
                ...office,
                central_office: {
                  ...office.central_office,
                  number: saved.number,
                  name: saved.name ?? null,
                },
              }
            : office,
        ),
      );

      setEditingCentralId(null);
      setMessage("تم تحديث المكتب المركزي.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تعديل المكتب المركزي.");
    } finally {
      setBusy("");
    }
  }

  async function archiveCentralOffice(item: SetupCentralOffice) {
    if (!canArchive) return;

    const confirmed = window.confirm(
      `أرشفة المكتب المركزي ${item.number}؟ يجب ألا تكون له مكاتب تصويت نشطة.`,
    );
    if (!confirmed) return;

    setBusy(`central-delete-${item.id}`);
    try {
      await requestStructure<SetupCentralOffice>(
        `areas/${area.id}/central-offices/${item.id}`,
        "PUT",
        { active: false },
      );
      setCentralOffices((current) =>
        current.filter((entry) => entry.id !== item.id),
      );
      setMessage("تمت أرشفة المكتب المركزي.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر أرشفة المكتب المركزي.");
    } finally {
      setBusy("");
    }
  }

  async function createOffice() {
    if (!canCreate) return;
    clearFeedback();

    const number = Number(officeDraft.number);
    const centerId = Number(officeDraft.centerId);
    const centralOfficeId = Number(officeDraft.centralOfficeId);

    if (!Number.isInteger(number) || number <= 0) {
      setError("أدخل رقمًا صحيحًا لمكتب التصويت.");
      return;
    }
    if (!centerId || !centralOfficeId) {
      setError("اختر المكتب المركزي ومقر مكتب التصويت.");
      return;
    }

    const code =
      officeDraft.code.trim() ||
      `${area.code}-OFF-${String(number).padStart(3, "0")}`;

    setBusy("office-new");
    try {
      const item = await requestStructure<PollingOffice>(
        "offices",
        "POST",
        {
          center_id: centerId,
          central_office_id: centralOfficeId,
          number,
          code,
          registered_voters: officeDraft.registeredVoters.trim(),
        },
      );
      setStructureItems((current) =>
        [...current, item].sort((a, b) => a.number - b.number),
      );
      setOfficeDraft(emptyOfficeDraft);
      setMessage(`تمت إضافة مكتب التصويت ${item.number}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إضافة مكتب التصويت.");
    } finally {
      setBusy("");
    }
  }

  function beginOfficeEdit(office: ConstituencyCoverageOffice) {
    if (!canEdit) return;
    const structure = structureById.get(office.id);
    if (!structure) return;

    setEditingObserverId(null);
    setCreatingObserverId(null);
    setEditingOfficeId(office.id);
    setEditingOfficeNumber(String(office.number));
    setEditingRegisteredVoters(
      structure.registered_voters_known && structure.registered_voters !== null
        ? String(structure.registered_voters)
        : "",
    );
    clearRowError(office.id);
  }

  async function saveOffice(office: ConstituencyCoverageOffice) {
    const structure = structureById.get(office.id);
    if (!structure || !canEdit) return;

    const number = Number(editingOfficeNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setRowError((current) => ({
        ...current,
        [office.id]: "رقم مكتب التصويت غير صالح.",
      }));
      return;
    }

    setBusy(`office-${office.id}`);
    try {
      const item = await requestStructure<PollingOffice>(
        `areas/${area.id}/offices/${office.id}`,
        "PUT",
        {
          number,
          registered_voters: editingRegisteredVoters.trim(),
        },
      );

      setStructureItems((current) =>
        current
          .map((entry) => (entry.id === item.id ? item : entry))
          .sort((a, b) => a.number - b.number),
      );
      setCoverageItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, number: item.number } : entry,
        ),
      );
      setEditingOfficeId(null);
      setSavedOfficeId(office.id);
      clearRowError(office.id);
      router.refresh();
    } catch (err) {
      setRowError((current) => ({
        ...current,
        [office.id]:
          err instanceof Error ? err.message : "تعذر تعديل مكتب التصويت.",
      }));
    } finally {
      setBusy("");
    }
  }

  async function archiveOffice(office: ConstituencyCoverageOffice) {
    if (!canArchive) return;

    const confirmed = window.confirm(
      `أرشفة مكتب التصويت ${office.number}؟ إذا كان مرتبطًا بمراقب نشط أو محضر أو حادثة، سيمنع النظام العملية.`,
    );
    if (!confirmed) return;

    setBusy(`office-delete-${office.id}`);
    try {
      await requestStructure<PollingOffice>(
        `areas/${area.id}/offices/${office.id}`,
        "PUT",
        { active: false },
      );
      setStructureItems((current) =>
        current.filter((entry) => entry.id !== office.id),
      );
      setCoverageItems((current) =>
        current.filter((entry) => entry.id !== office.id),
      );
      router.refresh();
    } catch (err) {
      setRowError((current) => ({
        ...current,
        [office.id]:
          err instanceof Error ? err.message : "تعذر أرشفة مكتب التصويت.",
      }));
    } finally {
      setBusy("");
    }
  }

  function startObserverEdit(office: ConstituencyCoverageOffice) {
    if (!office.representative || !canEdit) return;

    setEditingOfficeId(null);
    setCreatingObserverId(null);
    setEditingObserverId(office.id);
    setObserverDraft({
      name: office.representative.name,
      phone: office.representative.phone ?? "",
      voterNumber: office.representative.voter_number ?? "",
      rbo: office.representative.rbo ?? "",
    });
    clearRowError(office.id);
  }

  function startObserverCreate(office: ConstituencyCoverageOffice) {
    if (office.representative || !canAssign) return;

    setEditingOfficeId(null);
    setEditingObserverId(null);
    setCreatingObserverId(office.id);
    setObserverDraft({
      name: office.source_observer?.name ?? "",
      phone: office.source_observer?.phone ?? "",
      voterNumber: office.source_observer?.voter_number ?? "",
      rbo: office.source_observer?.rbo ?? "",
    });
    clearRowError(office.id);
  }

  function cancelRowEdit() {
    setEditingOfficeId(null);
    setEditingObserverId(null);
    setCreatingObserverId(null);
    setObserverDraft(emptyObserverDraft);
  }

  async function createRepresentative(office: ConstituencyCoverageOffice) {
    if (!canAssign || !observerDraft.name.trim()) {
      setRowError((current) => ({
        ...current,
        [office.id]: "أدخل اسم المراقب.",
      }));
      return;
    }

    setBusy(`observer-${office.id}`);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/areas/${areaId}/offices/${office.id}/representative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: observerDraft.name.trim(),
            phone: observerDraft.phone.trim(),
            voter_number: observerDraft.voterNumber.trim(),
            rbo: observerDraft.rbo.trim(),
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as AssignmentEnvelope | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(
          payload?.error?.message || "تعذر إضافة المراقب إلى المكتب.",
        );
      }

      const { representative, assignment } = payload.data;
      setCoverageItems((current) =>
        current.map((item) =>
          item.id === office.id
            ? {
                ...item,
                representative,
                assignment: {
                  id: assignment.id,
                  status: assignment.status,
                  check_in_at: assignment.check_in_at ?? null,
                },
                missing_fields: representative.missing_fields ?? [],
                coverage_state: "covered",
              }
            : item,
        ),
      );

      setCreatingObserverId(null);
      setSavedOfficeId(office.id);
      clearRowError(office.id);
      router.refresh();
    } catch (err) {
      setRowError((current) => ({
        ...current,
        [office.id]:
          err instanceof Error ? err.message : "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setBusy("");
    }
  }

  async function saveRepresentative(office: ConstituencyCoverageOffice) {
    const representative = office.representative;
    if (!representative || !canEdit) return;

    if (!observerDraft.name.trim()) {
      setRowError((current) => ({
        ...current,
        [office.id]: "اسم المراقب مطلوب.",
      }));
      return;
    }

    const body: Record<string, string> = {};
    const nextName = observerDraft.name.trim();
    const nextPhone = observerDraft.phone.trim();
    const nextVoterNumber = observerDraft.voterNumber.trim();
    const nextRbo = observerDraft.rbo.trim();

    if (nextName !== representative.name) body.name = nextName;
    if (nextPhone !== (representative.phone ?? "")) body.phone = nextPhone;
    if (nextVoterNumber !== (representative.voter_number ?? "")) {
      body.voter_number = nextVoterNumber;
    }
    if (nextRbo !== (representative.rbo ?? "")) body.rbo = nextRbo;

    if (!Object.keys(body).length) {
      cancelRowEdit();
      return;
    }

    setBusy(`observer-${office.id}`);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/areas/${areaId}/representatives/${representative.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as RepresentativeEnvelope | null;

      if (!response.ok || !payload?.success || !payload.data?.item) {
        throw new Error(payload?.error?.message || "تعذر حفظ بيانات المراقب.");
      }

      const saved = payload.data.item;
      setCoverageItems((current) =>
        current.map((item) =>
          item.id === office.id
            ? {
                ...item,
                representative: saved,
                missing_fields: saved.missing_fields ?? [],
              }
            : item,
        ),
      );

      setEditingObserverId(null);
      setSavedOfficeId(office.id);
      clearRowError(office.id);
      router.refresh();
    } catch (err) {
      setRowError((current) => ({
        ...current,
        [office.id]:
          err instanceof Error ? err.message : "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setBusy("");
    }
  }

  async function removeRepresentative(office: ConstituencyCoverageOffice) {
    if (!canArchive || !office.assignment || !office.representative) return;

    const confirmed = window.confirm(
      `إلغاء تعيين المراقب «${office.representative.name}» من مكتب التصويت ${office.number}؟`,
    );
    if (!confirmed) return;

    setBusy(`observer-delete-${office.id}`);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/areas/${areaId}/assignments/${office.assignment.id}/cancel`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { success: boolean; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || "تعذر إلغاء تعيين المراقب.");
      }

      setCoverageItems((current) =>
        current.map((item) =>
          item.id === office.id
            ? {
                ...item,
                assignment: null,
                representative: null,
                missing_fields: [],
                review_flags: [],
                coverage_state: "uncovered",
              }
            : item,
        ),
      );

      setSavedOfficeId(office.id);
      clearRowError(office.id);
      router.refresh();
    } catch (err) {
      setRowError((current) => ({
        ...current,
        [office.id]:
          err instanceof Error ? err.message : "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="area-operations">
      <div className="area-operations-summary">
        <div>
          <span>إجمالي المكاتب</span>
          <strong>{totals.total}</strong>
        </div>
        <div className="is-success">
          <span>مغطاة</span>
          <strong>{totals.covered}</strong>
        </div>
        <div className="is-danger">
          <span>بدون مراقب</span>
          <strong>{totals.uncovered}</strong>
        </div>
        <div className="is-warning">
          <span>تحتاج معالجة</span>
          <strong>{totals.attention}</strong>
        </div>
      </div>

      <details className="area-operations-tools">
        <summary>
          <div>
            <span>أدوات الهيكلة</span>
            <strong>بيانات الجماعة والمكاتب المركزية وإضافة مكتب</strong>
          </div>
          <span aria-hidden="true">⌄</span>
        </summary>

        <div className="area-operations-tools-body">
          <section className="area-operations-tool-section">
            <div className="area-operations-tool-head">
              <div>
                <span>الجماعة / المقاطعة</span>
                <strong>{area.name}</strong>
              </div>
              <small>{area.source_filename || "بدون ملف مصدر"}</small>
            </div>

            <div className="area-operations-form-grid">
              <label>
                <span>الاسم</span>
                <input
                  value={areaName}
                  onChange={(event) => setAreaName(event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label>
                <span>الرمز</span>
                <input
                  value={areaCode}
                  onChange={(event) => setAreaCode(event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void saveArea()}
                  disabled={busy === "area"}
                >
                  {busy === "area" ? "حفظ…" : "حفظ البيانات"}
                </button>
              ) : null}
            </div>
          </section>

          <section className="area-operations-tool-section">
            <div className="area-operations-tool-head">
              <div>
                <span>المكاتب المركزية</span>
                <strong>{centralOffices.length} مكاتب</strong>
              </div>
            </div>

            <div className="area-central-compact-list">
              {centralOffices.map((central) => {
                const editing = editingCentralId === central.id;
                const linkedCount = structureItems.filter(
                  (office) => office.central_office?.id === central.id,
                ).length;

                return (
                  <div className="area-central-compact-row" key={central.id}>
                    {editing ? (
                      <>
                        <input
                          inputMode="numeric"
                          value={centralNumber}
                          onChange={(event) => setCentralNumber(event.target.value)}
                          aria-label="رقم المكتب المركزي"
                        />
                        <input
                          value={centralName}
                          onChange={(event) => setCentralName(event.target.value)}
                          placeholder="اسم المكتب المركزي"
                        />
                        <div className="area-central-compact-actions">
                          <button
                            type="button"
                            onClick={() => void saveCentralOffice(central)}
                            disabled={busy === `central-${central.id}`}
                          >
                            حفظ
                          </button>
                          <button
                            type="button"
                            className="is-secondary"
                            onClick={() => setEditingCentralId(null)}
                          >
                            إلغاء
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>
                            مركزي {central.number}
                            {central.name ? ` · ${central.name}` : ""}
                          </strong>
                          <small>{linkedCount} مكاتب تصويت</small>
                        </div>
                        <div className="area-central-compact-actions">
                          {canEdit ? (
                            <button
                              type="button"
                              className="is-secondary"
                              onClick={() => beginCentralEdit(central)}
                            >
                              تعديل
                            </button>
                          ) : null}
                          {canArchive ? (
                            <button
                              type="button"
                              className="is-delete"
                              onClick={() => void archiveCentralOffice(central)}
                              disabled={busy === `central-delete-${central.id}`}
                            >
                              أرشفة
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {canCreate ? (
              <div className="area-central-create-row">
                <input
                  inputMode="numeric"
                  value={newCentralNumber}
                  onChange={(event) => setNewCentralNumber(event.target.value)}
                  placeholder="رقم مركزي جديد"
                />
                <input
                  value={newCentralName}
                  onChange={(event) => setNewCentralName(event.target.value)}
                  placeholder="الاسم (اختياري)"
                />
                <button
                  type="button"
                  onClick={() => void createCentralOffice()}
                  disabled={busy === "central-new"}
                >
                  + إضافة مكتب مركزي
                </button>
              </div>
            ) : null}
          </section>

          {canCreate ? (
            <section className="area-operations-tool-section">
              <div className="area-operations-tool-head">
                <div>
                  <span>مكتب تصويت جديد</span>
                  <strong>إضافة وربط مباشر</strong>
                </div>
              </div>

              <div className="area-office-create-grid">
                <select
                  value={officeDraft.centralOfficeId}
                  onChange={(event) =>
                    setOfficeDraft((current) => ({
                      ...current,
                      centralOfficeId: event.target.value,
                    }))
                  }
                >
                  <option value="">اختر المكتب المركزي</option>
                  {centralOffices.map((central) => (
                    <option value={central.id} key={central.id}>
                      مركزي {central.number}
                      {central.name ? ` · ${central.name}` : ""}
                    </option>
                  ))}
                </select>

                <input
                  inputMode="numeric"
                  value={officeDraft.number}
                  onChange={(event) =>
                    setOfficeDraft((current) => ({
                      ...current,
                      number: event.target.value,
                    }))
                  }
                  placeholder="رقم مكتب التصويت"
                />

                <select
                  value={officeDraft.centerId}
                  onChange={(event) =>
                    setOfficeDraft((current) => ({
                      ...current,
                      centerId: event.target.value,
                    }))
                  }
                >
                  <option value="">اختر المقر</option>
                  {centers.map((center) => (
                    <option value={center.id} key={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>

                <input
                  inputMode="numeric"
                  value={officeDraft.registeredVoters}
                  onChange={(event) =>
                    setOfficeDraft((current) => ({
                      ...current,
                      registeredVoters: event.target.value,
                    }))
                  }
                  placeholder="عدد المسجلين"
                />

                <input
                  value={officeDraft.code}
                  onChange={(event) =>
                    setOfficeDraft((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="الرمز (اختياري)"
                />

                <button
                  type="button"
                  onClick={() => void createOffice()}
                  disabled={busy === "office-new"}
                >
                  {busy === "office-new" ? "إضافة…" : "+ إضافة مكتب التصويت"}
                </button>
              </div>
            </section>
          ) : null}

          {error ? (
            <div className="area-operations-global-feedback is-error" role="alert">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="area-operations-global-feedback is-success" role="status">
              {message}
            </div>
          ) : null}
        </div>
      </details>

      <div className="area-operations-toolbar">
        <label className="area-operations-search">
          <span>بحث</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="المكتب، المقر، المراقب، الهاتف…"
          />
        </label>

        <label>
          <span>التغطية</span>
          <select
            value={coverageFilter}
            onChange={(event) =>
              setCoverageFilter(
                event.target.value as "all" | "covered" | "uncovered",
              )
            }
          >
            <option value="all">الكل</option>
            <option value="covered">لديها مراقب</option>
            <option value="uncovered">بدون مراقب</option>
          </select>
        </label>

        <label>
          <span>المكتب المركزي</span>
          <select
            value={centralFilter}
            onChange={(event) => setCentralFilter(event.target.value)}
          >
            <option value="all">كل المكاتب المركزية</option>
            {centralOffices.map((central) => (
              <option value={central.id} key={central.id}>
                مركزي {central.number}
              </option>
            ))}
            <option value="none">غير مرتبط</option>
          </select>
        </label>

        <label>
          <span>الحالة</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | "complete"
                  | "missing"
                  | "review"
                  | "source",
              )
            }
          >
            <option value="all">كل الحالات</option>
            <option value="complete">مكتمل</option>
            <option value="missing">بيانات ناقصة</option>
            <option value="review">تحتاج مراجعة</option>
            <option value="source">من المصدر فقط</option>
          </select>
        </label>

        <strong>{visible.length} مكتب</strong>
      </div>

      <div className="area-operations-table-wrap">
        <div className="area-operations-table">
          <div className="area-operations-row area-operations-row--head">
            <span>المكتب</span>
            <span>مقر مكتب التصويت</span>
            <span>المسجلون</span>
            <span>المراقب</span>
            <span>الهاتف</span>
            <span>رقم الناخب / RBO</span>
            <span>الحالة</span>
            <span>الإجراءات</span>
          </div>

          {groups.map((group) => {
            const groupCovered = group.offices.filter(
              (office) => office.representative && office.assignment,
            ).length;

            return (
              <div
                className="area-operations-group"
                key={group.central ? group.central.id : "none"}
              >
                <div className="area-operations-group-head">
                  <div>
                    <span>
                      {group.central
                        ? `المكتب المركزي ${group.central.number}`
                        : "غير مرتبط بمكتب مركزي"}
                    </span>
                    {group.central?.name ? <strong>{group.central.name}</strong> : null}
                  </div>
                  <small>
                    {group.offices.length} مكتب · {groupCovered} مغطى
                  </small>
                </div>

                {group.offices.map((office) => {
                  const structure = structureById.get(office.id);
                  const representative = office.representative;
                  const status = primaryStatus(office);
                  const officeEditing = editingOfficeId === office.id;
                  const observerEditing = editingObserverId === office.id;
                  const observerCreating = creatingObserverId === office.id;
                  const observerFormOpen = observerEditing || observerCreating;

                  return (
                    <article
                      className={`area-operations-row${
                        officeEditing || observerFormOpen ? " is-expanded" : ""
                      }`}
                      key={office.id}
                    >
                      <div className="area-operations-office-number">
                        <strong>{office.number}</strong>
                        <small>{structure?.code ?? "—"}</small>
                      </div>

                      <div className="area-operations-center">
                        <strong>{office.center.name}</strong>
                        <small>
                          {group.central
                            ? `مركزي ${group.central.number}`
                            : "غير مرتبط بمركزي"}
                        </small>
                      </div>

                      <div className="area-operations-registered">
                        <strong>
                          {structure?.registered_voters_known &&
                          structure.registered_voters !== null
                            ? structure.registered_voters
                            : "—"}
                        </strong>
                        <small>مسجل</small>
                      </div>

                      <div className="area-operations-observer">
                        {representative ? (
                          <>
                            <strong>{representative.name}</strong>
                            {office.source_observer?.name &&
                            office.source_observer.name !== representative.name ? (
                              <small>المصدر: {office.source_observer.name}</small>
                            ) : null}
                          </>
                        ) : office.source_observer?.name ? (
                          <>
                            <strong>{office.source_observer.name}</strong>
                            <small>من الملف فقط</small>
                          </>
                        ) : (
                          <span>بدون مراقب</span>
                        )}
                      </div>

                      <div className="area-operations-contact">
                        {representative?.phone ?? office.source_observer?.phone ?? "—"}
                      </div>

                      <div className="area-operations-identity">
                        <strong>
                          {representative?.voter_number ??
                            office.source_observer?.voter_number ??
                            "—"}
                        </strong>
                        <small>
                          RBO:{" "}
                          {representative?.rbo ?? office.source_observer?.rbo ?? "—"}
                        </small>
                      </div>

                      <div className="area-operations-status">
                        <span className={`is-${status.key}`}>{status.label}</span>
                        {office.missing_fields.length ? (
                          <small>
                            ناقص:{" "}
                            {office.missing_fields
                              .map((field) => missingLabels[field] ?? field)
                              .join("، ")}
                          </small>
                        ) : null}
                      </div>

                      <div className="area-operations-actions">
                        {canEdit ? (
                          <button
                            type="button"
                            className="is-secondary"
                            onClick={() => beginOfficeEdit(office)}
                          >
                            المكتب
                          </button>
                        ) : null}

                        {representative && canEdit ? (
                          <button
                            type="button"
                            onClick={() => startObserverEdit(office)}
                          >
                            المراقب
                          </button>
                        ) : !representative && canAssign ? (
                          <button
                            type="button"
                            className="is-add"
                            onClick={() => startObserverCreate(office)}
                          >
                            + مراقب
                          </button>
                        ) : null}

                        {canArchive ? (
                          <details className="area-operations-row-menu">
                            <summary aria-label="إجراءات إضافية">•••</summary>
                            <div>
                              {representative && office.assignment ? (
                                <button
                                  type="button"
                                  onClick={() => void removeRepresentative(office)}
                                  disabled={
                                    busy === `observer-delete-${office.id}`
                                  }
                                >
                                  إلغاء تعيين المراقب
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => void archiveOffice(office)}
                                disabled={busy === `office-delete-${office.id}`}
                              >
                                أرشفة المكتب
                              </button>
                            </div>
                          </details>
                        ) : null}
                      </div>

                      {officeEditing ? (
                        <div className="area-operations-expanded-panel">
                          <div className="area-operations-expanded-head">
                            <div>
                              <span>تعديل مكتب التصويت</span>
                              <strong>مكتب {office.number}</strong>
                            </div>
                          </div>
                          <div className="area-operations-edit-grid">
                            <label>
                              <span>رقم المكتب</span>
                              <input
                                inputMode="numeric"
                                value={editingOfficeNumber}
                                onChange={(event) =>
                                  setEditingOfficeNumber(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              <span>عدد المسجلين</span>
                              <input
                                inputMode="numeric"
                                value={editingRegisteredVoters}
                                onChange={(event) =>
                                  setEditingRegisteredVoters(event.target.value)
                                }
                                placeholder="غير معروف"
                              />
                            </label>
                            <div className="area-operations-edit-actions">
                              <button
                                type="button"
                                onClick={() => void saveOffice(office)}
                                disabled={busy === `office-${office.id}`}
                              >
                                {busy === `office-${office.id}` ? "حفظ…" : "حفظ"}
                              </button>
                              <button
                                type="button"
                                className="is-secondary"
                                onClick={cancelRowEdit}
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {observerFormOpen ? (
                        <div className="area-operations-expanded-panel">
                          <div className="area-operations-expanded-head">
                            <div>
                              <span>
                                {observerCreating
                                  ? "إضافة وربط مراقب"
                                  : "تعديل بيانات المراقب"}
                              </span>
                              <strong>مكتب {office.number}</strong>
                            </div>
                          </div>
                          <div className="area-operations-observer-grid">
                            <label>
                              <span>الاسم</span>
                              <input
                                value={observerDraft.name}
                                onChange={(event) =>
                                  setObserverDraft((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                autoFocus
                              />
                            </label>
                            <label>
                              <span>الهاتف</span>
                              <input
                                value={observerDraft.phone}
                                onChange={(event) =>
                                  setObserverDraft((current) => ({
                                    ...current,
                                    phone: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label>
                              <span>رقم الناخب</span>
                              <input
                                value={observerDraft.voterNumber}
                                onChange={(event) =>
                                  setObserverDraft((current) => ({
                                    ...current,
                                    voterNumber: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label>
                              <span>RBO</span>
                              <input
                                value={observerDraft.rbo}
                                onChange={(event) =>
                                  setObserverDraft((current) => ({
                                    ...current,
                                    rbo: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <div className="area-operations-edit-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  observerCreating
                                    ? void createRepresentative(office)
                                    : void saveRepresentative(office)
                                }
                                disabled={busy === `observer-${office.id}`}
                              >
                                {busy === `observer-${office.id}`
                                  ? "حفظ…"
                                  : observerCreating
                                    ? "إضافة وربط"
                                    : "حفظ"}
                              </button>
                              <button
                                type="button"
                                className="is-secondary"
                                onClick={cancelRowEdit}
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {rowError[office.id] ? (
                        <div className="area-operations-row-feedback is-error">
                          {rowError[office.id]}
                        </div>
                      ) : null}

                      {savedOfficeId === office.id ? (
                        <div className="area-operations-row-feedback is-success">
                          تم تنفيذ العملية بنجاح
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {!visible.length ? (
        <div className="setup-empty">لا توجد مكاتب مطابقة للفلاتر الحالية.</div>
      ) : null}
    </section>
  );
}
