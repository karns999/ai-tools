"use server"

import { createClient } from "@/lib/supabase/server"
import type { Task } from "@/lib/types/task"
import { revalidatePath } from "next/cache"

export async function createTasks(
  formData: FormData
): Promise<{ data: Task[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Unauthorized" }

  const promptModeId = formData.get("prompt_mode_id") as string
  if (!promptModeId) return { data: null, error: "Prompt Mode is required" }

  const files = formData.getAll("images") as File[]
  if (files.length === 0) return { data: null, error: "At least one image is required" }

  // Upload images to Supabase Storage and collect URLs
  const imageUrls: string[] = []
  for (const file of files) {
    const ext = file.name.split(".").pop() || "png"
    const path = `tasks/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, file)

    if (uploadError) {
      return { data: null, error: `Upload failed: ${uploadError.message}` }
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(path)

    imageUrls.push(urlData.publicUrl)
  }

  // Batch insert tasks
  const rows = imageUrls.map((url) => ({
    image_url: url,
    prompt_mode_id: promptModeId,
    status: "pending",
    creator: user.email!,
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

  if (error) return { data: null, error: error.message }
  return { data: data as Task[], error: null }
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
