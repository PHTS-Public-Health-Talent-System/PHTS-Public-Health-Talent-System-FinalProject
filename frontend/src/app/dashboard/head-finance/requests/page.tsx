"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function HeadFinanceRequestsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/approver/requests");
  }, [router]);

  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">กำลังนำท่านไปยังคำขอรออนุมัติ...</p>
      </div>
    </div>
  );
}
