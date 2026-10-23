import { Shield } from 'lucide-react';
import type { Metadata } from 'next';
import type React from 'react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Arch OS',
  description: 'Privacy policy and data compliance for the Arch Portal.',
};

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
          <Shield className="h-8 w-8 text-[var(--text-heading)]" />
        </div>
        <h1 className="font-semibold text-3xl text-[var(--text-heading)]">Privacy Policy</h1>
      </div>

      <div className="prose prose-neutral max-w-none space-y-6 text-[var(--text-muted)]">
        <p className="text-lg">Last updated: September 2026</p>

        <section className="rounded-2xl border border-black/[0.08] bg-white/70 p-8 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-medium text-[var(--text-heading)] text-xl">
            1. Data Collection and Usage
          </h2>
          <p className="mb-4">
            The Arch Portal collects operational telemetry, user interaction data, and system
            performance metrics necessary to ensure the continuous and safe operation of mining
            facilities.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Authentication Data:</strong> Employee IDs, roles, and department affiliations
              to enforce access control (via Supabase RLS).
            </li>
            <li>
              <strong>Operational Telemetry:</strong> Machine status, fuel logs, and safety
              incidents entered by users.
            </li>
            <li>
              <strong>System Metrics:</strong> Client-side performance metrics to optimize dashboard
              responsiveness.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/70 p-8 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-medium text-[var(--text-heading)] text-xl">
            2. Cookies and Tracking
          </h2>
          <p>
            We use strictly necessary cookies to maintain your authenticated session. Optional
            cookies may be used to analyze system performance and improve the user interface. You
            can manage your preferences through the cookie consent banner.
          </p>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/70 p-8 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-medium text-[var(--text-heading)] text-xl">
            3. Data Security and Isolation
          </h2>
          <p>
            Data is strictly isolated by department. Personnel can only view and modify data
            relevant to their assigned department and role level. All data is transmitted over
            encrypted channels (HTTPS/WSS) and stored securely in our enterprise database.
          </p>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/70 p-8 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-medium text-[var(--text-heading)] text-xl">
            4. Compliance and Contact
          </h2>
          <p>
            This portal complies with internal IT security standards and applicable data protection
            regulations. For privacy-related inquiries, please contact the IT Security Department or
            your Shift Supervisor.
          </p>
        </section>
      </div>
    </div>
  );
}
