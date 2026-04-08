"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, DatabaseIcon, CommandIcon } from "lucide-react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Task List",
      url: "/dashboard/task-list",
      icon: (
        <LayoutDashboardIcon />
      ),
    },
    {
      title: "Prompt List",
      url: "/dashboard/prompt-list",
      icon: (
        <DatabaseIcon />
      ),
    },
    {
      title: "Prompt Mode List",
      url: "/dashboard/prompt-mode-list",
      icon: (
        <DatabaseIcon />
      ),
    },
  ],
}

export function AppSidebar({ user, promptModes, ...props }: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar: string }
  promptModes?: { id: string; name: string }[]
}) {
  const currentUser = user || data.user
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Ai Tools.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} promptModes={promptModes ?? []} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
