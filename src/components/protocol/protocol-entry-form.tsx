"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ProtocolRecord,
  ProtocolSection,
  ProtocolTemplate,
} from "@/lib/elect/types";

type EditableSection = ProtocolSection;

function initialSections(
  protocol: ProtocolRecord | null,
  template: ProtocolTemplate,
): EditableSection[] {
  return structuredClone(protocol?.sections ?? template.sections);
}

const sectionNames = {
  local: "النتيجة المحلية",
  regional: "النتيجة الجهوية",
} as const;

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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked =
    protocol?.state === "validated" || protocol?.state === "verified";

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
          ballotsMatch: accounted === Number(section.ballots_cast || 0),
        };
      }),
    [sections],
  );

  function updateCount(
    sectionIndex: number,
    field: keyof Pick<
      ProtocolSection,
      | "registered_voters"
      | "voters"
      | "ballots_cast"
      | "valid_votes"
      | "invalid_votes"
      | "blank_votes"
      | "other_nonvalid_votes"
    >,
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const payload = {
      sections: sections.map((section) => ({
        kind: section.kind,
        registered_voters: section.registered_voters,
        voters: section.voters,
        ballots_cast: section.ballots_cast,
        valid_votes: section.valid_votes,
        invalid_votes: section.invalid_votes,
        blank_votes: section.blank_votes,
        other_nonvalid_votes: section.other_nonvalid_votes,
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
        setMessage(result?.error?.message ?? "تعذر حفظ المحضر.");
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
      {sections.map((section, sectionIndex) => {
        const check = localChecks[sectionIndex];
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
                    check.listMatches && check.ballotsMatch
                      ? "consistency ok"
                      : "consistency pending"
                  }
                >
                  {check.listMatches && check.ballotsMatch
                    ? "الأرقام متوازنة"
                    : "راجع التوازن"}
                </span>
              </div>
            </div>

            <div className="count-grid">
              {[
                ["registered_voters", "المسجلون"],
                ["voters", "المصوتون"],
                ["ballots_cast", "الأوراق المحتسبة"],
                ["valid_votes", "الأصوات الصحيحة"],
                ["invalid_votes", "الأصوات الملغاة"],
                ["blank_votes", "الأوراق البيضاء"],
                ["other_nonvalid_votes", "غير صحيحة أخرى"],
              ].map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    disabled={locked || pending}
                    value={String(
                      section[
                        field as keyof ProtocolSection
                      ] as number,
                    )}
                    onChange={(event) =>
                      updateCount(
                        sectionIndex,
                        field as Parameters<typeof updateCount>[1],
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
            </div>

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
                  <span>
                    <b>{result.candidate_list.ballot_number ?? "—"}</b>
                    <span>
                      {result.candidate_list.name}
                      {result.candidate_list.party?.short_name
                        ? ` · ${result.candidate_list.party.short_name}`
                        : ""}
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0}
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
          </section>
        );
      })}

      <div className="form-footer">
        <div>
          {message ? <p className="inline-message">{message}</p> : null}
          {locked ? (
            <p className="inline-message">
              هذا المحضر مقفل لأنه وصل إلى حالة {protocol?.state}.
            </p>
          ) : null}
        </div>
        <button
          className="primary-button"
          type="submit"
          disabled={pending || locked}
        >
          {pending ? "جارٍ الحفظ..." : "حفظ المحضر"}
        </button>
      </div>
    </form>
  );
}
