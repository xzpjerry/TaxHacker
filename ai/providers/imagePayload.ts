export type ImageAttachment = {
  contentType: string
  base64: string
}

type ProviderConfigForImages = {
  provider: "openai" | "google" | "mistral" | "openai_compatible"
  baseUrl?: string
}

type ImageContentPart = {
  type: "image_url"
  image_url: {
    url: string
  }
}

type ImagePayloadOptions = {
  convertToPngBase64?: (attachment: ImageAttachment) => Promise<string>
}

export function isLikelyLmStudioBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) {
    return false
  }

  try {
    const parsed = new URL(baseUrl)
    return parsed.port === "1234" || parsed.hostname.toLowerCase().includes("lmstudio")
  } catch {
    return /lmstudio/i.test(baseUrl) || /:1234(?:\/|$)/.test(baseUrl)
  }
}

export function normalizeOpenAICompatibleBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return baseUrl
  }

  const trimmedBaseUrl = baseUrl.trim()
  if (!isLikelyLmStudioBaseUrl(trimmedBaseUrl)) {
    return trimmedBaseUrl
  }

  try {
    const parsed = new URL(trimmedBaseUrl)
    if (parsed.pathname === "" || parsed.pathname === "/") {
      parsed.pathname = "/v1"
    } else if (parsed.pathname === "/v1/") {
      parsed.pathname = "/v1"
    }
    return parsed.toString().replace(/\/$/, "")
  } catch {
    if (/\/v1\/?$/.test(trimmedBaseUrl)) {
      return trimmedBaseUrl.replace(/\/$/, "")
    }
    return `${trimmedBaseUrl.replace(/\/$/, "")}/v1`
  }
}

export function normalizeModelIdentifier(model: string): string {
  return model.trim()
}

export async function buildImageContentParts(
  config: ProviderConfigForImages,
  attachments: ImageAttachment[],
  options: ImagePayloadOptions = {}
): Promise<ImageContentPart[]> {
  const useLmStudioPayload =
    config.provider === "openai_compatible" && isLikelyLmStudioBaseUrl(config.baseUrl)

  return Promise.all(
    attachments.map(async (attachment) => {
      if (useLmStudioPayload) {
        const pngBase64 = options.convertToPngBase64
          ? await options.convertToPngBase64(attachment)
          : attachment.base64

        return {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${pngBase64}`,
          },
        }
      }

      return {
        type: "image_url",
        image_url: {
          url: `data:${attachment.contentType};base64,${attachment.base64}`,
        },
      }
    })
  )
}
