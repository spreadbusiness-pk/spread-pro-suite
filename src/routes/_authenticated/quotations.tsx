import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/quotations")({
  component: () => (
    <ComingSoon
      title="Quotations"
      description="Send elegant, branded quotations in minutes."
      features={["Line-item pricing", "PDF export", "Send via email / WhatsApp", "Convert to order"]}
    />
  ),
});
