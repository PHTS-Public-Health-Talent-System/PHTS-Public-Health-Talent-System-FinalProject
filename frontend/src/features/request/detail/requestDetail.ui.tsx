import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"

export function InfoItem({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground break-words">{value}</dd>
    </div>
  )
}

export function SectionHeader({
  title,
  icon: Icon,
  isComplete,
}: {
  title: string
  icon: LucideIcon
  isComplete?: boolean
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${isComplete ? "bg-emerald-100" : "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${isComplete ? "text-emerald-600" : "text-primary"}`} />
        </div>
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
      </div>
      {isComplete && (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 hidden sm:flex"
        >
          <CheckCircle2 className="w-3 h-3" />
          ตรวจสอบครบแล้ว
        </Badge>
      )}
    </div>
  )
}

