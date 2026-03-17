"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  PlusIcon,
  ImageIcon,
  Trash2Icon,
  CopyIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
  PauseCircleIcon,
  DownloadIcon,
  RefreshCwIcon,
  ExpandIcon,
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type TaskImage = {
  id: string
  url: string
  prompt: string
  seed: number
  width: number
  height: number
  status: "generating" | "completed" | "failed"
  created_at: string
}

type Task = {
  id: string
  name: string
  status: "pending" | "running" | "completed" | "failed"
  created_at: string
  updated_at: string | null
  prompt_mode: string
  prompt_mode_id: string
  image_count: number
  completed_count: number
  failed_count: number
  width: number
  height: number
  seed: number | null
  negative_prompt: string
  steps: number
  cfg_scale: number
  sampler: string
  creator: string
  images: TaskImage[]
  error_message: string | null
  duration: number | null // seconds
}

const mockImages: TaskImage[] = [
  { id: "img-1", url: "", prompt: "a beautiful mountain landscape, sunset, golden hour, photorealistic", seed: 42, width: 1024, height: 1024, status: "completed", created_at: "2026-03-17T10:01:00Z" },
  { id: "img-2", url: "", prompt: "a beautiful ocean landscape, sunrise, photorealistic", seed: 43, width: 1024, height: 1024, status: "completed", created_at: "2026-03-17T10:02:00Z" },
  { id: "img-3", url: "", prompt: "a beautiful forest landscape, misty morning, photorealistic", seed: 44, width: 1024, height: 1024, status: "completed", created_at: "2026-03-17T10:03:00Z" },
  { id: "img-4", url: "", prompt: "a beautiful desert landscape, starry night, photorealistic", seed: 45, width: 1024, height: 1024, status: "completed", created_at: "2026-03-17T10:04:00Z" },
  { id: "img-5", url: "", prompt: "a beautiful city skyline, night, neon lights, photorealistic", seed: 46, width: 1024, height: 1024, status: "completed", created_at: "2026-03-17T10:05:00Z" },
]

const mockTasks: Task[] = [
  {
    id: "task-a1b2c3d4", name: "风景插画生成", status: "completed", created_at: "2026-03-17T10:00:00Z", updated_at: "2026-03-17T10:05:30Z",
    prompt_mode: "写实风格", prompt_mode_id: "pm-1", image_count: 5, completed_count: 5, failed_count: 0,
    width: 1024, height: 1024, seed: 42, negative_prompt: "blurry, low quality, watermark", steps: 30, cfg_scale: 7.5, sampler: "DPM++ 2M Karras",
    creator: "admin@example.com", images: mockImages, error_message: null, duration: 330,
  },
  {
    id: "task-e5f6g7h8", name: "角色立绘批量", status: "running", created_at: "2026-03-17T09:30:00Z", updated_at: "2026-03-17T09:32:00Z",
    prompt_mode: "动漫风格", prompt_mode_id: "pm-2", image_count: 3, completed_count: 1, failed_count: 0,
    width: 768, height: 1024, seed: null, negative_prompt: "realistic, photo", steps: 25, cfg_scale: 8, sampler: "Euler a",
    creator: "admin@example.com", images: mockImages.slice(0, 3).map((img, i) => ({ ...img, status: i === 0 ? "completed" : "generating" })), error_message: null, duration: null,
  },
  {
    id: "task-i9j0k1l2", name: "产品图渲染", status: "pending", created_at: "2026-03-16T15:00:00Z", updated_at: null,
    prompt_mode: "商业摄影", prompt_mode_id: "pm-3", image_count: 8, completed_count: 0, failed_count: 0,
    width: 1024, height: 1024, seed: 100, negative_prompt: "cartoon, illustration", steps: 40, cfg_scale: 7, sampler: "DPM++ SDE Karras",
    creator: "admin@example.com", images: [], error_message: null, duration: null,
  },
  {
    id: "task-m3n4o5p6", name: "头像生成测试", status: "failed", created_at: "2026-03-16T12:00:00Z", updated_at: "2026-03-16T12:01:00Z",
    prompt_mode: "写实风格", prompt_mode_id: "pm-1", image_count: 2, completed_count: 0, failed_count: 2,
    width: 512, height: 512, seed: 77, negative_prompt: "blurry", steps: 20, cfg_scale: 7.5, sampler: "Euler a",
    creator: "admin@example.com", images: mockImages.slice(0, 2).map((img) => ({ ...img, status: "failed" as const })), error_message: "CUDA out of memory. Tried to allocate 2.00 GiB.", duration: 60,
  },
  {
    id: "task-q7r8s9t0", name: "场景概念图", status: "completed", created_at: "2026-03-15T18:00:00Z", updated_at: "2026-03-15T18:10:00Z",
    prompt_mode: "概念艺术", prompt_mode_id: "pm-4", image_count: 6, completed_count: 6, failed_count: 0,
    width: 1920, height: 1080, seed: 200, negative_prompt: "photo, realistic", steps: 35, cfg_scale: 9, sampler: "DPM++ 2M Karras",
    creator: "admin@example.com", images: [...mockImages, { ...mockImages[0], id: "img-6" }], error_message: null, duration: 600,
  },
]

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const },
  running: { label: "Running", variant: "default" as const },
  completed: { label: "Completed", variant: "outline" as const },
  failed: { label: "Failed", variant: "destructive" as const },
}

export function TaskListClient() {
  const [selectedId, setSelectedId] = useState<string | null>(mockTasks[0]?.id ?? null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const selected = mockTasks.find((t) => t.id === selectedId) ?? null

  const allChecked = mockTasks.length > 0 && checkedIds.size === mockTasks.length

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(mockTasks.map((t) => t.id)))
    }
  }

  function handleBatchDelete() {
    // TODO: call server action
    setCheckedIds(new Set())
    setBatchDeleteOpen(false)
  }

  return (
    <div className="flex h-full">
      {/* Left: Task List */}
      <div className="w-96 shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
            {checkedIds.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>
                <Trash2Icon className="size-4" />
                Delete ({checkedIds.size})
              </Button>
            )}
            {checkedIds.size === 0 && <h2 className="text-sm font-semibold">Tasks</h2>}
          </div>
          <Button size="sm" variant="outline">
            <PlusIcon className="size-4" />
            New Task
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b transition-colors cursor-pointer",
                selectedId === task.id ? "bg-accent border-l-2 border-l-foreground" : "hover:bg-muted/50"
              )}
              onClick={() => setSelectedId(task.id)}
            >
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={checkedIds.has(task.id)}
                  onCheckedChange={() => toggleCheck(task.id)}
                  aria-label={`Select ${task.name}`}
                />
              </div>
              <div className="size-24 shrink-0 rounded-md border bg-muted/30 flex items-center justify-center">
                <ImageIcon className="size-10 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between h-24">
                <div>
                  <span className="text-sm font-medium truncate block">{task.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{task.prompt_mode}</span>
                    <span>·</span>
                    <span>{new Date(task.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div>
                  <Badge variant={statusConfig[task.status].variant} className="text-xs">
                    {statusConfig[task.status].label}
                  </Badge>
                </div>
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

function StatusIcon({ status }: { status: Task["status"] }) {
  switch (status) {
    case "pending": return <PauseCircleIcon className="size-4 text-muted-foreground" />
    case "running": return <LoaderIcon className="size-4 text-blue-500 animate-spin" />
    case "completed": return <CheckCircle2Icon className="size-4 text-green-500" />
    case "failed": return <XCircleIcon className="size-4 text-destructive" />
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function ImageStatusBadge({ status }: { status: TaskImage["status"] }) {
  if (status === "completed") return null
  if (status === "generating") return <Badge variant="default" className="absolute top-2 right-2 text-xs">Generating</Badge>
  return <Badge variant="destructive" className="absolute top-2 right-2 text-xs">Failed</Badge>
}

function getStepIndex(status: Task["status"]): number {
  switch (status) {
    case "pending": return 0
    case "running": return 1
    case "completed": return 3
    case "failed": return 2
  }
}

const steps = [
  { label: "Created", description: "Task created" },
  { label: "Running", description: "Generating images" },
  { label: "Processing", description: "Post-processing" },
  { label: "Completed", description: "All done" },
]

function TaskStepper({ status, activeStep, onStepClick }: { status: Task["status"]; activeStep: number; onStepClick: (index: number) => void }) {
  const current = getStepIndex(status)
  const isFailed = status === "failed"

  return (
    <div className="flex items-center justify-center py-4">
      {steps.map((step, i) => {
        const isCompleted = !isFailed && i < current
        const isCurrent = i === current
        const isFailedStep = isFailed && isCurrent
        const isActive = i === activeStep
        // 未到达的步骤: 灰色, 当前进行中: 黑色(foreground), 已完成: 绿色, 失败: 红色
        const isPending = !isCompleted && !isCurrent

        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              className="flex flex-col items-center gap-1.5 cursor-pointer"
              onClick={() => onStepClick(i)}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  isCurrent && !isFailedStep && "border-foreground bg-foreground text-background",
                  isFailedStep && "border-destructive bg-destructive text-white",
                  isPending && "border-muted-foreground/30 text-muted-foreground/40 bg-muted/50",
                  isActive && !isFailedStep && !isCompleted && "ring-2 ring-foreground/30 ring-offset-2",
                  isActive && isCompleted && "ring-2 ring-green-500/50 ring-offset-2",
                  isActive && isFailedStep && "ring-2 ring-destructive/50 ring-offset-2",
                )}
              >
                {isCompleted ? (
                  <CheckCircle2Icon className="size-4" />
                ) : isFailedStep ? (
                  <XCircleIcon className="size-4" />
                ) : (
                  i + 1
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-xs font-medium",
                  isCompleted && "text-green-600",
                  isCurrent && !isFailedStep && "text-foreground",
                  isFailedStep && "text-destructive",
                  isPending && "text-muted-foreground/40",
                )}>
                  {isFailedStep ? "Failed" : step.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{isFailedStep ? "Task failed" : step.description}</span>
              </div>
            </button>
            {i < steps.length - 1 && (
              <div className={cn(
                "mx-3 h-0.5 w-16 rounded-full",
                isCompleted ? "bg-green-500" : "bg-muted-foreground/20",
                isFailed && i < current ? "bg-destructive" : "",
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TaskDetail({ task }: { task: Task }) {
  const [activeStep, setActiveStep] = useState(getStepIndex(task.status))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">{task.name}</h1>
        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
          <span>{new Date(task.created_at).toLocaleString("zh-CN")}</span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{task.id}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(task.id); toast.success("Task ID copied") }}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <CopyIcon className="size-3.5" />
            </button>
          </span>
        </div>
      </div>

      <TaskStepper status={task.status} activeStep={activeStep} onStepClick={setActiveStep} />

      {/* TODO: step detail content based on activeStep */}
    </div>
  )
}

function ParamCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4", highlight && "border-destructive/50 bg-destructive/5")}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-sm font-medium", highlight && "text-destructive")}>{value}</p>
    </div>
  )
}
