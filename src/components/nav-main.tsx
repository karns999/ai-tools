"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CirclePlusIcon } from "lucide-react"
import { CreateTaskDialog } from "@/components/create-task-dialog"

export function NavMain({
  items,
  promptModes,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
  promptModes: { id: string; name: string }[]
}) {
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="创建任务"
              className="w-auto px-6 !bg-indigo-600 !text-white rounded-md hover:!bg-indigo-500 active:!bg-indigo-500"
              onClick={() => setCreateOpen(true)}
            >
              <CirclePlusIcon className="size-4" />
              <span>创建任务</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                asChild
              >
                <Link href={item.url}>
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        promptModes={promptModes}
      />
    </SidebarGroup>
  )
}
