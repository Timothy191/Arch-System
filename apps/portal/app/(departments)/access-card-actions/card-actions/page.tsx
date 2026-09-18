import { PageHeader } from "@repo/ui/PageHeader";
import { Suspense } from "react";
import { CardActionsView } from "./card-actions-view";

export const dynamic = "force-dynamic";

export default async function CardActionsPage(props: {
  searchParams: Promise<{ q?: string; selected?: string }>;
}) {
  const params = await props.searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Card Actions" showDate />
      <Suspense fallback={<div className="h-[400px] bg-black/5 animate-pulse rounded-xl" />}>
        <CardActionsView initialQuery={params.q ?? ""} initialSelectedId={params.selected ?? ""} />
      </Suspense>
    </div>
  );
}
