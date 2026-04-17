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
 * Generate scene suggestions for all keywords in one request.
 * Returns a JSON array to ensure reliable parsing.
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
  const systemContent = rolePrompt?.trim()
    ? `${rolePrompt.trim()}\n\n重要：请严格按照以上角色指令的要求生成内容，使用中文回复。`
    : "你是一个专业的产品场景设计师，请用中文生成场景建议。"

  const keywordList = keywords
    .map((k, i) => `${i + 1}. [${k.title}] ${k.content}`)
    .join("\n")

  const userContent: OpenRouterContentPart[] = [
    {
      type: "image_url",
      image_url: { url: imageUrl },
    },
    {
      type: "text",
      text: `产品标题：${title}\n\n关键词指令（共${keywords.length}条）：\n${keywordList}\n\n请严格根据角色指令的要求，结合产品图片和产品标题，为每条关键词指令各生成一条场景建议。\n\n要求：\n1. 必须生成恰好 ${keywords.length} 条场景建议，与关键词一一对应\n2. 使用中文回复\n3. 必须以 JSON 数组格式返回，例如：["场景1描述", "场景2描述"]\n4. 不要返回任何 JSON 以外的内容`,
    },
  ]

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]

  const { data, error } = await callOpenRouter(messages, {
    ...options,
    temperature: options?.temperature ?? 0.7,
  })

  if (error || !data) {
    return { suggestions: null, error: error ?? "No response from OpenRouter" }
  }

  const content = (data.choices[0]?.message?.content ?? "").trim()

  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error("[OpenRouter] Failed to parse JSON from:", content.slice(0, 500))
    return { suggestions: null, error: "AI response is not valid JSON array" }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
      return { suggestions: null, error: "AI response is not an array" }
    }
    const suggestions = parsed.map((item: unknown) => String(item).trim()).filter((s: string) => s.length > 0)
    return { suggestions, error: null }
  } catch {
    console.error("[OpenRouter] JSON parse error:", content.slice(0, 500))
    return { suggestions: null, error: "Failed to parse AI response as JSON" }
  }
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
