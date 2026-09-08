import React, { createContext, useContext, useState } from "react";
import {
  ChevronRight,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";

const TreeContext = createContext<{ level: number }>({ level: 0 });

export interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Tree({ className, children, ...props }: TreeProps) {
  return (
    <div className={cn("select-none text-sm", className)} {...props}>
      <TreeContext.Provider value={{ level: 0 }}>{children}</TreeContext.Provider>
    </div>
  );
}

export interface FolderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  name: string;
  defaultOpen?: boolean;
}

export function Folder({ name, defaultOpen = false, className, children, ...props }: FolderProps) {
  const { level } = useContext(TreeContext);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <div
        className="flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
        {isOpen ? (
          <FolderOpenIcon className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          <FolderIcon className="h-4 w-4 shrink-0 text-blue-500" />
        )}
        <span className="truncate">{name}</span>
      </div>
      {isOpen && (
        <TreeContext.Provider value={{ level: level + 1 }}>
          <div className="flex flex-col relative">
            <div
              className="absolute left-0 top-0 bottom-0 border-l border-border"
              style={{ left: `${level * 16 + 13}px` }}
            />
            {children}
          </div>
        </TreeContext.Provider>
      )}
    </div>
  );
}

export interface FileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  name: string;
  active?: boolean;
  icon?: React.ReactNode;
}

export function File({ name, active, icon, className, ...props }: FileProps) {
  const { level } = useContext(TreeContext);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors",
        active
          ? "bg-muted/50 text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      style={{ paddingLeft: `${level * 16 + 28}px` }}
      {...props}
    >
      {icon ? (
        <div className="h-4 w-4 shrink-0 flex items-center justify-center">{icon}</div>
      ) : (
        <FileIcon className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{name}</span>
    </div>
  );
}
