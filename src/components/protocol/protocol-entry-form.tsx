"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type EntryMode = "table" | "sequential";
type VoteInputs = Record<number, string>;
type SectionDraft = Pick<
  ProtocolSection,
  | "kind"
  | "valid_votes"
  | "invalid_votes"
  | "blank_votes"
  | "other_nonvalid_votes"
  | "observations"
>;
type DeviceDraft = {
  version: 1;
  protocolId: number | null;
  shared: SharedCounts;
  sections: SectionDraft[];
  voteInputs: VoteInputs;
  activeKind: "local" | "regional";
  entryMode: EntryMode;
  sequentialPosition: Record<"local" | "regional", number>;
  savedAt: string;
};

const sectionNames = {
  local: "النتيجة المحلية",
  regional: "النتيجة الجهوية",
} as const;

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

function initialVoteInputs(
  protocol: ProtocolRecord | null,
  template: ProtocolTemplate,
): VoteInputs {
  const source = protocol?.sections ?? template.sections;
  const savedProtocol = Boolean(protocol);

  return Object.fromEntries(
    source.flatMap((section) =>
      section.results.map((result) => [
        result.candidate_list.id,
        savedProtocol ? String(result.votes) : "0",
      ]),
    ),
  );
}

function parseVote(value: string | undefined) {
  if (value === undefined || value === "") return 0;
  return Math.max(0, Number.parseInt(value, 10) || 0);
}

function normalizeVoteInput(value: string) {
  if (value === "") return "";
  return String(Math.max(0, Number.parseInt(value, 10) || 0));
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
  const [voteInputs, setVoteInputs] = useState<VoteInputs>(() =>
    initialVoteInputs(protocol, template),
  );
  const [activeKind, setActiveKind] = useState<"local" | "regional">(
    () => sections.find((section) => section.kind === "local")?.kind ?? sections[0]?.kind ?? "local",
  );
  const [entryMode, setEntryMode] = useState<EntryMode>("table");
  const [sequentialPosition, setSequentialPosition] = useState<
    Record<"local" | "regional", number>
  >({ local: 0, regional: 0 });
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saved" | "restored" | "unavailable"
  >("idle");
  const voteInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked =
    protocol?.state === "validated" || protocol?.state === "verified";

  const candidacyReady =
    sections.length > 0 && sections.every((section) => section.results.length > 0);

  const draftKey = useMemo(
    () => `geniura-elect:protocol-draft:${template.election_id}:${officeId}`,
    [officeId, template.election_id],
  );

  const sectionProgress = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [
          section.kind,
          {
            entered: section.results.filter(
              (result) => voteInputs[result.candidate_list.id] !== "",
            ).length,
            total: section.results.length,
          },
        ]),
      ) as Record<
        "local" | "regional",
        { entered: number; total: number }
      >,
    [sections, voteInputs],
  );

  const hasAnyCandidateResults = sections.some(
    (section) => section.results.length > 0,
  );

  const allVotesEntered =
    hasAnyCandidateResults &&
    sections.every((section) =>
      section.results.every(
        (result) => voteInputs[result.candidate_list.id] !== "",
      ),
    );

  const activeSectionIndex = sections.findIndex(
    (section) => section.kind === activeKind,
  );
  const activeSection =
    activeSectionIndex >= 0 ? sections[activeSectionIndex] : sections[0];

  /* eslint-disable react-hooks/set-state-in-effect -- browser-only draft hydration intentionally restores client state after mount. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as DeviceDraft;
        const currentProtocolId = protocol?.id ?? null;

        if (
          draft.version === 1 &&
          draft.protocolId === currentProtocolId
        ) {
          setShared(draft.shared);
          setVoteInputs((current) => ({
            ...current,
            ...draft.voteInputs,
          }));
          setSections((current) =>
            current.map((section) => {
              const saved = draft.sections.find(
                (item) => item.kind === section.kind,
              );
              return saved ? { ...section, ...saved } : section;
            }),
          );
          if (
            draft.activeKind === "local" ||
            draft.activeKind === "regional"
          ) {
            setActiveKind(draft.activeKind);
          }
          if (draft.entryMode === "table" || draft.entryMode === "sequential") {
            setEntryMode(draft.entryMode);
          }
          setSequentialPosition(draft.sequentialPosition);
          setDraftStatus("restored");
        } else {
          window.localStorage.removeItem(draftKey);
        }
      }
    } catch {
      setDraftStatus("unavailable");
    } finally {
      setDraftReady(true);
    }
  }, [draftKey, protocol?.id]);

  useEffect(() => {
    if (!draftReady || locked || typeof window === "undefined") return;

    const draft: DeviceDraft = {
      version: 1,
      protocolId: protocol?.id ?? null,
      shared,
      sections: sections.map((section) => ({
        kind: section.kind,
        valid_votes: section.valid_votes,
        invalid_votes: section.invalid_votes,
        blank_votes: section.blank_votes,
        other_nonvalid_votes: section.other_nonvalid_votes,
        observations: section.observations ?? "",
      })),
      voteInputs,
      activeKind,
      entryMode,
      sequentialPosition,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftStatus("saved");
    } catch {
      setDraftStatus("unavailable");
    }
  }, [
    activeKind,
    draftKey,
    draftReady,
    entryMode,
    locked,
    protocol?.id,
    sections,
    sequentialPosition,
    shared,
    voteInputs,
  ]);

  /* eslint-enable react-hooks/set-state-in-effect */

  const localChecks = useMemo(
    () =>
      sections.map((section) => {
        const listTotal = section.results.reduce(
          (sum, result) =>
            sum + parseVote(voteInputs[result.candidate_list.id]),
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
    [sections, shared.ballots_cast, voteInputs],
  );

  const voterBallotGap = shared.voters - shared.ballots_cast;

  function updateShared(
    field: "registered_voters" | "voters" | "ballots_cast",
    value: string,
  ) {
    const number = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setShared((current) =>
      field === "voters"
        ? { ...current, voters: number, ballots_cast: number }
        : { ...current, [field]: number },
    );
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
    const candidateId =
      sections[sectionIndex]?.results[resultIndex]?.candidate_list.id;
    if (!candidateId) return;

    setVoteInputs((current) => ({
      ...current,
      [candidateId]: normalizeVoteInput(value),
    }));
  }

  function fillRemainingWithZero(sectionIndex: number) {
    const section = sections[sectionIndex];
    if (!section) return;

    setVoteInputs((current) => {
      const next = { ...current };
      for (const result of section.results) {
        const id = result.candidate_list.id;
        if (next[id] === "" || next[id] === undefined) next[id] = "0";
      }
      return next;
    });
  }

  function focusVoteInput(candidateId: number) {
    window.setTimeout(() => {
      const input = voteInputRefs.current[candidateId];
      input?.focus();
      input?.select();
    }, 0);
  }

  function moveSequential(
    kind: "local" | "regional",
    nextIndex: number,
    total: number,
  ) {
    const safe = Math.max(0, Math.min(Math.max(total - 1, 0), nextIndex));
    setSequentialPosition((current) => ({ ...current, [kind]: safe }));
  }

  function handleVoteKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    section: EditableSection,
    resultIndex: number,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const nextIndex = resultIndex + 1;
    if (nextIndex >= section.results.length) return;

    if (entryMode === "sequential") {
      moveSequential(section.kind, nextIndex, section.results.length);
    }

    focusVoteInput(section.results[nextIndex].candidate_list.id);
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
    if (!allVotesEntered) {
      setMessage(
        "بعض خانات الأصوات ما زالت فارغة. أدخلها أو استخدم «تعيين المتبقي إلى 0».",
      );
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
          votes: parseVote(voteInputs[result.candidate_list.id]),
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

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      setDraftStatus("idle");
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
      <section className="protocol-quick-toolbar" aria-label="أدوات الإدخال السريع">
        <div className="quick-toolbar-heading">
          <div>
            <p className="eyebrow">FAST PV ENTRY</p>
            <h2>الإدخال السريع للمحضر</h2>
            <p>
              أدخل الأصوات بالترتيب. زر Enter ينقلك مباشرة إلى اللائحة التالية.
            </p>
          </div>
          <div className="entry-mode-switch" aria-label="طريقة الإدخال">
            <button
              type="button"
              className={entryMode === "table" ? "is-active" : ""}
              onClick={() => setEntryMode("table")}
            >
              جدول سريع
            </button>
            <button
              type="button"
              className={entryMode === "sequential" ? "is-active" : ""}
              onClick={() => setEntryMode("sequential")}
            >
              إدخال متسلسل
            </button>
          </div>
        </div>

        <div className="quick-tabs" role="tablist" aria-label="نوع النتيجة">
          {sections.map((section) => {
            const progress = sectionProgress[section.kind] ?? {
              entered: 0,
              total: section.results.length,
            };
            const ready = section.results.length > 0;
            return (
              <button
                key={section.kind}
                type="button"
                role="tab"
                aria-selected={activeKind === section.kind}
                className={activeKind === section.kind ? "quick-tab is-active" : "quick-tab"}
                onClick={() => setActiveKind(section.kind)}
              >
                <span>{sectionNames[section.kind]}</span>
                <strong>
                  {ready
                    ? `${progress.entered}/${progress.total}`
                    : "غير جاهز"}
                </strong>
              </button>
            );
          })}
        </div>

        <div className="quick-draft-state" aria-live="polite">
          <span
            className={
              draftStatus === "unavailable"
                ? "draft-dot is-warning"
                : "draft-dot"
            }
            aria-hidden="true"
          />
          <span>
            {draftStatus === "restored"
              ? "تم استرجاع المسودة المحفوظة على هذا الجهاز."
              : draftStatus === "unavailable"
                ? "تعذر حفظ المسودة محليًا في هذا المتصفح."
                : "يُحفظ تقدمك تلقائيًا كمسودة على هذا الجهاز حتى الحفظ في النظام."}
          </span>
        </div>
      </section>

      <section className="protocol-section shared-counts-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PROTOCOL COUNTS</p>
            <h2>بيانات المحضر</h2>
            <p>أدخل الأرقام الأساسية أولًا، ثم أصوات الأحزاب أسفلها.</p>
          </div>
        </div>

        <div className="shared-count-grid">
          <label>
            <span>عدد الناخبين والناخبات</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={locked || pending}
              value={shared.registered_voters}
              onChange={(event) =>
                updateShared("registered_voters", event.target.value)
              }
            />
            <small>قابل للتعديل حسب المحضر</small>
          </label>

          <label>
            <span>عدد المصوتين</span>
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
            <span>عدد الأوراق الملغاة</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={locked || pending || activeSectionIndex < 0}
              value={activeSection ? String(activeSection.invalid_votes) : "0"}
              onChange={(event) =>
                updateSectionCount(
                  activeSectionIndex,
                  "invalid_votes",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>عدد الأصوات المعبر عنها</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={locked || pending || activeSectionIndex < 0}
              value={activeSection ? String(activeSection.valid_votes) : "0"}
              onChange={(event) =>
                updateSectionCount(
                  activeSectionIndex,
                  "valid_votes",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

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
            إحدى نتيجتي المحلي/الجهوي لا تحتوي لوائح بعد. يمكنك إدخال القسم
            المتاح وحفظ المحضر الآن، ثم استكمال القسم الآخر عند تحميل لوائحه.
          </p>
        </section>
      ) : null}

      {sections.map((section, sectionIndex) => {
        if (section.kind !== activeKind) return null;

        const check = localChecks[sectionIndex];
        const hardMismatch = !check.listMatches || !check.ballotsMatch;
        const progress = sectionProgress[section.kind] ?? {
          entered: 0,
          total: section.results.length,
        };
        const currentIndex = Math.min(
          sequentialPosition[section.kind] ?? 0,
          Math.max(section.results.length - 1, 0),
        );
        const currentResult = section.results[currentIndex];

        return (
          <section className="protocol-section quick-entry-section" key={section.kind}>
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

            <div className="balance-row">
              <span>
                مجموع أصوات الأحزاب: <strong>{check.listTotal}</strong>
              </span>
              <span>
                الأصوات المعبر عنها: <strong>{section.valid_votes}</strong>
              </span>
              <span>
                الأوراق الملغاة: <strong>{section.invalid_votes}</strong>
              </span>
            </div>

            {section.results.length && entryMode === "table" ? (
              <div className="quick-party-stack">
                {section.results.map((result, resultIndex) => (
                  <label
                    className="quick-party-card"
                    key={result.candidate_list.id}
                  >
                    <span className="candidate-list-identity quick-party-identity">
                      <b
                        className="quick-ballot-number"
                        aria-label={`رقم اللائحة ${result.candidate_list.ballot_number ?? "غير متوفر"}`}
                      >
                        {result.candidate_list.ballot_number ?? "—"}
                      </b>
                      {result.candidate_list.party?.has_logo ? (
                        <img
                          className="candidate-party-logo quick-party-logo"
                          src={`/api/operations/parties/${result.candidate_list.party.id}/logo`}
                          alt={`شعار ${result.candidate_list.party.name}`}
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="quick-party-logo quick-party-logo-fallback"
                          aria-hidden="true"
                        />
                      )}
                      <span className="candidate-list-copy quick-party-copy">
                        <strong>{result.candidate_list.name}</strong>
                        <small>
                          {result.candidate_list.party?.symbol_name
                            ? `الرمز الانتخابي: ${result.candidate_list.party.symbol_name}`
                            : result.candidate_list.party?.short_name ||
                              result.candidate_list.party?.name ||
                              "بدون هيئة محددة"}
                        </small>
                      </span>
                    </span>

                    <span className="quick-vote-entry">
                      <small>الأصوات</small>
                      <input
                        ref={(element) => {
                          voteInputRefs.current[result.candidate_list.id] = element;
                        }}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        aria-label={`أصوات ${result.candidate_list.name}`}
                        disabled={locked || pending}
                        value={voteInputs[result.candidate_list.id] ?? "0"}
                        onChange={(event) =>
                          updateVotes(
                            sectionIndex,
                            resultIndex,
                            event.target.value,
                          )
                        }
                        onKeyDown={(event) =>
                          handleVoteKeyDown(event, section, resultIndex)
                        }
                      />
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {section.results.length &&
            entryMode === "sequential" &&
            currentResult ? (
              <div className="sequential-entry">
                <div className="sequential-step">
                  <span>
                    اللائحة {currentIndex + 1} من {section.results.length}
                  </span>
                  <strong>
                    {currentResult.candidate_list.ballot_number ?? "—"}
                  </strong>
                </div>

                <div className="sequential-party">
                  {currentResult.candidate_list.party?.has_logo ? (
                    <img
                      className="sequential-party-logo"
                      src={`/api/operations/parties/${currentResult.candidate_list.party.id}/logo`}
                      alt={`شعار ${currentResult.candidate_list.party.name}`}
                    />
                  ) : null}
                  <div>
                    <h3>{currentResult.candidate_list.name}</h3>
                    <p>
                      {currentResult.candidate_list.party?.name ?? ""}
                      {currentResult.candidate_list.party?.symbol_name
                        ? ` · الرمز: ${currentResult.candidate_list.party.symbol_name}`
                        : ""}
                    </p>
                  </div>
                </div>

                <label className="sequential-vote-field">
                  <span>عدد الأصوات</span>
                  <input
                    ref={(element) => {
                      voteInputRefs.current[currentResult.candidate_list.id] =
                        element;
                    }}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="اكتب العدد ثم Enter"
                    aria-label={`أصوات ${currentResult.candidate_list.name}`}
                    disabled={locked || pending}
                    value={voteInputs[currentResult.candidate_list.id] ?? ""}
                    onChange={(event) =>
                      updateVotes(
                        sectionIndex,
                        currentIndex,
                        event.target.value,
                      )
                    }
                    onKeyDown={(event) =>
                      handleVoteKeyDown(event, section, currentIndex)
                    }
                  />
                  <small>Enter = الانتقال إلى اللائحة التالية</small>
                </label>

                <div className="sequential-nav">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={currentIndex === 0}
                    onClick={() =>
                      moveSequential(
                        section.kind,
                        currentIndex - 1,
                        section.results.length,
                      )
                    }
                  >
                    السابق
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={currentIndex >= section.results.length - 1}
                    onClick={() => {
                      const nextIndex = currentIndex + 1;
                      moveSequential(
                        section.kind,
                        nextIndex,
                        section.results.length,
                      );
                      const next = section.results[nextIndex];
                      if (next) focusVoteInput(next.candidate_list.id);
                    }}
                  >
                    التالي
                  </button>
                </div>
              </div>
            ) : null}

            {!section.results.length ? (
              <div className="quick-empty-section">
                <strong>هذا القسم غير جاهز للإدخال بعد</strong>
                <span>
                  لم تُحمّل لوائح الترشيح الخاصة بهذه النتيجة. يمكنك متابعة
                  القسم الآخر دون فقدان ما أدخلته.
                </span>
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
          disabled={pending || locked || !allVotesEntered}
        >
          {pending
            ? "جارٍ الحفظ..."
            : allVotesEntered
              ? "حفظ المحضر"
              : "أكمل الإدخال للحفظ"}
        </button>
      </div>
    </form>
  );
}
