'use client';

import { LoginForm as BaseLoginForm } from '@repo/auth/ui';
import { VisitorQrBadge } from './VisitorQrBadge';

export function LoginForm() {
  return <BaseLoginForm renderQrCode={(qrCode) => <VisitorQrBadge qrCode={qrCode} />} />;
}
