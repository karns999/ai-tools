import { Skeleton } from "@/components/ui/skeleton"

export default function TaskListLoading() {
  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex-1 flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="size-24 shrink-0 rounded-md" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
