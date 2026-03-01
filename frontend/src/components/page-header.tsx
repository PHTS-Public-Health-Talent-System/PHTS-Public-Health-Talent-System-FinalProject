"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive"
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: PageHeaderAction[] | ReactNode
  backHref?: string
  backLabel?: string
  eyebrow?: string
  icon?: LucideIcon
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  eyebrow,
  icon: Icon,
  className,
}: PageHeaderProps) {
  // Check if actions is a ReactNode or an array of PageHeaderAction
  const isReactNode = actions && !Array.isArray(actions)
  const actionsArray = Array.isArray(actions) ? actions : []

  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)}>
      <div className="space-y-3">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel || "กลับ"}
          </Link>
        )}
        <div className="space-y-2">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            {Icon ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {description && (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {isReactNode ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : actionsArray.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {actionsArray.map((action, index) => {
            const ActionIcon = action.icon
            if (action.href) {
              return (
                <Link key={index} href={action.href}>
                  <Button variant={action.variant || "default"}>
                    {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </Button>
                </Link>
              )
            }
            return (
              <Button
                key={index}
                variant={action.variant || "default"}
                onClick={action.onClick}
              >
                {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
