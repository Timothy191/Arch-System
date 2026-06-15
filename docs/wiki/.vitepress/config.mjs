import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Arch-Systems Wiki',
  description: 'Knowledge base for the Plantcor mining operations portal',
  
  // Use / as base since we'll deploy to root
  base: '/',
  
  // Clean URLs without .html
  cleanUrls: true,
  
  // Appearance
  appearance: 'dark',
  
  // Head tags
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3ecf8e' }],
  ],
  
  // Theme configuration
  themeConfig: {
    // Logo
    logo: '/logo.svg',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Reference', link: '/quick-reference' },
      { text: 'v1.5.1', link: '/entities/arch-systems' },
    ],
    
    // Sidebar
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Quick Reference', link: '/quick-reference' },
            { text: 'Onboarding', link: '/concepts/onboarding' },
          ]
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'Architecture Overview', link: '/entities/arch-systems' },
            { text: 'Monorepo Structure', link: '/concepts/turborepo-monorepo' },
            { text: 'Portal App Architecture', link: '/concepts/portal-app-architecture' },
            { text: 'Design System', link: '/concepts/design-system' },
          ]
        },
        {
          text: 'Database & Auth',
          collapsed: false,
          items: [
            { text: 'Database Schema', link: '/concepts/database-schema' },
            { text: 'RLS Policies', link: '/concepts/rls-policy' },
            { text: 'Auth & Middleware', link: '/concepts/auth-middleware' },
            { text: 'Supabase Local Dev', link: '/concepts/supabase-local-dev' },
          ]
        },
        {
          text: 'Features',
          collapsed: false,
          items: [
            { text: 'Department Features', link: '/concepts/department-features' },
            { text: 'AI Service', link: '/concepts/ai-service' },
            { text: 'External Tools', link: '/concepts/external-tools' },
            { text: 'Monitoring', link: '/concepts/monitoring-error-tracking' },
          ]
        },
        {
          text: 'Architecture Decisions',
          collapsed: true,
          items: [
            { text: 'ADR-001: Next.js App Router', link: '/concepts/adr-001-nextjs-app-router' },
            { text: 'ADR-002: Supabase Backend', link: '/concepts/adr-002-supabase-backend' },
            { text: 'ADR-003: Turborepo', link: '/concepts/adr-003-turborepo-monorepo' },
            { text: 'ADR-004: Tailwind Design', link: '/concepts/adr-004-tailwind-design-system' },
            { text: 'ADR-005: Zustand State', link: '/concepts/adr-005-zustand-state-management' },
            { text: 'ADR-006: Multi-Provider AI', link: '/concepts/adr-006-multi-provider-ai' },
            { text: 'ADR-007: React 19', link: '/concepts/adr-007-react-19-adoption' },
          ]
        },
        {
          text: 'Comparisons',
          collapsed: true,
          items: [
            { text: 'AI Providers', link: '/comparisons/ai-providers' },
            { text: 'Testing Frameworks', link: '/comparisons/testing-frameworks' },
            { text: 'State Management', link: '/comparisons/state-management' },
            { text: 'Rich Text Editors', link: '/comparisons/rich-text-editors' },
            { text: 'Monorepo Tools', link: '/comparisons/monorepo-tools' },
            { text: 'Database/Backend', link: '/comparisons/database-backend' },
            { text: 'Map Libraries', link: '/comparisons/map-libraries' },
            { text: 'Styling Approaches', link: '/comparisons/styling-approaches' },
            { text: 'React Patterns', link: '/comparisons/react-patterns' },
            { text: 'Animation Libraries', link: '/comparisons/animation-libraries' },
          ]
        },
        {
          text: 'How-To Guides',
          collapsed: false,
          items: [
            { text: 'Add a Department', link: '/queries/how-to-add-department' },
            { text: 'Fetch Data', link: '/queries/how-to-fetch-data' },
            { text: 'Deploy to Production', link: '/queries/how-to-deploy-production' },
            { text: 'Debug Issues', link: '/queries/how-to-debug-issues' },
            { text: 'How Auth Works', link: '/queries/how-does-auth-work' },
            { text: 'Fix Empty Queries', link: '/queries/why-query-returns-empty' },
          ]
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Troubleshooting', link: '/concepts/troubleshooting' },
            { text: 'Deployment', link: '/concepts/deployment' },
            { text: 'Incident Response', link: '/concepts/incident-response' },
          ]
        },
      ],
    },
    
    // Search
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },
    
    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template' },
    ],
    
    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Arch-Systems (Plantcor)',
    },
    
    // Edit link
    editLink: {
      pattern: 'https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/edit/main/wiki/:path',
      text: 'Edit this page on GitHub',
    },
    
    // Last updated
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short',
      },
    },
    
    // Outline (right sidebar)
    outline: {
      level: 'deep',
      label: 'On this page',
    },
  },
  
  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
    config: (md) => {
      // Add Mermaid support if needed
      // md.use(require('markdown-it-mermaid'))
    },
  },
  
  // Vite configuration
  vite: {
    server: {
      port: 5173,
    },
  },
})
