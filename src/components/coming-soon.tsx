import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Phase 2
          <Badge variant="outline" className="border-gold/40 text-gold-foreground">
            <Sparkles className="mr-1 h-3 w-3" /> In development
          </Badge>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="relative overflow-hidden p-8 shadow-elevated sm:p-12">
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative">
          <div className="inline-grid h-14 w-14 place-items-center rounded-2xl gradient-gold shadow-gold">
            <Sparkles className="h-6 w-6 text-gold-foreground" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Coming in the next phase</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            The foundation is ready. This module will light up when Phase 2 ships. Meanwhile the
            data model, routes, and permissions have been scaffolded so it can be enabled without
            touching anything else.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 rounded-xl border border-border/60 bg-card p-3 text-sm"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
