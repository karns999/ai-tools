export type Prompt = {
  id: string
  title: string
  content: string
  creator: string
  created_at: string
  updater: string | null
  updated_at: string | null
}

export type CreatePromptInput = {
  title: string
  content: string
}

export type UpdatePromptInput = {
  title?: string
  content?: string
}
