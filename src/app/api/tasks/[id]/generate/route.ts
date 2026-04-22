import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateImage } from "@/lib/openrouter"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const { indexes } = await request.json() as { indexes: number[] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Set status to generating, clear previous results
  await supabase.from("tasks").update({
    status: "generating",
    generated_images: [],
    failed_suggestions: [],
    selected_suggestions: indexes,
    updated_at: new Date().toISOString(),
  }).eq("id", taskId)

  // Run the generation loop in the background after response is sent
  after(async () => {
    const supabase = await createClient()

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return

    const { data: promptMode } = await supabase
      .from("prompt_modes")
      .select("role_prompt")
      .eq("id", task.prompt_mode_id)
      .single()

    const suggestions: string[] = task.scene_suggestions ?? []

    for (const idx of indexes) {
      const suggestion = suggestions[idx]
      if (!suggestion) {
        console.log(`[generate] task=${taskId} scene=${idx} — invalid index, skipping`)
        await appendFailed(supabase, taskId, idx)
        continue
      }

      console.log(`[generate] task=${taskId} scene=${idx} — calling AI...`)
      const { imageUrl, error } = await generateImage({
        productImageUrl: task.image_url,
        referenceImageUrls: task.reference_urls?.length > 0 ? task.reference_urls : undefined,
        rolePrompt: promptMode?.role_prompt,
        sceneSuggestion: suggestion,
        title: task.title || undefined,
      })

      if (error || !imageUrl) {
        console.log(`[generate] task=${taskId} scene=${idx} — FAILED: ${error}`)
        await appendFailed(supabase, taskId, idx)
        continue
      }

      console.log(`[generate] task=${taskId} scene=${idx} — SUCCESS`)

      // Upload base64 to storage if needed
      let finalUrl = imageUrl
      if (imageUrl.startsWith("data:image/")) {
        const base64Data = imageUrl.split(",")[1]
        const mimeMatch = imageUrl.match(/data:(image\/\w+);/)
        const ext = mimeMatch ? mimeMatch[1].split("/")[1] : "png"
        const path = `generated/${crypto.randomUUID()}.${ext}`
        const buffer = Buffer.from(base64Data, "base64")
        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(path, buffer, { contentType: mimeMatch?.[1] ?? "image/png" })

        if (uploadError) {
          console.log(`[generate] task=${taskId} scene=${idx} — UPLOAD FAILED: ${uploadError.message}`)
          await appendFailed(supabase, taskId, idx)
          continue
        }
        finalUrl = supabase.storage.from("images").getPublicUrl(path).data.publicUrl
      }

      // Append to generated_images (re-read to avoid race conditions)
      const { data: latest } = await supabase.from("tasks").select("generated_images").eq("id", taskId).single()
      const images = [...(latest?.generated_images ?? []), finalUrl]
      await supabase.from("tasks").update({ generated_images: images, updated_at: new Date().toISOString() }).eq("id", taskId)
    }

    // Finalize: set status based on results
    const { data: final } = await supabase.from("tasks").select("generated_images, failed_suggestions").eq("id", taskId).single()
    const successCount = final?.generated_images?.length ?? 0
    const finalStatus = successCount > 0 ? "complete" : "failed"
    console.log(`[generate] task=${taskId} — DONE: ${successCount} success, ${final?.failed_suggestions?.length ?? 0} failed → ${finalStatus}`)
    await supabase.from("tasks").update({ status: finalStatus, updated_at: new Date().toISOString() }).eq("id", taskId)
  })

  return NextResponse.json({ ok: true })
}

async function appendFailed(supabase: Awaited<ReturnType<typeof createClient>>, taskId: string, idx: number) {
  const { data } = await supabase.from("tasks").select("failed_suggestions").eq("id", taskId).single()
  const failed = [...(data?.failed_suggestions ?? []), idx]
  await supabase.from("tasks").update({ failed_suggestions: failed, updated_at: new Date().toISOString() }).eq("id", taskId)
}
