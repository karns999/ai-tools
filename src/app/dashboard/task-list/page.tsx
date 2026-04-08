import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Task } from "@/lib/types/task"
import { TaskListClient } from "./task-list-client"

export default async function TaskListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })

  return <TaskListClient initialData={(tasks as Task[]) ?? []} />
}
