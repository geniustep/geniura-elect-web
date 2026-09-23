"use client";

import { useState } from "react";

import styles from "./public-results-visibility-control.module.css";

type ElectionUpdateResponse =
  | {
      success: true;
      data: {
        item: {
          public_results_visible: boolean;
        };
      };
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

export function PublicResultsVisibilityControl({
  electionId,
  initialVisible,
}: {
  electionId: string;
  initialVisible: boolean;
}) {
  const [visible, setVisible] = useState(initialVisible);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function toggleVisibility() {
    const nextVisible = !visible;
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/election`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            public_results_visible: nextVisible,
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as ElectionUpdateResponse | null;

      if (!response.ok || !payload || !payload.success) {
        throw new Error(
          payload && !payload.success && payload.error?.message
            ? payload.error.message
            : "تعذر تغيير حالة النشر.",
        );
      }

      setVisible(payload.data.item.public_results_visible);
      setFeedback(
        payload.data.item.public_results_visible
          ? "أصبحت صفحة النتائج العامة متاحة للزوار."
          : "تم إخفاء النتائج، وتظهر الآن صفحة «قريبًا».",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "تعذر تغيير حالة النشر.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={`${styles.panel} ${visible ? styles.isVisible : styles.isHidden}`}
      aria-label="التحكم في نشر النتائج العامة"
    >
      <div className={styles.status}>
        <span aria-hidden="true" />
        <div>
          <small>النشر العام</small>
          <strong>{visible ? "النتائج ظاهرة للجمهور" : "النتائج مخفية"}</strong>
          <p>
            {visible
              ? "صفحة /results تعرض حاليًا النتائج العامة المتاحة."
              : "صفحة /results تعرض تصميم «قريبًا» فقط، دون أرقام أو نتائج."}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <a href="/results" target="_blank" rel="noreferrer">
          معاينة الصفحة
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => void toggleVisibility()}
        >
          {pending
            ? "جارٍ الحفظ…"
            : visible
              ? "إخفاء النتائج"
              : "إظهار النتائج"}
        </button>
      </div>

      {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
    </section>
  );
}
