"use server"

import { createClient } from "@/lib/supabase/server"
import type { CreatePromptInput, UpdatePromptInput, Prompt } from "@/lib/types/prompt"
import { revalidatePath } from "next/cache"

export async function fetchPrompts(): Promise<{ data: Prompt[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createPrompt(
  input: CreatePromptInput
): Promise<{ data: Prompt | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("prompts")
    .insert({
      title: input.title,
      content: input.content,
      creator: user.email,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/prompt-list")
  return { data, error: null }
}

export async function updatePrompt(
  id: string,
  input: UpdatePromptInput
): Promise<{ data: Prompt | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("prompts")
    .update({
      ...input,
      updater: user.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/prompt-list")
  return { data, error: null }
}

export async function deletePrompt(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/prompt-list")
  return { error: null }
}
