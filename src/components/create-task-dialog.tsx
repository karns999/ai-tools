"use client"

import { useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, XIcon, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { createTasks } from "@/app/dashboard/task-list/actions"
import { createClient } from "@/lib/supabase/client"

type PromptModeOption = { id: string; name: string }

type ImageItem = {
  file: File
  preview: string
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  promptModes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptModes: PromptModeOption[]
}) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [promptModeId, setPromptModeId] = useState("")
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  function handleFiles(files: FileList | null) {
    if (!files) return
    const newItems: ImageItem[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...newItems])
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function resetForm() {
    images.forEach((img) => URL.revokeObjectURL(img.preview))
    setImages([])
    setPromptModeId("")
  }

  const [uploadProgress, setUploadProgress] = useState("")

  async function handleCreate() {
    if (images.length === 0) { toast.error("请至少添加一张图片"); return }
    if (!promptModeId) { toast.error("请选择 Prompt 模式"); return }

    setCreating(true)
    setUploadProgress(`上传中 0/${images.length}`)

    const supabase = createClient()
    let uploaded = 0

    // Concurrent upload, max 5 at a time
    const CONCURRENCY = 5
    const imageUrls: (string | null)[] = new Array(images.length).fill(null)

    const queue = images.map((img, i) => async () => {
      const ext = img.file.name.split(".").pop() || "png"
      const path = `tasks/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, img.file)

      if (uploadError) {
        uploaded++
        setUploadProgress(`上传中 ${uploaded}/${images.length}`)
        return
      }

      const { data: urlData } = supabase.storage.from("images").getPublicUrl(path)
      imageUrls[i] = urlData.publicUrl
      uploaded++
      setUploadProgress(`上传中 ${uploaded}/${images.length}`)
    })

    // Run with concurrency limit
    const executing = new Set<Promise<void>>()
    for (const task of queue) {
      const p = task().then(() => { executing.delete(p) })
      executing.add(p)
      if (executing.size >= CONCURRENCY) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)

    const successUrls = imageUrls.filter(Boolean) as string[]
    const failCount = images.length - successUrls.length

    if (successUrls.length === 0) {
      toast.error("所有图片上传失败")
      setCreating(false)
      setUploadProgress("")
      return
    }

    if (failCount > 0) {
      toast.warning(`${failCount} 张图片上传失败，已跳过`)
    }

    setUploadProgress("正在创建任务...")
    const { error } = await createTasks({ promptModeId, imageUrls: successUrls })
    if (error) {
      toast.error(error)
    } else {
      toast.success(`已创建 ${images.length} 个任务`)
      resetForm()
      onOpenChange(false)
      if (pathname === "/dashboard/task-list") {
        window.location.reload()
      }
    }
    setCreating(false)
    setUploadProgress("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>创建任务</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Prompt 模式</Label>
            <Select value={promptModeId} onValueChange={setPromptModeId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择 Prompt 模式" />
              </SelectTrigger>
              <SelectContent>
                {promptModes.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>图片 ({images.length})</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <PlusIcon className="size-3" />
                添加图片
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = "" }}
              />
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="group relative aspect-square rounded-lg border overflow-hidden bg-muted/30">
                    <img
                      src={img.preview}
                      alt={img.file.name}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                    >
                      <XIcon className="size-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">点击添加图片</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? uploadProgress : `创建 ${images.length} 个任务`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
