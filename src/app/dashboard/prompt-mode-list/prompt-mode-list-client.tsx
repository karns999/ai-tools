"use client"

import { useState } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EllipsisVerticalIcon, PlusIcon, CopyIcon, Trash2Icon, XIcon } from "lucide-react"
import type { PromptMode, QuickSelection } from "@/lib/types/prompt-mode"
import type { Prompt } from "@/lib/types/prompt"
import { createPromptMode, updatePromptMode, deletePromptMode } from "./actions"
import { toast } from "sonner"

type PromptOption = Pick<Prompt, "id" | "title">

type FormState = {
  name: string
  description: string
  role_prompt: string
  prompt_ids: string[]
  quick_selections: QuickSelection[]
}

const emptyForm: FormState = {
  name: "",
  description: "",
  role_prompt: "",
  prompt_ids: [],
  quick_selections: [],
}

function PromptSelector({
  selected,
  onChange,
  allPrompts,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  allPrompts: PromptOption[]
}) {
  function handleAdd() {
    onChange([...selected, ""])
  }

  function handleSelect(index: number, value: string) {
    const next = [...selected]
    next[index] = value
    onChange(next)
  }

  function handleRemove(index: number) {
    onChange(selected.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Prompts</Label>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <PlusIcon className="size-3" />
          Add
        </Button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-col gap-2">
          {selected.map((id, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-center text-sm font-medium">{i + 1}</span>
              <Select value={id} onValueChange={(v) => handleSelect(i, v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a prompt" />
                </SelectTrigger>
                <SelectContent>
                  {allPrompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => handleRemove(i)}>
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground">Click "Add" to add prompts</p>
      )}
    </div>
  )
}

function QuickSelectionsEditor({
  selections,
  onChange,
  maxIndex,
  promptMap,
  promptIds,
}: {
  selections: QuickSelection[]
  onChange: (s: QuickSelection[]) => void
  maxIndex: number
  promptMap: Map<string, string>
  promptIds: string[]
}) {
  const [label, setLabel] = useState("")
  const [indexesStr, setIndexesStr] = useState("")

  function handleAdd() {
    if (!label.trim()) { toast.error("Label is required"); return }
    const parsed = indexesStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= maxIndex)
    if (parsed.length === 0) { toast.error("Enter valid indexes (1-" + maxIndex + ")"); return }
    const unique = [...new Set(parsed)]
    onChange([...selections, { label: label.trim(), indexes: unique }])
    setLabel("")
    setIndexesStr("")
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Quick Selections</Label>
      {maxIndex === 0 && (
        <p className="text-xs text-muted-foreground">Add prompts first to configure quick selections</p>
      )}
      {selections.length > 0 && (
        <div className="flex flex-col gap-1">
          {selections.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-xs">({s.indexes.join(", ")})</span>
              <button
                onClick={() => onChange(selections.filter((_, j) => j !== i))}
                className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {maxIndex > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Input placeholder="Label, e.g. 快速选择3张" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Input placeholder={"Indexes, e.g. 1,3,5 (1-" + maxIndex + ")"} value={indexesStr} onChange={(e) => setIndexesStr(e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleAdd}>Add</Button>
        </div>
      )}
    </div>
  )
}

export function PromptModeListClient({
  initialData,
  allPrompts,
}: {
  initialData: PromptMode[]
  allPrompts: PromptOption[]
}) {
  const [data, setData] = useState<PromptMode[]>(initialData)
  const [rowSelection, setRowSelection] = useState({})
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<FormState & { id: string }>({ id: "", ...emptyForm })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  const promptMap = new Map(allPrompts.map((p) => [p.id, p.title]))

  async function handleDelete(id: string) {
    const { error } = await deletePromptMode(id)
    if (error) { toast.error(error) } else { toast.success("Deleted"); setData((prev) => prev.filter((item) => item.id !== id)) }
    setDeleteTarget(null)
  }

  async function handleBatchDelete() {
    const selectedIds = table.getFilteredSelectedRowModel().rows.map((r) => r.original.id)
    if (selectedIds.length === 0) return
    const results = await Promise.all(selectedIds.map((id) => deletePromptMode(id)))
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) { toast.error(`${failed.length} failed to delete`) } else { toast.success(`${selectedIds.length} deleted`) }
    setData((prev) => prev.filter((item) => !selectedIds.includes(item.id)))
    setRowSelection({})
    setBatchDeleteOpen(false)
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.description.trim()) { toast.error("Name and description are required"); return }
    setCreating(true)
    const { data: newMode, error } = await createPromptMode(form)
    if (error) { toast.error(error) } else if (newMode) { toast.success("Created"); setData((prev) => [newMode, ...prev]); setForm({ ...emptyForm }); setCreateOpen(false) }
    setCreating(false)
  }

  function openEdit(mode: PromptMode) {
    setEditForm({
      id: mode.id,
      name: mode.name,
      description: mode.description,
      role_prompt: mode.role_prompt,
      prompt_ids: mode.prompt_ids ?? [],
      quick_selections: mode.quick_selections ?? [],
    })
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!editForm.name.trim() || !editForm.description.trim()) { toast.error("Name and description are required"); return }
    setEditing(true)
    const { id, ...input } = editForm
    const { data: updated, error } = await updatePromptMode(id, input)
    if (error) { toast.error(error) } else if (updated) { toast.success("Updated"); setData((prev) => prev.map((item) => (item.id === updated.id ? updated : item))); setEditOpen(false) }
    setEditing(false)
  }

  const selectedCount = Object.keys(rowSelection).length

  const columns: ColumnDef<PromptMode>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} aria-label="Select all" />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
      ),
      meta: { className: "w-8" },
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="w-64 truncate">{row.getValue("id")}</span>
          <button onClick={() => { navigator.clipboard.writeText(row.getValue("id") as string); toast.success("ID copied") }} className="cursor-pointer text-muted-foreground hover:text-foreground">
            <CopyIcon className="size-3" />
          </button>
        </span>
      ),
      meta: { className: "min-w-72" },
    },
    { accessorKey: "name", header: "Name", meta: { className: "min-w-40" } },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="line-clamp-2 whitespace-pre-wrap break-words">{row.getValue("description")}</span>,
      meta: { className: "min-w-48" },
    },
    {
      accessorKey: "role_prompt",
      header: "Role Prompt",
      cell: ({ row }) => <span className="line-clamp-2 whitespace-pre-wrap break-words">{row.getValue("role_prompt") || "-"}</span>,
      meta: { className: "min-w-48" },
    },
    {
      accessorKey: "prompt_ids",
      header: "Prompts",
      cell: ({ row }) => {
        const ids = (row.getValue("prompt_ids") as string[]) ?? []
        if (ids.length === 0) return "-"
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <Badge key={id} variant="secondary" className="text-xs">
                {promptMap.get(id) || "Unknown"} <span className="text-muted-foreground">({id.slice(0, 8)})</span>
              </Badge>
            ))}
          </div>
        )
      },
      meta: { className: "min-w-48" },
    },
    {
      accessorKey: "quick_selections",
      header: "Quick Selections",
      cell: ({ row }) => {
        const qs = (row.getValue("quick_selections") as QuickSelection[]) ?? []
        if (qs.length === 0) return "-"
        return (
          <div className="flex flex-wrap gap-1">
            {qs.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s.label} ({s.indexes.join(",")})</Badge>
            ))}
          </div>
        )
      },
      meta: { className: "min-w-48" },
    },
    { accessorKey: "creator", header: "Creator", meta: { className: "min-w-32" } },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => { const d = row.getValue("created_at") as string; return d ? new Date(d).toLocaleDateString("zh-CN") : "-" },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8"><EllipsisVerticalIcon className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row.original.id)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      meta: { className: "w-10" },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getRowId: (row) => row.id,
  })

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          {selectedCount > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>
              <Trash2Icon className="size-4" />
              Delete Mode
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Add Mode
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Add Prompt Mode</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter mode name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Enter mode description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role_prompt">Role Prompt</Label>
              <Textarea id="role_prompt" placeholder="Enter role prompt instruction" rows={3} value={form.role_prompt} onChange={(e) => setForm((f) => ({ ...f, role_prompt: e.target.value }))} />
            </div>
            <PromptSelector selected={form.prompt_ids} onChange={(ids) => setForm((f) => ({ ...f, prompt_ids: ids }))} allPrompts={allPrompts} />
            <QuickSelectionsEditor
              selections={form.quick_selections}
              onChange={(s) => setForm((f) => ({ ...f, quick_selections: s }))}
              maxIndex={form.prompt_ids.length}
              promptMap={promptMap}
              promptIds={form.prompt_ids}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit Prompt Mode</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-role_prompt">Role Prompt</Label>
              <Textarea id="edit-role_prompt" rows={3} value={editForm.role_prompt} onChange={(e) => setEditForm((f) => ({ ...f, role_prompt: e.target.value }))} />
            </div>
            <PromptSelector selected={editForm.prompt_ids} onChange={(ids) => setEditForm((f) => ({ ...f, prompt_ids: ids }))} allPrompts={allPrompts} />
            <QuickSelectionsEditor
              selections={editForm.quick_selections}
              onChange={(s) => setEditForm((f) => ({ ...f, quick_selections: s }))}
              maxIndex={editForm.prompt_ids.length}
              promptMap={promptMap}
              promptIds={editForm.prompt_ids}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdate} disabled={editing}>{editing ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="px-4 lg:px-6">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className={(h.column.columnDef.meta as { className?: string })?.className}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={(cell.column.columnDef.meta as { className?: string })?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">No data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt Mode</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirm */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Prompt Modes</AlertDialogTitle>
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
