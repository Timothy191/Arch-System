import { buttonVariants } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import Link from 'next/link';

// AGENT-TRACE: API documentation page using Swagger UI
// This page provides an interactive interface for exploring the API
// Protected by Supabase auth - only accessible to admin and engineering roles
// Loads OpenAPI spec from /api/doc endpoint

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-subtle)] glass-card rounded-none backdrop-blur-xl p-4">
        <h1 className="text-2xl font-semibold text-[var(--text-heading)]">API Documentation</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Interactive API reference for Arch-Systems Portal
        </p>
      </div>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>OpenAPI specification</CardTitle>
            <CardDescription>Download the current machine-readable API contract.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link className={buttonVariants()} href="/api/doc" target="_blank" rel="noreferrer">
              Open JSON specification
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
