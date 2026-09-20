"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import type {
  ElectionSetupSection,
  ElectionSetupSnapshot,
} from "@/lib/elect/types";

type SetupFormSection = ElectionSetupSection | "election";
type Mode = "create" | "edit";

type Props = {
  electionId: string;
  section: SetupFormSection;
  mode: Mode;
  snapshot: ElectionSetupSnapshot;
  recordId?: number;
};

const sectionNames: Record<SetupFormSection, string> = {
  election: "الاستحقاق",
  constituencies: "الدائرة الانتخابية",
  centers: "مركز التصويت",
  offices: "مكتب التصويت",
  representatives: "الموكل أو المنسق",
  assignments: "التعيين الميداني",
};

function getRecord(
  snapshot: ElectionSetupSnapshot,
  section: SetupFormSection,
  recordId?: number,
) {
  if (section === "election") return snapshot.election;
  if (!recordId) return undefined;
  return snapshot[section].find((item) => item.id === recordId);
}

function initialValues(
  snapshot: ElectionSetupSnapshot,
  section: SetupFormSection,
  mode: Mode,
  recordId?: number,
): Record<string, string> {
  const record = getRecord(snapshot, section, recordId);

  if (section === "election") {
    const item = snapshot.election;
    return {
      name: item.name,
      election_date: item.election_date,
      state: item.state,
      poll_open_time: item.poll_open_time,
      poll_close_time: item.poll_close_time,
    };
  }

  if (section === "constituencies") {
    const item =
      mode === "edit"
        ? snapshot.constituencies.find((value) => value.id === recordId)
        : undefined;
    return {
      name: item?.name ?? "",
      code: item?.code ?? "",
      region_id: String(item?.region.id ?? snapshot.regions[0]?.id ?? ""),
      kind: item?.kind ?? "local",
      seat_count: String(item?.seat_count ?? 1),
      registered_voters:
        item?.registered_voters === null || item?.registered_voters === undefined
          ? ""
          : String(item.registered_voters),
    };
  }

  if (section === "centers") {
    const item =
      mode === "edit"
        ? snapshot.centers.find((value) => value.id === recordId)
        : undefined;
    const firstLocal = snapshot.constituencies.find(
      (value) => value.kind === "local",
    );
    return {
      name: item?.name ?? "",
      code: item?.code ?? "",
      local_constituency_id: String(
        item?.constituency.id ?? firstLocal?.id ?? "",
      ),
      commune: item?.commune ?? "",
      address: item?.address ?? "",
    };
  }

  if (section === "offices") {
    const item =
      mode === "edit"
        ? snapshot.offices.find((value) => value.id === recordId)
        : undefined;
    return {
      center_id: String(item?.center.id ?? snapshot.centers[0]?.id ?? ""),
      code: item?.code ?? "",
      number: String(item?.number ?? 1),
      registered_voters: String(item?.registered_voters ?? 0),
    };
  }

  if (section === "representatives") {
    const item =
      mode === "edit"
        ? snapshot.representatives.find((value) => value.id === recordId)
        : undefined;
    return {
      name: item?.name ?? "",
      phone: item?.phone ?? "",
      email: item?.email ?? "",
    };
  }

  if (section === "assignments") {
    const item =
      mode === "edit"
        ? snapshot.assignments.find((value) => value.id === recordId)
        : undefined;
    return {
      polling_office_id: String(
        item?.office.id ?? snapshot.offices[0]?.id ?? "",
      ),
      representative_id: String(
        item?.representative.id ?? snapshot.representatives[0]?.id ?? "",
      ),
      role: item?.role ?? "primary",
      status: item?.status ?? "planned",
    };
  }

  return record ? {} : {};
}

function prerequisiteMessage(
  snapshot: ElectionSetupSnapshot,
  section: SetupFormSection,
): string | null {
  if (section === "constituencies" && snapshot.regions.length === 0) {
    return "يجب إعداد جهة انتخابية أولًا قبل إنشاء دائرة.";
  }
  if (
    section === "centers" &&
    !snapshot.constituencies.some((item) => item.kind === "local")
  ) {
    return "يجب إنشاء دائرة محلية أولًا قبل إضافة مركز تصويت.";
  }
  if (section === "offices" && snapshot.centers.length === 0) {
    return "يجب إنشاء مركز تصويت أولًا قبل إضافة مكتب.";
  }
  if (
    section === "assignments" &&
    (snapshot.offices.length === 0 ||
      snapshot.representatives.length === 0)
  ) {
    return "يجب أن يوجد مكتب تصويت وشخص واحد على الأقل قبل إنشاء تعيين.";
  }
  return null;
}

export function SetupEntityForm({
  electionId,
  section,
  mode,
  snapshot,
  recordId,
}: Props) {
  const router = useRouter();
  const record = useMemo(
    () => getRecord(snapshot, section, recordId),
    [recordId, section, snapshot],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(snapshot, section, mode, recordId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const prerequisite = prerequisiteMessage(snapshot, section);

  const missingRecord =
    mode === "edit" && section !== "election" && !record;

  function update(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prerequisite || missingRecord) return;

    setSubmitting(true);
    setError("");

    let payload: Record<string, unknown> = {};

    if (section === "election") {
      payload = {
        name: values.name,
        election_date: values.election_date,
        state: values.state,
        poll_open_time: values.poll_open_time,
        poll_close_time: values.poll_close_time,
      };
    } else if (section === "constituencies") {
      payload = {
        name: values.name,
        code: values.code,
        region_id: Number(values.region_id),
        seat_count: Number(values.seat_count),
        registered_voters: Number(values.registered_voters),
      };
      if (mode === "create") {
        payload.kind = values.kind;
      }
    } else if (section === "centers") {
      payload = {
        name: values.name,
        code: values.code,
        local_constituency_id: Number(values.local_constituency_id),
        commune: values.commune,
        address: values.address,
      };
    } else if (section === "offices") {
      payload = {
        center_id: Number(values.center_id),
        code: values.code,
        number: Number(values.number),
        registered_voters: values.registered_voters
          ? Number(values.registered_voters)
          : null,
      };
    } else if (section === "representatives") {
      payload = {
        name: values.name,
        phone: values.phone,
        email: values.email,
      };
    } else if (section === "assignments") {
      payload = {
        polling_office_id: Number(values.polling_office_id),
        representative_id: Number(values.representative_id),
        role: values.role,
        status: values.status,
      };
    }

    const path =
      section === "election"
        ? "election"
        : mode === "edit"
          ? `${section}/${recordId}`
          : section;

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/${path}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(
          result?.error?.message ||
            "تعذر حفظ التغييرات. تحقق من البيانات ثم أعد المحاولة.",
        );
        return;
      }

      router.push(`/elections/${electionId}/setup`);
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة حاليًا.");
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    section === "election"
      ? "تعديل بيانات الاستحقاق"
      : mode === "create"
        ? `إضافة ${sectionNames[section]}`
        : `تعديل ${sectionNames[section]}`;

  return (
    <div className="setup-form-shell">
      <nav className="breadcrumbs presentation-breadcrumbs">
        <Link href={`/elections/${electionId}/setup`}>إعداد الاستحقاق</Link>
        <span>/</span>
        <strong>{title}</strong>
      </nav>

      <form className="setup-form-card" onSubmit={submit}>
        <div className="presentation-kicker">إدارة البيانات</div>
        <h1>{title}</h1>
        <p>
          احفظ فقط البيانات المؤكدة. يمكن الرجوع إلى صفحة الإعداد ومتابعة
          بقية الهيكلة في أي وقت.
        </p>

        {missingRecord ? (
          <div className="setup-form-alert">السجل المطلوب غير موجود.</div>
        ) : null}

        {prerequisite ? (
          <div className="setup-form-prerequisite">{prerequisite}</div>
        ) : null}

        {!missingRecord ? (
          <div className="setup-form-grid">
            {section === "election" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم الاستحقاق</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>تاريخ الاقتراع</span>
                  <input
                    type="date"
                    required
                    value={values.election_date}
                    onChange={(event) =>
                      update("election_date", event.target.value)
                    }
                  />
                </label>
                <label className="setup-field">
                  <span>الحالة</span>
                  <select
                    value={values.state}
                    onChange={(event) => update("state", event.target.value)}
                  >
                    <option value="draft">مسودة</option>
                    <option value="setup">مرحلة الإعداد</option>
                    <option value="ready">جاهز</option>
                    <option value="polling">يوم الاقتراع</option>
                    <option value="counting">الفرز والتجميع</option>
                    <option value="closed">مغلق</option>
                  </select>
                </label>
                <label className="setup-field">
                  <span>فتح الاقتراع</span>
                  <input
                    required
                    placeholder="08:00"
                    value={values.poll_open_time}
                    onChange={(event) =>
                      update("poll_open_time", event.target.value)
                    }
                  />
                </label>
                <label className="setup-field">
                  <span>إغلاق الاقتراع</span>
                  <input
                    required
                    placeholder="19:00"
                    value={values.poll_close_time}
                    onChange={(event) =>
                      update("poll_close_time", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}

            {section === "constituencies" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم الدائرة</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الكود الداخلي</span>
                  <input
                    required
                    value={values.code}
                    onChange={(event) => update("code", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الجهة</span>
                  <select
                    required
                    value={values.region_id}
                    onChange={(event) =>
                      update("region_id", event.target.value)
                    }
                  >
                    {snapshot.regions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>النوع</span>
                  <select
                    value={values.kind}
                    disabled={mode === "edit"}
                    onChange={(event) => update("kind", event.target.value)}
                  >
                    <option value="local">محلية</option>
                    <option value="regional">جهوية</option>
                  </select>
                  {mode === "edit" ? (
                    <small>نوع الدائرة يثبت بعد الإنشاء.</small>
                  ) : null}
                </label>
                <label className="setup-field">
                  <span>عدد المقاعد</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={values.seat_count}
                    onChange={(event) =>
                      update("seat_count", event.target.value)
                    }
                  />
                </label>
                <label className="setup-field">
                  <span>عدد المسجلين</span>
                  <input
                    type="number"
                    min={0}
                    value={values.registered_voters}
                    onChange={(event) =>
                      update("registered_voters", event.target.value)
                    }
                  />
                  <small>ضع 0 فقط إذا لم يتم تحميل العدد بعد.</small>
                </label>
              </>
            ) : null}

            {section === "centers" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم المركز</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الدائرة المحلية</span>
                  <select
                    required
                    value={values.local_constituency_id}
                    onChange={(event) =>
                      update("local_constituency_id", event.target.value)
                    }
                  >
                    {snapshot.constituencies
                      .filter((item) => item.kind === "local")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>الكود الداخلي</span>
                  <input
                    required
                    value={values.code}
                    onChange={(event) => update("code", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الجماعة</span>
                  <input
                    value={values.commune}
                    onChange={(event) => update("commune", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>العنوان</span>
                  <input
                    value={values.address}
                    onChange={(event) => update("address", event.target.value)}
                  />
                </label>
              </>
            ) : null}

            {section === "offices" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>مركز التصويت</span>
                  <select
                    required
                    value={values.center_id}
                    onChange={(event) =>
                      update("center_id", event.target.value)
                    }
                  >
                    {snapshot.centers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.constituency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>رقم المكتب</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={values.number}
                    onChange={(event) => update("number", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الكود الداخلي</span>
                  <input
                    required
                    value={values.code}
                    onChange={(event) => update("code", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>عدد المسجلين</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={values.registered_voters}
                    onChange={(event) =>
                      update("registered_voters", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}

            {section === "representatives" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>الاسم الكامل</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>رقم الهاتف</span>
                  <input
                    value={values.phone}
                    onChange={(event) => update("phone", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>البريد الإلكتروني</span>
                  <input
                    type="email"
                    value={values.email}
                    onChange={(event) => update("email", event.target.value)}
                  />
                </label>
              </>
            ) : null}

            {section === "assignments" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>مكتب التصويت</span>
                  <select
                    required
                    value={values.polling_office_id}
                    onChange={(event) =>
                      update("polling_office_id", event.target.value)
                    }
                  >
                    {snapshot.offices.map((item) => (
                      <option key={item.id} value={item.id}>
                        مكتب {item.number} · {item.center.name} ·{" "}
                        {item.constituency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field setup-field--full">
                  <span>الموكل أو المنسق</span>
                  <select
                    required
                    value={values.representative_id}
                    onChange={(event) =>
                      update("representative_id", event.target.value)
                    }
                  >
                    {snapshot.representatives.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>الدور</span>
                  <select
                    value={values.role}
                    onChange={(event) => update("role", event.target.value)}
                  >
                    <option value="primary">موكل أساسي</option>
                    <option value="backup">موكل احتياطي</option>
                    <option value="coordinator">منسق مركز</option>
                  </select>
                </label>
                <label className="setup-field">
                  <span>حالة التعيين</span>
                  <select
                    value={values.status}
                    onChange={(event) => update("status", event.target.value)}
                  >
                    <option value="planned">مخطط</option>
                    <option value="notified">تم الإشعار</option>
                    <option value="confirmed">مؤكد</option>
                    <option value="present">حاضر</option>
                    <option value="absent">غائب</option>
                    <option value="replaced">تم الاستبدال</option>
                    <option value="cancelled">ملغى</option>
                    <option value="closed">مغلق</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="setup-form-alert">{error}</div> : null}

        <div className="setup-form-actions">
          <Link
            className="setup-cancel-button"
            href={`/elections/${electionId}/setup`}
          >
            إلغاء
          </Link>
          <button
            className="setup-submit-button"
            type="submit"
            disabled={
              submitting || Boolean(prerequisite) || Boolean(missingRecord)
            }
          >
            {submitting
              ? "جارٍ الحفظ..."
              : mode === "create"
                ? "إنشاء وحفظ"
                : "حفظ التعديلات"}
          </button>
        </div>
      </form>
    </div>
  );
}
