export function getStatusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-600 border-slate-200"
    case "PENDING":
      return "bg-amber-50 text-amber-600 border-amber-200"
    case "APPROVED":
      return "bg-emerald-50 text-emerald-600 border-emerald-200"
    case "PAID":
      return "bg-blue-50 text-blue-600 border-blue-200"
    case "REJECTED":
      return "bg-rose-50 text-rose-600 border-rose-200"
    case "RETURNED":
      return "bg-orange-50 text-orange-600 border-orange-200"
    case "CANCELLED":
      return "bg-slate-100 text-slate-500 border-slate-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function getPendingStepLabel(step?: number | null) {
  switch (step) {
    case 1:
      return "รอตรวจโดยหัวหน้าตึก/หัวหน้างาน"
    case 2:
      return "รอตรวจโดยหัวหน้ากลุ่มงาน"
    case 3:
      return "รอตรวจโดยเจ้าหน้าที่ พ.ต.ส."
    case 4:
      return "รอตรวจโดยหัวหน้ากลุ่มงานทรัพยากรบุคคล"
    case 5:
      return "รอตรวจโดยหัวหน้าการเงิน"
    case 6:
      return "รออนุมัติโดยผู้อำนวยการ"
    default:
      return "รอดำเนินการ"
  }
}

export function getStatusLabel(status: string, step?: number | null) {
  switch (status) {
    case "DRAFT":
      return "ฉบับร่าง"
    case "PENDING":
      return getPendingStepLabel(step)
    case "APPROVED":
      return "อนุมัติแล้ว"
    case "REJECTED":
      return "ไม่อนุมัติ"
    case "RETURNED":
      return "ส่งกลับแก้ไข"
    case "CANCELLED":
      return "ยกเลิกแล้ว"
    default:
      return status
  }
}
