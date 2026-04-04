# OpenAI-Compatible Image Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an LLM settings toggle that lets users decide whether the OpenAI-compatible provider converts image payloads to PNG before sending them.

**Architecture:** Extend the existing key/value settings pipeline with one provider-scoped flag, pass that flag into the OpenAI-compatible runtime config, and branch the existing LM Studio payload builder based on it. Keep the UI change inside the existing OpenAI-compatible provider block so the setting stays scoped to the transport path that uses it.

**Tech Stack:** Next.js, React, TypeScript, Zod, Node test runner

---

### Task 1: Add payload toggle coverage

**Files:**
- Modify: `ai/providers/imagePayload.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("keeps the original data URL when LM Studio PNG conversion is disabled", async () => {
  let converterCalls = 0

  const parts = await buildImageContentParts(
    {
      provider: "openai_compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      sendPngDataUrl: false,
    },
    [{ contentType: "image/webp", base64: "webp-base64" }],
    {
      convertToPngBase64: async () => {
        converterCalls += 1
        return "png-base64"
      },
    }
  )

  assert.equal(converterCalls, 0)
  assert.deepEqual(parts, [
    {
      type: "image_url",
      image_url: { url: "data:image/webp;base64,webp-base64" },
    },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ai/providers/imagePayload.test.ts`
Expected: FAIL because the payload builder does not yet honor the new setting.

- [ ] **Step 3: Commit**

```bash
git add ai/providers/imagePayload.test.ts
git commit -m "test: cover openai-compatible png toggle"
```

### Task 2: Thread the setting through runtime config

**Files:**
- Modify: `forms/settings.ts`
- Modify: `models/defaults.ts`
- Modify: `models/settings.ts`
- Modify: `ai/providers/imagePayload.ts`
- Modify: `ai/providers/llmProvider.ts`

- [ ] **Step 1: Add the persisted setting shape**

```ts
openai_compatible_send_png_data_url: z.enum(["true", "false"]).default("true"),
```

```ts
{
  code: "openai_compatible_send_png_data_url",
  name: "Convert OpenAI-Compatible images to PNG",
  description: "When enabled, OpenAI-compatible image requests are converted to PNG before sending.",
  value: "true",
},
```

- [ ] **Step 2: Pass the setting into the provider config**

```ts
sendPngDataUrl: settings.openai_compatible_send_png_data_url !== "false",
```

- [ ] **Step 3: Honor the setting in the payload builder**

```ts
const useLmStudioPayload =
  config.provider === "openai_compatible" &&
  isLikelyLmStudioBaseUrl(config.baseUrl) &&
  config.sendPngDataUrl !== false
```

- [ ] **Step 4: Run the targeted test**

Run: `node --test ai/providers/imagePayload.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add forms/settings.ts models/defaults.ts models/settings.ts ai/providers/imagePayload.ts ai/providers/llmProvider.ts
git commit -m "feat: add openai-compatible image conversion setting"
```

### Task 3: Add the settings UI control

**Files:**
- Modify: `components/settings/llm-settings-form.tsx`

- [ ] **Step 1: Add the controlled setting value**

```ts
type ProviderValue = {
  apiKey: string
  model: string
  baseUrl: string
  sendPngDataUrl: boolean
}
```

- [ ] **Step 2: Render the checkbox only for `openai_compatible`**

```tsx
{provider.key === "openai_compatible" && (
  <label className="flex items-center gap-2 text-sm">
    <input type="hidden" name="openai_compatible_send_png_data_url" value="false" />
    <input
      type="checkbox"
      name="openai_compatible_send_png_data_url"
      value="true"
      checked={value.sendPngDataUrl}
      onChange={(e) => handleValueChange(provider.key, "sendPngDataUrl", e.target.checked)}
    />
    Convert images to PNG before sending
  </label>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/settings/llm-settings-form.tsx
git commit -m "feat: add openai-compatible image toggle ui"
```
