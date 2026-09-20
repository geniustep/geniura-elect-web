"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  PollingOffice,
  SetupCentralOffice,
  SetupCenter,
  SetupPollingArea,
} from "@/lib/elect/types";

type Props = {
  electionId: string;
  initialArea: SetupPollingArea;
  initialCentralOffices: SetupCentralOffice[];
  centers: SetupCenter[];
  initialOffices: PollingOffice[];
  canCreate: boolean;
  canArchive: boolean;
};

type Envelope<T> = {
  success: boolean;
  data?: { item: T };
  error?: { message?: string };
};

type OfficeDraft = {
  number: string;
  code: string;
  centerId: string;
  registeredVoters: string;
};

const emptyOfficeDraft: OfficeDraft = {
  number: "",
  code: "",
  centerId: "",
  registeredVoters: "",
};

export function AreaStructureManager({
  electionId,
  initialArea,
  initialCentralOffices,
  centers,
  initialOffices,
  canCreate,
  canArchive,
}: Props) {
  const router = useRouter();
  const [area, setArea] = useState(initialArea);
  const [centralOffices, setCentralOffices] = useState(
    [...initialCentralOffices].sort((a, b) => a.number - b.number),
  );
  const [offices, setOffices] = useState(
    [...initialOffices].sort((a, b) => a.number - b.number),
  );
  const [areaName, setAreaName] = useState(initialArea.name);
  const [areaCode, setAreaCode] = useState(initialArea.code);
  const [newCentralNumber, setNewCentralNumber] = useState("");
  const [newCentralName, setNewCentralName] = useState("");
  const [editingCentralId, setEditingCentralId] = useState<number | null>(null);
  const [centralNumber, setCentralNumber] = useState("");
  const [centralName, setCentralName] = useState("");
  const [addingOfficeTo, setAddingOfficeTo] = useState<number | null>(null);
  const [officeDraft, setOfficeDraft] = useState<OfficeDraft>(emptyOfficeDraft);
  const [editingOfficeId, setEditingOfficeId] = useState<number | null>(null);
  const [editingOfficeNumber, setEditingOfficeNumber] = useState("");
  const [editingRegisteredVoters, setEditingRegisteredVoters] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const unassignedOffices = useMemo(
    () => offices.filter((office) => !office.central_office),
    [offices],
  );

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  async function requestItem<T>(
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
      .catch(() => null)) as Envelope<T> | null;
    if (!response.ok || !payload?.success || !payload.data?.item) {
      throw new Error(payload?.error?.message || "تعذر حفظ التغييرات.");
    }
    return payload.data.item;
  }

  async function saveArea() {
    clearFeedback();
    if (!areaName.trim() || !areaCode.trim()) {
      setError("اسم الجماعة / المقاطعة والرمز مطلوبان.");
      return;
    }
    setBusy("area");
    try {
      const item = await requestItem<SetupPollingArea>(
        `areas/${area.id}/management`,
        "PUT",
        { name: areaName.trim(), code: areaCode.trim() },
      );
      setArea(item);
      setAreaName(item.name);
      setAreaCode(item.code);
      setMessage("تم حفظ تفاصيل الجماعة / المقاطعة.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ التفاصيل.");
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
      const item = await requestItem<SetupCentralOffice>(
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
    clearFeedback();
    setEditingCentralId(item.id);
    setCentralNumber(String(item.number));
    setCentralName(item.name ?? "");
  }

  async function saveCentralOffice(item: SetupCentralOffice) {
    clearFeedback();
    const number = Number(centralNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setError("رقم المكتب المركزي غير صالح.");
      return;
    }
    setBusy(`central-${item.id}`);
    try {
      const saved = await requestItem<SetupCentralOffice>(
        `areas/${area.id}/central-offices/${item.id}`,
        "PUT",
        { number, name: centralName.trim() },
      );
      setCentralOffices((current) =>
        current
          .map((entry) => (entry.id === saved.id ? saved : entry))
          .sort((a, b) => a.number - b.number),
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
      `حذف المكتب المركزي ${item.number}؟ سيتم أرشفته ولن يُحذف تاريخه. يجب ألا تكون له مكاتب تصويت نشطة.`,
    );
    if (!confirmed) return;

    clearFeedback();
    setBusy(`central-delete-${item.id}`);
    try {
      await requestItem<SetupCentralOffice>(
        `areas/${area.id}/central-offices/${item.id}`,
        "PUT",
        { active: false },
      );
      setCentralOffices((current) =>
        current.filter((entry) => entry.id !== item.id),
      );
      setMessage("تم حذف المكتب المركزي من الاستخدام مع الاحتفاظ بسجله.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف المكتب المركزي.");
    } finally {
      setBusy("");
    }
  }

  function beginAddOffice(centralOffice: SetupCentralOffice) {
    if (!canCreate) return;
    clearFeedback();
    setAddingOfficeTo(centralOffice.id);
    setEditingOfficeId(null);
    setOfficeDraft({
      ...emptyOfficeDraft,
      centerId: centers[0] ? String(centers[0].id) : "",
    });
  }

  async function createOffice(centralOffice: SetupCentralOffice) {
    if (!canCreate) return;
    clearFeedback();
    const number = Number(officeDraft.number);
    const centerId = Number(officeDraft.centerId);
    if (!Number.isInteger(number) || number <= 0) {
      setError("أدخل رقمًا صحيحًا لمكتب التصويت.");
      return;
    }
    if (!centerId) {
      setError("اختر مقر مكتب التصويت.");
      return;
    }
    const code =
      officeDraft.code.trim() ||
      `${area.code}-OFF-${String(number).padStart(3, "0")}`;

    setBusy(`office-new-${centralOffice.id}`);
    try {
      const item = await requestItem<PollingOffice>(
        "offices",
        "POST",
        {
          center_id: centerId,
          central_office_id: centralOffice.id,
          number,
          code,
          registered_voters: officeDraft.registeredVoters.trim(),
        },
      );
      setOffices((current) =>
        [...current, item].sort((a, b) => a.number - b.number),
      );
      setAddingOfficeTo(null);
      setOfficeDraft(emptyOfficeDraft);
      setMessage(
        `تمت إضافة مكتب التصويت ${item.number} إلى المكتب المركزي ${centralOffice.number}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إضافة مكتب التصويت.");
    } finally {
      setBusy("");
    }
  }

  function beginOfficeEdit(office: PollingOffice) {
    clearFeedback();
    setAddingOfficeTo(null);
    setEditingOfficeId(office.id);
    setEditingOfficeNumber(String(office.number));
    setEditingRegisteredVoters(
      office.registered_voters_known && office.registered_voters !== null
        ? String(office.registered_voters)
        : "",
    );
  }

  async function saveOffice(office: PollingOffice) {
    clearFeedback();
    const number = Number(editingOfficeNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setError("رقم مكتب التصويت غير صالح.");
      return;
    }
    setBusy(`office-${office.id}`);
    try {
      const item = await requestItem<PollingOffice>(
        `areas/${area.id}/offices/${office.id}`,
        "PUT",
        {
          number,
          registered_voters: editingRegisteredVoters.trim(),
        },
      );
      setOffices((current) =>
        current
          .map((entry) => (entry.id === item.id ? item : entry))
          .sort((a, b) => a.number - b.number),
      );
      setEditingOfficeId(null);
      setMessage("تم تحديث مكتب التصويت.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تعديل مكتب التصويت.");
    } finally {
      setBusy("");
    }
  }

  async function archiveOffice(office: PollingOffice) {
    if (!canArchive) return;
    const confirmed = window.confirm(
      `حذف مكتب التصويت ${office.number}؟ سيتم أرشفته فقط. إذا كان مرتبطًا بمراقب نشط أو محضر أو حادثة، سيمنع النظام الحذف.`,
    );
    if (!confirmed) return;

    clearFeedback();
    setBusy(`office-delete-${office.id}`);
    try {
      await requestItem<PollingOffice>(
        `areas/${area.id}/offices/${office.id}`,
        "PUT",
        { active: false },
      );
      setOffices((current) =>
        current.filter((entry) => entry.id !== office.id),
      );
      setMessage("تم حذف مكتب التصويت من الاستخدام مع الاحتفاظ بسجله.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف مكتب التصويت.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="area-structure-manager">
      <div className="area-structure-heading">
        <div>
          <span>إدارة الهيكلة</span>
          <h2>تفاصيل الجماعة / المقاطعة والمكاتب المركزية</h2>
          <p>
            يمكنك تعديل البيانات داخل النطاق المسموح لك فقط. الحذف هنا أرشفة
            آمنة ولا يمحو التاريخ. إنشاء عناصر جديدة يبقى متاحًا للمدير.
          </p>
        </div>
      </div>

      <div className="area-details-editor">
        <label>
          <span>اسم الجماعة / المقاطعة</span>
          <input
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
          />
        </label>
        <label>
          <span>الرمز</span>
          <input
            value={areaCode}
            onChange={(event) => setAreaCode(event.target.value)}
          />
        </label>
        <div className="area-source-detail">
          <span>ملف المصدر</span>
          <strong>{area.source_filename || "غير محدد"}</strong>
        </div>
        <button
          type="button"
          onClick={() => void saveArea()}
          disabled={busy === "area"}
        >
          {busy === "area" ? "جارٍ الحفظ…" : "حفظ التفاصيل"}
        </button>
      </div>

      {canCreate ? (
        <div className="central-office-create">
          <div>
            <strong>إضافة مكتب مركزي</strong>
            <small>أدخل الرقم والاسم، ثم أضف مكاتب التصويت إليه.</small>
          </div>
          <input
            inputMode="numeric"
            value={newCentralNumber}
            onChange={(event) => setNewCentralNumber(event.target.value)}
            placeholder="رقم المكتب المركزي"
          />
          <input
            value={newCentralName}
            onChange={(event) => setNewCentralName(event.target.value)}
            placeholder="اسم المكتب المركزي (اختياري)"
          />
          <button
            type="button"
            onClick={() => void createCentralOffice()}
            disabled={busy === "central-new"}
          >
            {busy === "central-new" ? "إضافة…" : "+ إضافة مكتب مركزي"}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="area-structure-message is-error">{error}</div>
      ) : null}
      {message ? (
        <div className="area-structure-message is-success">{message}</div>
      ) : null}

      <div className="central-office-grid">
        {centralOffices.map((centralOffice) => {
          const linked = offices
            .filter((office) => office.central_office?.id === centralOffice.id)
            .sort((a, b) => a.number - b.number);
          const isEditing = editingCentralId === centralOffice.id;
          const isAddingOffice = addingOfficeTo === centralOffice.id;

          return (
            <article className="central-office-card" key={centralOffice.id}>
              <div className="central-office-card-head">
                {isEditing ? (
                  <div className="central-office-edit-fields">
                    <input
                      inputMode="numeric"
                      value={centralNumber}
                      onChange={(event) => setCentralNumber(event.target.value)}
                    />
                    <input
                      value={centralName}
                      onChange={(event) => setCentralName(event.target.value)}
                      placeholder="اسم المكتب المركزي"
                    />
                  </div>
                ) : (
                  <div>
                    <span>المكتب المركزي</span>
                    <h3>
                      {centralOffice.number}
                      {centralOffice.name ? ` · ${centralOffice.name}` : ""}
                    </h3>
                  </div>
                )}

                <div className="central-office-head-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void saveCentralOffice(centralOffice)}
                        disabled={busy === `central-${centralOffice.id}`}
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
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => beginCentralEdit(centralOffice)}
                      >
                        تعديل الرقم / الاسم
                      </button>
                      {canCreate ? (
                        <button
                          type="button"
                          className="is-add"
                          onClick={() => beginAddOffice(centralOffice)}
                        >
                          + إضافة مكتب تصويت
                        </button>
                      ) : null}
                      {canArchive ? (
                        <button
                          type="button"
                          className="is-delete"
                          onClick={() => void archiveCentralOffice(centralOffice)}
                          disabled={
                            busy === `central-delete-${centralOffice.id}`
                          }
                        >
                          حذف
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {canCreate && isAddingOffice ? (
                <div className="central-office-add-office">
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
                    <option value="">اختر مقر مكتب التصويت</option>
                    {centers.map((center) => (
                      <option value={center.id} key={center.id}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={officeDraft.code}
                    onChange={(event) =>
                      setOfficeDraft((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="الرمز (يُولد تلقائيًا إن ترك فارغًا)"
                  />
                  <input
                    inputMode="numeric"
                    value={officeDraft.registeredVoters}
                    onChange={(event) =>
                      setOfficeDraft((current) => ({
                        ...current,
                        registeredVoters: event.target.value,
                      }))
                    }
                    placeholder="عدد المسجلين (اختياري)"
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => void createOffice(centralOffice)}
                      disabled={busy === `office-new-${centralOffice.id}`}
                    >
                      إضافة وربط
                    </button>
                    <button
                      type="button"
                      className="is-secondary"
                      onClick={() => setAddingOfficeTo(null)}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="central-office-office-list">
                {linked.length ? (
                  linked.map((office) => {
                    const editing = editingOfficeId === office.id;
                    return (
                      <div className="central-office-office-row" key={office.id}>
                        {editing ? (
                          <>
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
                            <div className="central-office-row-actions">
                              <button
                                type="button"
                                onClick={() => void saveOffice(office)}
                                disabled={busy === `office-${office.id}`}
                              >
                                حفظ
                              </button>
                              <button
                                type="button"
                                className="is-secondary"
                                onClick={() => setEditingOfficeId(null)}
                              >
                                إلغاء
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <strong>مكتب {office.number}</strong>
                            <span>{office.center.name}</span>
                            <span>
                              {office.registered_voters_known
                                ? `${office.registered_voters} مسجل`
                                : "عدد المسجلين غير معروف"}
                            </span>
                            <div className="central-office-row-actions">
                              <button
                                type="button"
                                onClick={() => beginOfficeEdit(office)}
                              >
                                تعديل
                              </button>
                              {canArchive ? (
                                <button
                                  type="button"
                                  className="is-delete"
                                  onClick={() => void archiveOffice(office)}
                                  disabled={
                                    busy === `office-delete-${office.id}`
                                  }
                                >
                                  حذف
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="central-office-empty">
                    لا توجد مكاتب تصويت مرتبطة بهذا المكتب المركزي بعد.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {unassignedOffices.length ? (
        <div className="unassigned-office-note">
          <strong>{unassignedOffices.length}</strong>
          <span>
            مكتب تصويت داخل هذه الجماعة / المقاطعة غير مرتبط بمكتب مركزي.
          </span>
        </div>
      ) : null}
    </section>
  );
}
