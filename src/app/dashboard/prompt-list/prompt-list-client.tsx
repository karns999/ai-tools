"use client"

import { useState, useCallback } from "react"
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
import { EllipsisVerticalIcon, PlusIcon, CopyIcon, Trash2Icon } from "lucide-react"
import type { Prompt } from "@/lib/types/prompt"
import { createPrompt, updatePrompt, deletePrompt } from "./actions"
import { toast } from "sonner"

export function PromptListClient({ initialData }: { initialData: Prompt[] }) {
  const [data, setData] = useState<Prompt[]>(initialData)
  const [rowSelection, setRowSelection] = useState({})
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", content: "" })
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ id: "", title: "", content: "" })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  async function handleDelete(id: string) {
    const { error } = await deletePrompt(id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Deleted")
      setData((prev) => prev.filter((item) => item.id !== id))
    }
    setDeleteTarget(null)
  }

  async function handleBatchDelete() {
    const selectedIds = table.getFilteredSelectedRowModel().rows.map((r) => r.original.id)
    if (selectedIds.length === 0) return
    const results = await Promise.all(selectedIds.map((id) => deletePrompt(id)))
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) {
      toast.error(`${failed.length} failed to delete`)
    } else {
      toast.success(`${selectedIds.length} deleted`)
    }
    setData((prev) => prev.filter((item) => !selectedIds.includes(item.id)))
    setRowSelection({})
    setBatchDeleteOpen(false)
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required")
      return
    }
    setCreating(true)
    const { data: newPrompt, error } = await createPrompt(form)
    if (error) {
      toast.error(error)
    } else if (newPrompt) {
      toast.success("Created")
      setData((prev) => [newPrompt, ...prev])
      setForm({ title: "", content: "" })
      setCreateOpen(false)
    }
    setCreating(false)
  }

  function openEdit(prompt: Prompt) {
    setEditForm({ id: prompt.id, title: prompt.title, content: prompt.content })
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!editForm.title.trim() || !editForm.content.trim()) {
      toast.error("Title and content are required")
      return
    }
    setEditing(true)
    const { data: updated, error } = await updatePrompt(editForm.id, {
      title: editForm.title,
      content: editForm.content,
    })
    if (error) {
      toast.error(error)
    } else if (updated) {
      toast.success("Updated")
      setData((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditOpen(false)
    }
    setEditing(false)
  }

  const selectedCount = Object.keys(rowSelection).length

  const columns: ColumnDef<Prompt>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      meta: { className: "w-8" },
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="w-64 truncate">{row.getValue("id")}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(row.getValue("id") as string)
              toast.success("ID copied")
            }}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <CopyIcon className="size-3" />
          </button>
        </span>
      ),
      meta: { className: "min-w-72" },
    },
    { accessorKey: "title", header: "Title", meta: { className: "min-w-40" } },
    {
      accessorKey: "content",
      header: "Content",
      cell: ({ row }) => (
        <span className="line-clamp-2 whitespace-pre-wrap break-words">{row.getValue("content")}</span>
      ),
      meta: { className: "min-w-64" },
    },
    { accessorKey: "creator", header: "Creator", meta: { className: "min-w-40" } },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => {
        const date = row.getValue("created_at") as string
        return date ? new Date(date).toLocaleDateString("zh-CN") : "-"
      },
    },
    { accessorKey: "updater", header: "Updater", cell: ({ row }) => row.getValue("updater") || "-" },
    {
      accessorKey: "updated_at",
      header: "Updated At",
      cell: ({ row }) => {
        const date = row.getValue("updated_at") as string
        return date ? new Date(date).toLocaleDateString("zh-CN") : "-"
      },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteTarget(row.original.id)}
            >
              Delete
            </DropdownMenuItem>
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
              Delete Prompt
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Add Prompt
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Prompt</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter prompt title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Enter prompt content"
                rows={4}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                rows={4}
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdate} disabled={editing}>
              {editing ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="px-4 lg:px-6">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={(header.column.columnDef.meta as { className?: string })?.className}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                      <TableCell
                        key={cell.id}
                        className={(cell.column.columnDef.meta as { className?: string })?.className}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete this prompt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Prompts</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete the selected prompts?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBatchDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
