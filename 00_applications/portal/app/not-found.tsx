import Link from "next/link";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { ErrorFullscreen } from "@/components/errors/ErrorFullscreen";

export default function NotFound() {
  return (
    <ErrorFullscreen>
      <div className="space-y-2">
        <h1 className="text-4xl font-medium text-[var(--text-heading)]">404</h1>
        <p className="text-[var(--text-muted)] text-sm">
          The page you are looking for does not exist.
        </p>
      </div>
      <SecondaryButton asChild>
        <Link href="/">Return to Hub</Link>
      </SecondaryButton>
    </ErrorFullscreen>
  );
}
