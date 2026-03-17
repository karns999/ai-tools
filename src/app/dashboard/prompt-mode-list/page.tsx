import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { PromptMode } from "@/lib/types/prompt-mode"
import type { Prompt } from "@/lib/types/prompt"
import { PromptModeListClient } from "./prompt-mode-list-client"

export default async function PromptModeListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [{ data: promptModes }, { data: prompts }] = await Promise.all([
    supabase
      .from("prompt_modes")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("prompts")
      .select("id, title")
      .order("created_at", { ascending: false }),
  ])

  return (
    <PromptModeListClient
      initialData={(promptModes as PromptMode[]) ?? []}
      allPrompts={(prompts as Pick<Prompt, "id" | "title">[]) ?? []}
    />
  )
}
