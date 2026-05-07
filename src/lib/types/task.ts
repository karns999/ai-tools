export type GeneratedImageItem = {
  url: string
  scene_index: number
}

export type GeneratedImageGroup = {
  id: string
  index: number
  selected_suggestions: number[]
  failed_suggestions: number[]
  images: GeneratedImageItem[]
  status: "generating" | "complete" | "failed"
  created_at: string
}

export type Task = {
  id: string
  title: string
  image_url: string
  reference_urls: string[]
  scene_suggestions: string[]
  generated_images: string[]
  generated_image_groups: GeneratedImageGroup[]
  selected_suggestions: number[]
  failed_suggestions: number[]
  prompt_mode_id: string
  status: "pending" | "suggest" | "image" | "generating" | "complete" | "failed"
  creator: string
  created_at: string
  updated_at: string | null
}
