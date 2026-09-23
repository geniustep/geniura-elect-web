"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ProtocolRecord,
  ProtocolSection,
  ProtocolTemplate,
} from "@/lib/elect/types";

type EditableSection = ProtocolSection;
type SharedCounts = {
  registered_voters: number;
  voters: number;
  ballots_cast: number;
};

const sectionNames = {
  local: "النتيجة المحلية",
  regional: "النتيجة الجهوية",
} as const;

const legacyFields = [
  ["valid_votes", "الأصوات الصحيحة"],
  ["invalid_votes", "غير الصحيحة (تصنيف مؤقت)"],
  ["blank_votes", "بدون اختيار (تصنيف مؤقت)"],
  ["other_nonvalid_votes", "أخرى غير صحيحة (تصنيف مؤقت)"],
] as const;

function initialSections(
  protocol: ProtocolRecord | null,
  template: ProtocolTemplate,
): EditableSection[] {
  return structuredClone(protocol?.sections ?? template.sections);
}

function initialSharedCounts(sections: EditableSection[]): SharedCounts {
  const source = sections[0];
  return {
    registered_voters: Number(source?.registered_voters ?? 0),
    voters: Number(source?.voters ?? 0),
    ballots_cast: Number(source?.ballots_cast ?? 0),
  };
}

export function ProtocolEntryForm({
  officeId,
  protocol,
  template,
}: {
  officeId: number;
  protocol: ProtocolRecord | null;
  template: ProtocolTemplate;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<EditableSection[]>(() =>
    initialSections(protocol, template),
  );
  const [shared, setShared] = useState<SharedCounts>(() =>
    initialSharedCounts(initialSections(protocol, template)),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked =
    protocol?.state === "validated" || protocol?.state === "verified";

  const candidacyReady =
    sections.length > 0 && sections.every((section) => section.results.length > 0);

  const localChecks = useMemo(
    () =>
      sections.map((section) => {
        const listTotal = section.results.reduce(
          (sum, result) => sum + Number(result.votes || 0),
          0,
        );
        const accounted =
          Number(section.valid_votes || 0) +
          Number(section.invalid_votes || 0) +
          Number(section.blank_votes || 0) +
          Number(section.other_nonvalid_votes || 0);

        return {
          kind: section.kind,
          listTotal,
          accounted,
          listMatches: listTotal === Number(section.valid_votes || 0),
          ballotsMatch: accounted === Number(shared.ballots_cast || 0),
        };
      }),
    [sections, shared.ballots_cast],
  );

  const voterBallotGap = shared.voters - shared.ballots_cast;

  function updateShared(
    field: "voters" | "ballots_cast",
    value: string,
  ) {
    const number = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setShared((current) => ({ ...current, [field]: number }));
  }

  function updateSectionCount(
    sectionIndex: number,
    field:
      | "valid_votes"
      | "invalid_votes"
      | "blank_votes"
      | "other_nonvalid_votes",
    value: string,
  ) {
    const number = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setSections((current) =>
      current.map((section, index) =>
        index === sectionIndex ? { ...section, [field]: number } : section,
      ),
    );
  }

  function updateVotes(
    sectionIndex: number,
    resultIndex: number,
    value: string,
  ) {
    const votes = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              results: section.results.map((result, itemIndex) =>
                itemIndex === resultIndex ? { ...result, votes } : result,
              ),
            },
      ),
    );
  }

  function updateObservations(sectionIndex: number, value: string) {
    setSections((current) =>
      current.map((section, index) =>
        index === sectionIndex ? { ...section, observations: value } : section,
      ),
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!candidacyReady) {
      setMessage("لا يمكن حفظ النتائج قبل تحميل لوائح الترشيح الرسمية.");
      return;
    }

    setPending(true);
    setMessage(null);

    const payload = {
      sections: sections.map((section) => ({
        kind: section.kind,
        registered_voters: shared.registered_voters,
        voters: shared.voters,
        ballots_cast: shared.ballots_cast,
        valid_votes: section.valid_votes,
        invalid_votes: section.invalid_votes,
        blank_votes: section.blank_votes,
        other_nonvalid_votes: section.other_nonvalid_votes,
        observations: section.observations ?? "",
        results: section.results.map((result) => ({
          candidate_list_id: result.candidate_list.id,
          votes: result.votes,
        })),
      })),
    };

    try {
      const response = await fetch(
        `/api/operations/polling-offices/${officeId}/protocol`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        const fallback =
          response.status === 422
            ? "تعذر حفظ المحضر بسبب عدم تطابق بعض البيانات. راجع الحقول والتنبيهات."
            : "تعذر حفظ المحضر.";
        setMessage(result?.error?.message ?? fallback);
        return;
      }

      setMessage("تم حفظ بيانات المحضر.");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="protocol-form" onSubmit={save}>
      <section className="protocol-section shared-counts-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">POLLING OFFICE COUNTS</p>
            <h2>المعطيات المشتركة للمكتب</h2>
            <p>تُستعمل القيم نفسها في النتيجتين المحلية والجهوية.</p>
          </div>
        </div>

        <div className="shared-count-grid">
          <label>
            <span>المسجلون</span>
            <input
              type="number"
              inputMode="numeric"
              readOnly
              aria-readonly="true"
              value={shared.registered_voters}
            />
            <small>قيمة النظام الرسمية للمكتب</small>
          </label>
          <label>
            <span>المصوتون</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={locked || pending}
              value={shared.voters}
              onChange={(event) => updateShared("voters", event.target.value)}
            />
          </label>
          <label>
            <span>الأوراق الموجودة بالصندوق</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={locked || pending}
              value={shared.ballots_cast}
              onChange={(event) =>
                updateShared("ballots_cast", event.target.value)
              }
            />
          </label>
        </div>

        {voterBallotGap !== 0 ? (
          <div className="protocol-alert protocol-alert-warning" role="status">
            <strong>تنبيه غير مانع</strong>
            <span>
              يوجد فرق بين عدد المصوتين وعدد الأوراق الموجودة بالصندوق
              (الفرق: {Math.abs(voterBallotGap)}).
            </span>
          </div>
        ) : null}

        {protocol?.warnings?.has_warnings ? (
          <div className="protocol-alert protocol-alert-warning" role="status">
            <strong>تنبيه الخادم</strong>
            <span>{protocol.warnings.message}</span>
          </div>
        ) : null}

        {protocol?.consistency.state === "inconsistent" ? (
          <div className="protocol-alert protocol-alert-error" role="alert">
            <strong>خطأ يمنع التحقق</strong>
            <span>{protocol.consistency.message}</span>
          </div>
        ) : null}
      </section>

      {!candidacyReady ? (
        <section className="protocol-section candidacy-blocker" role="alert">
          <p className="eyebrow">CANDIDACY DATA REQUIRED</p>
          <h2>لوائح الترشيح غير محمّلة</h2>
          <p>
            لم تُحمّل لوائح الترشيح لهذه الدائرة بعد. لا يمكن إدخال أصوات
            اللوائح أو حفظ نتيجة فعلية إلى أن تُعتمد البيانات الرسمية.
          </p>
        </section>
      ) : null}

      {sections.map((section, sectionIndex) => {
        const check = localChecks[sectionIndex];
        const hardMismatch = !check.listMatches || !check.ballotsMatch;
        return (
          <section className="protocol-section" key={section.kind}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{section.kind.toUpperCase()}</p>
                <h2>{sectionNames[section.kind]}</h2>
                <p>{section.constituency.name}</p>
              </div>
              <div className="consistency-stack">
                <span
                  className={
                    hardMismatch ? "consistency pending" : "consistency ok"
                  }
                >
                  {hardMismatch ? "راجع التوازن" : "الأرقام متوازنة"}
                </span>
              </div>
            </div>

            {section.warnings?.has_warnings ? (
              <div className="protocol-alert protocol-alert-warning" role="status">
                <strong>تنبيه</strong>
                <span>{section.warnings.message}</span>
              </div>
            ) : null}

            {section.consistency?.state === "inconsistent" ? (
              <div className="protocol-alert protocol-alert-error" role="alert">
                <strong>عدم اتساق</strong>
                <span>{section.consistency.message}</span>
              </div>
            ) : null}

            <div className="provisional-note">
              تصنيف بعض فئات الأوراق أدناه مؤقت إلى حين اعتماد نموذج
              المحضر الرسمي لسنة 2026.
            </div>

            <div className="count-grid section-count-grid">
              {legacyFields.map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    disabled={locked || pending}
                    value={String(section[field])}
                    onChange={(event) =>
                      updateSectionCount(
                        sectionIndex,
                        field,
                        event.target.value,
                      )
                    }
                  />
                </label>
              ))}
            </div>

            <div className="balance-row">
              <span>
                مجموع أصوات اللوائح: <strong>{check.listTotal}</strong>
              </span>
              <span>
                مجموع الأوراق المصنفة: <strong>{check.accounted}</strong>
              </span>
              <span>
                الأوراق بالصندوق: <strong>{shared.ballots_cast}</strong>
              </span>
            </div>

            {section.results.length ? (
              <div className="results-table">
                <div className="results-head">
                  <span>اللائحة</span>
                  <span>الأصوات</span>
                </div>
                {section.results.map((result, resultIndex) => (
                  <label
                    className="result-row"
                    key={result.candidate_list.id}
                  >
                    <span className="candidate-list-identity">
                      <b>{result.candidate_list.ballot_number ?? "—"}</b>
                      {result.candidate_list.party?.has_logo ? (
                        <img
                          className="candidate-party-logo"
                          src={`/api/operations/parties/${result.candidate_list.party.id}/logo`}
                          alt={`شعار ${result.candidate_list.party.name}`}
                          loading="lazy"
                        />
                      ) : null}
                      <span className="candidate-list-copy">
                        <strong>{result.candidate_list.name}</strong>
                        <small>
                          {result.candidate_list.party?.short_name ||
                            result.candidate_list.party?.name ||
                            "بدون هيئة محددة"}
                          {result.candidate_list.party?.symbol_name
                            ? ` · الرمز: ${result.candidate_list.party.symbol_name}`
                            : ""}
                        </small>
                      </span>
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`أصوات ${result.candidate_list.name}`}
                      disabled={locked || pending}
                      value={result.votes}
                      onChange={(event) =>
                        updateVotes(
                          sectionIndex,
                          resultIndex,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <label className="observation-field">
              <span>ملاحظات المحضر</span>
              <textarea
                rows={3}
                disabled={locked || pending}
                value={section.observations ?? ""}
                onChange={(event) =>
                  updateObservations(sectionIndex, event.target.value)
                }
                placeholder="اكتب فقط الملاحظات المثبتة في المحضر أو اللازمة للمراجعة."
              />
            </label>
          </section>
        );
      })}

      <div className="form-footer protocol-save-bar">
        <div>
          {message ? <p className="inline-message">{message}</p> : null}
          {locked ? (
            <p className="inline-message">
              المحضر مقفل بعد التحقق/الاعتماد ولا يمكن تعديل بياناته مباشرة.
            </p>
          ) : null}
        </div>
        <button
          className="primary-button"
          type="submit"
          disabled={pending || locked || !candidacyReady}
        >
          {pending ? "جارٍ الحفظ..." : "حفظ بيانات المحضر"}
        </button>
      </div>
    </form>
  );
}
