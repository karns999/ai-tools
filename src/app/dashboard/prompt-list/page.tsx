import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Prompt } from "@/lib/types/prompt"
import { PromptListClient } from "./prompt-list-client"

export default async function PromptListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: prompts } = await supabase
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false })

  return <PromptListClient initialData={(prompts as Prompt[]) ?? []} />
}
