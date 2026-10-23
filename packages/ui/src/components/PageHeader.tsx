interface PageHeaderProps {
  title: string;
  showDate?: boolean;
}

export function PageHeader({ title, showDate = true }: PageHeaderProps) {
  return (
    <div className="gold-steel-border gold-steel-border-slim flex items-center justify-between rounded-xl bg-white/75 px-4 py-2.5 shadow-2xs backdrop-blur-md">
      <h2 className="font-medium text-[var(--text-heading)] text-fluid-2xl">{title}</h2>
      {showDate && (
        <p className="text-[var(--text-muted)] text-fluid-xs">
          {new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}
