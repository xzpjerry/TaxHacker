# Chinese UI Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-selectable Simplified Chinese across the authenticated app and make CSV headers locale-aware without overwriting user-customized labels.

**Architecture:** Introduce a small i18n layer plus shared system-label helpers backed by pure default-entity definitions. Persist the locale in settings and a cookie, add `nameSource` metadata to preserve user overrides, and localize UI and CSV flows through shared display helpers instead of scattered hard-coded labels.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Zod, Node test runner

---

## Planned File Structure

- Create: `lib/default-entities.ts`
  - Pure built-in field/category/project definitions and localized label dictionaries that are safe to import from client and server code.
- Create: `lib/i18n/locales.ts`
  - Supported locales, fallback logic, locale validation, and translation key types.
- Create: `lib/i18n/messages/en.ts`
  - English UI message dictionary.
- Create: `lib/i18n/messages/zh-CN.ts`
  - Simplified Chinese UI message dictionary.
- Create: `lib/i18n/index.ts`
  - `t()` translator and locale resolution exports.
- Create: `lib/i18n/system-labels.ts`
  - Shared helpers for built-in field/category/project display names and edit normalization.
- Create: `lib/i18n/server.ts`
  - Server helpers for reading user locale and building translators in server components and routes.
- Create: `lib/i18n/provider.tsx`
  - Client locale context and `useT` / `useLocale` hooks.
- Create: `components/i18n/locale-cookie-sync.tsx`
  - Client cookie sync so root layout can set `lang` consistently on subsequent requests.
- Create: `lib/i18n/index.test.ts`
  - Locale resolution, translations, built-in display behavior, and normalized name submission tests.
- Create: `models/export_and_import.test.ts`
  - CSV header auto-mapping tests for English and Chinese labels.
- Create: `scripts/backfill-name-source.ts`
  - One-off backfill that marks untouched built-in fields, categories, and projects as `nameSource = "default"`.
- Modify: `prisma/schema.prisma`
  - Add `nameSource` to `Field`, `Category`, and `Project`.
- Modify: `forms/settings.ts`
  - Accept `ui_language`.
- Modify: `models/defaults.ts`
  - Source built-in data from `lib/default-entities.ts`, seed `ui_language`, and seed `nameSource`.
- Modify: `models/settings.ts`
  - Expose `getUiLanguage()` and thread locale-aware settings helpers.
- Modify: `models/fields.ts`
  - Preserve `nameSource` on create and update.
- Modify: `models/categories.ts`
  - Preserve `nameSource` on create and update.
- Modify: `models/projects.ts`
  - Preserve `nameSource` on create and update.
- Modify: `models/export_and_import.ts`
  - Export `resolveImportFieldCode()` and use localized field labels.
- Modify: `app/layout.tsx`
  - Read locale cookie and set `<html lang>`.
- Modify: `app/(app)/layout.tsx`
  - Resolve user locale from settings and wrap the authenticated app in the locale provider.
- Modify: `app/(app)/settings/actions.ts`
  - Persist `ui_language`, set locale cookie, and normalize built-in edited names.
- Modify: `app/(app)/settings/danger/actions.ts`
  - Reset built-ins with `nameSource = "default"`.
- Modify: `components/settings/global-settings-form.tsx`
  - Add language selector and translate settings labels.
- Modify: `components/settings/crud.tsx`
  - Support translated display values separately from editable stored names.
- Modify: `components/sidebar/sidebar.tsx`
  - Translate authenticated navigation.
- Modify: `app/(app)/settings/layout.tsx`
  - Translate the settings shell and side-nav entries.
- Modify: `app/(app)/settings/categories/page.tsx`
  - Translate labels and display built-in names through shared helpers.
- Modify: `app/(app)/settings/fields/page.tsx`
  - Translate labels and display built-in field names through shared helpers.
- Modify: `app/(app)/settings/projects/page.tsx`
  - Translate labels and display built-in project names through shared helpers.
- Modify: `app/(app)/settings/currencies/page.tsx`
  - Translate labels and descriptions.
- Modify: `components/settings/profile-settings-form.tsx`
  - Translate labels and action text.
- Modify: `components/settings/business-settings-form.tsx`
  - Translate labels and placeholders.
- Modify: `components/settings/llm-settings-form.tsx`
  - Translate form labels and helper text.
- Modify: `components/forms/select-category.tsx`
  - Show localized built-in category names.
- Modify: `components/forms/select-project.tsx`
  - Show localized built-in project names.
- Modify: `components/forms/select-type.tsx`
  - Translate transaction type option labels.
- Modify: `components/transactions/list.tsx`
  - Use locale-aware field labels and translate totals summary text.
- Modify: `components/transactions/edit.tsx`
  - Translate action text and use locale-aware field labels.
- Modify: `components/transactions/filters.tsx`
  - Translate filter placeholders and action titles.
- Modify: `components/transactions/new.tsx`
  - Translate new transaction dialog strings.
- Modify: `app/(app)/transactions/page.tsx`
  - Translate the transactions page shell.
- Modify: `app/(app)/transactions/[transactionId]/page.tsx`
  - Translate incomplete-field and recognized-text copy.
- Modify: `components/export/transactions.tsx`
  - Translate the export dialog and use localized field labels.
- Modify: `components/import/csv.tsx`
  - Auto-map Chinese headers and translate import UI copy.
- Modify: `app/(app)/export/transactions/route.ts`
  - Write CSV headers in the active UI locale.

## Preflight

- [ ] Create a dedicated worktree before implementing the tasks below.

```bash
git worktree add ../TaxHacker-chinese-ui -b codex/chinese-ui-support main
cd ../TaxHacker-chinese-ui
```

Expected: a clean worktree on branch `codex/chinese-ui-support`.

### Task 1: Add failing tests for locale lookup and CSV header matching

**Files:**
- Create: `lib/i18n/index.test.ts`
- Create: `models/export_and_import.test.ts`

- [ ] **Step 1: Write the failing locale and label tests**

```ts
import test from "node:test"
import assert from "node:assert/strict"

import { resolveLocale, t } from "./index"
import { getCategoryDisplayName, getFieldDisplayName, normalizeSystemNameSubmission } from "./system-labels"

test("falls back to english for unsupported locales", () => {
  assert.equal(resolveLocale(undefined), "en")
  assert.equal(resolveLocale("fr-FR"), "en")
  assert.equal(resolveLocale("zh-CN"), "zh-CN")
})

test("returns translated chrome labels", () => {
  assert.equal(t("zh-CN", "nav.transactions"), "交易")
  assert.equal(t("en", "settings.general.language"), "Language")
})

test("translates only default-owned field labels", () => {
  assert.equal(getFieldDisplayName({ code: "name", name: "Name", nameSource: "default" }, "zh-CN"), "名称")
  assert.equal(
    getFieldDisplayName({ code: "name", name: "Client Label", nameSource: "custom" }, "zh-CN"),
    "Client Label"
  )
})

test("normalizes unchanged localized built-in names back to the default english seed", () => {
  assert.deepEqual(normalizeSystemNameSubmission("field", "name", "名称"), {
    name: "Name",
    nameSource: "default",
  })
  assert.deepEqual(normalizeSystemNameSubmission("field", "name", "Client Name"), {
    name: "Client Name",
    nameSource: "custom",
  })
})

test("translates default-owned categories while preserving custom categories", () => {
  assert.equal(
    getCategoryDisplayName({ code: "travel", name: "Travel Expenses", nameSource: "default" }, "zh-CN"),
    "差旅支出"
  )
  assert.equal(
    getCategoryDisplayName({ code: "travel", name: "Trips", nameSource: "custom" }, "zh-CN"),
    "Trips"
  )
})
```

```ts
import test from "node:test"
import assert from "node:assert/strict"

import { resolveImportFieldCode } from "./export_and_import"

const fields = [
  { code: "name", name: "Name", nameSource: "default" },
  { code: "merchant", name: "Merchant", nameSource: "default" },
  { code: "client_tag", name: "客户标签", nameSource: "custom" },
] as const

test("matches english and chinese builtin headers", () => {
  assert.equal(resolveImportFieldCode(fields, "Name"), "name")
  assert.equal(resolveImportFieldCode(fields, "名称"), "name")
  assert.equal(resolveImportFieldCode(fields, "商家"), "merchant")
})

test("matches stored custom names before localized built-in labels", () => {
  assert.equal(resolveImportFieldCode(fields, "客户标签"), "client_tag")
})

test("returns an empty mapping for unknown headers", () => {
  assert.equal(resolveImportFieldCode(fields, "Totally Unknown"), "")
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test lib/i18n/index.test.ts models/export_and_import.test.ts`
Expected: FAIL with import errors because the i18n modules and `resolveImportFieldCode()` do not exist yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add lib/i18n/index.test.ts models/export_and_import.test.ts
git commit -m "test: add Chinese locale coverage"
```

### Task 2: Implement locale primitives and CSV header helpers

**Files:**
- Create: `lib/default-entities.ts`
- Create: `lib/i18n/locales.ts`
- Create: `lib/i18n/messages/en.ts`
- Create: `lib/i18n/messages/zh-CN.ts`
- Create: `lib/i18n/index.ts`
- Create: `lib/i18n/system-labels.ts`
- Modify: `models/defaults.ts`
- Modify: `models/export_and_import.ts`

- [ ] **Step 1: Create pure locale and built-in label definitions**

```ts
export const DEFAULT_PROJECTS = [
  { code: "personal", name: "Personal", zhCNName: "个人", llm_prompt: "personal", color: "#1e202b" },
] as const

export const DEFAULT_CATEGORIES = [
  { code: "travel", name: "Travel Expenses", zhCNName: "差旅支出", color: "#fb9062", llm_prompt: "travel, accommodation, etc" },
  { code: "other", name: "Other", zhCNName: "其他", color: "#121216", llm_prompt: "other, miscellaneous" },
] as const

export const DEFAULT_FIELDS = [
  { code: "name", name: "Name", zhCNName: "名称", type: "string", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: true },
  { code: "merchant", name: "Merchant", zhCNName: "商家", type: "string", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: false },
  { code: "categoryCode", name: "Category", zhCNName: "分类", type: "string", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: false },
  { code: "projectCode", name: "Project", zhCNName: "项目", type: "string", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: false },
  { code: "issuedAt", name: "Issued At", zhCNName: "开具日期", type: "string", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: true },
  { code: "total", name: "Total", zhCNName: "金额", type: "number", isExtra: false, isVisibleInList: true, isVisibleInAnalysis: true, isRequired: true },
  { code: "currencyCode", name: "Currency", zhCNName: "币种", type: "string", isExtra: false, isVisibleInList: false, isVisibleInAnalysis: true, isRequired: false },
  { code: "convertedTotal", name: "Converted Total", zhCNName: "换算金额", type: "number", isExtra: false, isVisibleInList: false, isVisibleInAnalysis: false, isRequired: false },
  { code: "convertedCurrencyCode", name: "Converted Currency Code", zhCNName: "换算币种", type: "string", isExtra: false, isVisibleInList: false, isVisibleInAnalysis: false, isRequired: false },
  { code: "type", name: "Type", zhCNName: "类型", type: "string", isExtra: false, isVisibleInList: false, isVisibleInAnalysis: true, isRequired: false },
  { code: "note", name: "Note", zhCNName: "备注", type: "string", isExtra: false, isVisibleInList: false, isVisibleInAnalysis: false, isRequired: false },
] as const
```

```ts
export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function resolveLocale(value?: string): AppLocale {
  return value === "zh-CN" ? "zh-CN" : "en"
}
```

```ts
export const EN_MESSAGES = {
  "nav.home": "Home",
  "nav.transactions": "Transactions",
  "nav.unsorted": "Unsorted",
  "nav.apps": "Apps",
  "nav.settings": "Settings",
  "sidebar.upload": "Upload",
  "settings.nav.general": "General",
  "settings.nav.profile": "Profile & Plan",
  "settings.nav.business": "Business Details",
  "settings.nav.llm": "LLM settings",
  "settings.nav.fields": "Fields",
  "settings.nav.categories": "Categories",
  "settings.nav.projects": "Projects",
  "settings.nav.currencies": "Currencies",
  "settings.nav.backups": "Backups",
  "settings.nav.danger": "Danger Zone",
  "settings.general.language": "Language",
  "settings.categories.llmPrompt": "LLM Prompt",
  "settings.profile.accountName": "Account Name",
  "settings.llm.providers": "LLM providers",
  "settings.llm.providersHelp": "Drag provider blocks to reorder. First is highest priority.",
  "common.name": "Name",
  "common.color": "Color",
  "common.save": "Save",
  "common.saving": "Saving...",
  "transactions.title": "Transactions",
  "transactions.emptyState": "You don't seem to have any transactions yet. Let's start and create the first one!",
  "transactions.summary.netTotal": "Net Total",
  "transactions.summary.turnover": "Turnover",
  "transactions.save": "Save Transaction",
  "transactions.deleteConfirm": "Are you sure? This will delete the transaction with all the files permanently",
  "transactions.newDialog.title": "New Transaction",
  "transactions.newDialog.description": "Create a new transaction",
  "transactions.type.expense": "Expense",
  "transactions.type.income": "Income",
  "transactions.type.pending": "Pending",
  "transactions.type.other": "Other",
  "export.dialog.submit": "Export Transactions",
  "import.csv.skipColumn": "Skip column",
  "import.csv.emptyState": "Upload your CSV file to import transactions",
} as const

export const ZH_CN_MESSAGES = {
  "nav.home": "首页",
  "nav.transactions": "交易",
  "nav.unsorted": "待整理",
  "nav.apps": "应用",
  "nav.settings": "设置",
  "sidebar.upload": "上传",
  "settings.nav.general": "常规",
  "settings.nav.profile": "个人资料与套餐",
  "settings.nav.business": "企业信息",
  "settings.nav.llm": "LLM 设置",
  "settings.nav.fields": "字段",
  "settings.nav.categories": "分类",
  "settings.nav.projects": "项目",
  "settings.nav.currencies": "货币",
  "settings.nav.backups": "备份",
  "settings.nav.danger": "危险区域",
  "settings.general.language": "语言",
  "settings.categories.llmPrompt": "LLM 提示词",
  "settings.profile.accountName": "账户名称",
  "settings.llm.providers": "LLM 提供商",
  "settings.llm.providersHelp": "拖动提供商卡片以调整优先级，排在最前面的优先级最高。",
  "common.name": "名称",
  "common.color": "颜色",
  "common.save": "保存",
  "common.saving": "正在保存...",
  "transactions.title": "交易",
  "transactions.emptyState": "你还没有任何交易。现在开始创建第一条吧！",
  "transactions.summary.netTotal": "净额",
  "transactions.summary.turnover": "营业额",
  "transactions.save": "保存交易",
  "transactions.deleteConfirm": "确定吗？这会永久删除该交易及其所有附件。",
  "transactions.newDialog.title": "新建交易",
  "transactions.newDialog.description": "创建一条新的交易记录",
  "transactions.type.expense": "支出",
  "transactions.type.income": "收入",
  "transactions.type.pending": "待处理",
  "transactions.type.other": "其他",
  "export.dialog.submit": "导出交易",
  "import.csv.skipColumn": "跳过此列",
  "import.csv.emptyState": "上传 CSV 文件以导入交易",
} as const
```

- [ ] **Step 2: Implement translator and system-label helpers**

```ts
import { DEFAULT_CATEGORIES, DEFAULT_FIELDS, DEFAULT_PROJECTS } from "@/lib/default-entities"
import { resolveLocale, type AppLocale } from "./locales"
import { EN_MESSAGES } from "./messages/en"
import { ZH_CN_MESSAGES } from "./messages/zh-CN"

const MESSAGES = {
  en: EN_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
} as const

export type TranslationKey = keyof typeof EN_MESSAGES

export function t(locale: AppLocale, key: TranslationKey) {
  return MESSAGES[resolveLocale(locale)][key] ?? EN_MESSAGES[key]
}

const FIELD_LABELS = Object.fromEntries(DEFAULT_FIELDS.map((field) => [field.code, { en: field.name, "zh-CN": field.zhCNName }]))
const CATEGORY_LABELS = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.code, { en: category.name, "zh-CN": category.zhCNName }])
)
const PROJECT_LABELS = Object.fromEntries(
  DEFAULT_PROJECTS.map((project) => [project.code, { en: project.name, "zh-CN": project.zhCNName }])
)

type NamedRecord = { code: string; name: string; nameSource?: string | null }

export function getFieldDisplayName(field: NamedRecord, locale: AppLocale) {
  if (field.nameSource !== "default") return field.name
  return FIELD_LABELS[field.code]?.[locale] ?? field.name
}

export function getCategoryDisplayName(category: NamedRecord, locale: AppLocale) {
  if (category.nameSource !== "default") return category.name
  return CATEGORY_LABELS[category.code]?.[locale] ?? category.name
}

export function getProjectDisplayName(project: NamedRecord, locale: AppLocale) {
  if (project.nameSource !== "default") return project.name
  return PROJECT_LABELS[project.code]?.[locale] ?? project.name
}

function getSystemLabelsForCode(kind: "field" | "category" | "project", code: string) {
  const source = kind === "field" ? FIELD_LABELS : kind === "category" ? CATEGORY_LABELS : PROJECT_LABELS
  const labels = source[code]

  return new Map<AppLocale, string>(
    labels
      ? [
          ["en", labels.en],
          ["zh-CN", labels["zh-CN"]],
        ]
      : [["en", code]]
  )
}

export function normalizeSystemNameSubmission(kind: "field" | "category" | "project", code: string, submittedName: string) {
  const trimmedName = submittedName.trim()
  const labels = getSystemLabelsForCode(kind, code)
  if (labels.has(trimmedName)) {
    return { name: labels.get("en")!, nameSource: "default" as const }
  }
  return { name: trimmedName, nameSource: "custom" as const }
}
```

- [ ] **Step 3: Use the shared field matcher for CSV import**

```ts
export function resolveImportFieldCode(
  fields: Array<{ code: string; name: string; nameSource?: string | null }>,
  header: string
) {
  const normalizedHeader = header.trim()

  const exactCode = fields.find((field) => field.code === normalizedHeader)
  if (exactCode) return exactCode.code

  const storedName = fields.find((field) => field.name === normalizedHeader)
  if (storedName) return storedName.code

  const builtinName = fields.find(
    (field) =>
      getFieldDisplayName(field, "en") === normalizedHeader || getFieldDisplayName(field, "zh-CN") === normalizedHeader
  )
  return builtinName?.code ?? ""
}
```

```ts
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCIES, DEFAULT_FIELDS, DEFAULT_PROJECTS } from "@/lib/default-entities"
```

- [ ] **Step 4: Run the targeted tests**

Run: `node --test lib/i18n/index.test.ts models/export_and_import.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the locale primitives**

```bash
git add lib/default-entities.ts lib/i18n/locales.ts lib/i18n/messages/en.ts lib/i18n/messages/zh-CN.ts lib/i18n/index.ts lib/i18n/system-labels.ts lib/i18n/index.test.ts models/defaults.ts models/export_and_import.ts models/export_and_import.test.ts
git commit -m "feat: add locale and system label helpers"
```

### Task 3: Persist locale and default-name ownership metadata

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `forms/settings.ts`
- Modify: `models/settings.ts`
- Modify: `models/defaults.ts`
- Modify: `models/fields.ts`
- Modify: `models/categories.ts`
- Modify: `models/projects.ts`
- Modify: `app/(app)/settings/actions.ts`
- Modify: `app/(app)/settings/danger/actions.ts`
- Create: `scripts/backfill-name-source.ts`

- [ ] **Step 1: Add `ui_language` and `nameSource` to the data model**

```prisma
model Category {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  code         String
  name         String
  nameSource   String   @default("custom") @map("name_source")
  color        String   @default("#000000")
  llm_prompt   String?
  createdAt    DateTime @default(now()) @map("created_at")
}
```

```ts
export const settingsFormSchema = z.object({
  ui_language: z.enum(["en", "zh-CN"]).default("en"),
  default_currency: z.string().max(5).optional(),
  default_type: z.string().optional(),
  default_category: z.string().optional(),
  default_project: z.string().optional(),
  openai_api_key: z.string().optional(),
  google_api_key: z.string().optional(),
  mistral_api_key: z.string().optional(),
  openai_compatible_api_key: z.string().optional(),
  openai_compatible_base_url: z.string().optional(),
  openai_compatible_model_name: z.string().optional(),
  openai_compatible_send_png_data_url: z.enum(["true", "false"]).default("true"),
  llm_providers: z.string().default("openai,google,mistral,openai_compatible"),
  prompt_analyse_new_file: z.string().optional(),
  is_welcome_message_hidden: z.string().optional(),
})
```

```ts
{
  code: "ui_language",
  name: "Interface Language",
  description: "Controls the authenticated app language and CSV export headers.",
  value: "en",
},
```

- [ ] **Step 2: Seed defaults and normalize edits through `nameSource`**

```ts
export function getUiLanguage(settings: SettingsMap) {
  return resolveLocale(settings.ui_language)
}
```

```ts
await prisma.category.upsert({
  where: { userId_code: { code: category.code, userId } },
  update: {
    name: category.name,
    nameSource: "default",
    color: category.color,
    llm_prompt: category.llm_prompt,
  },
  create: {
    ...category,
    nameSource: "default",
    userId,
  },
})
```

```ts
const normalizedName = normalizeSystemNameSubmission("category", code, validatedForm.data.name)

const category = await updateCategory(userId, code, {
  name: normalizedName.name,
  nameSource: normalizedName.nameSource,
  llm_prompt: validatedForm.data.llm_prompt,
  color: validatedForm.data.color || "",
})
```

```ts
const field = await createField(userId, {
  code: codeFromName(validatedForm.data.name),
  name: validatedForm.data.name,
  nameSource: "custom",
  type: validatedForm.data.type,
  llm_prompt: validatedForm.data.llm_prompt,
  isVisibleInList: validatedForm.data.isVisibleInList,
  isVisibleInAnalysis: validatedForm.data.isVisibleInAnalysis,
  isRequired: validatedForm.data.isRequired,
  isExtra: true,
})
```

- [ ] **Step 3: Add the backfill script for historical built-ins**

```ts
import { prisma } from "@/lib/db"
import { DEFAULT_CATEGORIES, DEFAULT_FIELDS, DEFAULT_PROJECTS } from "@/lib/default-entities"

async function markDefaults() {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.updateMany({
      where: { code: category.code, name: category.name },
      data: { nameSource: "default" },
    })
  }

  for (const project of DEFAULT_PROJECTS) {
    await prisma.project.updateMany({
      where: { code: project.code, name: project.name },
      data: { nameSource: "default" },
    })
  }

  for (const field of DEFAULT_FIELDS) {
    await prisma.field.updateMany({
      where: { code: field.code, name: field.name },
      data: { nameSource: "default" },
    })
  }
}

markDefaults()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 4: Generate the migration, run the backfill, and verify the tests still pass**

Run: `npx prisma migrate dev --name add_ui_language_and_name_source`
Expected: PASS and Prisma regenerates the client.

Run: `node scripts/backfill-name-source.ts`
Expected: PASS

Run: `node --test lib/i18n/index.test.ts models/export_and_import.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the persistence changes**

```bash
git add prisma/schema.prisma forms/settings.ts models/settings.ts models/defaults.ts models/fields.ts models/categories.ts models/projects.ts app/(app)/settings/actions.ts app/(app)/settings/danger/actions.ts scripts/backfill-name-source.ts prisma/migrations
git commit -m "feat: persist ui locale and label ownership"
```

### Task 4: Thread locale through layouts and the global settings selector

**Files:**
- Create: `lib/i18n/server.ts`
- Create: `lib/i18n/provider.tsx`
- Create: `components/i18n/locale-cookie-sync.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/settings/actions.ts`
- Modify: `components/settings/global-settings-form.tsx`

- [ ] **Step 1: Build the server and client locale plumbing**

```ts
import { getSettings } from "@/models/settings"
import { getUiLanguage } from "@/models/settings"
import { t, type TranslationKey } from "./index"

export async function getServerI18n(userId: string) {
  const settings = await getSettings(userId)
  const locale = getUiLanguage(settings)

  return {
    locale,
    t: (key: TranslationKey) => t(locale, key),
  }
}
```

```tsx
"use client"

import { createContext, useContext, useMemo } from "react"
import { t, type TranslationKey } from "@/lib/i18n"
import type { AppLocale } from "@/lib/i18n/locales"

const LocaleContext = createContext<{ locale: AppLocale; t: (key: TranslationKey) => string } | null>(null)

export function LocaleProvider({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: (key: TranslationKey) => t(locale, key) }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error("useLocale must be used inside LocaleProvider")
  return context
}

export function useT() {
  return useLocale().t
}
```

```tsx
"use client"

import { useEffect } from "react"
import type { AppLocale } from "@/lib/i18n/locales"

export function LocaleCookieSync({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    document.cookie = `ui_language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [locale])

  return null
}
```

- [ ] **Step 2: Use the locale in layouts and the settings form**

```tsx
import { cookies } from "next/headers"
import { resolveLocale } from "@/lib/i18n/locales"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get("ui_language")?.value)

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  )
}
```

```tsx
const settings = await getSettings(user.id)
const locale = getUiLanguage(settings)

return (
  <NotificationProvider>
    <LocaleProvider locale={locale}>
      <LocaleCookieSync locale={locale} />
      <ScreenDropArea>
        {/* existing sidebar and app shell */}
      </ScreenDropArea>
    </LocaleProvider>
  </NotificationProvider>
)
```

```ts
import { cookies } from "next/headers"

const cookieStore = await cookies()

for (const key in validatedForm.data) {
  const value = validatedForm.data[key as keyof typeof validatedForm.data]
  if (value !== undefined) {
    await updateSettings(user.id, key, value)
  }
}

cookieStore.set("ui_language", validatedForm.data.ui_language ?? "en", {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
})
```

```tsx
<FormSelect
  title="Language"
  name="ui_language"
  defaultValue={settings.ui_language || "en"}
  items={[
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
  ]}
/>
```

- [ ] **Step 3: Run the typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit the locale plumbing**

```bash
git add lib/i18n/server.ts lib/i18n/provider.tsx components/i18n/locale-cookie-sync.tsx app/layout.tsx app/(app)/layout.tsx app/(app)/settings/actions.ts components/settings/global-settings-form.tsx
git commit -m "feat: thread locale through app shell"
```

### Task 5: Translate shared chrome and settings CRUD pages safely

**Files:**
- Modify: `components/sidebar/sidebar.tsx`
- Modify: `app/(app)/settings/layout.tsx`
- Modify: `components/settings/crud.tsx`
- Modify: `components/settings/profile-settings-form.tsx`
- Modify: `components/settings/business-settings-form.tsx`
- Modify: `components/settings/llm-settings-form.tsx`
- Modify: `app/(app)/settings/categories/page.tsx`
- Modify: `app/(app)/settings/fields/page.tsx`
- Modify: `app/(app)/settings/projects/page.tsx`
- Modify: `app/(app)/settings/currencies/page.tsx`

- [ ] **Step 1: Translate shared chrome using `useT()` and `getServerI18n()`**

```tsx
const t = useT()

<UploadButton className="w-full mt-4 mb-2">
  <Upload className="h-4 w-4" />
  {open ? <span>{t("sidebar.upload")}</span> : ""}
</UploadButton>

<Link href="/transactions">
  <FileText />
  <span>{t("nav.transactions")}</span>
</Link>
```

```tsx
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const { t } = await getServerI18n(user.id)

  const settingsCategories = [
    { title: t("settings.nav.general"), href: "/settings" },
    { title: t("settings.nav.profile"), href: "/settings/profile" },
    { title: t("settings.nav.business"), href: "/settings/business" },
    { title: t("settings.nav.llm"), href: "/settings/llm" },
    { title: t("settings.nav.fields"), href: "/settings/fields" },
    { title: t("settings.nav.categories"), href: "/settings/categories" },
    { title: t("settings.nav.projects"), href: "/settings/projects" },
    { title: t("settings.nav.currencies"), href: "/settings/currencies" },
    { title: t("settings.nav.backups"), href: "/settings/backups" },
    { title: t("settings.nav.danger"), href: "/settings/danger" },
  ]
```

- [ ] **Step 2: Separate translated display values from editable stored names in CRUD tables**

```tsx
interface CrudColumn<T> {
  key: keyof T
  label: string
  type?: "text" | "number" | "checkbox" | "select" | "color"
  options?: string[]
  defaultValue?: string | boolean
  editable?: boolean
  renderCell?: (item: T) => React.ReactNode
  getEditValue?: (item: T) => string | boolean
}
```

```tsx
const startEditing = (item: T) => {
  const initialEditingItem = { ...item }

  for (const column of columns) {
    if (column.getEditValue) {
      initialEditingItem[column.key] = column.getEditValue(item) as T[keyof T]
    }
  }

  setEditingId(item.code || item.id)
  setEditingItem(initialEditingItem)
}
```

```tsx
{columns.map((column) => (
  <TableCell key={String(column.key)} className="first:font-semibold">
    {editingId === (item.code || item.id) && column.editable
      ? EditFormCell(item, column)
      : column.renderCell
        ? column.renderCell(item)
        : FormCell(item, column)}
  </TableCell>
))}
```

- [ ] **Step 3: Use localized labels in settings pages and forms**

```tsx
const { locale, t } = await getServerI18n(user.id)

<CrudTable
  items={categoriesWithActions}
  columns={[
    {
      key: "name",
      label: t("common.name"),
      editable: true,
      renderCell: (category) => getCategoryDisplayName(category, locale),
      getEditValue: (category) => getCategoryDisplayName(category, locale),
    },
    { key: "llm_prompt", label: t("settings.categories.llmPrompt"), editable: true },
    { key: "color", label: t("common.color"), type: "color", defaultValue: randomHexColor(), editable: true },
  ]}
```

```tsx
const t = useT()

<FormInput title={t("settings.profile.accountName")} name="name" defaultValue={user.name || ""} />

<Button type="submit" disabled={pending}>
  {pending ? t("common.saving") : t("common.save")}
</Button>
```

```tsx
const t = useT()

<label className="text-sm font-medium">{t("settings.llm.providers")}</label>
<small className="text-muted-foreground">{t("settings.llm.providersHelp")}</small>
```

- [ ] **Step 4: Run the typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit the shared and settings translations**

```bash
git add components/sidebar/sidebar.tsx app/(app)/settings/layout.tsx components/settings/crud.tsx components/settings/profile-settings-form.tsx components/settings/business-settings-form.tsx components/settings/llm-settings-form.tsx app/(app)/settings/categories/page.tsx app/(app)/settings/fields/page.tsx app/(app)/settings/projects/page.tsx app/(app)/settings/currencies/page.tsx
git commit -m "feat: translate shared app chrome and settings"
```

### Task 6: Translate transactions and make CSV import and export locale-aware

**Files:**
- Modify: `components/forms/select-category.tsx`
- Modify: `components/forms/select-project.tsx`
- Modify: `components/forms/select-type.tsx`
- Modify: `components/transactions/list.tsx`
- Modify: `components/transactions/edit.tsx`
- Modify: `components/transactions/filters.tsx`
- Modify: `components/transactions/new.tsx`
- Modify: `app/(app)/transactions/page.tsx`
- Modify: `app/(app)/transactions/[transactionId]/page.tsx`
- Modify: `components/export/transactions.tsx`
- Modify: `components/import/csv.tsx`
- Modify: `app/(app)/export/transactions/route.ts`

- [ ] **Step 1: Localize shared transaction selectors and field labels**

```tsx
const { locale } = useLocale()

const items = useMemo(
  () =>
    categories.map((category) => ({
      code: category.code,
      name: getCategoryDisplayName(category, locale),
      color: category.color,
    })),
  [categories, locale]
)
```

```tsx
const { locale, t } = useLocale()

const items = [
  { code: "expense", name: t("transactions.type.expense"), badge: "↓" },
  { code: "income", name: t("transactions.type.income"), badge: "↑" },
  { code: "pending", name: t("transactions.type.pending"), badge: "⏲︎" },
  { code: "other", name: t("transactions.type.other"), badge: "?" },
]
```

```tsx
const { locale, t } = useLocale()

const visibleFields = useMemo(
  () =>
    fields
      .filter((field) => field.isVisibleInList)
      .map((field) => ({
        ...field,
        displayName: field.code === "categoryCode"
          ? getFieldDisplayName(field, locale)
          : getFieldDisplayName(field, locale),
        renderer: getFieldRenderer(field),
      })),
  [fields, locale]
)
```

- [ ] **Step 2: Translate transactions pages and dialogs**

```tsx
const { t } = await getServerI18n(user.id)

<span className="text-3xl font-bold tracking-tight">{t("transactions.title")}</span>

{transactions.length === 0 && (
  <p className="text-muted-foreground">{t("transactions.emptyState")}</p>
)}
```

```tsx
const t = useT()

if (confirm(t("transactions.deleteConfirm"))) {
  startTransition(async () => {
    await deleteAction(transaction.id)
    router.back()
  })
}

<Button type="submit" disabled={isSaving}>
  {isSaving ? t("common.saving") : t("transactions.save")}
</Button>
```

```tsx
<DialogTitle className="text-2xl font-bold">{t("transactions.newDialog.title")}</DialogTitle>
<DialogDescription>{t("transactions.newDialog.description")}</DialogDescription>
```

- [ ] **Step 3: Localize CSV export headers and import auto-mapping**

```ts
const settings = await getSettings(user.id)
const locale = getUiLanguage(settings)

const headers = fieldKeys.map((fieldCode) => {
  const field = existingFields.find((item) => item.code === fieldCode)
  return field ? getFieldDisplayName(field, locale) : "UNKNOWN"
})
```

```tsx
setColumnMappings(
  parsedData[0].map((header) => resolveImportFieldCode(fields, header))
)
```

```tsx
const t = useT()

<option value="">{t("import.csv.skipColumn")}</option>

<p className="text-muted-foreground">{t("import.csv.emptyState")}</p>
```

- [ ] **Step 4: Run the targeted tests and typecheck**

Run: `node --test lib/i18n/index.test.ts models/export_and_import.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit the transaction and CSV localization**

```bash
git add components/forms/select-category.tsx components/forms/select-project.tsx components/forms/select-type.tsx components/transactions/list.tsx components/transactions/edit.tsx components/transactions/filters.tsx components/transactions/new.tsx app/(app)/transactions/page.tsx app/(app)/transactions/[transactionId]/page.tsx components/export/transactions.tsx components/import/csv.tsx app/(app)/export/transactions/route.ts
git commit -m "feat: localize transactions and csv flows"
```

### Task 7: Full verification and smoke test

**Files:**
- Modify: none

- [ ] **Step 1: Run the automated verification suite**

Run: `node --test lib/i18n/index.test.ts models/export_and_import.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run the app and perform a manual smoke test**

Run: `npm run dev`
Expected: Next.js dev server starts on `http://localhost:7331`.

Manual checks:
- Switch `Language` to `简体中文` in `/settings` and verify the sidebar, settings shell, and transactions page render Chinese labels.
- Open the export dialog in `/transactions` and verify field names and action text render Chinese labels.
- Export a CSV in Chinese, re-import it in `/import/csv`, and verify the standard columns auto-map without manual edits.
- Rename a built-in category while the UI is Chinese, switch back to English, and verify the renamed category keeps the user-entered custom name.

- [ ] **Step 3: Confirm the branch is clean after verification**

```bash
git status --short
```

Expected: no output because the verification steps should not introduce new changes.
