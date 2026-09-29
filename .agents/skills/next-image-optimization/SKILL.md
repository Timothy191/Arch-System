---
name: next-image-optimization
description: 'Next.js 16 Image Optimization runbook: <Image /> component implementation, CLS prevention, responsive sizing, remotePatterns security, and automated image audits.'
version: '1.0.0'
---

# Next.js 16 Image Optimization Runbook

**Governing Mandate:** All visual and content images in `apps/portal` and Next.js applications MUST utilize Next.js `<Image />` (`next/image`) to enforce zero Cumulative Layout Shift (CLS), modern AVIF/WebP formats, responsive delivery, and strict remote pattern validation.

---

## 1. Core Invariants & Rules

1. **Rule IMG-001 (Framework Mandate)**:
   - Always import and render `<Image />` from `'next/image'`.
   - Raw `<img>` elements are forbidden across application routes.
   - _Exception_: Root error boundary (`apps/portal/app/error.tsx`) is permitted to use lightweight SVG/img to maintain zero-JS bundle isolation during catastrophic runtime crashes.

2. **Rule IMG-002 (CLS Elimination)**:
   - Every `<Image />` MUST declare explicit intrinsic `width` and `height`, OR specify `fill` with a positioned parent (`relative`, `absolute`, `fixed`).
   - If using `fill`, the element MUST specify a responsive `sizes` attribute (e.g. `sizes="(max-width: 768px) 100vw, 50vw"`).

3. **Rule IMG-003 (Accessibility)**:
   - Every `<Image />` MUST have a meaningful `alt` attribute. Decorative backgrounds must use `alt=""` and `aria-hidden="true"`.

4. **Rule IMG-004 (Remote URL Security)**:
   - Remote image sources MUST strictly match `images.remotePatterns` declared in `apps/portal/next.config.mjs`.
   - Wildcard domains or unencrypted `http://` patterns are strictly forbidden to prevent SSRF vulnerabilities.

5. **Rule IMG-005 (Monorepo Boundary Invariant)**:
   - Pure UI packages (`packages/ui`) MUST NOT directly couple to `next/image`. Reusable components must accept render props/slots or unbundled primitives to maintain UI library portability.

---

## 2. Implementation Protocols & Code Recipes

### Protocol A: Local Static Images (Zero-CLS & Automatic Blur)

```tsx
import Image from 'next/image';
import avatarImg from '@/public/avatars/operator.png';

export function OperatorProfile() {
  return (
    <Image
      src={avatarImg}
      alt="Operator Profile"
      placeholder="blur"
      className="rounded-full ring-2 ring-arch-border"
    />
  );
}
```

### Protocol B: Dynamic Imports in Server Components

```tsx
import Image from 'next/image';

interface EquipmentCardProps {
  machineId: string;
  imageFilename: string;
}

export async function EquipmentImage({ machineId, imageFilename }: EquipmentCardProps) {
  // Static path prefix guarantees only valid assets are bundled
  const { default: imageObj } = await import(`@/public/images/machines/${imageFilename}`);

  return (
    <Image
      src={imageObj}
      alt={`Equipment ${machineId}`}
      placeholder="blur"
      className="object-cover rounded-xl"
    />
  );
}
```

### Protocol C: Responsive Hero & Full-Bleed Containers (`fill` & `sizes`)

```tsx
import Image from 'next/image';

export function DepartmentHero({ heroUrl, title }: { heroUrl: string; title: string }) {
  return (
    <div className="relative w-full h-64 md:h-96 overflow-hidden rounded-2xl">
      <Image
        src={heroUrl}
        alt={`${title} department hero banner`}
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 1200px"
        className="object-cover object-center filter brightness-105"
      />
    </div>
  );
}
```

---

## 3. Verification & Quality Gates

Before declaring any image-related changes complete:

```bash
# 1. Run the automated Image Optimization & CLS auditor
pnpm audit:images

# 2. Run full monorepo compliance
pnpm audit:compliance

# 3. Verify TypeScript strict checking
pnpm --filter portal type-check
```
