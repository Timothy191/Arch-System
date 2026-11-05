# JSON-LD

## 1. Render JSON-LD as a native <script type="application/ld+json"> tag

- Source: <https://nextjs.org/docs/app/guides/json-ld>
- Rule: Structured data is rendered as `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />` in a Server Component `layout` or `page`. The `next/script` component is not used because JSON-LD is data, not executable code.

## 2. Sanitize to prevent XSS

- Source: <https://nextjs.org/docs/app/guides/json-ld>
- Rule: `JSON.stringify` output is scrubbed by replacing `<` with `\u003c` (or via `serialize-javascript`) before injection, since raw `JSON.stringify` does not sanitize malicious strings.

## 3. Type with schema-dts

- Source: <https://nextjs.org/docs/app/guides/json-ld>
- Rule: TypeScript JSON-LD payloads are typed with `schema-dts` (e.g. `WithContext<Product>`) rather than untyped objects.

## 4. Validate structured data

- Source: <https://nextjs.org/docs/app/guides/json-ld>
- Rule: Published JSON-LD is validated with Google's Rich Results Test or the Schema Markup Validator before deployment.
