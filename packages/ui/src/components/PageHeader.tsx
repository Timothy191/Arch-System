interface PageHeaderProps {
  title: string;
  showDate?: boolean;
}

export function PageHeader({ title, showDate = true }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/75 backdrop-blur-md shadow-2xs gold-steel-border gold-steel-border-slim">
      <h2 className="text-fluid-2xl font-medium text-[var(--text-heading)]">{title}</h2>
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
