import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/inventory")({
  component: () => (
    <ComingSoon
      title="Inventory"
      description="Track paper, ink, and consumables in real time."
      features={["Stock levels & reorder points", "Suppliers", "Purchase orders", "Consumption per job"]}
    />
  ),
});
