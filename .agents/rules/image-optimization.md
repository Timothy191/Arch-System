# Image Optimization

## 1. Always specify width + height or fill

- Source: <https://nextjs.org/docs/app/api-reference/components/image>
- Rule: Every `next/image` must have `width`+`height` or `fill` + sized parent to prevent CLS.

## 2. `sizes` attribute for responsive/fill images

- Source: <https://nextjs.org/docs/app/api-reference/components/image#sizes>
- Rule: Any `fill` image or responsive image must declare `sizes` matching the grid breakpoints.

## 3. `priority` for LCP image only

- Source: <https://nextjs.org/docs/app/api-reference/components/image#priority>
- Rule: Set `priority` on exactly the above-the-fold LCP image; never on more than one per route.

## 4. `placeholder="blur"` with blurDataURL

- Source: <https://nextjs.org/docs/app/api-reference/components/image#placeholder>
- Rule: Use `placeholder="blur"` with a small base64 `blurDataURL` (or static import) to reduce perceived LCP.

## 5. `fetchPriority="high"` for hero images

- Source: <https://web.dev/articles/fetch-priority>
- Rule: Add `fetchPriority="high"` to the LCP hero image to prioritize its download.
