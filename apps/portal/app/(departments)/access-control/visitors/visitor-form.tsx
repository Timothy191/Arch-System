'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Loader2, Plus, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { registerVisitor } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-accent-cyan text-bg-secondary shadow-diffusion-cyan transition-all hover:bg-accent-cyan/90"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Registering...
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Register &amp; Issue Badge
        </>
      )}
    </Button>
  );
}

export function VisitorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    setError(null);
    try {
      const result = await registerVisitor(formData);
      if (result.success) {
        toast.success('Visitor registered successfully', {
          description: `${formData.get('first_name')} ${formData.get('surname')} has been checked in.`,
        });
        formRef.current?.reset();
      } else {
        setError('Failed to register visitor. Please try again.');
        toast.error('Registration failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      toast.error('An error occurred', {
        description: message,
      });
    }
  }

  return (
    <GlassCard>
      <div className="mb-6 flex items-center space-x-2">
        <div className="rounded-lg bg-[var(--accent-blue)]/10 p-2">
          <Users className="h-5 w-5 text-[var(--accent-blue)]" />
        </div>
        <h3 className="font-semibold text-[var(--text-heading)]">New Registration</h3>
      </div>

      <form ref={formRef} action={clientAction} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="first_name"
            className="block font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
          >
            First Name
          </label>
          <Input
            id="first_name"
            name="first_name"
            placeholder="John"
            required
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="surname"
            className="block font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
          >
            Surname
          </label>
          <Input
            id="surname"
            name="surname"
            placeholder="Doe"
            required
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="company"
            className="block font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
          >
            Company / Agency
          </label>
          <Input
            id="company"
            name="company"
            placeholder="Acme Corp"
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="block font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
          >
            Reason for Visit
          </label>
          <Input
            id="reason"
            name="reason"
            placeholder="Maintenance, Audit, etc."
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)]"
          />
        </div>

        {error && <p className="mt-2 font-medium text-red-500 text-xs">{error}</p>}

        <div className="pt-4">
          <SubmitButton />
        </div>
      </form>
    </GlassCard>
  );
}
