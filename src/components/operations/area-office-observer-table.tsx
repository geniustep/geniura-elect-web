"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type {
  ConstituencyCoverageOffice,
  SetupRepresentative,
} from "@/lib/elect/types";

type Props = {
  electionId: string;
  areaId: number;
  offices: ConstituencyCoverageOffice[];
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
};

type Draft = {
  name: string;
  phone: string;
  voterNumber: string;
  rbo: string;
};

type Envelope = {
  success: boolean;
  data?: { item: SetupRepresentative };
  error?: { message?: string };
};

type ManualAssignmentEnvelope = {
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

const missingLabels: Record<string, string> = {
  name: "الاسم",
  phone: "الهاتف",
  voter_number: "رقم الناخب",
  rbo: "ر ب و",
};

const reviewLabels: Record<string, string> = {
  duplicate_phone: "هاتف مكرر",
  duplicate_voter_number: "رقم ناخب مكرر",
  duplicate_rbo: "ر ب و مكرر",
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا");
}

export function AreaOfficeObserverTable({
  electionId,
  areaId,
  offices,
  canEdit,
  canCreate,
  canDelete,
}: Props) {
  const [items, setItems] = useState(offices);
  const [query, setQuery] = useState("");
  const [coverage, setCoverage] = useState<"all" | "covered" | "uncovered">(
    "all",
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingOfficeId, setCreatingOfficeId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    phone: "",
    voterNumber: "",
    rbo: "",
  });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [errorByOffice, setErrorByOffice] = useState<Record<number, string>>({});
  const [savedOfficeId, setSavedOfficeId] = useState<number | null>(null);

  const visible = useMemo(() => {
    const needle = normalizeSearch(query);
    return items.filter((office) => {
      const isCovered = Boolean(office.assignment && office.representative);
      if (coverage === "covered" && !isCovered) return false;
      if (coverage === "uncovered" && isCovered) return false;
      if (!needle) return true;

      const representative = office.representative;
      const source = office.source_observer;
      const haystack = normalizeSearch(
        [
          office.number,
          office.center.name,
          office.central_office?.number ?? "",
          office.central_office?.name ?? "",
          representative?.name ?? "",
          representative?.phone ?? "",
          representative?.voter_number ?? "",
          representative?.rbo ?? "",
          source?.name ?? "",
          source?.phone ?? "",
        ].join(" "),
      );
      return haystack.includes(needle);
    });
  }, [coverage, items, query]);

  function clearOfficeError(officeId: number) {
    setErrorByOffice((current) => {
      const next = { ...current };
      delete next[officeId];
      return next;
    });
  }

  function startEdit(office: ConstituencyCoverageOffice) {
    if (!office.representative) return;
    setCreatingOfficeId(null);
    setEditingId(office.id);
    setSavedOfficeId(null);
    setDraft({
      name: office.representative.name,
      phone: office.representative.phone ?? "",
      voterNumber: office.representative.voter_number ?? "",
      rbo: office.representative.rbo ?? "",
    });
    clearOfficeError(office.id);
  }

  function startCreate(office: ConstituencyCoverageOffice) {
    if (office.representative) return;
    setEditingId(null);
    setCreatingOfficeId(office.id);
    setSavedOfficeId(null);
    setDraft({
      name: "",
      phone: "",
      voterNumber: "",
      rbo: "",
    });
    clearOfficeError(office.id);
  }

  function cancelForm() {
    setEditingId(null);
    setCreatingOfficeId(null);
  }

  async function createRepresentative(office: ConstituencyCoverageOffice) {
    if (!draft.name.trim()) {
      setErrorByOffice((current) => ({
        ...current,
        [office.id]: "أدخل اسم المراقب.",
      }));
      return;
    }

    setSavingId(office.id);
    setSavedOfficeId(null);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/offices/${office.id}/representative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            phone: draft.phone.trim(),
            voter_number: draft.voterNumber.trim(),
            rbo: draft.rbo.trim(),
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as ManualAssignmentEnvelope | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setErrorByOffice((current) => ({
          ...current,
          [office.id]:
            payload?.error?.message || "تعذر إضافة المراقب إلى المكتب.",
        }));
        return;
      }

      const { representative, assignment } = payload.data;
      setItems((current) =>
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
              }
            : item,
        ),
      );
      setCreatingOfficeId(null);
      setSavedOfficeId(office.id);
      clearOfficeError(office.id);
    } catch {
      setErrorByOffice((current) => ({
        ...current,
        [office.id]: "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function save(office: ConstituencyCoverageOffice) {
    const representative = office.representative;
    if (!representative) return;

    if (!draft.name.trim()) {
      setErrorByOffice((current) => ({
        ...current,
        [office.id]: "اسم المراقب مطلوب عند تعديل مراقب موجود.",
      }));
      return;
    }

    const body: Record<string, string> = {};
    const nextName = draft.name.trim();
    const nextPhone = draft.phone.trim();
    const nextVoterNumber = draft.voterNumber.trim();
    const nextRbo = draft.rbo.trim();

    if (nextName !== representative.name) body.name = nextName;
    if (nextPhone !== (representative.phone ?? "")) body.phone = nextPhone;
    if (nextVoterNumber !== (representative.voter_number ?? "")) {
      body.voter_number = nextVoterNumber;
    }
    if (nextRbo !== (representative.rbo ?? "")) body.rbo = nextRbo;

    if (!Object.keys(body).length) {
      cancelForm();
      return;
    }

    setSavingId(office.id);
    setSavedOfficeId(null);
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
        .catch(() => null)) as Envelope | null;

      if (!response.ok || !payload?.success || !payload.data?.item) {
        setErrorByOffice((current) => ({
          ...current,
          [office.id]:
            payload?.error?.message || "تعذر حفظ بيانات المراقب.",
        }));
        return;
      }

      const saved = payload.data.item;
      setItems((current) =>
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
      setEditingId(null);
      setSavedOfficeId(office.id);
      clearOfficeError(office.id);
    } catch {
      setErrorByOffice((current) => ({
        ...current,
        [office.id]: "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function removeRepresentative(office: ConstituencyCoverageOffice) {
    if (!canDelete || !office.assignment || !office.representative) return;

    const confirmed = window.confirm(
      `حذف تعيين المراقب «${office.representative.name}» من مكتب التصويت ${office.number}؟ سيُلغى التعيين مع الاحتفاظ بالسجل التاريخي.`,
    );
    if (!confirmed) return;

    setSavingId(office.id);
    setSavedOfficeId(null);
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
        setErrorByOffice((current) => ({
          ...current,
          [office.id]:
            payload?.error?.message || "تعذر حذف تعيين المراقب.",
        }));
        return;
      }

      setItems((current) =>
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
      clearOfficeError(office.id);
      setSavedOfficeId(office.id);
    } catch {
      setErrorByOffice((current) => ({
        ...current,
        [office.id]: "تعذر الاتصال بالخدمة.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  function onKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    office: ConstituencyCoverageOffice,
    isCreating: boolean,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelForm();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (isCreating) {
        void createRepresentative(office);
      } else {
        void save(office);
      }
    }
  }

  return (
    <section className="area-office-list-section">
      <div className="area-office-toolbar">
        <label>
          <span>بحث</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="رقم المكتب، المقر، اسم المراقب أو الهاتف"
          />
        </label>

        <label>
          <span>التغطية</span>
          <select
            value={coverage}
            onChange={(event) =>
              setCoverage(
                event.target.value as "all" | "covered" | "uncovered",
              )
            }
          >
            <option value="all">كل المكاتب</option>
            <option value="covered">لديها مراقب</option>
            <option value="uncovered">بدون مراقب</option>
          </select>
        </label>

        <strong>{visible.length} مكتب</strong>
      </div>

      <div className="area-office-table">
        <div className="area-office-row area-office-row--head">
          <span>المكتب</span>
          <span>مقر مكتب التصويت</span>
          <span>المراقب</span>
          <span>الهاتف</span>
          <span>رقم الناخب</span>
          <span>ر ب و</span>
          <span>الحالة</span>
          <span />
        </div>

        {visible.map((office) => {
          const representative = office.representative;
          const isEditing = editingId === office.id;
          const isCreating = creatingOfficeId === office.id;
          const isFormOpen = isEditing || isCreating;
          const missing = office.missing_fields.map(
            (field) => missingLabels[field] ?? field,
          );
          const reviews = office.review_flags.map(
            (flag) => reviewLabels[flag] ?? flag,
          );

          return (
            <article
              className={`area-office-row${isFormOpen ? " is-editing" : ""}`}
              key={office.id}
            >
              <div className="area-office-number">
                <strong>{office.number}</strong>
                {office.central_office ? (
                  <small>مركزي {office.central_office.number}</small>
                ) : null}
              </div>

              <div className="area-office-center">
                <strong>{office.center.name}</strong>
                {office.central_office?.name ? (
                  <small>{office.central_office.name}</small>
                ) : null}
              </div>

              <div>
                {isFormOpen ? (
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    onKeyDown={(event) =>
                      onKeyDown(event, office, isCreating)
                    }
                    placeholder="اسم المراقب"
                    autoFocus
                  />
                ) : representative ? (
                  <strong>{representative.name}</strong>
                ) : office.source_observer?.name ? (
                  <span className="area-office-source-value">
                    {office.source_observer.name}
                    <small>من الملف فقط</small>
                  </span>
                ) : (
                  <span className="area-office-empty">بدون مراقب</span>
                )}
              </div>

              <div>
                {isFormOpen ? (
                  <input
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    onKeyDown={(event) =>
                      onKeyDown(event, office, isCreating)
                    }
                    placeholder="الهاتف"
                  />
                ) : (
                  representative?.phone ??
                  office.source_observer?.phone ??
                  "—"
                )}
              </div>

              <div>
                {isFormOpen ? (
                  <input
                    value={draft.voterNumber}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        voterNumber: event.target.value,
                      }))
                    }
                    onKeyDown={(event) =>
                      onKeyDown(event, office, isCreating)
                    }
                    placeholder="رقم الناخب"
                  />
                ) : (
                  representative?.voter_number ??
                  office.source_observer?.voter_number ??
                  "—"
                )}
              </div>

              <div>
                {isFormOpen ? (
                  <input
                    value={draft.rbo}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        rbo: event.target.value,
                      }))
                    }
                    onKeyDown={(event) =>
                      onKeyDown(event, office, isCreating)
                    }
                    placeholder="ر ب و"
                  />
                ) : (
                  representative?.rbo ?? office.source_observer?.rbo ?? "—"
                )}
              </div>

              <div className="area-office-statuses">
                {!representative ? (
                  <span className="is-uncovered">بدون مراقب</span>
                ) : null}
                {missing.length ? (
                  <span className="is-missing">ناقص: {missing.join("، ")}</span>
                ) : null}
                {reviews.map((review) => (
                  <span className="is-review" key={review}>
                    {review}
                  </span>
                ))}
                {representative && !missing.length && !reviews.length ? (
                  <span className="is-complete">مكتمل</span>
                ) : null}
              </div>

              <div className="area-office-actions">
                {isFormOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        isCreating
                          ? void createRepresentative(office)
                          : void save(office)
                      }
                      disabled={savingId === office.id}
                    >
                      {savingId === office.id
                        ? "حفظ…"
                        : isCreating
                          ? "إضافة وربط"
                          : "حفظ"}
                    </button>
                    <button
                      type="button"
                      className="is-secondary"
                      onClick={cancelForm}
                      disabled={savingId === office.id}
                    >
                      إلغاء
                    </button>
                  </>
                ) : representative ? (
                  <>
                    {canEdit ? (
                      <button type="button" onClick={() => startEdit(office)}>
                        تعديل
                      </button>
                    ) : null}
                    {canDelete && office.assignment ? (
                      <button
                        type="button"
                        className="is-delete"
                        onClick={() => void removeRepresentative(office)}
                        disabled={savingId === office.id}
                      >
                        حذف
                      </button>
                    ) : null}
                  </>
                ) : canCreate ? (
                  <button
                    type="button"
                    className="is-add"
                    onClick={() => startCreate(office)}
                  >
                    إضافة مراقب
                  </button>
                ) : null}
              </div>

              {errorByOffice[office.id] ? (
                <div className="area-office-feedback is-error" role="alert">
                  {errorByOffice[office.id]}
                </div>
              ) : null}

              {savedOfficeId === office.id ? (
                <div className="area-office-feedback is-success" role="status">
                  تم تنفيذ العملية بنجاح
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!visible.length ? (
        <div className="setup-empty">لا توجد مكاتب مطابقة للبحث الحالي.</div>
      ) : null}
    </section>
  );
}
