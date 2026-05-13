import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateImage } from "@/lib/openrouter"
import { convertDataImageUrlToJpeg } from "@/lib/image"
import type { GeneratedImageGroup, GeneratedImageItem } from "@/lib/types/task"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  if (!taskId) return NextResponse.json({ error: "Task id is required" }, { status: 400 })

  let body: { indexes?: unknown; suggestions?: unknown }
  try {
    body = await request.json() as { indexes?: unknown; suggestions?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { indexes, suggestions } = body
  if (!Array.isArray(indexes) || indexes.some((index) => !Number.isInteger(index))) {
    return NextResponse.json({ error: "indexes must be an array of integers" }, { status: 400 })
  }
  if (suggestions !== undefined && !Array.isArray(suggestions)) {
    return NextResponse.json({ error: "suggestions must be an array when provided" }, { status: 400 })
  }

  const suggestionOverrides = Array.isArray(suggestions)
    ? suggestions.map((suggestion) => String(suggestion))
    : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: currentTask, error: fetchError } = await supabase
    .from("tasks")
    .select("generated_image_groups, generated_images, selected_suggestions, failed_suggestions")
    .eq("id", taskId)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const currentGroups = getGeneratedImageGroups(currentTask?.generated_image_groups)
  const existingGroups = currentGroups.length > 0
    ? currentGroups
    : createLegacyGeneratedImageGroups(currentTask)
  const generationGroup: GeneratedImageGroup = {
    id: crypto.randomUUID(),
    index: existingGroups.length + 1,
    selected_suggestions: indexes,
    failed_suggestions: [],
    images: [],
    status: "generating",
    created_at: new Date().toISOString(),
  }

  // Start a new generation group, preserving previous generated images.
  const { error: startError } = await supabase.from("tasks").update({
    status: "generating",
    failed_suggestions: [],
    selected_suggestions: indexes,
    generated_image_groups: [...existingGroups, generationGroup],
    updated_at: new Date().toISOString(),
  }).eq("id", taskId)

  if (startError) {
    return NextResponse.json({ error: startError.message }, { status: 500 })
  }

  // Run the generation loop in the background after response is sent
  after(async () => {
    const supabase = await createClient()

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return

    // Guard: if another generate call already reset the task, abort this one
    if (JSON.stringify(task.selected_suggestions) !== JSON.stringify(indexes)) {
      console.log(`[generate] task=${taskId} — indexes mismatch (stale after() call), aborting`)
      return
    }

    const { data: promptMode } = await supabase
      .from("prompt_modes")
      .select("role_prompt")
      .eq("id", task.prompt_mode_id)
      .single()

    const sceneSuggestions: string[] = suggestionOverrides ?? task.scene_suggestions ?? []

    for (const idx of indexes) {
      const suggestion = sceneSuggestions[idx]
      if (!suggestion) {
        console.log(`[generate] task=${taskId} scene=${idx} — invalid index, skipping`)
        await appendFailed(supabase, taskId, generationGroup.id, idx)
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
        await appendFailed(supabase, taskId, generationGroup.id, idx)
        continue
      }

      console.log(`[generate] task=${taskId} scene=${idx} — SUCCESS`)

      // Upload base64 to storage if needed
      let finalUrl = imageUrl
      if (imageUrl.startsWith("data:image/")) {
        let buffer: Buffer
        try {
          buffer = await convertDataImageUrlToJpeg(imageUrl)
        } catch (err) {
          console.log(`[generate] task=${taskId} scene=${idx} — JPG CONVERT FAILED: ${(err as Error).message}`)
          await appendFailed(supabase, taskId, generationGroup.id, idx)
          continue
        }

        const path = `generated/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(path, buffer, { contentType: "image/jpeg" })

        if (uploadError) {
          console.log(`[generate] task=${taskId} scene=${idx} — UPLOAD FAILED: ${uploadError.message}`)
          await appendFailed(supabase, taskId, generationGroup.id, idx)
          continue
        }
        finalUrl = supabase.storage.from("images").getPublicUrl(path).data.publicUrl
      }

      await appendGeneratedImage(supabase, taskId, generationGroup.id, {
        url: finalUrl,
        scene_index: idx,
      })
    }

    // Finalize: set status based on results
    const { data: final } = await supabase.from("tasks").select("generated_image_groups").eq("id", taskId).single()
    const finalGroups = getGeneratedImageGroups(final?.generated_image_groups)
    const finalGroup = finalGroups.find((group) => group.id === generationGroup.id)
    const successCount = finalGroup?.images.length ?? 0
    const finalStatus = successCount > 0 ? "complete" : "failed"
    const updatedGroups = updateGeneratedImageGroup(finalGroups, generationGroup.id, (group) => ({
      ...group,
      status: finalStatus,
    }))
    console.log(`[generate] task=${taskId} — DONE: ${successCount} success, ${finalGroup?.failed_suggestions.length ?? 0} failed → ${finalStatus}`)
    await supabase.from("tasks").update({ status: finalStatus, generated_image_groups: updatedGroups, updated_at: new Date().toISOString() }).eq("id", taskId)
  })

  return NextResponse.json({ ok: true })
}

function getGeneratedImageGroups(value: unknown): GeneratedImageGroup[] {
  return Array.isArray(value) ? value as GeneratedImageGroup[] : []
}

function updateGeneratedImageGroup(
  groups: GeneratedImageGroup[],
  groupId: string,
  update: (group: GeneratedImageGroup) => GeneratedImageGroup
) {
  return groups.map((group) => group.id === groupId ? update(group) : group)
}

function createLegacyGeneratedImageGroups(task: {
  generated_images?: string[] | null
  selected_suggestions?: number[] | null
  failed_suggestions?: number[] | null
} | null): GeneratedImageGroup[] {
  const generatedImages = task?.generated_images ?? []
  if (generatedImages.length === 0) return []

  const failedSet = new Set(task?.failed_suggestions ?? [])
  const sceneForImage = (task?.selected_suggestions ?? []).filter((idx) => !failedSet.has(idx))

  return [{
    id: "legacy",
    index: 1,
    selected_suggestions: task?.selected_suggestions ?? [],
    failed_suggestions: task?.failed_suggestions ?? [],
    images: generatedImages.map((url, i) => ({
      url,
      scene_index: sceneForImage[i] ?? i,
    })),
    status: "complete",
    created_at: new Date().toISOString(),
  }]
}

async function appendGeneratedImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  groupId: string,
  image: GeneratedImageItem
) {
  const { data } = await supabase
    .from("tasks")
    .select("generated_images, generated_image_groups")
    .eq("id", taskId)
    .single()

  const groups = getGeneratedImageGroups(data?.generated_image_groups)
  const updatedGroups = updateGeneratedImageGroup(groups, groupId, (group) => ({
    ...group,
    images: [...(group.images ?? []), image],
  }))
  const images = [...(data?.generated_images ?? []), image.url]

  await supabase.from("tasks").update({
    generated_images: images,
    generated_image_groups: updatedGroups,
    updated_at: new Date().toISOString(),
  }).eq("id", taskId)
}

async function appendFailed(supabase: Awaited<ReturnType<typeof createClient>>, taskId: string, groupId: string, idx: number) {
  const { data } = await supabase.from("tasks").select("failed_suggestions, generated_image_groups").eq("id", taskId).single()
  const failed = [...new Set([...(data?.failed_suggestions ?? []), idx])]
  const groups = getGeneratedImageGroups(data?.generated_image_groups)
  const updatedGroups = updateGeneratedImageGroup(groups, groupId, (group) => ({
    ...group,
    failed_suggestions: [...new Set([...(group.failed_suggestions ?? []), idx])],
  }))

  await supabase.from("tasks").update({
    failed_suggestions: failed,
    generated_image_groups: updatedGroups,
    updated_at: new Date().toISOString(),
  }).eq("id", taskId)
}
