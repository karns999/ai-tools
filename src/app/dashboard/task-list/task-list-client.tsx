"use client"

import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ImageIcon,
  Trash2Icon,
  CopyIcon,
  PlayIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
  DownloadIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import JSZip from "jszip"
import { toast } from "sonner"
import type { Task } from "@/lib/types/task"
import type { PromptMode } from "@/lib/types/prompt-mode"
import type { Prompt } from "@/lib/types/prompt"
import { deleteTask, updateTask, uploadReferenceImages, startTask, generateSingleImage, fetchTasks } from "./actions"

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-neutral-200 text-neutral-700 border-neutral-300" },
  suggest: { label: "场景建议生成中", className: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" },
  image: { label: "准备生图", className: "bg-blue-100 text-blue-700 border-blue-200" },
  generating: { label: "生图中", className: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" },
  complete: { label: "已完成", className: "bg-green-100 text-green-700 border-green-200" },
  failed: { label: "失败", className: "bg-red-100 text-red-700 border-red-200" },
  // Legacy status compatibility
  running: { label: "进行中", className: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" },
  ready: { label: "准备生图", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "已完成", className: "bg-green-100 text-green-700 border-green-200" },
}

export function TaskListClient({
  initialData,
  promptModeMap,
  promptMap,
}: {
  initialData: Task[]
  promptModeMap: Record<string, PromptMode>
  promptMap: Record<string, Pick<Prompt, "id" | "title" | "content">>
}) {
  const [tasks, setTasks] = useState<Task[]>(initialData)
  const [selectedId, setSelectedId] = useState<string | null>(initialData[0]?.id ?? null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const selected = tasks.find((t) => t.id === selectedId) ?? null

  // Poll for task updates every 5 seconds when any task is in a processing state
  useEffect(() => {
    const hasProcessing = tasks.some((t) => t.status === "suggest" || t.status === "generating")
    if (!hasProcessing) return

    const interval = setInterval(async () => {
      const { data } = await fetchTasks()
      if (data) {
        setTasks(data)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [tasks])

  // Track generating state per task so it persists across switches
  const [generatingState, setGeneratingState] = useState<Record<string, {
    generating: boolean
    images: string[]
    total: number
  }>>({})

  // Track selected suggestions per task
  const [selectedSuggestionsMap, setSelectedSuggestionsMap] = useState<Record<string, Set<number>>>(() => {
    const map: Record<string, Set<number>> = {}
    for (const t of initialData) {
      if (t.selected_suggestions && t.selected_suggestions.length > 0) {
        map[t.id] = new Set(t.selected_suggestions)
      }
    }
    return map
  })

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
    setDeleting(true)
    const ids = Array.from(checkedIds)
    const results = await Promise.all(ids.map((id) => deleteTask(id)))
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) toast.error(`${failed.length} 个删除失败`)
    else toast.success(`已删除 ${ids.length} 个任务`)
    setTasks((prev) => prev.filter((t) => !checkedIds.has(t.id)))
    if (checkedIds.has(selectedId ?? "")) setSelectedId(null)
    setCheckedIds(new Set())
    setBatchDeleteOpen(false)
    setDeleting(false)
  }

  function handleTaskUpdate(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
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
                删除 ({checkedIds.size})
              </Button>
            ) : (
              <h2 className="text-sm font-semibold">任务列表 ({tasks.length})</h2>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tasks.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              暂无任务
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
                  aria-label="Select task"
                />
              </div>
              <TaskThumbnail url={task.image_url} />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <span className="text-sm font-medium truncate">{task.title || ""}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(task.created_at).toLocaleDateString("zh-CN")}
                </span>
                <Badge variant="outline" className={cn("text-xs w-fit font-medium", statusConfig[task.status].className)}>
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
          <TaskDetail
            key={selected.id}
            task={selected}
            promptMode={promptModeMap[selected.prompt_mode_id] || null}
            promptMap={promptMap}
            onUpdate={handleTaskUpdate}
            generatingState={generatingState[selected.id] || null}
            onGeneratingStateChange={(state) => {
              setGeneratingState((prev) => ({
                ...prev,
                [selected.id]: state,
              }))
            }}
            selectedSuggestions={selectedSuggestionsMap[selected.id] || new Set()}
            onSelectedSuggestionsChange={(s) => {
              setSelectedSuggestionsMap((prev) => ({
                ...prev,
                [selected.id]: s,
              }))
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            选择一个任务查看详情
          </div>
        )}
      </div>

      {/* Batch Delete Confirm */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {checkedIds.size} 个任务</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销，确定要删除吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={(e) => { e.preventDefault(); handleBatchDelete() }} disabled={deleting}>
              {deleting ? "删除中..." : "删除"}
            </AlertDialogAction>
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

function TaskDetail({
  task,
  promptMode,
  promptMap,
  onUpdate,
  generatingState,
  onGeneratingStateChange,
  selectedSuggestions,
  onSelectedSuggestionsChange,
}: {
  task: Task
  promptMode: PromptMode | null
  promptMap: Record<string, Pick<Prompt, "id" | "title" | "content">>
  onUpdate: (task: Task) => void
  generatingState: { generating: boolean; images: string[]; total: number } | null
  onGeneratingStateChange: (state: { generating: boolean; images: string[]; total: number }) => void
  selectedSuggestions: Set<number>
  onSelectedSuggestionsChange: (s: Set<number>) => void
}) {
  const [title, setTitle] = useState(task.title || "")
  const [starting, setStarting] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
  const taskIdRef = useRef(task.id)

  const generating = generatingState?.generating ?? false
  const generatingImages = generatingState?.images ?? []
  const generatingTotal = generatingState?.total ?? 0
  const [referenceFiles, setReferenceFiles] = useState<{ file: File; preview: string }[]>([])
  const [removedSavedRefs, setRemovedSavedRefs] = useState<Set<number>>(new Set())
  const refInputRef = useRef<HTMLInputElement>(null)

  function handleReferenceFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const currentCount = activeSavedRefs.length + referenceFiles.length
    const remaining = 3 - currentCount
    if (remaining <= 0) { toast.error("最多上传 3 张参考图"); return }
    const newItems = Array.from(files).slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setReferenceFiles((prev) => [...prev, ...newItems])
  }

  function removeReference(index: number) {
    setReferenceFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function removeSavedRef(index: number) {
    setRemovedSavedRefs((prev) => new Set(prev).add(index))
  }

  async function handleStart() {
    setStarting(true)

    // 1. Upload new reference images if any
    let newRefUrls: string[] = []
    if (referenceFiles.length > 0) {
      const formData = new FormData()
      referenceFiles.forEach((f) => formData.append("references", f.file))
      const { urls, error: uploadError } = await uploadReferenceImages(formData)
      if (uploadError) {
        toast.error(uploadError)
        setStarting(false)
        return
      }
      newRefUrls = urls ?? []
    }

    // 2. Save title + reference_urls first
    const allRefs = [...activeSavedRefs, ...newRefUrls]
    const updates: { title?: string; reference_urls: string[] } = {
      reference_urls: allRefs,
    }
    if (!task.title && title.trim()) {
      updates.title = title.trim()
    }

    const { error: saveError } = await updateTask(task.id, updates)
    if (saveError) {
      toast.error(saveError)
      setStarting(false)
      return
    }

    // Clean up local previews
    referenceFiles.forEach((f) => URL.revokeObjectURL(f.preview))
    setReferenceFiles([])
    setRemovedSavedRefs(new Set())

    // 3. Clear scene suggestions and set running status immediately
    onUpdate({ ...task, ...(updates.title ? { title: updates.title } : {}), reference_urls: allRefs, scene_suggestions: [], generated_images: [], status: "suggest" as const })
    setStarting(false)

    // 4. Start AI generation in background (no loading state)
    const currentTaskId = task.id
    startTask(task.id).then(({ data, error }) => {
      if (taskIdRef.current !== currentTaskId) return // User switched, polling will pick up the update
      if (error) {
        toast.error(error)
        if (data) onUpdate(data)
      } else if (data) {
        toast.success("场景建议已生成")
        onUpdate(data)
      }
    })
  }

  // Active saved reference images (excluding removed ones)
  const savedRefs = task.reference_urls ?? []
  const activeSavedRefs = savedRefs.filter((_, i) => !removedSavedRefs.has(i))
  const totalRefCount = activeSavedRefs.length + referenceFiles.length

  // Resolve prompts from prompt mode
  const associatedPrompts = (promptMode?.prompt_ids ?? [])
    .map((id) => promptMap[id])
    .filter(Boolean)

  return (
    <div className="p-6 lg:p-8 lg:pr-20">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-6">
        <Badge variant="outline" className={cn("font-medium", statusConfig[task.status].className)}>
          {statusConfig[task.status].label}
        </Badge>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{task.creator}</span>
          <span>·</span>
          <span>{new Date(task.created_at).toLocaleString("zh-CN")}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(task.id); toast.success("已复制任务 ID") }}
            className="cursor-pointer text-muted-foreground hover:text-foreground ml-1"
            title={task.id}
          >
            <CopyIcon className="size-3" />
          </button>
        </div>
      </div>

      {/* Images row */}
      <div className="flex justify-between mb-6">
        {/* Product Image */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">* 产品主图</Label>
          {task.image_url ? (
            <div className="size-52 rounded-xl border overflow-hidden bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={task.image_url} alt="Product" className="size-full object-contain" />
            </div>
          ) : (
            <div className="size-52 rounded-xl border bg-muted/30 flex items-center justify-center">
              <ImageIcon className="size-12 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Reference Images */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">参考图（可选，最多 3 张）</Label>
          <div className="flex gap-3">
            {/* Saved reference images (not removed) */}
            {savedRefs.map((url, i) => !removedSavedRefs.has(i) && (
              <div key={`saved-${i}`} className="size-52 rounded-xl border overflow-hidden bg-muted/30 relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`参考图 ${i + 1}`} className="size-full object-contain" />
                <button
                  onClick={() => removeSavedRef(i)}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
            {/* Newly added reference images */}
            {referenceFiles.map((ref, i) => (
              <div key={`new-${i}`} className="size-52 rounded-xl border overflow-hidden bg-muted/30 relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref.preview} alt={`参考图`} className="size-full object-contain" />
                <button
                  onClick={() => removeReference(i)}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
            {/* Upload slot */}
            {totalRefCount < 3 && (
              <div
                className="size-52 rounded-xl border-2 border-dashed bg-muted/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => refInputRef.current?.click()}
              >
                <PlusIcon className="size-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">点击上传</span>
              </div>
            )}
          </div>
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { handleReferenceFiles(e.target.files); e.target.value = "" }}
          />
        </div>
      </div>

      {/* Product Title */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-2 block">产品标题</Label>
        {task.title ? (
          <p className="text-sm py-2">{task.title}</p>
        ) : (
          <Input
            className="text-sm"
            placeholder="请输入产品标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </div>

      {/* Prompt Instructions */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-2 block">Prompt 指令</Label>
        <div className="flex flex-col gap-3">
          {promptMode?.role_prompt && (
            <div className="rounded-lg bg-neutral-100 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">角色指令</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{promptMode.role_prompt}</p>
            </div>
          )}

          {associatedPrompts.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {associatedPrompts.map((p, i) => (
                <div key={p.id} className="rounded-lg bg-neutral-100 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">图片 {i + 1} · {p.title}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                </div>
              ))}
            </div>
          )}

          {!promptMode?.role_prompt && associatedPrompts.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">暂无 Prompt 指令配置</p>
          )}
        </div>
      </div>

      {/* Start Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={handleStart}
          disabled={starting || task.status === "suggest" || task.status === "generating" || generating}
          className="w-64"
          size="lg"
        >
          {starting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlayIcon className="size-4" />
          )}
          {starting ? "开始中..." : "开始任务"}
        </Button>
      </div>

      {/* Scene Suggestions */}
      {task.status !== "pending" && <hr className="mb-6 border-t" />}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-2 block">场景建议</Label>

        {/* Quick Selections */}
        {task.scene_suggestions && task.scene_suggestions.length > 0 && promptMode?.quick_selections && promptMode.quick_selections.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {promptMode.quick_selections.map((qs, i) => {
              const qsIndexes = new Set(qs.indexes.map((idx) => idx - 1))
              const isActive = qsIndexes.size > 0 && [...qsIndexes].every((idx) => selectedSuggestions.has(idx))
              return (
                <Button
                  key={i}
                  size="sm"
                  variant="outline"
                  className={isActive ? "border-2 border-foreground" : ""}
                  onClick={() => {
                    const next = new Set<number>()
                    qs.indexes.forEach((idx) => next.add(idx - 1))
                    onSelectedSuggestionsChange(next)
                  }}
                >
                  {qs.label}（{qs.indexes.join(", ")}）
                </Button>
              )
            })}
            {selectedSuggestions.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelectedSuggestionsChange(new Set())}
              >
                清除选择
              </Button>
            )}
          </div>
        )}

        {task.scene_suggestions && task.scene_suggestions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {task.scene_suggestions.map((suggestion, i) => {
              const isSelected = selectedSuggestions.has(i)
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg bg-neutral-100 px-4 py-3 cursor-pointer transition-all",
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : "hover:bg-neutral-200/70"
                  )}
                  onClick={() => {
                    const next = new Set(selectedSuggestions)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    onSelectedSuggestionsChange(next)
                  }}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">场景 {i + 1}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            {task.status === "pending" ? "开始任务后将自动生成场景建议" : task.status === "suggest" ? "场景建议生成中..." : "暂无场景建议"}
          </p>
        )}

        {/* Generate Image Button */}
        {task.scene_suggestions && task.scene_suggestions.length > 0 && selectedSuggestions.size > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              className="w-64"
              size="lg"
              disabled={generating || task.status === "generating"}
              onClick={async () => {
                onGeneratingStateChange({ generating: true, images: [], total: Array.from(selectedSuggestions).length })
                const indexes = Array.from(selectedSuggestions).sort()
                const currentTaskId = task.id

                // Clear generated images and set status in DB first
                await updateTask(task.id, { status: "generating", generated_images: [], selected_suggestions: indexes } as { status?: string; generated_images?: string[]; selected_suggestions?: number[] })
                onUpdate({ ...task, generated_images: [], status: "generating" as const })

                const collectedImages: string[] = []
                for (const idx of indexes) {
                  if (taskIdRef.current !== currentTaskId) break
                  const { imageUrl, error } = await generateSingleImage(task.id, idx)
                  if (taskIdRef.current !== currentTaskId) break
                  if (error) {
                    toast.error(`场景 ${idx + 1} 生成失败: ${error}`)
                    continue
                  }
                  if (imageUrl) {
                    collectedImages.push(imageUrl)
                    onGeneratingStateChange({ generating: true, images: [...collectedImages], total: indexes.length })
                  }
                }

                // Backend auto-completes status when all images are done
                // If all failed, set status to failed
                if (collectedImages.length === 0) {
                  await updateTask(task.id, { status: "failed" })
                }
                // Refresh to get latest state
                if (taskIdRef.current === currentTaskId) {
                  const { data: refreshed } = await fetchTasks()
                  const updated = refreshed?.find((t) => t.id === task.id)
                  if (updated) onUpdate(updated)
                  onGeneratingStateChange({ generating: false, images: [], total: 0 })
                  if (collectedImages.length === 0) {
                    toast.error("所有图片生成失败")
                  } else {
                    toast.success("图片生成完成")
                  }
                }
              }}
            >
              {generating ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              {generating ? "生成中..." : `开始生图（${selectedSuggestions.size} 个场景）`}
            </Button>
          </div>
        )}
      </div>

      {/* Generated Images */}
      {(generating || task.status === "generating" || (task.generated_images && task.generated_images.length > 0)) && (() => {
        const isGenerating = generating || task.status === "generating"
        const displayImages = generating ? generatingImages : (task.generated_images ?? [])
        const totalCount = generating
          ? generatingTotal
          : (task.status === "generating" ? (task.selected_suggestions?.length ?? 0) : 0)
        const skeletonCount = Math.max(0, totalCount - displayImages.length)

        return (
        <>
          <hr className="mb-6 border-t" />
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">生成结果</Label>
              {!isGenerating && task.generated_images && task.generated_images.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedImages.size === task.generated_images.length) {
                        setSelectedImages(new Set())
                      } else {
                        setSelectedImages(new Set(task.generated_images.map((_, i) => i)))
                      }
                    }}
                  >
                    <CheckIcon className="size-3" />
                    {selectedImages.size === task.generated_images.length ? "取消全选" : "全选"}
                  </Button>
                  {selectedImages.size > 0 && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const images = task.generated_images ?? []
                        const indexes = Array.from(selectedImages).sort()
                        const zip = new JSZip()
                        for (const idx of indexes) {
                          const url = images[idx]
                          if (!url) continue
                          try {
                            const res = await fetch(url)
                            const blob = await res.blob()
                            const ext = blob.type.split("/")[1] || "jpg"
                            zip.file(`${task.title || "image"}_${idx + 1}.${ext}`, blob)
                          } catch {
                            toast.error(`图片 ${idx + 1} 获取失败`)
                          }
                        }
                        const content = await zip.generateAsync({ type: "blob" })
                        const blobUrl = URL.createObjectURL(content)
                        const a = document.createElement("a")
                        a.href = blobUrl
                        a.download = `${task.title || "images"}.zip`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(blobUrl)
                        toast.success(`已下载 ${indexes.length} 张图片`)
                      }}
                    >
                      <DownloadIcon className="size-3" />
                      下载（{selectedImages.size}）
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {isGenerating ? (
                <>
                  {displayImages.map((url, i) => (
                    <div
                      key={`done-${i}`}
                      className="aspect-square rounded-xl border overflow-hidden bg-muted/30 cursor-pointer"
                      onClick={() => { setLightboxUrl(url); setLightboxIndex(i) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`生成图 ${i + 1}`} className="size-full object-contain" />
                    </div>
                  ))}
                  {Array.from({ length: skeletonCount }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="aspect-square rounded-xl overflow-hidden">
                      <Skeleton className="size-full rounded-none" />
                    </div>
                  ))}
                </>
              ) : (
                task.generated_images?.map((url, i) => (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-xl border overflow-hidden bg-muted/30 relative group cursor-pointer transition-all",
                      selectedImages.has(i) && "ring-2 ring-blue-500"
                    )}
                    onClick={() => { setLightboxUrl(url); setLightboxIndex(i) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`生成图 ${i + 1}`} className="size-full object-contain" />
                    {/* Selection checkbox */}
                    <div
                      className="absolute top-2 left-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedImages((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }}
                    >
                      <Checkbox
                        checked={selectedImages.has(i)}
                        className="bg-white/80"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
        )
      })()}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="!max-w-[90vw] !sm:max-w-[90vw] max-h-[90vh] w-fit p-2" showCloseButton={false}>
          {lightboxUrl && (() => {
            const images = generating ? generatingImages : (task.generated_images ?? [])
            const hasPrev = lightboxIndex > 0
            const hasNext = lightboxIndex < images.length - 1
            return (
              <div className="relative flex items-center justify-center">
                {hasPrev && (
                  <button
                    className="absolute left-2 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newIdx = lightboxIndex - 1
                      setLightboxIndex(newIdx)
                      setLightboxUrl(images[newIdx])
                    }}
                  >
                    <ChevronLeftIcon className="size-6" />
                  </button>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg" />
                {hasNext && (
                  <button
                    className="absolute right-2 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newIdx = lightboxIndex + 1
                      setLightboxIndex(newIdx)
                      setLightboxUrl(images[newIdx])
                    }}
                  >
                    <ChevronRightIcon className="size-6" />
                  </button>
                )}
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                  {lightboxIndex + 1} / {images.length}
                </span>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
