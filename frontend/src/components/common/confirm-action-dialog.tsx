"use client"

import * as React from "react"
import { Loader2, AlertTriangle } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

type ConfirmActionDialogProps = {
  trigger: React.ReactNode
  title: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** * Use 'destructive' for delete actions to show red button and warning icon
   */
  variant?: "default" | "destructive"
  disabled?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  variant = "default",
  disabled = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent dialog from closing immediately
    e.preventDefault()

    if (pending) return
    setPending(true)

    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      console.error("Confirm action failed:", error)
      // Optional: Add toast error here if needed
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {trigger}
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-[400px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            {variant === "destructive" && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <span>{title}</span>
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-base">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="mt-0">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={handleConfirm}
            className={cn(
              "min-w-[80px]",
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังทำ...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
