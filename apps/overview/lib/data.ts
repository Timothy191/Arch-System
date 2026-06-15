// Departments data
export const DEPARTMENTS = [
  {
    id: "drilling",
    name: "Drilling",
    slug: "drilling",
    description: "Drilling operations and equipment management",
    color: "#3ecf8e",
    routes: [
      {
        path: "/drilling",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/drilling/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/drilling/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/drilling/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/drilling/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/drilling/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["drilling_operator", "supervisor", "admin"],
  },
  {
    id: "production",
    name: "Production",
    slug: "production",
    description: "Coal production and extraction operations",
    color: "#00c573",
    routes: [
      {
        path: "/production",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/production/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/production/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/production/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/production/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/production/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["production_operator", "supervisor", "admin"],
  },
  {
    id: "access-control",
    name: "Access Control",
    slug: "access-control",
    description: "Mine entry/exit and personnel tracking",
    color: "#60a5fa",
    routes: [
      {
        path: "/access-control",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/access-control/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/access-control/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/access-control/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/access-control/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/access-control/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["access_control_officer", "supervisor", "admin"],
  },
  {
    id: "engineering",
    name: "Engineering",
    slug: "engineering",
    description: "Technical support and maintenance planning",
    color: "#a78bfa",
    routes: [
      {
        path: "/engineering",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/engineering/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/engineering/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/engineering/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/engineering/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/engineering/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["engineer", "supervisor", "admin"],
  },
  {
    id: "control-room",
    name: "Control Room",
    slug: "control-room",
    description: "Central monitoring and alert management",
    color: "#007aff",
    routes: [
      {
        path: "/control-room",
        name: "Dashboard",
        description: "Alert panel and monitoring",
      },
      {
        path: "/control-room/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/control-room/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/control-room/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/control-room/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/control-room/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["control_room_operator", "admin"],
  },
  {
    id: "safety",
    name: "Safety",
    slug: "safety",
    description: "Safety compliance and incident reporting",
    color: "#ef4444",
    routes: [
      {
        path: "/safety",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/safety/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/safety/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/safety/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/safety/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/safety/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["safety_officer", "supervisor", "admin"],
  },
  {
    id: "training",
    name: "Training",
    slug: "training",
    description: "Employee training and certification",
    color: "#ec4899",
    routes: [
      {
        path: "/training",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/training/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/training/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/training/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/training/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/training/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["trainer", "supervisor", "admin"],
  },
];

// Navigation graph nodes and edges for XYFlow
const _NAVIGATION_GRAPH = {
  nodes: [
    // Root
    { id: "hub", type: "root", label: "Hub", x: 400, y: 50 },
    { id: "login", type: "auth", label: "Login", x: 100, y: 50 },

    // Departments
    {
      id: "drilling",
      type: "department",
      label: "Drilling",
      color: "#3ecf8e",
      x: 100,
      y: 200,
    },
    {
      id: "production",
      type: "department",
      label: "Production",
      color: "#00c573",
      x: 250,
      y: 200,
    },
    {
      id: "access-control",
      type: "department",
      label: "Access Control",
      color: "#60a5fa",
      x: 400,
      y: 200,
    },
    {
      id: "engineering",
      type: "department",
      label: "Engineering",
      color: "#a78bfa",
      x: 550,
      y: 200,
    },
    {
      id: "control-room",
      type: "department",
      label: "Control Room",
      color: "#007aff",
      x: 700,
      y: 200,
    },
    {
      id: "safety",
      type: "department",
      label: "Safety",
      color: "#ef4444",
      x: 850,
      y: 200,
    },
    {
      id: "training",
      type: "department",
      label: "Training",
      color: "#ec4899",
      x: 1000,
      y: 200,
    },

    // Admin
    { id: "admin", type: "admin", label: "Admin", x: 1150, y: 50 },
  ],
  edges: [
    // Hub connections
    { id: "e1", source: "hub", target: "drilling" },
    { id: "e2", source: "hub", target: "production" },
    { id: "e3", source: "hub", target: "access-control" },
    { id: "e4", source: "hub", target: "engineering" },
    { id: "e5", source: "hub", target: "control-room" },
    { id: "e6", source: "hub", target: "safety" },
    { id: "e7", source: "hub", target: "training" },

    // Auth
    { id: "e8", source: "login", target: "hub" },

    // Admin
    { id: "e9", source: "admin", target: "hub" },
  ],
};

// Tech stack data
export const TECH_STACK = [
  {
    category: "Frontend",
    color: "#3ecf8e",
    items: [
      {
        name: "Next.js 14",
        version: "14.2.8",
        description: "App Router, React Server Components",
      },
      {
        name: "React 18",
        version: "18.3.1",
        description: "Concurrent features, Suspense",
      },
      {
        name: "Tailwind CSS",
        version: "3.4.13",
        description: "Utility-first styling",
      },
      {
        name: "Framer Motion",
        version: "",
        description: "Animations and transitions",
      },
      { name: "Lucide React", version: "", description: "Icon library" },
    ],
  },
  {
    category: "Backend",
    color: "#60a5fa",
    items: [
      {
        name: "Supabase",
        version: "",
        description: "Auth, Postgres, Realtime",
      },
      {
        name: "PostgreSQL",
        version: "",
        description: "Primary database with RLS",
      },
      {
        name: "Row Level Security",
        version: "",
        description: "Per-row access control",
      },
    ],
  },
  {
    category: "DevOps",
    color: "#007aff",
    items: [
      {
        name: "pnpm",
        version: "",
        description: "Package manager with workspaces",
      },
      { name: "Turborepo", version: "", description: "Monorepo build system" },
      {
        name: "Docker",
        version: "",
        description: "Containerization for tools",
      },
      {
        name: "Node.js",
        version: "20.17.0+",
        description: "Runtime with Volta",
      },
    ],
  },
  {
    category: "Testing",
    color: "#ec4899",
    items: [
      { name: "Jest", version: "", description: "Unit testing with ts-jest" },
      {
        name: "Playwright",
        version: "1.56.1",
        description: "E2E browser testing",
      },
    ],
  },
  {
    category: "Integration Tools",
    color: "#a78bfa",
    items: [
      { name: "n8n", version: "", description: "Workflow automation (iframe)" },
      {
        name: "Flowise",
        version: "",
        description: "LLM workflow builder (iframe)",
      },
    ],
  },
];

// Database schema
export const DATABASE_SCHEMA = [
  {
    name: "departments",
    rls: true,
    columns: ["id (UUID PK)", "name (text)", "slug (text)", "created_at"],
    description: "7 departments (drilling, production, etc.)",
  },
  {
    name: "employees",
    rls: true,
    columns: [
      "id (UUID PK)",
      "auth_id (FK)",
      "department_id (FK)",
      "full_name",
      "role",
      "created_at",
    ],
    description: "Linked to auth.users via trigger",
  },
  {
    name: "machines",
    rls: true,
    columns: [
      "id (UUID PK)",
      "department_id (FK)",
      "name",
      "type",
      "status",
      "created_at",
    ],
    description: "Per-department equipment",
  },
  {
    name: "daily_logs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "department_id (FK)",
      "shift",
      "date",
      "notes",
      "created_by",
      "created_at",
    ],
    description: "Append-only (no DELETE policies)",
  },
  {
    name: "machine_hours",
    rls: true,
    columns: [
      "id (UUID PK)",
      "daily_log_id (FK)",
      "machine_id (FK)",
      "hours",
      "created_at",
    ],
    description: "Child of daily_logs",
  },
  {
    name: "fuel_logs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "daily_log_id (FK)",
      "machine_id (FK)",
      "liters",
      "created_at",
    ],
    description: "Fuel consumption records",
  },
  {
    name: "production_logs",
    rls: true,
    columns: ["id (UUID PK)", "daily_log_id (FK)", "tons", "created_at"],
    description: "Production output records",
  },
];

const _DB_RELATIONSHIPS = [
  { from: "employees", to: "departments", type: "many-to-one" },
  { from: "machines", to: "departments", type: "many-to-one" },
  { from: "daily_logs", to: "departments", type: "many-to-one" },
  { from: "machine_hours", to: "daily_logs", type: "many-to-one" },
  { from: "machine_hours", to: "machines", type: "many-to-one" },
  { from: "fuel_logs", to: "daily_logs", type: "many-to-one" },
  { from: "fuel_logs", to: "machines", type: "many-to-one" },
  { from: "production_logs", to: "daily_logs", type: "many-to-one" },
];
