"use server"

import { createClient } from "@/lib/supabase/server"
import type { CreatePromptModeInput, UpdatePromptModeInput, PromptMode } from "@/lib/types/prompt-mode"
import type { Prompt } from "@/lib/types/prompt"
import { revalidatePath } from "next/cache"

export async function fetchPromptModes(): Promise<{ data: PromptMode[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("prompt_modes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function fetchAllPrompts(): Promise<{ data: Pick<Prompt, "id" | "title">[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("prompts")
    .select("id, title")
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as Pick<Prompt, "id" | "title">[], error: null }
}

export async function createPromptMode(
  input: CreatePromptModeInput
): Promise<{ data: PromptMode | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("prompt_modes")
    .insert({
      name: input.name,
      description: input.description,
      role_prompt: input.role_prompt,
      prompt_ids: input.prompt_ids,
      quick_selections: input.quick_selections,
      creator: user.email,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath("/dashboard/prompt-mode-list")
  return { data, error: null }
}

export async function updatePromptMode(
  id: string,
  input: UpdatePromptModeInput
): Promise<{ data: PromptMode | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("prompt_modes")
    .update({
      ...input,
      updater: user.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath("/dashboard/prompt-mode-list")
  return { data, error: null }
}

export async function deletePromptMode(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { error } = await supabase
    .from("prompt_modes")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/prompt-mode-list")
  return { error: null }
}
