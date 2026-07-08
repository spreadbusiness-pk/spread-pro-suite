import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/orders")({
  component: () => (
    <ComingSoon
      title="Orders"
      description="Track every printing job from intake to delivery."
      features={[
        "Create orders linked to customers",
        "Assign to Designer, Production, Delivery",
        "Order status pipeline",
        "Attachments & artwork files",
      ]}
    />
  ),
});
