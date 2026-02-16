"use client"

import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

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
}

export function PageHeader({ title, description, actions, backHref, backLabel }: PageHeaderProps) {
  // Check if actions is a ReactNode or an array of PageHeaderAction
  const isReactNode = actions && !Array.isArray(actions)
  const actionsArray = Array.isArray(actions) ? actions : []

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        {backHref && (
          <Link 
            href={backHref}
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel || "กลับ"}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {isReactNode ? (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      ) : actionsArray.length > 0 ? (
        <div className="flex items-center gap-2">
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
