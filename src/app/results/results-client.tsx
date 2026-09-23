"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/branding/brand-logo";
import type {
  PublicResultList,
  PublicResultsComingSoon,
  PublicResultsPayload,
  PublicResultsSnapshot,
  PublicResultsState,
} from "@/lib/elect/public-results";

import styles from "./results.module.css";

type ApiResponse =
  | {
      success: true;
      data: PublicResultsPayload;
    }
  | {
      success: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

type LoadState = "loading" | "ready" | "error";

function isComingSoon(
  payload: PublicResultsPayload,
): payload is PublicResultsComingSoon {
  return payload.publication.visible === false;
}

const POLL_INTERVAL_MS = 15_000;

function formatInteger(value: number) {
  return new Intl.NumberFormat("ar-MA").format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function parseBackendDateTime(value: string | null) {
  if (!value) return null;
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: string | null) {
  const date = parseBackendDateTime(value);
  if (!date) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-MA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Casablanca",
  }).format(date);
}

function formatElectionDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-MA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  }).format(date);
}

function stateCopy(state: PublicResultsState) {
  switch (state) {
    case "OFFICIAL":
      return {
        label: "النتيجة الرسمية",
        detail: "المعطيات المعروضة موسومة كمصدر رسمي في عقد النتائج.",
        tone: "official" as const,
      };
    case "COMPLETE_INTERNAL":
      return {
        label: "اكتمل تجميع المحاضر المتوفرة",
        detail:
          "اكتمل التجميع الداخلي للمحاضر المحتسبة، ولا يمثل ذلك إعلانًا رسميًا للنتيجة.",
        tone: "complete" as const,
      };
    case "NO_RESULTS":
      return {
        label: "بانتظار النتائج",
        detail: "لم ترد بعد محاضر موثقة داخلة في التجميع العام.",
        tone: "empty" as const,
      };
    case "PARTIAL":
    default:
      return {
        label: "نتائج جزئية",
        detail:
          "الأرقام المعروضة تجميعية ومبنية على المحاضر المحتسبة حتى الآن.",
        tone: "partial" as const,
      };
  }
}

function allocationCopy(snapshot: PublicResultsSnapshot) {
  switch (snapshot.allocation.state) {
    case "complete":
      return "توزيع محسوب بعد اكتمال المحاضر المحتسبة داخليًا.";
    case "requires_resolution":
      return "توجد حالة في حساب المقاعد تحتاج حسمًا قبل اعتماد التوزيع.";
    case "provisional":
      return `توزيع مؤقت بناءً على ${formatPercent(
        snapshot.completion.percent,
      )} من المكاتب المحتسبة.`;
    case "unavailable":
    default:
      return "سيظهر توزيع المقاعد عند توفر المعطيات الكافية للحساب.";
  }
}

function sortedLists(lists: PublicResultList[]) {
  return [...lists].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return (a.ballot_number ?? Number.MAX_SAFE_INTEGER) -
      (b.ballot_number ?? Number.MAX_SAFE_INTEGER);
  });
}

function listLogoUrl(item: PublicResultList) {
  if (!item.has_logo || item.ballot_number === null) return null;
  return `/api/public/results/list-logo/${encodeURIComponent(
    String(item.ballot_number),
  )}`;
}

function ResultBar({
  item,
  noResults,
}: {
  item: PublicResultList;
  noResults: boolean;
}) {
  const width = item.percentage === null ? 0 : Math.min(100, Math.max(0, item.percentage));
  const partyLabel = item.party_name || item.name;

  return (
    <article
      className={`${styles.resultRow} ${
        item.is_featured_party ? styles.featuredResultRow : ""
      }`}
    >
      <div className={styles.resultIdentity}>
        <span className={styles.ballotNumber}>
          {item.ballot_number ?? "—"}
        </span>
        {listLogoUrl(item) ? (
          <img
            className={styles.resultPartyLogo}
            src={listLogoUrl(item) ?? undefined}
            alt={`شعار ${partyLabel}`}
            loading="lazy"
          />
        ) : (
          <span className={styles.resultPartyLogoFallback} aria-hidden="true" />
        )}
        <div className={styles.resultIdentityCopy}>
          <strong>{partyLabel}</strong>
          <small>
            {item.symbol_name ? `الرمز: ${item.symbol_name}` : "الرمز غير متوفر"}
            {item.party_name && item.name !== item.party_name
              ? ` · ${item.name}`
              : ""}
          </small>
        </div>
      </div>

      <div className={styles.resultNumbers}>
        <strong>{noResults ? "—" : formatInteger(item.votes)}</strong>
        <span>{noResults ? "—" : formatPercent(item.percentage)}</span>
        <span>
          {item.seats_available && item.seats !== null
            ? `${formatInteger(item.seats)} مقعد`
            : "المقاعد —"}
        </span>
      </div>

      <div
        className={styles.voteTrack}
        role="progressbar"
        aria-label={`نسبة الأصوات الصحيحة المحتسبة لـ ${partyLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.percentage ?? 0}
        aria-valuetext={
          item.percentage === null
            ? "غير متوفرة"
            : formatPercent(item.percentage)
        }
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </article>
  );
}

function ComingSoon({
  snapshot,
  refreshing,
  connectionInterrupted,
}: {
  snapshot: PublicResultsComingSoon;
  refreshing: boolean;
  connectionInterrupted: boolean;
}) {
  return (
    <main className={`${styles.page} ${styles.comingSoonPage}`}>
      <section className={styles.comingSoonShell}>
        <header className={styles.comingSoonTopbar}>
          <div className={styles.comingSoonPlace}>
            <span className={styles.locationMark} aria-hidden="true" />
            <div>
              <strong>{snapshot.constituency.name}</strong>
              <small>الدائرة الانتخابية المحلية</small>
            </div>
          </div>

          <div className={styles.comingSoonElection}>
            <strong>{snapshot.election.name}</strong>
            <small>{formatElectionDate(snapshot.election.date)}</small>
          </div>

          <div className={styles.comingSoonHeaderLogo}>
            <BrandLogo priority />
          </div>
        </header>

        <div className={styles.comingSoonCanvas}>
          <div className={styles.comingSoonScenery} aria-hidden="true">
            <span className={styles.comingSoonMountain} />
            <span className={styles.comingSoonSea} />
            <div className={styles.comingSoonCity}>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className={styles.comingSoonMonument}>
            <div className={styles.comingSoonCenterLogo}>
              <BrandLogo priority />
            </div>
            <h1>قريبًا</h1>
            <span className={styles.comingSoonAccent} aria-hidden="true" />
            <p>سيتم عرض النتائج هنا</p>
          </div>

          <div className={styles.comingSoonPreview} aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <span />
                <i />
                <i />
              </div>
            ))}
          </div>

          <div className={styles.comingSoonLiveRegion} aria-live="polite">
            {connectionInterrupted
              ? "تعذر التحديث مؤقتًا"
              : refreshing
                ? "جارٍ التحقق من توفر النتائج"
                : ""}
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultsSummary({
  snapshot,
  onClose,
}: {
  snapshot: PublicResultsSnapshot;
  onClose: () => void;
}) {
  const lists = sortedLists(snapshot.lists);
  const status = stateCopy(snapshot.status.state);

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.summaryModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-summary-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.summaryHeader}>
          <div className={styles.summaryBrand}>
            <BrandLogo priority />
            <div>
              <span>ملخص النتائج</span>
              <strong id="results-summary-title">{snapshot.election.name}</strong>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق ملخص النتائج">
            ×
          </button>
        </header>

        <div className={styles.summaryIdentity}>
          <strong>{snapshot.constituency.name}</strong>
          <span>{formatElectionDate(snapshot.election.date)}</span>
        </div>

        <div className={styles.summaryCompletion}>
          <div>
            <span>تقدم احتساب النتائج</span>
            <strong>{formatPercent(snapshot.completion.percent)}</strong>
          </div>
          <p>
            {formatInteger(snapshot.completion.counted_offices)} من{" "}
            {formatInteger(snapshot.completion.total_offices)} مكتب تصويت
          </p>
        </div>

        <div className={styles.summaryLists}>
          {lists.map((item) => (
            <div
              className={item.is_featured_party ? styles.summaryFeatured : ""}
              key={`${item.ballot_number ?? "x"}-${item.name}`}
            >
              <div className={styles.summaryPartyIdentity}>
                <span className={styles.summaryBallotNumber}>
                  {item.ballot_number ?? "—"}
                </span>
                {listLogoUrl(item) ? (
                  <img
                    className={styles.summaryPartyLogo}
                    src={listLogoUrl(item) ?? undefined}
                    alt={`شعار ${item.party_name || item.name}`}
                    loading="lazy"
                  />
                ) : null}
                <span>
                  <strong>{item.party_name || item.name}</strong>
                  {item.symbol_name ? <small>{item.symbol_name}</small> : null}
                </span>
              </div>
              <strong>{formatInteger(item.votes)}</strong>
              <small>{formatPercent(item.percentage)}</small>
              <small>
                {item.seats_available && item.seats !== null
                  ? `${item.seats} مقعد`
                  : "—"}
              </small>
            </div>
          ))}
        </div>

        <footer className={styles.summaryFooter}>
          <span>{status.label}</span>
          <p>{status.detail}</p>
          <small>آخر تحديث: {formatTime(snapshot.metadata.data_as_of)}</small>
        </footer>
      </section>
    </div>
  );
}

export function PublicResultsClient({
  displayMode,
}: {
  displayMode: "default" | "tv";
}) {
  const [snapshot, setSnapshot] = useState<PublicResultsPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [connectionInterrupted, setConnectionInterrupted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const mountedRef = useRef(true);
  const snapshotRef = useRef<PublicResultsPayload | null>(null);

  const fetchSnapshot = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);

    try {
      const response = await fetch("/api/public/results", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !payload || !payload.success) {
        throw new Error("public_results_unavailable");
      }

      if (!mountedRef.current) return;
      snapshotRef.current = payload.data;
      setSnapshot(payload.data);
      setLoadState("ready");
      setConnectionInterrupted(false);
    } catch {
      if (!mountedRef.current) return;
      if (initial && !snapshotRef.current) {
        setLoadState("error");
      } else {
        setConnectionInterrupted(true);
      }
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialFetchId = window.setTimeout(() => {
      void fetchSnapshot(true);
    }, 0);

    const intervalId = window.setInterval(() => {
      void fetchSnapshot(false);
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialFetchId);
      window.clearInterval(intervalId);
    };
  }, [fetchSnapshot]);

  if (loadState === "loading" && !snapshot) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingShell}>
          <div className={styles.loadingHeader} />
          <div className={styles.loadingHero} />
          <div className={styles.loadingGrid}>
            <div />
            <div />
            <div />
          </div>
        </div>
      </main>
    );
  }

  if (loadState === "error" && !snapshot) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState}>
          <BrandLogo priority />
          <span>متابعة النتائج</span>
          <h1>تعذر تحديث النتائج مؤقتًا</h1>
          <p>
            لا توجد بيانات متاحة للعرض في هذه اللحظة. يمكنك إعادة المحاولة دون
            تسجيل الدخول.
          </p>
          <button type="button" onClick={() => void fetchSnapshot(true)}>
            إعادة المحاولة
          </button>
        </section>
      </main>
    );
  }

  if (!snapshot) return null;

  if (isComingSoon(snapshot)) {
    return (
      <ComingSoon
        snapshot={snapshot}
        refreshing={refreshing}
        connectionInterrupted={connectionInterrupted}
      />
    );
  }

  const lists = sortedLists(snapshot.lists);
  const featured = snapshot.lists.find((item) => item.is_featured_party) ?? null;
  const status = stateCopy(snapshot.status.state);
  const noResults = snapshot.status.state === "NO_RESULTS";
  const seatLists = lists.filter(
    (item) => item.seats_available && item.seats !== null && item.seats > 0,
  );
  const isTv = displayMode === "tv";

  return (
    <main className={`${styles.page} ${isTv ? styles.tvMode : ""}`}>
      <header className={styles.publicHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headerIdentity}>
            <div className={styles.logoFrame}>
              <BrandLogo priority />
            </div>
            <div>
              <span className={styles.electionType}>
                {snapshot.election.name}
              </span>
              <strong>{snapshot.constituency.name}</strong>
              <small>
                {snapshot.constituency.kind === "local"
                  ? "الدائرة الانتخابية المحلية"
                  : "الدائرة الانتخابية الجهوية"}
                {" · "}
                {formatElectionDate(snapshot.election.date)}
              </small>
            </div>
          </div>

          <div className={styles.headerUpdate} aria-live="polite">
            <span>متابعة النتائج</span>
            <strong>
              {refreshing ? "جارٍ التحديث…" : `آخر تحديث: ${formatTime(snapshot.metadata.data_as_of)}`}
            </strong>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {connectionInterrupted ? (
          <div className={styles.connectionWarning} role="status">
            تعذر الاتصال مؤقتًا؛ يتم عرض آخر بيانات متوفرة عند{" "}
            {formatTime(snapshot.metadata.data_as_of)}.
          </div>
        ) : null}

        <section
          className={`${styles.statusBanner} ${styles[`status_${status.tone}`]}`}
          aria-label="حالة النتائج"
        >
          <strong>{status.label}</strong>
          <p>{status.detail}</p>
        </section>

        <section className={styles.completionHero}>
          <div className={styles.heroCopy}>
            <span>تقدم احتساب النتائج</span>
            <strong>{formatPercent(snapshot.completion.percent)}</strong>
            <p>من المكاتب المحتسبة</p>
          </div>

          <div className={styles.heroProgress}>
            <div className={styles.officeCount}>
              <strong>
                {formatInteger(snapshot.completion.counted_offices)}
              </strong>
              <span>من أصل</span>
              <strong>{formatInteger(snapshot.completion.total_offices)}</strong>
              <span>مكتب تصويت</span>
            </div>

            <div
              className={styles.completionTrack}
              role="progressbar"
              aria-label="نسبة اكتمال المكاتب المحتسبة"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={snapshot.completion.percent}
              aria-valuetext={formatPercent(snapshot.completion.percent)}
            >
              <span
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, snapshot.completion.percent),
                  )}%`,
                }}
              />
            </div>

            <p>
              {noResults
                ? "تظهر الأرقام عند وصول واعتماد أول محضر موثق."
                : "النتائج تتحدث مع ورود واعتماد المحاضر."}
            </p>
          </div>
        </section>

        <section className={styles.featuredCard} aria-labelledby="featured-party-title">
          <div className={styles.featuredHeading}>
            <div className={styles.featuredLogo}>
              <BrandLogo />
            </div>
            <div>
              <span>بطاقة معلومات</span>
              <h2 id="featured-party-title">حزب العدالة والتنمية</h2>
              {featured?.ballot_number ? (
                <small>رقم اللائحة: {featured.ballot_number}</small>
              ) : null}
            </div>
          </div>

          {featured ? (
            noResults ? (
              <div className={styles.featuredEmpty}>
                لم ترد بعد أصوات محتسبة لهذه الصفحة.
              </div>
            ) : (
              <div className={styles.featuredMetrics}>
                <div>
                  <span>الأصوات</span>
                  <strong>{formatInteger(featured.votes)}</strong>
                </div>
                <div>
                  <span>من الأصوات الصحيحة المحتسبة</span>
                  <strong>{formatPercent(featured.percentage)}</strong>
                </div>
                <div>
                  <span>المقاعد المحسوبة</span>
                  <strong>
                    {featured.seats_available && featured.seats !== null
                      ? formatInteger(featured.seats)
                      : "—"}
                  </strong>
                  {!featured.seats_available ? (
                    <small>لم يكتمل احتساب المقاعد بعد</small>
                  ) : null}
                </div>
              </div>
            )
          ) : (
            <div className={styles.featuredEmpty}>
              بيانات بطاقة الحزب المميزة غير متاحة حاليًا في مصدر النتائج العام.
            </div>
          )}

          <footer>
            استنادًا إلى {formatPercent(snapshot.completion.percent)} من المكاتب
            المحتسبة
          </footer>
        </section>

        <section className={styles.section} aria-labelledby="lists-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>الأصوات الحالية</span>
              <h2 id="lists-title">نتائج اللوائح</h2>
            </div>
            <small>{formatInteger(lists.length)} لوائح</small>
          </div>

          <div className={styles.resultsList}>
            {lists.length ? (
              lists.map((item) => (
                <ResultBar
                  item={item}
                  noResults={noResults}
                  key={`${item.ballot_number ?? "x"}-${item.name}`}
                />
              ))
            ) : (
              <div className={styles.emptyPanel}>لا توجد لوائح متاحة للعرض.</div>
            )}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="seats-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>الحساب الحالي</span>
              <h2 id="seats-title">توزيع المقاعد</h2>
            </div>
            <small>
              {formatInteger(snapshot.allocation.seats_total)} مقاعد
            </small>
          </div>

          {seatLists.length ? (
            <div className={styles.seatPanel}>
              <div className={styles.seatRows}>
                {seatLists.map((item) => (
                  <div className={styles.seatRow} key={`seat-${item.name}`}>
                    <div className={styles.seatPartyIdentity}>
                      <span className={styles.ballotNumber}>
                        {item.ballot_number ?? "—"}
                      </span>
                      {listLogoUrl(item) ? (
                        <img
                          className={styles.seatPartyLogo}
                          src={listLogoUrl(item) ?? undefined}
                          alt={`شعار ${item.party_name || item.name}`}
                          loading="lazy"
                        />
                      ) : null}
                      <span>
                        <strong>{item.party_name || item.name}</strong>
                        {item.symbol_name ? <small>{item.symbol_name}</small> : null}
                      </span>
                    </div>
                    <div className={styles.seatDots} aria-hidden="true">
                      {Array.from({ length: item.seats ?? 0 }).map((_, index) => (
                        <i
                          className={item.is_featured_party ? styles.featuredSeat : ""}
                          key={index}
                        />
                      ))}
                    </div>
                    <strong>{formatInteger(item.seats ?? 0)}</strong>
                  </div>
                ))}
              </div>
              <p>{allocationCopy(snapshot)}</p>
            </div>
          ) : (
            <div className={styles.emptyPanel}>{allocationCopy(snapshot)}</div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="stats-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>المحاضر المحتسبة</span>
              <h2 id="stats-title">إحصائيات الاقتراع</h2>
            </div>
          </div>

          <dl className={styles.statsGrid}>
            <div>
              <dt>المسجلون</dt>
              <dd>
                {snapshot.totals.registered_voters_known &&
                snapshot.totals.registered_voters !== null
                  ? formatInteger(snapshot.totals.registered_voters)
                  : "غير متوفر حاليًا"}
              </dd>
            </div>
            <div>
              <dt>المصوتون</dt>
              <dd>{formatInteger(snapshot.totals.voters)}</dd>
            </div>
            <div>
              <dt>الأصوات الصحيحة</dt>
              <dd>{formatInteger(snapshot.totals.valid_votes)}</dd>
            </div>
            <div>
              <dt>الأوراق الملغاة</dt>
              <dd>{formatInteger(snapshot.totals.invalid_votes)}</dd>
            </div>
            <div>
              <dt>الأوراق البيضاء</dt>
              <dd>{formatInteger(snapshot.totals.blank_votes)}</dd>
            </div>
            <div>
              <dt>
                {snapshot.totals.turnout_basis === "counted_offices"
                  ? "المشاركة في المكاتب المحتسبة"
                  : "نسبة المشاركة"}
              </dt>
              <dd>
                {snapshot.totals.turnout_percent === null
                  ? "غير متوفر حاليًا"
                  : formatPercent(snapshot.totals.turnout_percent)}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="areas-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>التغطية الجغرافية للنتائج</span>
              <h2 id="areas-title">تقدم التوصل بالمحاضر</h2>
            </div>
          </div>

          {snapshot.area_progress_available && snapshot.areas.length ? (
            <div className={styles.areaList}>
              {snapshot.areas.map((area) => (
                <article className={styles.areaRow} key={area.name}>
                  <div>
                    <strong>{area.name}</strong>
                    <span>
                      {formatInteger(area.counted_offices)} /{" "}
                      {formatInteger(area.total_offices)} مكتب
                    </span>
                  </div>
                  <strong>{formatPercent(area.percent)}</strong>
                  <div
                    className={styles.areaTrack}
                    role="progressbar"
                    aria-label={`نسبة المكاتب المحتسبة في ${area.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={area.percent}
                    aria-valuetext={formatPercent(area.percent)}
                  >
                    <span style={{ width: `${Math.min(100, Math.max(0, area.percent))}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyPanel}>
              تفاصيل تقدم المحاضر حسب المناطق غير متوفرة حاليًا.
            </div>
          )}
        </section>

        {!isTv ? (
          <section className={styles.pressAction}>
            <div>
              <span>للمشاركة والاطلاع السريع</span>
              <strong>ملخص النتائج</strong>
            </div>
            <button type="button" onClick={() => setSummaryOpen(true)}>
              فتح الملخص
            </button>
          </section>
        ) : null}

        <footer className={styles.disclaimer}>
          <strong>
            {snapshot.status.official
              ? "النتيجة الرسمية"
              : "تنبيه حول حالة البيانات"}
          </strong>
          <p>
            {snapshot.status.official
              ? "تعرض هذه الصفحة النتيجة الموسومة رسميًا في مصدر البيانات."
              : "هذه أرقام تجميعية مبنية على المحاضر المحتسبة حتى الآن، ولا تمثل إعلانًا رسميًا للنتيجة."}
          </p>
          <small>آخر بيانات متوفرة: {formatTime(snapshot.metadata.data_as_of)}</small>
        </footer>
      </div>

      {summaryOpen ? (
        <ResultsSummary
          snapshot={snapshot}
          onClose={() => setSummaryOpen(false)}
        />
      ) : null}
    </main>
  );
}
