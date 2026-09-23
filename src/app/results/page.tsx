import type { Metadata } from "next";

import { PublicResultsClient } from "./results-client";

export const metadata: Metadata = {
  title: "نتائج انتخاب أعضاء مجلس النواب 2026 | طنجة – أصيلة",
  description:
    "متابعة تجميعية لنتائج انتخاب أعضاء مجلس النواب بالدائرة الانتخابية المحلية طنجة – أصيلة.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ display?: string }>;
}) {
  const params = await searchParams;
  const displayMode = params.display === "tv" ? "tv" : "default";

  return <PublicResultsClient displayMode={displayMode} />;
}
