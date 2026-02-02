"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, X, Download, FileIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { useRequestDetail, useCancelRequest } from "@/features/request/hooks";
import { StatusBadge } from "@/components/common/status-badge";
import { RequestTimeline } from "@/components/common/request-timeline";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  REQUEST_TYPE_LABELS,
  PERSONNEL_TYPE_LABELS,
  WORK_ATTRIBUTE_LABELS,
  STEP_LABELS,
  type WorkAttributes,
} from "@/types/request.types";

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: request, isLoading } = useRequestDetail(id);
  const cancelMutation = useCancelRequest();

  const handleCancel = () => {
    cancelMutation.mutate(id, {
      onSuccess: () => {
        toast.success("ยกเลิกคำขอเรียบร้อยแล้ว");
        router.push("/dashboard/user");
      },
      onError: () => toast.error("ไม่สามารถยกเลิกคำขอได้"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        ไม่พบคำขอ
      </div>
    );
  }

  const canEdit = request.status === "DRAFT" || request.status === "RETURNED";
  const canCancel =
    request.status !== "APPROVED" &&
    request.status !== "REJECTED" &&
    request.status !== "CANCELLED";

  const workAttrs = request.work_attributes as WorkAttributes | null;
  const activeAttrs = workAttrs
    ? (Object.entries(workAttrs) as [keyof WorkAttributes, boolean][])
        .filter(([, v]) => v)
        .map(([k]) => WORK_ATTRIBUTE_LABELS[k])
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
              <StatusBadge status={request.status} currentStep={request.current_step} />
            </h2>
            <p className="text-sm text-muted-foreground">
              {request.request_no ?? `#${request.request_id}`} &middot;{" "}
              ยื่นเมื่อ{" "}
              {new Date(request.created_at).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/dashboard/user/requests/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-1 h-3 w-3" /> แก้ไข
              </Button>
            </Link>
          )}
          {canCancel && (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" disabled={cancelMutation.isPending}>
                  <X className="mr-1 h-3 w-3" /> ยกเลิกคำขอ
                </Button>
              }
              title="ยืนยันยกเลิกคำขอ"
              description="เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้ ต้องการดำเนินการต่อหรือไม่?"
              variant="destructive"
              confirmLabel="ยกเลิกคำขอ"
              onConfirm={handleCancel}
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="py-6">
          <RequestTimeline
            currentStep={request.current_step}
            status={request.status}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">รายละเอียด</TabsTrigger>
          <TabsTrigger value="attachments">
            เอกสารแนบ
            {request.attachments.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {request.attachments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">ประวัติอนุมัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">ประเภทบุคลากร</p>
                <p className="font-medium">
                  {PERSONNEL_TYPE_LABELS[request.personnel_type] ?? request.personnel_type}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เลขที่ตำแหน่ง</p>
                <p className="font-medium">{request.current_position_number ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สังกัด</p>
                <p className="font-medium">{request.current_department ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ภารกิจหลัก</p>
                <p className="font-medium">{request.main_duty ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ลักษณะงาน</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeAttrs.length > 0
                    ? activeAttrs.map((label) => (
                        <Badge key={label} variant="outline">
                          {label}
                        </Badge>
                      ))
                    : "-"}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่มีผล</p>
                <p className="font-medium">
                  {new Date(request.effective_date).toLocaleDateString("th-TH")}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">จำนวนเงินที่ขอเบิก</p>
                <p className="text-2xl font-bold text-primary">
                  {request.requested_amount.toLocaleString()} บาท
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {request.attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  ไม่มีเอกสารแนบ
                </p>
              ) : (
                <div className="space-y-3">
                  {request.attachments.map((att) => (
                    <div
                      key={att.attachment_id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{att.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(att.file_size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/${att.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {request.actions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  ยังไม่มีประวัติการดำเนินการ
                </p>
              ) : (
                <div className="space-y-4">
                  {request.actions.map((action, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        {i < request.actions.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">
                          {action.action}
                          {action.step_no != null && (
                            <span className="text-muted-foreground ml-1">
                              — {STEP_LABELS[action.step_no] ?? `ขั้นตอน ${action.step_no}`}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {action.actor
                            ? `${action.actor.first_name} ${action.actor.last_name}`
                            : "ระบบ"}{" "}
                          &middot;{" "}
                          {new Date(action.action_date).toLocaleString("th-TH")}
                        </p>
                        {action.comment && (
                          <p className="text-sm mt-1 bg-muted p-2 rounded">
                            {action.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
