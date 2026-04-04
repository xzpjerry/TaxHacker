import sharp from "sharp"

import { ImageAttachment } from "./imagePayload"

export async function convertImageAttachmentToPngBase64(attachment: ImageAttachment): Promise<string> {
  if (!attachment.contentType.startsWith("image/") || attachment.contentType === "image/png") {
    return attachment.base64
  }

  const imageBuffer = Buffer.from(attachment.base64, "base64")
  const pngBuffer = await sharp(imageBuffer).png().toBuffer()
  return pngBuffer.toString("base64")
}
