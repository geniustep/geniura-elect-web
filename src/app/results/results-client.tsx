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

function LiveResultCard({
  item,
  noResults,
  rank,
}: {
  item: PublicResultList;
  noResults: boolean;
  rank: number;
}) {
  const partyLabel = item.party_name || item.name;
  const width =
    item.percentage === null
      ? 0
      : Math.min(100, Math.max(0, item.percentage));

  return (
    <article className={styles.livePartyCard}>
      <span className={styles.liveRank} aria-label={`الترتيب ${rank}`}>
        {rank}
      </span>

      <div className={styles.livePartyIdentity}>
        <span className={styles.liveBallotNumber}>
          {item.ballot_number ?? "—"}
        </span>
        {listLogoUrl(item) ? (
          <img
            className={styles.livePartyLogo}
            src={listLogoUrl(item) ?? undefined}
            alt={`شعار ${partyLabel}`}
            loading="lazy"
          />
        ) : (
          <span className={styles.livePartyLogoFallback} aria-hidden="true" />
        )}
        <div className={styles.livePartyName}>
          <strong>{partyLabel}</strong>
          {item.symbol_name ? <small>{item.symbol_name}</small> : null}
        </div>
      </div>

      <div className={styles.livePartyNumbers}>
        <div>
          <small>الأصوات</small>
          <strong>{noResults ? "—" : formatInteger(item.votes)}</strong>
        </div>
        <div>
          <small>النسبة</small>
          <span>{noResults ? "—" : formatPercent(item.percentage)}</span>
        </div>
        <div>
          <small>المقاعد</small>
          <em>
            {item.seats_available && item.seats !== null
              ? formatInteger(item.seats)
              : "—"}
          </em>
        </div>
      </div>

      <div
        className={styles.livePartyTrack}
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

export function PublicResultsClient({
  displayMode,
  constituencyCode,
}: {
  displayMode: "default" | "tv";
  constituencyCode: string | null;
}) {
  const [snapshot, setSnapshot] = useState<PublicResultsPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [connectionInterrupted, setConnectionInterrupted] = useState(false);
  const mountedRef = useRef(true);
  const snapshotRef = useRef<PublicResultsPayload | null>(null);

  const fetchSnapshot = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);

    try {
      const resultsUrl = constituencyCode
        ? `/api/public/results?code=${encodeURIComponent(constituencyCode)}`
        : "/api/public/results";
      const response = await fetch(resultsUrl, {
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
  }, [constituencyCode]);

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
  const status = stateCopy(snapshot.status.state);
  const noResults = snapshot.status.state === "NO_RESULTS";
  const isTv = displayMode === "tv";
  const turnout =
    snapshot.totals.turnout_percent === null
      ? "—"
      : formatPercent(snapshot.totals.turnout_percent);
  const registered =
    snapshot.totals.registered_voters_known &&
    snapshot.totals.registered_voters !== null
      ? formatInteger(snapshot.totals.registered_voters)
      : "—";
  const allocatedSeats = lists.reduce(
    (total, item) =>
      total + (item.seats_available && item.seats !== null ? item.seats : 0),
    0,
  );
  const seatsAvailable = lists.some((item) => item.seats_available);
  const completionPercent = Math.min(
    100,
    Math.max(0, snapshot.completion.percent),
  );

  return (
    <main
      className={`${styles.page} ${styles.livePage} ${isTv ? styles.liveTvMode : ""}`}
    >
      <section className={styles.liveShell}>
        <header className={styles.liveHeader}>
          <div className={styles.liveBrand}>
            <div className={styles.liveBrandLogo}>
              <BrandLogo priority />
            </div>
            <div>
              <span>متابعة النتائج</span>
              <strong>{snapshot.constituency.name}</strong>
            </div>
          </div>

          <div className={styles.liveElectionTitle}>
            <strong>{snapshot.election.name}</strong>
            <small>{formatElectionDate(snapshot.election.date)}</small>
          </div>

          <div className={styles.liveUpdate} aria-live="polite">
            <span className={styles.liveUpdateDot} aria-hidden="true" />
            <div>
              <small>{refreshing ? "جارٍ التحديث" : "آخر تحديث"}</small>
              <strong>{formatTime(snapshot.metadata.data_as_of)}</strong>
            </div>
          </div>
        </header>

        <div className={styles.liveBoard}>
          <section
            className={styles.liveRankingPanel}
            aria-labelledby="live-results-title"
          >
            <div className={styles.liveRankingHeader}>
              <div>
                <span>جميع اللوائح · ترتيب حسب الأصوات المحتسبة</span>
                <h1 id="live-results-title">النتائج</h1>
              </div>
              <strong>{formatInteger(lists.length)} لائحة</strong>
            </div>

            <div
              className={`${styles.liveRankingList} ${
                lists.length > 20 ? styles.liveRankingDense : ""
              }`}
            >
              {lists.length ? (
                lists.map((item, index) => (
                  <LiveResultCard
                    item={item}
                    noResults={noResults}
                    rank={index + 1}
                    key={`${item.ballot_number ?? "x"}-${item.name}`}
                  />
                ))
              ) : (
                <div className={styles.liveEmpty}>
                  لا توجد لوائح متاحة للعرض.
                </div>
              )}
            </div>
          </section>

          <aside className={styles.liveSidebar} aria-label="ملخص النتائج">
            <section className={styles.liveCompletionCard}>
              <div
                className={styles.liveCompletionDial}
                style={{
                  background: `conic-gradient(var(--public-brand) ${completionPercent}%, #e7edf4 0)`,
                }}
                aria-hidden="true"
              >
                <div>
                  <strong>{formatPercent(snapshot.completion.percent)}</strong>
                  <small>محتسب</small>
                </div>
              </div>

              <div className={styles.liveCompletionCopy}>
                <span>تقدم احتساب المحاضر</span>
                <strong>
                  {formatInteger(snapshot.completion.counted_offices)}
                  <small>
                    {" "}
                    / {formatInteger(snapshot.completion.total_offices)} مكتب
                  </small>
                </strong>
                <div className={styles.liveCompletionBar} aria-hidden="true">
                  <span style={{ width: `${completionPercent}%` }} />
                </div>
              </div>
            </section>

            <section className={styles.liveSideStats}>
              <div>
                <span>الأصوات الصحيحة</span>
                <strong>{formatInteger(snapshot.totals.valid_votes)}</strong>
              </div>
              <div>
                <span>
                  {snapshot.totals.turnout_basis === "counted_offices"
                    ? "المشاركة المحتسبة"
                    : "نسبة المشاركة"}
                </span>
                <strong>{turnout}</strong>
              </div>
              <div>
                <span>المسجلون</span>
                <strong>{registered}</strong>
              </div>
              <div>
                <span>عدد المقاعد</span>
                <strong>{formatInteger(snapshot.allocation.seats_total)}</strong>
              </div>
            </section>

            <section className={styles.liveSeatSummary}>
              <div>
                <span>المقاعد المحسوبة</span>
                <strong>{seatsAvailable ? formatInteger(allocatedSeats) : "—"}</strong>
              </div>
              <small>
                {seatsAvailable
                  ? "وفق المعطيات المتاحة حاليًا"
                  : "سيظهر التوزيع عند توفر المعطيات الكافية"}
              </small>
            </section>

            <section
              className={`${styles.liveNotice} ${styles[`status_${status.tone}`]}`}
              role="status"
            >
              <div className={styles.liveNoticeStatus}>
                <span className={styles.liveNoticeDot} aria-hidden="true" />
                <strong>{status.label}</strong>
              </div>
              <p>
                {snapshot.status.official
                  ? "المعطيات المعروضة موسومة كمصدر رسمي."
                  : noResults
                    ? "ستظهر الأرقام فور اعتماد أول محضر موثق."
                    : "هذه أرقام تجميعية مبنية على المحاضر المحتسبة حتى الآن، ولا تمثل إعلانًا رسميًا للنتيجة."}
              </p>
              {connectionInterrupted ? (
                <small>يتم عرض آخر بيانات متوفرة مؤقتًا.</small>
              ) : (
                <small>
                  آخر بيانات: {formatTime(snapshot.metadata.data_as_of)}
                </small>
              )}
            </section>
          </aside>
        </div>

        <footer className={styles.liveFooter}>
          <span>
            {snapshot.status.official
              ? "النتيجة الرسمية"
              : "تتحدث الصفحة تلقائيًا مع ورود واعتماد المحاضر."}
          </span>
          <small>
            {snapshot.constituency.name} · {formatElectionDate(snapshot.election.date)}
          </small>
        </footer>
      </section>
    </main>
  );
  );
}
