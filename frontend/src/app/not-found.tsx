import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <GlassCard className="max-w-md text-center">
        <div className="mb-4 text-6xl font-bold text-accent/30">404</div>
        <h2 className="mb-2 text-xl font-bold text-text-primary">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </GlassCard>
    </div>
  );
}
