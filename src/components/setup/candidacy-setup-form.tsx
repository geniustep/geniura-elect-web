"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import type { ElectionSetupSnapshot } from "@/lib/elect/types";

export type CandidacySetupSection =
  | "parties"
  | "candidates"
  | "candidate-lists"
  | "list-members";

type Props = {
  electionId: string;
  section: CandidacySetupSection;
  mode: "create" | "edit";
  snapshot: ElectionSetupSnapshot;
  recordId?: number;
};

const sectionNames: Record<CandidacySetupSection, string> = {
  parties: "هيئة أو حزب",
  candidates: "مرشح",
  "candidate-lists": "لائحة",
  "list-members": "عضو لائحة",
};

function getRecord(
  snapshot: ElectionSetupSnapshot,
  section: CandidacySetupSection,
  recordId?: number,
) {
  if (!recordId) return undefined;

  if (section === "parties") {
    return snapshot.parties.find((item) => item.id === recordId);
  }
  if (section === "candidates") {
    return snapshot.candidates.find((item) => item.id === recordId);
  }
  if (section === "candidate-lists") {
    return snapshot.candidate_lists.find((item) => item.id === recordId);
  }
  return snapshot.list_members.find((item) => item.id === recordId);
}

function initialValues(
  snapshot: ElectionSetupSnapshot,
  section: CandidacySetupSection,
  recordId?: number,
): Record<string, string> {
  if (section === "parties") {
    const item = snapshot.parties.find((value) => value.id === recordId);
    return {
      name: item?.name ?? "",
      short_name: item?.short_name ?? "",
      code: item?.code ?? "",
    };
  }

  if (section === "candidates") {
    const item = snapshot.candidates.find((value) => value.id === recordId);
    return {
      name: item?.name ?? "",
      birth_date: item?.birth_date ?? "",
    };
  }

  if (section === "candidate-lists") {
    const item = snapshot.candidate_lists.find((value) => value.id === recordId);
    return {
      constituency_id: String(
        item?.constituency.id ?? snapshot.constituencies[0]?.id ?? "",
      ),
      party_id: String(item?.party?.id ?? ""),
      name: item?.name ?? "",
      code: item?.code ?? "",
      ballot_number:
        item?.ballot_number === null || item?.ballot_number === undefined
          ? ""
          : String(item.ballot_number),
      head_candidate_name: item?.head_candidate_name ?? "",
    };
  }

  const item = snapshot.list_members.find((value) => value.id === recordId);
  return {
    candidate_list_id: String(
      item?.candidate_list.id ?? snapshot.candidate_lists[0]?.id ?? "",
    ),
    candidate_id: String(
      item?.candidate.id ?? snapshot.candidates[0]?.id ?? "",
    ),
    sequence: String(item?.sequence ?? 1),
  };
}

function prerequisiteMessage(
  snapshot: ElectionSetupSnapshot,
  section: CandidacySetupSection,
): string | null {
  if (section === "candidate-lists" && snapshot.constituencies.length === 0) {
    return "يجب إعداد دائرة انتخابية واحدة على الأقل قبل إنشاء لائحة.";
  }
  if (
    section === "list-members" &&
    (snapshot.candidate_lists.length === 0 || snapshot.candidates.length === 0)
  ) {
    return "يجب إنشاء لائحة ومرشح واحد على الأقل قبل إضافة عضو إلى اللائحة.";
  }
  return null;
}

export function CandidacySetupForm({
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
    initialValues(snapshot, section, recordId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const prerequisite = prerequisiteMessage(snapshot, section);
  const missingRecord = mode === "edit" && !record;

  function update(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (missingRecord || prerequisite) return;

    let payload: Record<string, unknown>;

    if (section === "parties") {
      payload = {
        name: values.name,
        short_name: values.short_name,
        code: values.code,
      };
    } else if (section === "candidates") {
      payload = {
        name: values.name,
        birth_date: values.birth_date || null,
      };
    } else if (section === "candidate-lists") {
      payload = {
        constituency_id: Number(values.constituency_id),
        party_id: values.party_id ? Number(values.party_id) : null,
        name: values.name,
        code: values.code,
        ballot_number: values.ballot_number
          ? Number(values.ballot_number)
          : null,
        head_candidate_name: values.head_candidate_name,
      };
    } else {
      payload = {
        candidate_list_id: Number(values.candidate_list_id),
        candidate_id: Number(values.candidate_id),
        sequence: Number(values.sequence),
      };
    }

    const path =
      mode === "edit" ? `${section}/${recordId}` : section;

    setSubmitting(true);
    setError("");

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
            "تعذر حفظ البيانات. تحقق من القيم ثم أعد المحاولة.",
        );
        return;
      }

      router.push(`/elections/${electionId}/setup/candidacy`);
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة حاليًا.");
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "create"
      ? `إضافة ${sectionNames[section]}`
      : `تعديل ${sectionNames[section]}`;

  return (
    <div className="setup-form-shell">
      <nav className="breadcrumbs presentation-breadcrumbs">
        <Link href={`/elections/${electionId}/setup`}>إعداد الاستحقاق</Link>
        <span>/</span>
        <Link href={`/elections/${electionId}/setup/candidacy`}>
          اللوائح والمرشحون
        </Link>
        <span>/</span>
        <strong>{title}</strong>
      </nav>

      <form className="setup-form-card" onSubmit={submit}>
        <div className="presentation-kicker">إدارة الترشيحات</div>
        <h1>{title}</h1>
        <p>
          أدخل البيانات المؤكدة فقط، وحافظ على ترتيب أعضاء اللائحة كما هو في
          المصدر المعتمد لديك.
        </p>

        {missingRecord ? (
          <div className="setup-form-alert">السجل المطلوب غير موجود.</div>
        ) : null}

        {prerequisite ? (
          <div className="setup-form-prerequisite">{prerequisite}</div>
        ) : null}

        {!missingRecord ? (
          <div className="setup-form-grid">
            {section === "parties" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم الهيئة أو الحزب</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الاسم المختصر</span>
                  <input
                    value={values.short_name}
                    onChange={(event) =>
                      update("short_name", event.target.value)
                    }
                  />
                </label>
                <label className="setup-field">
                  <span>الرمز الداخلي</span>
                  <input
                    required
                    value={values.code}
                    onChange={(event) => update("code", event.target.value)}
                  />
                </label>
              </>
            ) : null}

            {section === "candidates" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم المرشح</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>تاريخ الميلاد</span>
                  <input
                    type="date"
                    value={values.birth_date}
                    onChange={(event) =>
                      update("birth_date", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}

            {section === "candidate-lists" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اسم اللائحة</span>
                  <input
                    required
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>الدائرة</span>
                  <select
                    required
                    value={values.constituency_id}
                    onChange={(event) =>
                      update("constituency_id", event.target.value)
                    }
                  >
                    {snapshot.constituencies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.kind === "local" ? "محلية" : "جهوية"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>الهيئة أو الحزب</span>
                  <select
                    value={values.party_id}
                    onChange={(event) =>
                      update("party_id", event.target.value)
                    }
                  >
                    <option value="">غير محدد</option>
                    {snapshot.parties.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>الرمز الداخلي للائحة</span>
                  <input
                    required
                    value={values.code}
                    onChange={(event) => update("code", event.target.value)}
                  />
                </label>
                <label className="setup-field">
                  <span>رقم اللائحة / ورقة التصويت</span>
                  <input
                    type="number"
                    min="0"
                    value={values.ballot_number}
                    onChange={(event) =>
                      update("ballot_number", event.target.value)
                    }
                  />
                </label>
                <label className="setup-field setup-field--full">
                  <span>اسم رأس اللائحة المرجعي</span>
                  <input
                    value={values.head_candidate_name}
                    onChange={(event) =>
                      update("head_candidate_name", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}

            {section === "list-members" ? (
              <>
                <label className="setup-field setup-field--full">
                  <span>اللائحة</span>
                  <select
                    required
                    value={values.candidate_list_id}
                    onChange={(event) =>
                      update("candidate_list_id", event.target.value)
                    }
                  >
                    {snapshot.candidate_lists.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.constituency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>المرشح</span>
                  <select
                    required
                    value={values.candidate_id}
                    onChange={(event) =>
                      update("candidate_id", event.target.value)
                    }
                  >
                    {snapshot.candidates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  <span>الترتيب داخل اللائحة</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={values.sequence}
                    onChange={(event) =>
                      update("sequence", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="setup-form-alert">{error}</div> : null}

        <div className="setup-form-actions">
          <Link
            className="setup-edit-link"
            href={`/elections/${electionId}/setup/candidacy`}
          >
            إلغاء
          </Link>
          <button
            className="setup-create-button"
            type="submit"
            disabled={submitting || !!prerequisite || missingRecord}
          >
            {submitting ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </form>
    </div>
  );
}
