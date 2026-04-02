/**
 * App Router entry point for /results.
 *
 * Thin wrapper — all logic lives in the presentation layer so it can be
 * unit-tested and reused independently of Next.js routing.
 */
import ResultsPage from "@/presentation/pages/ResultsPage";

export default function Page() {
  return <ResultsPage />;
}
