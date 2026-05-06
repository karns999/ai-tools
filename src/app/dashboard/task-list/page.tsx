import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Task } from "@/lib/types/task"
import type { PromptMode } from "@/lib/types/prompt-mode"
import type { Prompt } from "@/lib/types/prompt"
import { TaskListClient } from "./task-list-client"

export default async function TaskListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [{ data: tasks }, { data: promptModes }, { data: prompts }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("prompt_modes").select("*").order("created_at", { ascending: false }),
    supabase.from("prompts").select("id, title, content").order("created_at", { ascending: false }),
  ])

  const promptModeMap: Record<string, PromptMode> = {}
  ;((promptModes ?? []) as PromptMode[]).forEach((pm) => {
    promptModeMap[pm.id] = pm
  })

  const promptMap: Record<string, Pick<Prompt, "id" | "title" | "content">> = {}
  ;((prompts ?? []) as Pick<Prompt, "id" | "title" | "content">[]).forEach((p) => {
    promptMap[p.id] = p
  })

  return (
    <TaskListClient
      initialData={(tasks as Task[]) ?? []}
      promptModeMap={promptModeMap}
      promptMap={promptMap}
    />
  )
}
