export type Task = {
  id: string
  image_url: string
  prompt_mode_id: string
  status: "pending" | "running" | "completed" | "failed"
  creator: string
  created_at: string
  updated_at: string | null
}
