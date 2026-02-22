"use client";

import { Eye, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AttachmentItem = {
  id: number;
  name: string;
  type?: string;
  path: string;
};

function resolveFileUrl(filePath: string): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const baseUrl = apiBase.replace(/\/api\/?$/, "");
  const normalizedPath = filePath.includes("uploads/")
    ? filePath.slice(filePath.indexOf("uploads/"))
    : filePath;
  return `${baseUrl}/${normalizedPath}`;
}

export function AttachmentList({
  title = "เอกสารแนบ",
  items,
  onPreview,
  onDelete,
}: {
  title?: string;
  items: AttachmentItem[];
  onPreview: (url: string, name: string) => void;
  onDelete?: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="p-4 rounded-lg bg-slate-500/10 border border-slate-500/30">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-slate-400" />
        <span className="font-medium text-slate-400">{title}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const fileUrl = resolveFileUrl(item.path);
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                {item.type && <p className="text-xs text-muted-foreground">{item.type}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onPreview(fileUrl, item.name)}
                  className="h-8 w-8 text-slate-500 hover:text-primary"
                  aria-label="ดูเอกสารแนบ"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(item.id)}
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    aria-label="ลบเอกสารแนบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
