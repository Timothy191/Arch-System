import Link from "next/link";
import Image from "next/image";
import { SecondaryButton } from "@repo/ui/SecondaryButton";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src="/error-pages/404-error.png"
            alt="404 Not Found"
            width={120}
            height={120}
            priority
            className="opacity-80 hover:opacity-100 transition-opacity duration-200"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-medium text-[var(--text-heading)]">404</h1>
          <p className="text-[var(--text-muted)] text-sm">
            The page you are looking for does not exist.
          </p>
        </div>
        <SecondaryButton asChild>
          <Link href="/">Return to Hub</Link>
        </SecondaryButton>
      </div>
    </div>
  );
}
