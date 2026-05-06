"use server"

import { createClient } from "@/lib/supabase/server"
import { generateSceneSuggestions, generateImage } from "@/lib/openrouter"
import type { Task } from "@/lib/types/task"
import { revalidatePath } from "next/cache"

export async function createTasks(
  input: { promptModeId: string; imageUrls: string[] }
): Promise<{ data: Task[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { promptModeId, imageUrls } = input
  if (!promptModeId) return { data: null, error: "Prompt Mode is required" }
  if (imageUrls.length === 0) return { data: null, error: "At least one image is required" }

  const baseTime = Date.now()
  const rows = imageUrls.map((url, i) => ({
    image_url: url,
    prompt_mode_id: promptModeId,
    status: "pending",
    creator: user.email!,
    created_at: new Date(baseTime + i).toISOString(),
  }))

  const { data, error } = await supabase
    .from("tasks")
    .insert(rows)
    .select()

  if (error) return { data: null, error: error.message }

  revalidatePath("/dashboard/task-list")
  return { data: data as Task[], error: null }
}

export async function fetchTasks(): Promise<{ data: Task[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as Task[], error: null }
}

export async function updateTask(
  id: string,
  input: { title?: string; status?: string; reference_urls?: string[]; generated_images?: string[]; selected_suggestions?: number[]; failed_suggestions?: number[] }
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  // If reference_urls is being updated, clean up removed files from Storage
  if (input.reference_urls !== undefined) {
    const { data: oldTask } = await supabase
      .from("tasks")
      .select("reference_urls")
      .eq("id", id)
      .single()

    const oldUrls: string[] = oldTask?.reference_urls ?? []
    const newUrls = new Set(input.reference_urls)
    const removedUrls = oldUrls.filter((url) => !newUrls.has(url))

    if (removedUrls.length > 0) {
      const paths = removedUrls
        .map((url) => url.match(/\/object\/public\/images\/(.+)$/)?.[1])
        .filter(Boolean) as string[]
      if (paths.length > 0) {
        await supabase.storage.from("images").remove(paths)
      }
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath("/dashboard/task-list")
  return { data: data as Task, error: null }
}

export async function uploadReferenceImages(
  formData: FormData
): Promise<{ urls: string[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { urls: null, error: "Unauthorized" }

  const files = formData.getAll("references") as File[]
  if (files.length === 0) return { urls: [], error: null }

  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split(".").pop() || "png"
    const path = `references/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, file)

    if (uploadError) {
      return { urls: null, error: `上传失败: ${uploadError.message}` }
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(path)

    urls.push(urlData.publicUrl)
  }

  return { urls, error: null }
}

/**
 * Start a task: set status to running, call OpenRouter for scene suggestions,
 * then update status to ready (success) or failed.
 */
export async function startTask(
  taskId: string
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  // 1. Fetch task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single()

  if (fetchError || !task) return { data: null, error: fetchError?.message ?? "Task not found" }

  // 2. Set status to suggest, clear downstream data
  await supabase
    .from("tasks")
    .update({ status: "suggest", scene_suggestions: [], generated_images: [], updated_at: new Date().toISOString() })
    .eq("id", taskId)

  // 3. Fetch prompt mode + associated prompts
  const { data: promptMode } = await supabase
    .from("prompt_modes")
    .select("*")
    .eq("id", task.prompt_mode_id)
    .single()

  let keywords: { title: string; content: string }[] = []
  if (promptMode?.prompt_ids?.length) {
    const { data: prompts } = await supabase
      .from("prompts")
      .select("id, title, content")
      .in("id", promptMode.prompt_ids)

    // Keep the order from prompt_ids
    const promptMap = new Map((prompts ?? []).map((p: { id: string; title: string; content: string }) => [p.id, p]))
    keywords = promptMode.prompt_ids
      .map((id: string) => promptMap.get(id))
      .filter(Boolean)
      .map((p: { title: string; content: string }) => ({ title: p.title, content: p.content }))
  }

  // 4. Call OpenRouter with all keywords at once
  console.log(`[startTask] task=${taskId} — calling AI with ${keywords.length} keywords...`)
  const { suggestions, error: aiError } = await generateSceneSuggestions({
    imageUrl: task.image_url,
    title: task.title || "",
    rolePrompt: promptMode?.role_prompt,
    keywords,
  })

  // 5. Update task with results
  if (aiError || !suggestions || suggestions.length === 0) {
    console.log(`[startTask] task=${taskId} — AI FAILED: ${aiError}`)
    const { data: failedTask } = await supabase
      .from("tasks")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single()

    revalidatePath("/dashboard/task-list")
    return { data: failedTask as Task, error: aiError ?? "AI generation failed" }
  }

  console.log(`[startTask] task=${taskId} — AI SUCCESS: ${suggestions.length} suggestions`)

  const { data: updatedTask, error: updateError } = await supabase    .from("tasks")
    .update({
      scene_suggestions: suggestions,
      status: "image",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select()
    .single()

  if (updateError) return { data: null, error: updateError.message }

  revalidatePath("/dashboard/task-list")
  return { data: updatedTask as Task, error: null }
}

/**
 * Generate a single image for one scene suggestion.
 * Calls AI, uploads result to Supabase Storage, appends URL to task's generated_images.
 */
export async function generateSingleImage(
  taskId: string,
  sceneIndex: number
): Promise<{ imageUrl: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imageUrl: null, error: "Unauthorized" }

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single()

  if (fetchError || !task) return { imageUrl: null, error: fetchError?.message ?? "Task not found" }

  const suggestions: string[] = task.scene_suggestions ?? []
  const suggestion = suggestions[sceneIndex]
  if (!suggestion) return { imageUrl: null, error: "Invalid scene index" }

  // Fetch prompt mode for role_prompt
  const { data: promptMode } = await supabase
    .from("prompt_modes")
    .select("role_prompt")
    .eq("id", task.prompt_mode_id)
    .single()

  // Call AI
  console.log(`[generateSingleImage] task=${taskId} scene=${sceneIndex} — calling AI...`)
  const { imageUrl, error: genError } = await generateImage({
    productImageUrl: task.image_url,
    referenceImageUrls: task.reference_urls?.length > 0 ? task.reference_urls : undefined,
    rolePrompt: promptMode?.role_prompt,
    sceneSuggestion: suggestion,
    title: task.title || undefined,
  })

  const selectedCount = task.selected_suggestions?.length ?? 0

  // Helper: check if all selected scenes are done (success + fail) and set final status
  const checkAndFinalize = async (successCount: number, failCount: number) => {
    const done = selectedCount > 0 && successCount + failCount >= selectedCount
    console.log(`[generateSingleImage] task=${taskId} checkFinalize: success=${successCount} fail=${failCount} selected=${selectedCount} done=${done}`)
    if (done) {
      const finalStatus = successCount > 0 ? "complete" : "failed"
      console.log(`[generateSingleImage] task=${taskId} — setting final status: ${finalStatus}`)
      await supabase.from("tasks").update({ status: finalStatus, updated_at: new Date().toISOString() }).eq("id", taskId)
      revalidatePath("/dashboard/task-list")
    }
  }

  if (genError || !imageUrl) {
    console.log(`[generateSingleImage] task=${taskId} scene=${sceneIndex} — AI FAILED: ${genError}`)
    // Record this scene as failed
    const currentFailed: number[] = task.failed_suggestions ?? []
    const newFailed = [...currentFailed, sceneIndex]
    await supabase.from("tasks").update({ failed_suggestions: newFailed, updated_at: new Date().toISOString() }).eq("id", taskId)
    await checkAndFinalize((task.generated_images ?? []).length, newFailed.length)
    return { imageUrl: null, error: genError ?? "AI generation failed" }
  }

  console.log(`[generateSingleImage] task=${taskId} scene=${sceneIndex} — AI SUCCESS, url length=${imageUrl.length}`)

  // Upload to Supabase Storage if base64
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
      console.log(`[generateSingleImage] task=${taskId} scene=${sceneIndex} — UPLOAD FAILED: ${uploadError.message}`)
      const currentFailed: number[] = task.failed_suggestions ?? []
      const newFailed = [...currentFailed, sceneIndex]
      await supabase.from("tasks").update({ failed_suggestions: newFailed, updated_at: new Date().toISOString() }).eq("id", taskId)
      await checkAndFinalize((task.generated_images ?? []).length, newFailed.length)
      return { imageUrl: null, error: `Upload failed: ${uploadError.message}` }
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(path)
    finalUrl = urlData.publicUrl
  }

  // Append to generated_images
  const currentImages: string[] = task.generated_images ?? []
  const newImages = [...currentImages, finalUrl]
  const failedCount = (task.failed_suggestions ?? []).length

  const updatePayload: Record<string, unknown> = {
    generated_images: newImages,
    updated_at: new Date().toISOString(),
  }
  // Check if all done
  if (selectedCount > 0 && newImages.length + failedCount >= selectedCount) {
    updatePayload.status = newImages.length > 0 ? "complete" : "failed"
  }

  console.log(`[generateSingleImage] task=${taskId} scene=${sceneIndex} — updating DB: images=${newImages.length} failed=${failedCount} selected=${selectedCount} newStatus=${updatePayload.status ?? "unchanged"}`)

  const { error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)

  if (updateError) {
    return { imageUrl: null, error: updateError.message }
  }

  if (updatePayload.status) {
    revalidatePath("/dashboard/task-list")
  }

  return { imageUrl: finalUrl, error: null }
}

/**
 * Update task status after all image generation is done.
 */
export async function finishImageGeneration(
  taskId: string
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single()

  const finalStatus = (task?.generated_images?.length ?? 0) > 0 ? "complete" : "failed"

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath("/dashboard/task-list")
  return { data: data as Task, error: null }
}

export async function startSuggestGeneration(
  taskId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { headers } = await import("next/headers")
  const headersList = await headers()
  const cookie = headersList.get("cookie") ?? ""
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") ? "http" : "https"

  const res = await fetch(`${protocol}://${host}/api/tasks/${taskId}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? `Failed (${res.status})` }
  }

  revalidatePath("/dashboard/task-list")
  return { error: null }
}

export async function startImageGeneration(
  taskId: string,
  indexes: number[]
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { headers } = await import("next/headers")
  const headersList = await headers()
  const cookie = headersList.get("cookie") ?? ""
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") ? "http" : "https"

  const res = await fetch(`${protocol}://${host}/api/tasks/${taskId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ indexes }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? `Failed (${res.status})` }
  }

  revalidatePath("/dashboard/task-list")
  return { error: null }
}

export async function deleteTask(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  // Fetch task to get image_url before deleting
  const { data: task } = await supabase
    .from("tasks")
    .select("image_url")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) return { error: error.message }

  // Clean up Storage image
  if (task?.image_url) {
    const match = task.image_url.match(/\/object\/public\/images\/(.+)$/)
    if (match) {
      await supabase.storage.from("images").remove([match[1]])
    }
  }

  revalidatePath("/dashboard/task-list")
  return { error: null }
}
