"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export function PayrollSummaryCard({
  icon: Icon,
  title,
  value,
  iconClassName,
  iconBgClassName,
}: {
  icon: LucideIcon
  title: string
  value: string
  iconClassName: string
  iconBgClassName: string
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("rounded-xl p-3", iconBgClassName)}>
          <Icon className={cn("h-5 w-5", iconClassName)} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

