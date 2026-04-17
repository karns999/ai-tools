export type Task = {
  id: string
  title: string
  image_url: string
  reference_urls: string[]
  scene_suggestions: string[]
  generated_images: string[]
  selected_suggestions: number[]
  prompt_mode_id: string
  status: "pending" | "suggest" | "image" | "generating" | "complete" | "failed"
  creator: string
  created_at: string
  updated_at: string | null
}
