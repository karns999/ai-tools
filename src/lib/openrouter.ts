const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2.5"
const IMAGE_GEN_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-4.5"

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant"
  content: string | OpenRouterContentPart[]
}

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type OpenRouterOptions = {
  model?: string
  temperature?: number
  max_tokens?: number
}

export type OpenRouterResponse = {
  id: string
  choices: {
    message: {
      role: string
      content: string | null
      images?: { type: string; image_url: { url: string } }[]
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<{ data: OpenRouterResponse | null; error: string | null }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { data: null, error: "OPENROUTER_API_KEY is not configured" }
  }

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4096,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return { data: null, error: `OpenRouter API error (${res.status}): ${errorBody}` }
    }

    const data = (await res.json()) as OpenRouterResponse
    return { data, error: null }
  } catch (err) {
    return { data: null, error: `OpenRouter request failed: ${(err as Error).message}` }
  }
}

/**
 * Generate scene suggestions based on product image, title, and prompt instructions.
 *
 * @param imageUrl - Public URL of the product image
 * @param title - Product title
 * @param rolePrompt - Role prompt instruction (used as system message)
 * @param keywords - Array of keyword prompt objects (title + content, used in user message)
 * @param options - Optional model/temperature overrides
 * @returns Array of scene suggestion strings
 */
export async function generateSceneSuggestions({
  imageUrl,
  title,
  rolePrompt,
  keywords,
  options,
}: {
  imageUrl: string
  title: string
  rolePrompt?: string
  keywords: { title: string; content: string }[]
  options?: OpenRouterOptions
}): Promise<{ suggestions: string[] | null; error: string | null }> {
  // System message: role prompt
  const systemContent = rolePrompt?.trim()
    || "You are a creative AI assistant that generates scene suggestions for product images."

  // Build keyword section for user message
  let keywordText = ""
  if (keywords.length > 0) {
    keywordText = "\n\n关键词指令：\n" + keywords
      .map((k, i) => `${i + 1}. [${k.title}] ${k.content}`)
      .join("\n")
  }

  // User message: image + title + keywords
  const userContent: OpenRouterContentPart[] = [
    {
      type: "image_url",
      image_url: { url: imageUrl },
    },
    {
      type: "text",
      text: `产品标题：${title}${keywordText}\n\n请根据以上产品图片、标题和关键词指令，生成场景建议。每个场景建议单独一行，用数字序号标注。`,
    },
  ]

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]

  const { data, error } = await callOpenRouter(messages, options)

  if (error || !data) {
    return { suggestions: null, error: error ?? "No response from OpenRouter" }
  }

  const content = data.choices[0]?.message?.content ?? ""

  console.log("[OpenRouter] Raw response content:", JSON.stringify(content).slice(0, 500))
  console.log("[OpenRouter] Full response:", JSON.stringify(data).slice(0, 1000))

  // Parse numbered lines into array
  const suggestions = content
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)、]\s*/, "").trim())
    .filter((line) => line.length > 0)

  return { suggestions, error: null }
}


/**
 * Generate an image using a product image, optional reference images,
 * role prompt, and a selected scene suggestion.
 *
 * @param productImageUrl - Public URL of the product image
 * @param referenceImageUrls - Optional array of reference image URLs
 * @param rolePrompt - Role prompt / style instruction
 * @param sceneSuggestion - The selected scene suggestion text
 * @param options - Optional model/temperature overrides
 * @returns Generated image URL (base64 data URL or hosted URL depending on model)
 */
export async function generateImage({
  productImageUrl,
  referenceImageUrls,
  rolePrompt,
  sceneSuggestion,
  title,
  options,
}: {
  productImageUrl: string
  referenceImageUrls?: string[]
  rolePrompt?: string
  sceneSuggestion: string
  title?: string
  options?: OpenRouterOptions
}): Promise<{ imageUrl: string | null; error: string | null }> {
  // System message
  const systemContent = rolePrompt?.trim()
    || "You are a professional product photographer. Generate a high-quality product scene image."

  // Build user content: product image + reference images + text prompt
  const userContent: OpenRouterContentPart[] = [
    {
      type: "image_url",
      image_url: { url: productImageUrl },
    },
  ]

  // Add reference images if provided
  if (referenceImageUrls && referenceImageUrls.length > 0) {
    for (const refUrl of referenceImageUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url: refUrl },
      })
    }
  }

  // Text prompt with scene description
  const refNote = referenceImageUrls && referenceImageUrls.length > 0
    ? `\n\n参考图片已提供（${referenceImageUrls.length}张），请参考其风格和构图。`
    : ""

  const titleNote = title ? `\n产品标题：${title}` : ""

  userContent.push({
    type: "text",
    text: `请根据以上产品图片生成一张场景图。${titleNote}\n\n场景描述：${sceneSuggestion}${refNote}\n\n要求：保持产品主体清晰完整，场景自然融合，画面高质量。`,
  })

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]

  const model = options?.model ?? IMAGE_GEN_MODEL
  const { data, error } = await callOpenRouter(messages, { ...options, model })

  if (error || !data) {
    return { imageUrl: null, error: error ?? "No response from OpenRouter" }
  }

  console.log("[OpenRouter Image] Full response:", JSON.stringify(data).slice(0, 2000))

  const message = data.choices[0]?.message

  // Check images array first (used by seedream and similar models)
  if (message?.images && message.images.length > 0) {
    const imgUrl = message.images[0].image_url?.url
    if (imgUrl) {
      return { imageUrl: imgUrl, error: null }
    }
  }

  const content = message?.content ?? ""

  console.log("[OpenRouter Image] Response content length:", content.length)
  console.log("[OpenRouter Image] Content preview:", content.slice(0, 300))

  // Try to extract image URL from response
  // Some models return markdown image syntax: ![alt](url)
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
  if (mdMatch) {
    return { imageUrl: mdMatch[1], error: null }
  }

  // Some models return a plain URL
  const urlMatch = content.match(/(https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp|gif))/i)
  if (urlMatch) {
    return { imageUrl: urlMatch[1], error: null }
  }

  // Some models return base64 data
  if (content.startsWith("data:image/")) {
    return { imageUrl: content, error: null }
  }

  // If content is very long, it might be base64 without prefix
  if (content.length > 1000 && !content.includes(" ")) {
    return { imageUrl: `data:image/png;base64,${content}`, error: null }
  }

  return { imageUrl: null, error: "Unable to extract image from AI response" }
}
