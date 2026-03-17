import { Skeleton } from "@/components/ui/skeleton"

export default function PromptListLoading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="px-4 lg:px-6">
        <div className="rounded-lg border">
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
