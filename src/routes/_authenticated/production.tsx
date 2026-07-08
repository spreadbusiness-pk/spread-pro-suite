import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/production")({
  component: () => (
    <ComingSoon
      title="Production"
      description="Manage the shop floor: print, finishing, and QC."
      features={["Work orders", "Machine assignment", "Kanban production board", "QC checklist"]}
    />
  ),
});
