import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <ComingSoon
      title="Reports"
      description="Financial, sales, and production analytics."
      features={["Sales by customer / month", "Outstanding payments", "Production throughput", "Export to CSV / PDF"]}
    />
  ),
});
