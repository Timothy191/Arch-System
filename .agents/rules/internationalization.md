# Internationalization

## 1. Single locale (en-US); i18n routing not adopted

- Source: <https://nextjs.org/docs/app/guides/internationalization>
- Rule: `apps/portal` is single-locale (`lang="en"`, Open Graph `locale: "en_GB"`). Internationalized routing (`[lang]` segments, sub-path or domain) is not adopted; no new route segment may introduce a locale parameter.

## 2. If i18n is adopted, use [lang] + next/root-params

- Source: <https://nextjs.org/docs/app/guides/internationalization>
- Rule: Future i18n adoption nests all special files under `app/[lang]`, reads the locale via `next/root-params` (`lang()` getter), narrows with a `hasLocale` guard (404 on unknown locale), and prerenders locales via `generateStaticParams()` in the root layout.

## 3. Locale selection via Accept-Language + proxy.ts redirect

- Source: <https://nextjs.org/docs/app/guides/internationalization>
- Rule: When adopted, the preferred locale is read from the `Accept-Language` header (e.g. `negotiator` / `@formatjs/intl-localematcher`) and `server/proxy.ts` redirects pathless requests to `/${locale}${pathname}`, skipping `_next` internals.
