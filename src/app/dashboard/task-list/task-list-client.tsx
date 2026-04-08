"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ImageIcon,
  Trash2Icon,
  CopyIcon,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Task } from "@/lib/types/task"
import { deleteTask } from "./actions"

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const },
  running: { label: "Running", variant: "default" as const },
  completed: { label: "Completed", variant: "outline" as const },
  failed: { label: "Failed", variant: "destructive" as const },
}

export function TaskListClient({ initialData }: { initialData: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialData)
  const [selectedId, setSelectedId] = useState<string | null>(initialData[0]?.id ?? null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const selected = tasks.find((t) => t.id === selectedId) ?? null

  const allChecked = tasks.length > 0 && checkedIds.size === tasks.length

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allChecked) setCheckedIds(new Set())
    else setCheckedIds(new Set(tasks.map((t) => t.id)))
  }

  async function handleBatchDelete() {
    const ids = Array.from(checkedIds)
    const results = await Promise.all(ids.map((id) => deleteTask(id)))
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) toast.error(`${failed.length} failed to delete`)
    else toast.success(`${ids.length} deleted`)
    setTasks((prev) => prev.filter((t) => !checkedIds.has(t.id)))
    if (checkedIds.has(selectedId ?? "")) setSelectedId(null)
    setCheckedIds(new Set())
    setBatchDeleteOpen(false)
  }

  return (
    <div className="flex h-full">
      {/* Left: Task List */}
      <div className="w-[28rem] shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
            {checkedIds.size > 0 ? (
              <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>
                <Trash2Icon className="size-4" />
                Delete ({checkedIds.size})
              </Button>
            ) : (
              <h2 className="text-sm font-semibold">Tasks ({tasks.length})</h2>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tasks.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No tasks yet
            </div>
          )}
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-4 px-4 py-4 border-b transition-colors cursor-pointer",
                selectedId === task.id ? "bg-accent border-l-2 border-l-foreground" : "hover:bg-muted/50"
              )}
              onClick={() => setSelectedId(task.id)}
            >
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={checkedIds.has(task.id)}
                  onCheckedChange={() => toggleCheck(task.id)}
                  aria-label={`Select task`}
                />
              </div>
              <TaskThumbnail url={task.image_url} />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <span className="text-sm font-mono text-muted-foreground truncate">{task.id.slice(0, 8)}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(task.created_at).toLocaleDateString("zh-CN")}
                </span>
                <Badge variant={statusConfig[task.status].variant} className="text-xs w-fit">
                  {statusConfig[task.status].label}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Task Detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <TaskDetail task={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a task to view details
          </div>
        )}
      </div>

      {/* Batch Delete Confirm */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {checkedIds.size} Tasks</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBatchDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TaskThumbnail({ url }: { url: string }) {
  if (!url) {
    return (
      <div className="size-24 shrink-0 rounded-lg border bg-muted/30 flex items-center justify-center">
        <ImageIcon className="size-10 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className="size-24 shrink-0 rounded-lg border overflow-hidden relative bg-muted/30">
      <Skeleton className="absolute inset-0 size-full rounded-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="relative size-full object-cover"
      />
    </div>
  )
}

function TaskDetail({ task }: { task: Task }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{task.id}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(task.id); toast.success("Task ID copied") }}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <CopyIcon className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <Badge variant={statusConfig[task.status].variant}>{statusConfig[task.status].label}</Badge>
          <span>{new Date(task.created_at).toLocaleString("zh-CN")}</span>
        </div>
      </div>

      {task.image_url && (
        <div className="rounded-lg border overflow-hidden bg-muted/30 max-w-md">
          <img src={task.image_url} alt="Task image" className="w-full object-contain" />
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        <span>Prompt Mode ID: </span>
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{task.prompt_mode_id}</code>
      </div>
    </div>
  )
}
