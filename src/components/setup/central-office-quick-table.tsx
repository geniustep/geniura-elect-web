"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type { SetupCentralOffice } from "@/lib/elect/types";

type Props = {
  electionId: string;
  initialItems: SetupCentralOffice[];
};

type SortDirection = "asc" | "desc";

type UpdateEnvelope = {
  success: boolean;
  data?: SetupCentralOffice;
  error?: {
    code?: string;
    message?: string;
  };
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا");
}

function friendlySaveError(status: number, payload: UpdateEnvelope | null) {
  if (status === 401) {
    return "انتهت الجلسة. أعد تسجيل الدخول ثم حاول مرة أخرى.";
  }
  if (status === 403) {
    return "ليست لديك صلاحية حفظ هذا التعديل.";
  }

  const backendMessage = normalizeSearch(payload?.error?.message ?? "");
  if (
    status === 409 ||
    /already|unique|duplicate|مستخدم|مكرر/.test(backendMessage)
  ) {
    return "هذا الرقم مستخدم بالفعل لمكتب مركزي آخر.";
  }
  if (status === 422) {
    return "تعذر حفظ التعديل. تحقق من أن الرقم غير مستخدم وأن البيانات صحيحة.";
  }
  return "تعذر حفظ التعديل. حاول مرة أخرى.";
}

export function CentralOfficeQuickTable({ electionId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftNumber, setDraftNumber] = useState("");
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [successId, setSuccessId] = useState<number | null>(null);

  const areas = useMemo(() => {
    const unique = new Map<number, string>();
    for (const item of items) {
      unique.set(item.area.id, item.area.name);
    }
    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return items
      .filter((item) => {
        if (areaId !== "all" && String(item.area.id) !== areaId) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        const haystack = normalizeSearch(
          [item.number, item.name ?? "", item.area.name].join(" "),
        );
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const areaOrder = a.area.name.localeCompare(b.area.name, "ar");
        if (areaOrder !== 0) {
          return areaOrder;
        }
        return sortDirection === "asc"
          ? a.number - b.number
          : b.number - a.number;
      });
  }, [areaId, items, query, sortDirection]);

  function startEdit(item: SetupCentralOffice) {
    setEditingId(item.id);
    setDraftNumber(String(item.number));
    setDraftName(item.name ?? "");
    setSuccessId(null);
    setErrorById((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftNumber("");
    setDraftName("");
  }

  async function saveItem(item: SetupCentralOffice) {
    const nextNumber = Number(draftNumber);
    if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
      setErrorById((current) => ({
        ...current,
        [item.id]: "أدخل رقمًا صحيحًا أكبر من صفر.",
      }));
      return;
    }

    const nextName = draftName.trim();
    const update: { number?: number; name?: string } = {};
    if (nextNumber !== item.number) {
      update.number = nextNumber;
    }
    if (nextName !== (item.name ?? "")) {
      update.name = nextName;
    }

    if (!Object.keys(update).length) {
      cancelEdit();
      return;
    }

    setSavingId(item.id);
    setSuccessId(null);
    setErrorById((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/central-offices/${item.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(update),
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as UpdateEnvelope | null;

      if (!response.ok || !payload?.success) {
        setErrorById((current) => ({
          ...current,
          [item.id]: friendlySaveError(response.status, payload),
        }));
        return;
      }

      const saved =
        payload.data ??
        ({
          ...item,
          number: update.number ?? item.number,
          name:
            update.name !== undefined
              ? update.name || null
              : item.name,
        } satisfies SetupCentralOffice);

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? saved : entry)),
      );
      setEditingId(null);
      setDraftNumber("");
      setDraftName("");
      setSuccessId(item.id);
    } catch {
      setErrorById((current) => ({
        ...current,
        [item.id]: "تعذر الاتصال بالخدمة. حاول مرة أخرى.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  function handleEditKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    item: SetupCentralOffice,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void saveItem(item);
    }
  }

  if (!items.length) {
    return <div className="setup-empty">لا توجد مكاتب مركزية بعد.</div>;
  }

  return (
    <div className="central-office-quick-editor">
      <div className="central-office-toolbar">
        <label className="central-office-filter-control">
          <span>بحث سريع</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="رقم، اسم المكتب أو النطاق"
          />
        </label>

        <label className="central-office-filter-control">
          <span>النطاق الترابي</span>
          <select
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
          >
            <option value="all">كل النطاقات</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="central-office-sort-button"
          type="button"
          onClick={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
          aria-label="تغيير ترتيب أرقام المكاتب المركزية"
        >
          الرقم {sortDirection === "asc" ? "↑" : "↓"}
        </button>

        <span className="central-office-result-count">
          {visibleItems.length} من {items.length}
        </span>
      </div>

      {visibleItems.length ? (
        <div className="setup-table central-office-quick-table">
          <div className="setup-row setup-row--header central-office-quick-row">
            <span>الرقم</span>
            <span>المكتب المركزي</span>
            <span>النطاق</span>
            <span>مكاتب التصويت</span>
            <span />
          </div>

          {visibleItems.map((item) => {
            const isEditing = editingId === item.id;
            const isSaving = savingId === item.id;
            const error = errorById[item.id];
            const saved = successId === item.id;

            return (
              <div
                className={`setup-row central-office-quick-row${isEditing ? " central-office-quick-row--editing" : ""}`}
                key={item.id}
              >
                <div className="central-office-cell">
                  <small className="central-office-mobile-label">الرقم</small>
                  {isEditing ? (
                    <input
                      className="central-office-inline-input central-office-number-input"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={draftNumber}
                      onChange={(event) => setDraftNumber(event.target.value)}
                      onKeyDown={(event) => handleEditKeyDown(event, item)}
                      aria-label={`رقم المكتب المركزي ${item.name ?? item.number}`}
                      autoFocus
                    />
                  ) : (
                    <strong>{item.number}</strong>
                  )}
                </div>

                <div className="central-office-cell central-office-name-cell">
                  <small className="central-office-mobile-label">
                    المكتب المركزي
                  </small>
                  {isEditing ? (
                    <input
                      className="central-office-inline-input"
                      type="text"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => handleEditKeyDown(event, item)}
                      placeholder="اسم المكتب المركزي"
                      aria-label={`اسم المكتب المركزي رقم ${item.number}`}
                    />
                  ) : (
                    <strong>{item.name || "بدون اسم"}</strong>
                  )}
                </div>

                <div className="central-office-cell">
                  <small className="central-office-mobile-label">
                    النطاق الترابي
                  </small>
                  <span>{item.area.name}</span>
                </div>

                <div className="central-office-cell">
                  <small className="central-office-mobile-label">
                    مكاتب التصويت
                  </small>
                  <span>{item.office_count}</span>
                </div>

                <div className="central-office-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="central-office-save-button"
                        type="button"
                        onClick={() => void saveItem(item)}
                        disabled={isSaving}
                      >
                        {isSaving ? "جارٍ الحفظ…" : "حفظ"}
                      </button>
                      <button
                        className="central-office-cancel-button"
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      className="setup-edit-link central-office-edit-button"
                      type="button"
                      onClick={() => startEdit(item)}
                    >
                      تعديل سريع
                    </button>
                  )}
                </div>

                {error ? (
                  <div
                    className="central-office-feedback central-office-feedback--error"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}

                {saved ? (
                  <div
                    className="central-office-feedback central-office-feedback--success"
                    role="status"
                  >
                    تم حفظ التعديل
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="setup-empty">
          لا توجد مكاتب مركزية مطابقة للبحث أو الفلتر الحالي.
        </div>
      )}
    </div>
  );
}
