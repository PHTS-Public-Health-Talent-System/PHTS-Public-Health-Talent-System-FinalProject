'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  AlertTriangle,
  Clock,
  CalendarX,
  Bell,
  Mail,
  Shield,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useLicenseAlertsList,
  useLicenseAlertsSummary,
  useNotifyLicenseAlerts,
} from '@/features/license-alerts/hooks';
import type { LicenseAlertListItem } from '@/features/license-alerts/api';
import { resolveProfessionLabel } from '@/shared/constants/profession';
import {
  formatThaiDate as formatThaiDateValue,
  formatThaiDateTime as formatThaiDateTimeValue,
} from '@/shared/utils/thai-locale';

type AlertBucket = 'expired' | '30' | '60' | '90';

interface LicenseAlert {
  id: string;
  citizenId: string;
  name: string;
  position: string;
  department: string;
  profession: string;
  licenseNumber: string;
  licenseExpiry: string;
  daysLeft: number;
  status: 'expired' | 'critical' | 'warning' | 'normal';
  notified: boolean;
  notifiedDate?: string;
  bucket: AlertBucket;
}

const formatThaiDate = (dateStr: string | null): string => formatThaiDateValue(dateStr);

const formatThaiDateTime = (dateStr: string | null | undefined): string =>
  formatThaiDateTimeValue(dateStr);

function deriveStatus(bucket: AlertBucket, daysLeft: number): LicenseAlert['status'] {
  if (bucket === 'expired') return 'expired';
  if (daysLeft < 0) return 'expired';
  if (daysLeft < 30 || bucket === '30') return 'critical';
  if (daysLeft < 90 || bucket === '60' || bucket === '90') return 'warning';
  return 'normal';
}

function getStatusBadge(status: LicenseAlert['status']) {
  switch (status) {
    case 'expired':
      return (
        <Badge variant="destructive" className="gap-1.5 h-6">
          <CalendarX className="h-3 w-3" />
          หมดอายุแล้ว
        </Badge>
      );
    case 'critical':
      return (
        <Badge className="gap-1.5 h-6 bg-destructive/90 hover:bg-destructive/80 border-destructive/20 text-destructive-foreground">
          <AlertTriangle className="h-3 w-3" />
          วิกฤต (&lt;30 วัน)
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="gap-1.5 h-6 bg-amber-500 hover:bg-amber-600 text-white border-amber-600/20">
          <Clock className="h-3 w-3" />
          ใกล้หมดอายุ
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1.5 h-6">
          <Shield className="h-3 w-3" />
          ปกติ
        </Badge>
      );
  }
}

function mapAlertRow(row: LicenseAlertListItem): LicenseAlert {
  const daysLeft = typeof row.days_left === 'number' ? row.days_left : 0;
  return {
    id: `${row.citizen_id}-${row.bucket}`,
    citizenId: row.citizen_id,
    name: row.full_name ?? '-',
    position: row.position_name ?? '-',
    department: row.department ?? '-',
    profession: resolveProfessionLabel(row.profession_code, row.position_name ?? '-'),
    licenseNumber: row.license_no ?? '-',
    licenseExpiry: formatThaiDate(row.license_expiry),
    daysLeft,
    status: deriveStatus(row.bucket, daysLeft),
    notified: Boolean(row.last_notified_at),
    notifiedDate: formatThaiDateTime(row.last_notified_at),
    bucket: row.bucket,
  };
}

// Helper Component for Stats
function StatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  cardClassName,
  iconBgClassName,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  iconClassName: string;
  iconBgClassName: string;
  cardClassName?: string;
}) {
  return (
    <Card className={`border-border shadow-sm ${cardClassName ?? 'bg-card'}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`text-2xl font-bold mt-1 ${iconClassName}`}>{value}</div>
        </div>
        <div className={`p-3 rounded-full ${iconBgClassName}`}>
          <Icon className={`h-6 w-6 ${iconClassName}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { data: summaryData } = useLicenseAlertsSummary();
  const { data: expiredData } = useLicenseAlertsList({ bucket: 'expired' });
  const { data: expiring30Data } = useLicenseAlertsList({ bucket: '30' });
  const { data: expiring60Data } = useLicenseAlertsList({ bucket: '60' });
  const { data: expiring90Data } = useLicenseAlertsList({ bucket: '90' });
  const notifyMutation = useNotifyLicenseAlerts();

  const alerts = useMemo<LicenseAlert[]>(() => {
    const normalize = (data: unknown) =>
      Array.isArray(data) ? data.map((row) => mapAlertRow(row as LicenseAlertListItem)) : [];

    const merged = [
      ...normalize(expiredData),
      ...normalize(expiring30Data),
      ...normalize(expiring60Data),
      ...normalize(expiring90Data),
    ];

    const byCitizen = new Map<string, LicenseAlert>();
    for (const item of merged) {
      const key = item.citizenId;
      const prev = byCitizen.get(key);
      if (!prev) {
        byCitizen.set(key, item);
        continue;
      }
      const prevDays = Number.isFinite(prev.daysLeft) ? prev.daysLeft : 999999;
      const nextDays = Number.isFinite(item.daysLeft) ? item.daysLeft : 999999;
      if (nextDays < prevDays) {
        byCitizen.set(key, item);
        continue;
      }
      if (!prev.notified && item.notified) {
        byCitizen.set(key, { ...prev, notified: true, notifiedDate: item.notifiedDate });
      }
    }

    return Array.from(byCitizen.values());
  }, [expiredData, expiring30Data, expiring60Data, expiring90Data]);

  const filteredAlerts = alerts.filter((alert) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      alert.name.toLowerCase().includes(q) ||
      alert.position.toLowerCase().includes(q) ||
      alert.department.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesProfession = professionFilter === 'all' || alert.profession === professionFilter;
    return matchesSearch && matchesStatus && matchesProfession;
  });

  const expiredCount = summaryData?.expired ?? alerts.filter((a) => a.status === 'expired').length;
  const criticalCount =
    summaryData?.expiring_30 ?? alerts.filter((a) => a.status === 'critical').length;
  const warningCount =
    (summaryData?.expiring_60 ?? 0) + (summaryData?.expiring_90 ?? 0) ||
    alerts.filter((a) => a.status === 'warning').length;
  const notNotifiedCount = alerts.filter((a) => !a.notified).length;

  const professions = [...new Set(alerts.map((a) => a.profession))];

  const handleSelectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(filteredAlerts.map((a) => a.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedAlerts.includes(id)) {
      setSelectedAlerts(selectedAlerts.filter((a) => a !== id));
    } else {
      setSelectedAlerts([...selectedAlerts, id]);
    }
  };

  const selectedRows = alerts.filter((a) => selectedAlerts.includes(a.id));

  const notifyByRows = async (rows: LicenseAlert[]) => {
    if (!rows.length) return;
    try {
      await notifyMutation.mutateAsync(
        rows.map((row) => ({ citizen_id: row.citizenId, bucket: row.bucket })),
      );
      setSelectedAlerts([]);
      setShowNotifyDialog(false);
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถส่งแจ้งเตือนได้');
    }
  };

  const handleNotify = () => setShowNotifyDialog(true);

  const handleConfirmNotify = async () => {
    await notifyByRows(selectedRows);
  };

  const handleNotifyOne = async (alert: LicenseAlert) => {
    await notifyByRows([alert]);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">แจ้งเตือนใบอนุญาต</h1>
          <p className="text-muted-foreground mt-1">
            ตรวจสอบและแจ้งเตือนใบอนุญาตประกอบวิชาชีพที่ใกล้หมดอายุ
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-background shadow-sm">
            <Download className="h-4 w-4" />
            ส่งออก Excel
          </Button>
          {selectedAlerts.length > 0 && (
            <Button
              className="gap-2 shadow-sm animate-in fade-in zoom-in duration-200"
              onClick={handleNotify}
              disabled={notifyMutation.isPending}
            >
              <Mail className="h-4 w-4" />
              ส่งแจ้งเตือน ({selectedAlerts.length})
            </Button>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="หมดอายุแล้ว"
          value={expiredCount}
          icon={CalendarX}
          iconClassName="text-destructive"
          iconBgClassName="bg-destructive/10"
          cardClassName="bg-destructive/5 border-destructive/20"
        />
        <StatCard
          title="วิกฤต (<30 วัน)"
          value={criticalCount}
          icon={AlertCircle}
          iconClassName="text-orange-600"
          iconBgClassName="bg-orange-500/10"
          cardClassName="bg-orange-500/5 border-orange-200"
        />
        <StatCard
          title="ใกล้หมดอายุ"
          value={warningCount}
          icon={Clock}
          iconClassName="text-amber-500"
          iconBgClassName="bg-amber-500/10"
          cardClassName="bg-amber-500/5 border-amber-200"
        />
        <StatCard
          title="ยังไม่แจ้งเตือน"
          value={notNotifiedCount}
          icon={Bell}
          iconClassName="text-blue-600"
          iconBgClassName="bg-blue-500/10"
          cardClassName="bg-blue-500/5 border-blue-200"
        />
      </div>

      {/* Main Content */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              รายการใบอนุญาต
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (ทั้งหมด {filteredAlerts.length} รายการ)
              </span>
            </CardTitle>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, แผนก..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background pl-9 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="expired">หมดอายุแล้ว</SelectItem>
                  <SelectItem value="critical">วิกฤต</SelectItem>
                  <SelectItem value="warning">ใกล้หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
              <Select value={professionFilter} onValueChange={setProfessionFilter}>
                <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                  <SelectValue placeholder="วิชาชีพ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกวิชาชีพ</SelectItem>
                  {professions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[50px] text-center">
                    <input
                      type="checkbox"
                      className="rounded border-border align-middle h-4 w-4"
                      checked={
                        selectedAlerts.length === filteredAlerts.length && filteredAlerts.length > 0
                      }
                      onChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[200px] font-semibold">ชื่อ-สกุล / แผนก</TableHead>
                  <TableHead className="font-semibold">วิชาชีพ</TableHead>
                  <TableHead className="font-semibold">เลขที่ใบอนุญาต</TableHead>
                  <TableHead className="text-center font-semibold">วันหมดอายุ</TableHead>
                  <TableHead className="text-center font-semibold">คงเหลือ (วัน)</TableHead>
                  <TableHead className="text-center font-semibold">สถานะ</TableHead>
                  <TableHead className="text-center font-semibold">แจ้งเตือนล่าสุด</TableHead>
                  <TableHead className="text-center w-[100px] font-semibold">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      ไม่พบรายการที่ค้นหา
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map((alert) => (
                    <TableRow
                      key={alert.id}
                      className="group hover:bg-muted/30 border-border transition-colors"
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          className="rounded border-border align-middle h-4 w-4"
                          checked={selectedAlerts.includes(alert.id)}
                          onChange={() => handleSelectOne(alert.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{alert.name}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {alert.department}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{alert.profession}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {alert.licenseNumber}
                      </TableCell>
                      <TableCell className="text-center text-sm">{alert.licenseExpiry}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold tabular-nums ${
                            alert.daysLeft < 0
                              ? 'text-destructive'
                              : alert.daysLeft < 30
                                ? 'text-orange-600'
                                : 'text-amber-500'
                          }`}
                        >
                          {alert.daysLeft < 0 ? alert.daysLeft : `+${alert.daysLeft}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(alert.status)}</TableCell>
                      <TableCell className="text-center">
                        {alert.notified ? (
                          <div className="flex flex-col items-center">
                            <Badge
                              variant="outline"
                              className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] h-5 px-1.5 font-normal"
                            >
                              <CheckCircle2 className="h-3 w-3" /> แจ้งแล้ว
                            </Badge>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {alert.notifiedDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
	                      </TableCell>
	                      <TableCell className="text-center">
	                        <Button
	                          variant={alert.notified ? 'outline' : 'ghost'}
	                          size="sm"
	                          className={
	                            alert.notified
	                              ? 'h-8 px-2 gap-1 bg-background'
	                              : 'h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1'
	                          }
	                          onClick={() => handleNotifyOne(alert)}
	                          disabled={notifyMutation.isPending}
	                          title={alert.notified ? 'ส่งแจ้งเตือนซ้ำ' : 'ส่งแจ้งเตือน'}
	                        >
	                          {alert.notified ? (
	                            <>
	                              <Mail className="h-3.5 w-3.5" /> ส่งซ้ำ
	                            </>
	                          ) : (
	                            <>
	                              <Bell className="h-3.5 w-3.5" /> แจ้งเตือน
	                            </>
	                          )}
	                        </Button>
	                      </TableCell>
	                    </TableRow>
	                  ))
	                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <AlertTriangle className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h4 className="font-semibold text-blue-900 text-sm">ข้อแนะนำ</h4>
          <ul className="mt-1 space-y-1 text-xs text-blue-800/80 list-disc list-inside">
            <li>
              ผู้ที่ใบอนุญาตหมดอายุจะ <strong>ไม่สามารถรับเงิน พ.ต.ส.</strong>{' '}
              ได้จนกว่าจะต่ออายุใบอนุญาต
            </li>
            <li>ควรแจ้งเตือนล่วงหน้าอย่างน้อย 30-90 วันก่อนใบอนุญาตหมดอายุ</li>
            <li>
              สามารถเลือกหลายรายการในตาราง แล้วกดปุ่ม &quot;ส่งแจ้งเตือน&quot; ด้านบนเพื่อส่งพร้อมกันได้
            </li>
          </ul>
        </div>
      </div>

      {/* Notify Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการส่งแจ้งเตือน</DialogTitle>
            <DialogDescription>
              คุณต้องการส่งแจ้งเตือนไปยังบุคลากรที่เลือกจำนวน{' '}
              <span className="font-bold text-foreground">{selectedAlerts.length}</span> คน
              ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm font-medium mb-2">ตัวอย่างรายชื่อ:</p>
            <ul className="space-y-1 max-h-[150px] overflow-auto text-sm text-muted-foreground border rounded-md p-2 bg-muted/30">
              {selectedRows.slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-xs opacity-70">หมดอายุ {a.licenseExpiry}</span>
                </li>
              ))}
              {selectedRows.length > 5 && (
                <li className="text-xs text-center pt-1 italic">
                  ...และอีก {selectedRows.length - 5} คน
                </li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmNotify}
              disabled={notifyMutation.isPending}
              className="gap-2"
            >
              <Mail className="h-4 w-4" /> ยืนยันส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl mb-2">ส่งแจ้งเตือนสำเร็จ</DialogTitle>
            <p className="text-muted-foreground text-sm">
              ระบบได้บันทึกและส่งการแจ้งเตือนเรียบร้อยแล้ว
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-32">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
