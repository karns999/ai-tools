import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateSceneSuggestions } from "@/lib/openrouter"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Set status to suggest immediately
  await supabase.from("tasks").update({
    status: "suggest",
    scene_suggestions: [],
    generated_images: [],
    updated_at: new Date().toISOString(),
  }).eq("id", taskId)

  after(async () => {
    const supabase = await createClient()

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return

    const { data: promptMode } = await supabase
      .from("prompt_modes")
      .select("*, prompt_ids")
      .eq("id", task.prompt_mode_id)
      .single()

    let keywords: { title: string; content: string }[] = []
    if (promptMode?.prompt_ids?.length) {
      const { data: prompts } = await supabase
        .from("prompts")
        .select("id, title, content")
        .in("id", promptMode.prompt_ids)

      const promptMap = new Map((prompts ?? []).map((p: { id: string; title: string; content: string }) => [p.id, p]))
      keywords = promptMode.prompt_ids
        .map((id: string) => promptMap.get(id))
        .filter(Boolean)
        .map((p: { title: string; content: string }) => ({ title: p.title, content: p.content }))
    }

    console.log(`[suggest] task=${taskId} — calling AI with ${keywords.length} keywords...`)
    const { suggestions, error } = await generateSceneSuggestions({
      imageUrl: task.image_url,
      title: task.title || "",
      rolePrompt: promptMode?.role_prompt,
      keywords,
    })

    if (error || !suggestions || suggestions.length === 0) {
      console.log(`[suggest] task=${taskId} — FAILED: ${error}`)
      await supabase.from("tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", taskId)
      return
    }

    console.log(`[suggest] task=${taskId} — SUCCESS: ${suggestions.length} suggestions`)
    await supabase.from("tasks").update({
      scene_suggestions: suggestions,
      status: "image",
      updated_at: new Date().toISOString(),
    }).eq("id", taskId)
  })

  return NextResponse.json({ ok: true })
}
