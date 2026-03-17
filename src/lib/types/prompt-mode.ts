export type QuickSelection = {
  label: string
  indexes: number[]
}

export type PromptMode = {
  id: string
  name: string
  description: string
  role_prompt: string
  prompt_ids: string[]
  quick_selections: QuickSelection[]
  creator: string
  created_at: string
  updater: string | null
  updated_at: string | null
}

export type CreatePromptModeInput = {
  name: string
  description: string
  role_prompt: string
  prompt_ids: string[]
  quick_selections: QuickSelection[]
}

export type UpdatePromptModeInput = {
  name?: string
  description?: string
  role_prompt?: string
  prompt_ids?: string[]
  quick_selections?: QuickSelection[]
}
