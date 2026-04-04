import test from "node:test"
import assert from "node:assert/strict"

import type { ImageAttachment } from "./imagePayload"

const { buildImageContentParts, normalizeModelIdentifier, normalizeOpenAICompatibleBaseUrl } = await import(
  new URL("./imagePayload.ts", import.meta.url).href
)

test("keeps data URLs for non-LM-Studio providers", async () => {
  const parts = await buildImageContentParts(
    {
      provider: "openai_compatible",
      baseUrl: "http://localhost:11434/v1",
    },
    [
      {
        contentType: "image/webp",
        base64: "webp-base64",
      },
    ]
  )

  assert.deepEqual(parts, [
    {
      type: "image_url",
      image_url: {
        url: "data:image/webp;base64,webp-base64",
      },
    },
  ])
})

test("uses PNG data URLs for LM Studio compatible endpoints", async () => {
  let converterCalls = 0

  const parts = await buildImageContentParts(
    {
      provider: "openai_compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
    },
    [
      {
        contentType: "image/webp",
        base64: "webp-base64",
      },
    ],
    {
      convertToPngBase64: async (attachment: ImageAttachment) => {
        converterCalls += 1
        assert.equal(attachment.contentType, "image/webp")
        assert.equal(attachment.base64, "webp-base64")
        return "png-base64"
      },
    }
  )

  assert.equal(converterCalls, 1)
  assert.deepEqual(parts, [
    {
      type: "image_url",
      image_url: {
        url: "data:image/png;base64,png-base64",
      },
    },
  ])
})

test("keeps the original data URL when LM Studio PNG conversion is disabled", async () => {
  let converterCalls = 0

  const parts = await buildImageContentParts(
    {
      provider: "openai_compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      sendPngDataUrl: false,
    },
    [
      {
        contentType: "image/webp",
        base64: "webp-base64",
      },
    ],
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
      image_url: {
        url: "data:image/webp;base64,webp-base64",
      },
    },
  ])
})

test("normalizes bare LM Studio base URLs to the v1 endpoint", () => {
  assert.equal(normalizeOpenAICompatibleBaseUrl("http://localhost:1234"), "http://localhost:1234/v1")
  assert.equal(normalizeOpenAICompatibleBaseUrl("http://localhost:1234/"), "http://localhost:1234/v1")
  assert.equal(normalizeOpenAICompatibleBaseUrl("http://localhost:1234/v1"), "http://localhost:1234/v1")
  assert.equal(normalizeOpenAICompatibleBaseUrl("http://localhost:11434/v1"), "http://localhost:11434/v1")
})

test("trims accidental whitespace from model identifiers", () => {
  assert.equal(normalizeModelIdentifier(" qwen/qwen3.5-9b "), "qwen/qwen3.5-9b")
})
