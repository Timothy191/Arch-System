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
      <div className="glass-card rounded-none border-[var(--border-subtle)] border-b p-4 backdrop-blur-xl">
        <h1 className="font-semibold text-2xl text-[var(--text-heading)]">API Documentation</h1>
        <p className="mt-1 text-[var(--text-muted)] text-sm">
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
