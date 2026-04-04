# Simplified Chinese UI Support Design

Date: 2026-04-04
Status: Approved for planning
Scope: Authenticated app UI, built-in labels, and CSV import/export behavior

## Summary

Add user-selectable Simplified Chinese (`zh-CN`) alongside English (`en`) through a central locale layer with shared label helpers. When the UI is in Chinese, the app chrome, authenticated product UI, and exported CSV column headers should render in Chinese automatically.

This change should not overwrite user-customized names. System-defined fields, categories, and projects should translate by locale only while they remain marked as default-owned records. User-created records and user-renamed built-ins should keep their stored names regardless of locale.

## Goals

- Let each user choose between English and Simplified Chinese.
- Translate the authenticated product UI without introducing route-based locale segments.
- Export CSV column headers in the active UI language.
- Import CSV files exported in either English or Simplified Chinese without requiring manual remapping for standard fields.
- Preserve user customizations to names for fields, categories, and projects.

## Non-Goals

- Translating public docs, legal pages, or landing-page marketing content in this phase.
- Adding Traditional Chinese in this phase.
- Rewriting routing to use locale-prefixed paths.
- Translating arbitrary user-entered content such as custom field names, category names, project names, notes, merchant names, or transaction text.

## Constraints In The Current Codebase

- The app currently has no general i18n layer.
- UI strings are mostly hard-coded in components and pages.
- Built-in fields, categories, projects, and settings are seeded into each user's database records.
- CSV export headers are derived from field display names.
- Built-in records are editable, so locale-aware display cannot safely infer ownership from the current stored name alone.

## Proposed Architecture

### Locale Storage

Add a new setting:

- `ui_language`: `en | zh-CN`

Default:

- Existing users without the setting fall back to `en`.
- New users receive `ui_language = en` through default settings.
- The selected locale is also mirrored into a cookie so the root layout can set the HTML `lang` attribute without requiring an authenticated settings lookup on every request.

### Central Locale Layer

Add a lightweight i18n module under `lib/i18n/` with:

- `locales.ts`
  - supported locales
  - default locale
  - locale validation helpers
- `messages/en.ts`
- `messages/zh-CN.ts`
- `index.ts`
  - `t(locale, key, params?)`
  - message fallback to English
- `provider.tsx`
  - client-side locale context and `useLocale` / `useT` hooks
- `server.ts`
  - server helpers to read the active locale from settings and build translators for server components and route handlers

The system should remain intentionally simple: dictionary lookup by stable keys, with English fallback for missing keys.

### Shared Display-Label Helpers

Add shared helpers for system-defined labels:

- `getFieldDisplayName(field, locale)`
- `getCategoryDisplayName(category, locale)`
- `getProjectDisplayName(project, locale)`

These helpers should:

- translate only system-default records
- return stored names for custom or user-overridden records
- use stable `code` values for lookup

This keeps UI and CSV export behavior consistent by reusing the same display logic everywhere.

### Distinguishing Default Vs Custom Names

Add a `nameSource` field to:

- `Field`
- `Category`
- `Project`

Allowed values:

- `default`
- `custom`

Behavior:

- seeded built-ins are created with `nameSource = default`
- user-created records are created with `nameSource = custom`
- if a user renames a built-in record, it becomes `custom`
- translated display names apply only to `default` records

This explicit metadata avoids brittle inference and prevents locale switches from overwriting user intent.

## Data Model Changes

### Prisma Schema

Add `nameSource String @default("custom")` to:

- `Field`
- `Category`
- `Project`

Use a string field in the initial rollout to match the existing schema style. Converting this to a Prisma enum is out of scope for this change.

### Default Seeds

Update `createUserDefaults` and reset flows so built-in records are created or restored with:

- `nameSource = default`

User-created records continue to use:

- `nameSource = custom`

## Migration Strategy

Add a Prisma migration and a data backfill step.

Backfill rules:

1. For each existing `Field`, `Category`, and `Project`, check whether its `code` matches a known built-in code.
2. If the code is not a built-in code, set `nameSource = custom`.
3. If the code is a built-in code and the stored `name` still matches the current seeded English default for that code, set `nameSource = default`.
4. Otherwise set `nameSource = custom`.

This heuristic is conservative by design. It preserves user edits even if that means some historical built-ins remain English after locale switching.

## Rendering Model

### Server-Side

- Read `ui_language` from settings in authenticated layouts and pages.
- Validate against supported locales and fall back to `en`.
- Mirror the resolved locale into a cookie used by the root layout.
- Provide the active locale and translator to child components.
- Set the root HTML `lang` attribute from the cookie-backed resolved locale, with `en` as the public-page fallback.

### Client-Side

- Expose locale and translation helpers through a provider.
- Replace hard-coded UI strings in client components with dictionary-backed lookups.
- Use shared display helpers in forms, tables, dialogs, and export/import flows.

### Coverage For This Phase

Translate authenticated app surfaces in this rollout order:

1. app chrome and navigation
2. transactions list/detail/create/edit flows
3. settings pages
4. import/export flows
5. remaining authenticated app screens

Public landing/docs/legal content remains out of scope for this change.

## CSV Export Design

Current behavior already derives headers from field names. Replace direct usage of stored field names with the shared field display helper.

Rules:

- If UI language is `en`, built-in field headers export in English.
- If UI language is `zh-CN`, built-in field headers export in Simplified Chinese.
- Custom fields always export using their stored names.
- User-renamed built-in fields export using their stored customized names.

This ensures export behavior matches what the user sees in the UI.

## CSV Import Design

CSV import auto-mapping should recognize, in this order:

1. exact field `code`
2. stored field `name`
3. built-in English display name
4. built-in Simplified Chinese display name

Behavior:

- Standard fields exported in either English or Chinese should map automatically.
- Custom fields continue to map by stored name or code only.
- Ambiguous or unknown headers should remain unmapped rather than guessed.

This keeps English and Chinese exports round-trippable.

## Settings UI Design

Add a language selector to global settings:

- label in English UI: `Language`
- label in Chinese UI: `语言`
- options:
  - `English`
  - `简体中文`

Saving the setting should:

- persist `ui_language`
- update the locale cookie
- revalidate affected app routes
- update locale context on the next render

## Translation Content Strategy

Use stable translation keys for:

- navigation labels
- buttons
- dialog titles and descriptions
- form labels and placeholders
- table headings and summary labels
- import/export status text
- notifications and banner text

Use system-label dictionaries keyed by record code for:

- built-in fields
- built-in categories
- built-in default project

Do not translate:

- user-entered names
- freeform prompts
- AI output
- transaction content

## Error Handling And Fallbacks

- Unsupported locale values fall back to `en`.
- Missing translation keys fall back to English.
- Missing system-label translations fall back to stored names.
- CSV import leaves unmatched columns unmapped.
- Locale changes must never mutate stored names.

## Testing Strategy

### Unit Tests

- locale validation and fallback behavior
- `t(locale, key)` English fallback behavior
- field/category/project display helpers:
  - default-owned built-in item translates
  - custom item keeps stored name
  - renamed built-in item keeps stored name
- CSV import header matching for:
  - field code
  - English built-in label
  - Simplified Chinese built-in label

### Integration Tests

- settings action persists `ui_language`
- authenticated layouts resolve and expose locale correctly
- CSV export route writes English headers for `en`
- CSV export route writes Chinese headers for `zh-CN`

### UI Smoke Coverage

- sidebar and navigation labels switch languages
- export dialog text switches languages
- transactions table built-in headings switch languages
- custom names remain unchanged across locale switches

## Rollout Plan

1. Add schema support for `nameSource` and `ui_language`.
2. Add locale infrastructure and dictionaries.
3. Add shared display-label helpers.
4. Wire locale resolution into layouts and settings.
5. Convert app chrome and high-traffic screens to the locale layer.
6. Update CSV export/import to use locale-aware helpers.
7. Add tests for fallback, label ownership, and CSV round-tripping.

## Risks And Mitigations

### Risk: misclassifying historical built-ins as default-owned

Mitigation:

- use conservative backfill rules
- only mark built-in rows as `default` when the stored name still matches the seeded English default

### Risk: incomplete translation coverage causing mixed-language UI

Mitigation:

- central English fallback
- translate shared chrome and high-traffic flows first

### Risk: locale logic duplicated between UI and CSV

Mitigation:

- use shared display helpers for both rendering and export/import mapping

### Risk: user confusion if built-in renamed items stop translating

Mitigation:

- this is intentional and consistent with preserving user ownership
- the behavior should be documented in the settings or release notes if needed

## Acceptance Criteria

- Users can switch between English and Simplified Chinese from settings.
- Authenticated product UI renders in the selected locale for translated surfaces.
- Exported CSV headers follow the active UI language for built-in fields.
- Chinese-exported CSV files auto-map correctly on re-import.
- Custom names and user-renamed built-ins remain unchanged when switching locale.
- Missing translation coverage degrades to English rather than breaking rendering.
