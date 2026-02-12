"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  AlertTriangle,
  Clock,
  CalendarX,
  Bell,
  Mail,
  Shield,
  Filter,
  Download,
  CheckCircle2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useLicenseAlertsList,
  useLicenseAlertsSummary,
  useNotifyLicenseAlerts,
} from "@/features/license-alerts/hooks"
import type { LicenseAlertListItem } from "@/features/license-alerts/api"
import { resolveProfessionLabel } from "@/shared/constants/profession"

type AlertBucket = "expired" | "30" | "60" | "90"

interface LicenseAlert {
  id: string
  citizenId: string
  name: string
  position: string
  department: string
  profession: string
  licenseNumber: string
  licenseExpiry: string
  daysLeft: number
  status: "expired" | "critical" | "warning" | "normal"
  notified: boolean
  notifiedDate?: string
  bucket: AlertBucket
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatThaiDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function deriveStatus(bucket: AlertBucket, daysLeft: number): LicenseAlert["status"] {
  if (bucket === "expired") return "expired"
  if (daysLeft < 0) return "expired"
  if (daysLeft < 30 || bucket === "30") return "critical"
  if (daysLeft < 90 || bucket === "60" || bucket === "90") return "warning"
  return "normal"
}

function getStatusBadge(status: LicenseAlert["status"]) {
  switch (status) {
    case "expired":
      return (
        <Badge variant="destructive" className="gap-1">
          <CalendarX className="h-3 w-3" />
          หมดอายุแล้ว
        </Badge>
      )
    case "critical":
      return (
        <Badge className="gap-1 bg-destructive/80 hover:bg-destructive/70">
          <AlertTriangle className="h-3 w-3" />
          วิกฤต
        </Badge>
      )
    case "warning":
      return (
        <Badge className="gap-1 bg-amber-500 hover:bg-amber-500/90">
          <Clock className="h-3 w-3" />
          ใกล้หมดอายุ
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Shield className="h-3 w-3" />
          ปกติ
        </Badge>
      )
  }
}

function mapAlertRow(row: LicenseAlertListItem): LicenseAlert {
  const daysLeft = typeof row.days_left === "number" ? row.days_left : 0
  return {
    id: `${row.citizen_id}-${row.bucket}`,
    citizenId: row.citizen_id,
    name: row.full_name ?? "-",
    position: row.position_name ?? "-",
    department: row.department ?? "-",
    profession: resolveProfessionLabel(row.profession_code, row.position_name ?? "-"),
    licenseNumber: row.license_no ?? "-",
    licenseExpiry: formatThaiDate(row.license_expiry),
    daysLeft,
    status: deriveStatus(row.bucket, daysLeft),
    notified: Boolean(row.last_notified_at),
    notifiedDate: formatThaiDateTime(row.last_notified_at),
    bucket: row.bucket,
  }
}

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [professionFilter, setProfessionFilter] = useState("all")
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([])
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  const { data: summaryData } = useLicenseAlertsSummary()
  const { data: expiredData } = useLicenseAlertsList({ bucket: "expired" })
  const { data: expiring30Data } = useLicenseAlertsList({ bucket: "30" })
  const { data: expiring60Data } = useLicenseAlertsList({ bucket: "60" })
  const { data: expiring90Data } = useLicenseAlertsList({ bucket: "90" })
  const notifyMutation = useNotifyLicenseAlerts()

  const alerts = useMemo<LicenseAlert[]>(() => {
    const normalize = (data: unknown) => (Array.isArray(data) ? data.map((row) => mapAlertRow(row as LicenseAlertListItem)) : [])

    return [
      ...normalize(expiredData),
      ...normalize(expiring30Data),
      ...normalize(expiring60Data),
      ...normalize(expiring90Data),
    ]
  }, [expiredData, expiring30Data, expiring60Data, expiring90Data])

  const filteredAlerts = alerts.filter((alert) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      alert.name.toLowerCase().includes(q) ||
      alert.position.toLowerCase().includes(q) ||
      alert.department.toLowerCase().includes(q)
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter
    const matchesProfession = professionFilter === "all" || alert.profession === professionFilter
    return matchesSearch && matchesStatus && matchesProfession
  })

  const expiredCount = summaryData?.expired ?? alerts.filter((a) => a.status === "expired").length
  const criticalCount = summaryData?.expiring_30 ?? alerts.filter((a) => a.status === "critical").length
  const warningCount =
    ((summaryData?.expiring_60 ?? 0) + (summaryData?.expiring_90 ?? 0)) ||
    alerts.filter((a) => a.status === "warning").length
  const notNotifiedCount = alerts.filter((a) => !a.notified).length

  const professions = [...new Set(alerts.map((a) => a.profession))]

  const handleSelectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([])
    } else {
      setSelectedAlerts(filteredAlerts.map((a) => a.id))
    }
  }

  const handleSelectOne = (id: string) => {
    if (selectedAlerts.includes(id)) {
      setSelectedAlerts(selectedAlerts.filter((a) => a !== id))
    } else {
      setSelectedAlerts([...selectedAlerts, id])
    }
  }

  const selectedRows = alerts.filter((a) => selectedAlerts.includes(a.id))

  const notifyByRows = async (rows: LicenseAlert[]) => {
    if (!rows.length) return
    try {
      await notifyMutation.mutateAsync(rows.map((row) => ({ citizen_id: row.citizenId, bucket: row.bucket })))
      setSelectedAlerts([])
      setShowNotifyDialog(false)
      setShowSuccessDialog(true)
    } catch {
      toast.error("ไม่สามารถส่งแจ้งเตือนได้")
    }
  }

  const handleNotify = () => setShowNotifyDialog(true)

  const handleConfirmNotify = async () => {
    await notifyByRows(selectedRows)
  }

  const handleNotifyOne = async (alert: LicenseAlert) => {
    await notifyByRows([alert])
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">แจ้งเตือนใบอนุญาต</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ตรวจสอบใบอนุญาตประกอบวิชาชีพที่ใกล้หมดอายุหรือหมดอายุแล้ว
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            ส่งออก Excel
          </Button>
          {selectedAlerts.length > 0 && (
            <Button className="gap-2" onClick={handleNotify} disabled={notifyMutation.isPending}>
              <Mail className="h-4 w-4" />
              ส่งแจ้งเตือน ({selectedAlerts.length})
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">หมดอายุแล้ว</p>
                <p className="text-2xl font-bold text-destructive">{expiredCount}</p>
              </div>
              <CalendarX className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">วิกฤต ({"<"}30 วัน)</p>
                <p className="text-2xl font-bold text-destructive/80">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-amber-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ใกล้หมดอายุ (30-90 วัน)</p>
                <p className="text-2xl font-bold text-amber-500">{warningCount}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยังไม่แจ้งเตือน</p>
                <p className="text-2xl font-bold text-primary">{notNotifiedCount}</p>
              </div>
              <Bell className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อหรือหน่วยงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-secondary border-border">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="expired">หมดอายุแล้ว</SelectItem>
                <SelectItem value="critical">วิกฤต</SelectItem>
                <SelectItem value="warning">ใกล้หมดอายุ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={professionFilter} onValueChange={setProfessionFilter}>
              <SelectTrigger className="w-[220px] bg-secondary border-border">
                <SelectValue placeholder="วิชาชีพ" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">ทุกวิชาชีพ</SelectItem>
                {professions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" />
            รายการใบอนุญาตที่ต้องดำเนินการ
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            แสดง {filteredAlerts.length} จาก {alerts.length} รายการ
          </span>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={selectedAlerts.length === filteredAlerts.length && filteredAlerts.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-border"
                    />
                  </TableHead>
                  <TableHead className="font-semibold">ชื่อ-สกุล</TableHead>
                  <TableHead className="font-semibold">วิชาชีพ</TableHead>
                  <TableHead className="font-semibold">เลขที่ใบอนุญาต</TableHead>
                  <TableHead className="font-semibold text-center">วันหมดอายุ</TableHead>
                  <TableHead className="font-semibold text-center">เหลือ (วัน)</TableHead>
                  <TableHead className="font-semibold text-center">สถานะ</TableHead>
                  <TableHead className="font-semibold text-center">แจ้งเตือนล่าสุด</TableHead>
                  <TableHead className="font-semibold text-center">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id} className="hover:bg-secondary/20">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedAlerts.includes(alert.id)}
                        onChange={() => handleSelectOne(alert.id)}
                        className="rounded border-border"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alert.name}</p>
                        <p className="text-xs text-muted-foreground">{alert.department}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{alert.profession}</TableCell>
                    <TableCell className="text-sm font-mono">{alert.licenseNumber}</TableCell>
                    <TableCell className="text-center text-sm">{alert.licenseExpiry}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-semibold ${
                          alert.daysLeft < 0
                            ? "text-destructive"
                            : alert.daysLeft < 30
                              ? "text-destructive/80"
                              : "text-amber-500"
                        }`}
                      >
                        {alert.daysLeft < 0 ? alert.daysLeft : `+${alert.daysLeft}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(alert.status)}</TableCell>
                    <TableCell className="text-center">
                      {alert.notified ? (
                        <div className="flex flex-col items-center">
                          <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/50">
                            <CheckCircle2 className="h-3 w-3" />
                            แจ้งแล้ว
                          </Badge>
                          <span className="text-xs text-muted-foreground mt-1">{alert.notifiedDate}</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">ยังไม่แจ้ง</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {!alert.notified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleNotifyOne(alert)}
                          disabled={notifyMutation.isPending}
                        >
                          <Bell className="h-4 w-4" />
                          แจ้งเตือน
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAlerts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">ไม่พบรายการที่ค้นหา</div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 bg-secondary/30 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground">ข้อมูลสำคัญ</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>- ผู้ที่ใบอนุญาตหมดอายุจะ<span className="text-destructive font-medium">ไม่สามารถรับเงิน พ.ต.ส.</span> ได้จนกว่าจะต่ออายุใบอนุญาต</li>
                <li>- ควรแจ้งเตือนล่วงหน้าอย่างน้อย 30-90 วันก่อนใบอนุญาตหมดอายุ</li>
                <li>- สามารถเลือกหลายรายการแล้วส่งแจ้งเตือนพร้อมกันได้</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>ส่งแจ้งเตือนใบอนุญาต</DialogTitle>
            <DialogDescription>
              คุณต้องการส่งแจ้งเตือนไปยังบุคลากรที่เลือก {selectedAlerts.length} คน ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">รายชื่อผู้ที่จะได้รับแจ้งเตือน:</p>
            <ul className="space-y-1 max-h-[200px] overflow-auto">
              {selectedRows.map((a) => (
                <li key={a.id} className="text-sm flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground">- {a.licenseExpiry}</span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleConfirmNotify} disabled={notifyMutation.isPending}>
              <Mail className="mr-2 h-4 w-4" />
              ส่งแจ้งเตือน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <DialogTitle className="text-center">ส่งแจ้งเตือนสำเร็จ</DialogTitle>
            <DialogDescription className="text-center">ระบบบันทึกการแจ้งเตือนเรียบร้อยแล้ว</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full">ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
