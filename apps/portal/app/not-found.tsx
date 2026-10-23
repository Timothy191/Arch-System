import { SecondaryButton } from '@repo/ui/SecondaryButton';
import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Image
            src="/error-pages/404-error.png"
            alt="404 Not Found"
            width={120}
            height={120}
            priority
            className="opacity-80 transition-opacity duration-200 hover:opacity-100"
          />
        </div>
        <div className="space-y-2">
          <h1 className="font-medium text-4xl text-[var(--text-heading)]">404</h1>
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
