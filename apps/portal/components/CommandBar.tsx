'use client';

import { getServiceUrls } from '@repo/ui/lib/urls';
import { cn } from '@repo/ui/lib/utils';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logout } from '~/app/actions';

const urls = getServiceUrls();

import {
  Activity,
  Bot,
  Factory,
  LayoutDashboard,
  LogOut,
  Monitor,
  Pickaxe,
  Search,
  Settings,
  ShieldCheck,
  User,
  Wrench,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  href?: string;
  action?: () => void;
  category: string;
  icon?: React.ReactNode;
}

const DEPARTMENT_COMMANDS: CommandItem[] = [
  {
    id: 'dept-overview',
    label: 'System Overview',
    href: '/overview',
    category: 'Departments',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'dept-drilling',
    label: 'Drilling Operations',
    href: '/drilling',
    category: 'Departments',
    icon: <Pickaxe className="h-4 w-4" />,
  },
  {
    id: 'dept-production',
    label: 'Production',
    href: '/production',
    category: 'Departments',
    icon: <Factory className="h-4 w-4" />,
  },
  {
    id: 'dept-control',
    label: 'Control Room',
    href: '/control-room',
    category: 'Departments',
    icon: <Monitor className="h-4 w-4" />,
  },
  {
    id: 'dept-engineering',
    label: 'Engineering',
    href: '/engineering',
    category: 'Departments',
    icon: <Wrench className="h-4 w-4" />,
  },
  {
    id: 'dept-access',
    label: 'Access Control',
    href: '/access-control',
    category: 'Departments',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: 'dept-admin',
    label: 'Admin Management',
    href: '/admin',
    category: 'Departments',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

const NAV_COMMANDS: CommandItem[] = [
  {
    id: 'nav-hub',
    label: 'Hub Dashboard',
    href: '/',
    category: 'Navigation',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    id: 'nav-profile',
    label: 'Profile',
    href: '/admin',
    category: 'Navigation',
    icon: <User className="h-4 w-4" />,
  },
  {
    id: 'nav-settings',
    label: 'Settings',
    href: '/admin',
    category: 'Navigation',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: 'nav-logout',
    label: 'Log Out',
    action: () => {
      // eslint-disable-next-line no-console
      logout().catch(console.error);
    },
    category: 'Navigation',
    icon: <LogOut className="h-4 w-4" />,
  },
];

const TOOLS_COMMANDS: CommandItem[] = [
  {
    id: 'tool-flowise',
    label: 'Flowise',
    href: `${urls.portal}`,
    category: 'Tools',
    icon: <Bot className="h-4 w-4" />,
  },
];

const ALL_COMMANDS = [...DEPARTMENT_COMMANDS, ...NAV_COMMANDS, ...TOOLS_COMMANDS];

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // BOLT-OPTIMIZATION: Memoize filtered items, category grouping, flatList, and itemIndexMap.
  // Prevents re-executing array filtering, reduce grouping, and linear indexOf searches on every render.
  const { grouped, flatList, itemIndexMap } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? ALL_COMMANDS.filter((cmd) => cmd.label.toLowerCase().includes(q))
      : ALL_COMMANDS;

    const grouped: Record<string, CommandItem[]> = {};
    for (let i = 0; i < filtered.length; i++) {
      const cmd = filtered[i]!;
      const list = (grouped[cmd.category] ??= []);
      list.push(cmd);
    }

    const flatList = Object.values(grouped).flat();
    const itemIndexMap = new Map<string, number>();
    for (let i = 0; i < flatList.length; i++) {
      const item = flatList[i]!;
      itemIndexMap.set(item.id, i);
    }

    return { grouped, flatList, itemIndexMap };
  }, [query]);

  // BOLT-OPTIMIZATION: Store refs for rapidly changing state so the keydown event listener closure
  // accesses fresh state without re-registering window event listeners on every arrow keypress.
  const flatListRef = useRef(flatList);
  flatListRef.current = flatList;

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery('');
      if (item.href) {
        if (item.href.startsWith('http')) {
          window.open(item.href, '_blank', 'noopener,noreferrer');
        } else {
          router.push(item.href);
        }
      }
      if (item.action) item.action();
    },
    [router]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // BOLT-OPTIMIZATION: Stable keydown listener attached only when open state changes.
  // Prevents event listener teardown and re-registration on every arrow key state change.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const list = flatListRef.current;
      if (list.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % list.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + list.length) % list.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = list[selectedIndexRef.current];
        if (item) handleSelect(item);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleSelect]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-overlay flex items-start justify-center pt-[20vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="liquid-glass-light relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 shadow-window">
        {/* Search input */}
        <div className="flex items-center gap-3 border-white/10 border-b bg-transparent px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-arch-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search departments, tools, or pages..."
            className="flex-1 bg-transparent text-arch-text-primary text-sm outline-none placeholder:text-arch-text-tertiary"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-arch-text-tertiary transition-colors hover:bg-arch-surface-tertiary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-arch-text-tertiary text-sm">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 font-bold text-[10px] text-arch-text-tertiary uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => {
                  const globalIndex = itemIndexMap.get(item.id) ?? 0;
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-arch-accent-blue/10 text-arch-accent-blue'
                          : 'text-arch-text-secondary hover:bg-arch-surface-tertiary'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0',
                          isSelected ? 'text-arch-accent-blue' : 'text-arch-text-tertiary'
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 font-medium text-sm">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="rounded bg-arch-surface-tertiary px-1.5 py-0.5 font-mono text-[10px] text-arch-text-tertiary">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-arch-border-subtle border-t px-4 py-2 text-[10px] text-arch-text-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-arch-surface-tertiary px-1 font-mono">↑</kbd>
            <kbd className="rounded bg-arch-surface-tertiary px-1 font-mono">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-arch-surface-tertiary px-1 font-mono">Enter</kbd>
            to select
          </span>
        </div>
      </div>
    </div>
  );
}
