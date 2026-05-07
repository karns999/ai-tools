import sharp from "sharp"

const JPEG_QUALITY = 92

export async function convertDataImageUrlToJpeg(dataUrl: string) {
  const base64Data = dataUrl.split(",")[1]
  if (!base64Data) {
    throw new Error("Invalid image data URL")
  }

  const input = Buffer.from(base64Data.replace(/\s/g, ""), "base64")

  return sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}
