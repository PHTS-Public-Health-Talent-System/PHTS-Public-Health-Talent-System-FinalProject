"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  useAddHoliday,
  useDeleteHoliday,
  useHolidays,
  useMasterRatesConfig,
  useUpdateMasterRate,
  useCreateMasterRate,
  useProfessions,
} from "@/features/master-data/hooks"

const STANDARD_PROFESSIONS = [
  { value: "DOCTOR", label: "DOCTOR (แพทย์)" },
  { value: "DENTIST", label: "DENTIST (ทันตแพทย์)" },
  { value: "PHARMACIST", label: "PHARMACIST (เภสัชกร)" },
  { value: "NURSE", label: "NURSE (พยาบาล)" },
  { value: "OTHERS", label: "OTHERS (อื่นๆ)" },
]

type HolidayRow = {
  holiday_id: number
  holiday_date: string
  holiday_name: string
  is_active: boolean
}

type MasterRateRow = {
  rate_id: number
  profession_code: string
  group_no: number
  item_no: string | number
  condition_desc: string | null
  amount: number
  is_active: boolean
}

export default function MasterDataPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [holidayDate, setHolidayDate] = useState("")
  const [holidayName, setHolidayName] = useState("")
  
  // Filter States
  const [selectedProfession, setSelectedProfession] = useState<string>("ALL")
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL")

  // Create Rate State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isNewGroup, setIsNewGroup] = useState(false)
  const [isNewProfession, setIsNewProfession] = useState(false)
  const [newRate, setNewRate] = useState({
    profession_code: "",
    group_no: "",
    item_no: "",
    sub_item_no: "",
    condition_desc: "",
    amount: "",
  })

  const holidays = useHolidays({ year })
  const addHoliday = useAddHoliday()
  const deleteHoliday = useDeleteHoliday()

  const rates = useMasterRatesConfig()
  const professionsQuery = useProfessions()
  const updateRate = useUpdateMasterRate()
  const createRate = useCreateMasterRate()

  const holidayRows = (holidays.data as HolidayRow[] | undefined) ?? []
  const rateRows = useMemo(() => {
    return (rates.data as MasterRateRow[] | undefined) ?? []
  }, [rates.data])

  // Extract unique values for filters
  const professions = useMemo(() => {
    // Combine current professions from rates and any potential extra ones from professionsQuery
    const set = new Set<string>(rateRows.map((r) => r.profession_code))
    if (professionsQuery.data) {
      professionsQuery.data.forEach((p: string) => set.add(p))
    }
    return Array.from(set).sort()
  }, [rateRows, professionsQuery.data])

  // Merged professions for Select (Standard + Dynamic)
  const mergedProfessions = useMemo(() => {
    const map = new Map<string, string>();
    STANDARD_PROFESSIONS.forEach(p => map.set(p.value, p.label));
    professions.forEach(p => {
      if (!map.has(p)) {
        map.set(p, p);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [professions]);

  const groups = useMemo(() => {
    const set = new Set(rateRows.map((r) => r.group_no))
    return Array.from(set).sort((a, b) => a - b)
  }, [rateRows])

  const [rateDrafts, setRateDrafts] = useState<Record<number, MasterRateRow>>({})
  
  // ... rest of the component
  const handleRateDraft = (rate: MasterRateRow, field: keyof MasterRateRow, value: string | number | boolean) => {
    setRateDrafts((prev) => ({
      ...prev,
      [rate.rate_id]: {
        ...rate,
        ...prev[rate.rate_id],
        [field]: value,
      } as MasterRateRow,
    }))
  }


  const handleCreateRate = () => {
    if (!newRate.profession_code || !newRate.group_no || !newRate.amount || !newRate.condition_desc) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (วิชาชีพ, กลุ่ม, เงื่อนไข, อัตรา)")
      return
    }

    createRate.mutate(
      {
        ...newRate,
        group_no: Number(newRate.group_no),
        amount: Number(newRate.amount),
        item_no: newRate.item_no || null,
        sub_item_no: newRate.sub_item_no || null,
      },
      {
        onSuccess: () => {
          toast.success("เพิ่มอัตราใหม่เรียบร้อยแล้ว")
          setIsCreateOpen(false)
          setNewRate({
            profession_code: "",
            group_no: "",
            item_no: "",
            sub_item_no: "",
            condition_desc: "",
            amount: "",
          })
          setIsNewGroup(false)
          setIsNewProfession(false)
          rates.refetch()
          professionsQuery.refetch()
        },
        onError: (err: Error) => {
           toast.error(`เพิ่มอัตราไม่สำเร็จ: ${err.message}`)
        },
      }
    )
  }

  const handleUpdateRate = (rate: MasterRateRow) => {
    const draft = rateDrafts[rate.rate_id] ?? rate
    if (!draft.condition_desc || !draft.condition_desc.trim()) {
      toast.error("กรุณาระบุเงื่อนไขก่อนบันทึก")
      return
    }
    updateRate.mutate(
      {
        rateId: rate.rate_id,
        payload: {
          amount: Number(draft.amount),
          condition_desc: draft.condition_desc ?? "",
          is_active: !!draft.is_active,
        },
      },
      {
        onSuccess: () => {
          toast.success("อัปเดตอัตราเรียบร้อยแล้ว")
          rates.refetch()
        },
        onError: () => toast.error("อัปเดตอัตราไม่สำเร็จ"),
      },
    )
  }

  const handleAddHoliday = () => {
    if (!holidayDate || !holidayName) {
      toast.error("กรุณากรอกวันที่และชื่อวันหยุด")
      return
    }
    addHoliday.mutate(
      { date: holidayDate, name: holidayName },
      {
        onSuccess: () => {
          toast.success("เพิ่มวันหยุดเรียบร้อยแล้ว")
          setHolidayDate("")
          setHolidayName("")
          holidays.refetch()
        },
        onError: () => toast.error("เพิ่มวันหยุดไม่สำเร็จ"),
      },
    )
  }

  const handleDeleteHoliday = (date: string) => {
    deleteHoliday.mutate(date, {
      onSuccess: () => {
        toast.success("ลบวันหยุดเรียบร้อยแล้ว")
        holidays.refetch()
      },
      onError: () => toast.error("ลบวันหยุดไม่สำเร็จ"),
    })
  }

  const filteredRates = useMemo(() => {
    return rateRows.filter((rate) => {
      const matchProf = selectedProfession === "ALL" || rate.profession_code === selectedProfession
      const matchGroup = selectedGroup === "ALL" || String(rate.group_no) === selectedGroup
      return matchProf && matchGroup
    })
  }, [rateRows, selectedProfession, selectedGroup])

  const sortedRates = useMemo(() => {
    return [...filteredRates].sort((a, b) => {
      if (a.profession_code !== b.profession_code) {
        return a.profession_code.localeCompare(b.profession_code)
      }
      if (a.group_no !== b.group_no) return a.group_no - b.group_no
      return String(a.item_no).localeCompare(String(b.item_no))
    })
  }, [filteredRates])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">Master Data</div>
        <div className="text-2xl font-semibold">ตั้งค่าข้อมูลหลัก</div>
      </div>

      <Tabs defaultValue="holidays">
        <TabsList>
          <TabsTrigger value="holidays">วันหยุดราชการ</TabsTrigger>
          <TabsTrigger value="rates">อัตรา พ.ต.ส.</TabsTrigger>
        </TabsList>

        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle>วันหยุดราชการ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">ปี</div>
                  <Input value={year} onChange={(e) => setYear(e.target.value)} className="w-24" />
                </div>
                <Button variant="outline" onClick={() => holidays.refetch()}>
                  โหลดรายการ
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-44"
                />
                <Input
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="ชื่อวันหยุด"
                  className="w-64"
                />
                <Button onClick={handleAddHoliday} disabled={addHoliday.isPending}>
                  {addHoliday.isPending ? "กำลังเพิ่ม..." : "เพิ่มวันหยุด"}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อวันหยุด</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidayRows.map((holiday) => (
                    <TableRow key={holiday.holiday_id}>
                      <TableCell>{holiday.holiday_date}</TableCell>
                      <TableCell>{holiday.holiday_name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteHoliday(holiday.holiday_date)}
                        >
                          ลบ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {holidayRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        ยังไม่มีรายการวันหยุด
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                 <span>อัตรา พ.ต.ส.</span>
                 <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                       <Button size="sm" className="gap-1">
                          <Plus className="h-4 w-4" /> เพิ่มอัตราใหม่
                       </Button>
                    </DialogTrigger>
                    <DialogContent>
                       <DialogHeader>
                          <DialogTitle>เพิ่มอัตรา พ.ต.ส.</DialogTitle>
                          <DialogDescription>
                             สร้างอัตราการจ่ายเงิน พ.ต.ส. ใหม่ โดยระบุวิชาชีพ กลุ่ม และเงื่อนไข
                          </DialogDescription>
                       </DialogHeader>
                       <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>วิชาชีพ (Code)</Label>
                                {isNewProfession ? (
                                   <div className="flex gap-2">
                                      <Input 
                                         placeholder="รหัสวิชาชีพใหม่"
                                         value={newRate.profession_code}
                                         onChange={(e) => setNewRate({...newRate, profession_code: e.target.value.toUpperCase()})}
                                         className="flex-1"
                                         autoFocus
                                      />
                                      <Button variant="ghost" size="sm" onClick={() => setIsNewProfession(false)} className="text-xs">
                                         เลือก
                                      </Button>
                                   </div>
                                ) : (
                                   <Select 
                                      value={newRate.profession_code} 
                                      onValueChange={(val) => {
                                         if (val === "NEW") {
                                            setIsNewProfession(true)
                                            setNewRate({...newRate, profession_code: ""})
                                         } else {
                                            setNewRate({...newRate, profession_code: val})
                                         }
                                      }}
                                   >
                                      <SelectTrigger>
                                         <SelectValue placeholder="เลือกวิชาชีพ" />
                                      </SelectTrigger>
                                      <SelectContent>
                                         {mergedProfessions.map((p) => (
                                           <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                         ))}
                                         <SelectItem value="NEW" className="text-primary font-medium">+ เพิ่มวิชาชีพใหม่</SelectItem>
                                      </SelectContent>
                                   </Select>
                                )}
                             </div>
                             <div className="space-y-2">
                                <Label>กลุ่ม (Group No)</Label>
                                {isNewGroup ? (
                                   <div className="flex gap-2">
                                      <Input 
                                         type="number" 
                                         placeholder="เลขกลุ่มใหม่"
                                         value={newRate.group_no}
                                         onChange={(e) => setNewRate({...newRate, group_no: e.target.value})}
                                         className="flex-1"
                                         autoFocus
                                      />
                                      <Button variant="ghost" size="sm" onClick={() => setIsNewGroup(false)} className="text-xs">
                                         เลือก
                                      </Button>
                                   </div>
                                ) : (
                                   <Select 
                                      value={newRate.group_no} 
                                      onValueChange={(val) => {
                                         if (val === "NEW") {
                                            setIsNewGroup(true)
                                            setNewRate({...newRate, group_no: ""})
                                         } else {
                                            setNewRate({...newRate, group_no: val})
                                         }
                                      }}
                                   >
                                      <SelectTrigger>
                                         <SelectValue placeholder="เลือกกลุ่ม" />
                                      </SelectTrigger>
                                      <SelectContent>
                                         {groups.map((g) => (
                                           <SelectItem key={g} value={String(g)}>กลุ่ม {g}</SelectItem>
                                         ))}
                                         <SelectItem value="NEW" className="text-primary font-medium">+ สร้างกลุ่มใหม่</SelectItem>
                                      </SelectContent>
                                   </Select>
                                )}
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>ข้อ (Item No) *Optional</Label>
                                <Input 
                                   placeholder="เช่น 1.1"
                                   value={newRate.item_no}
                                   onChange={(e) => setNewRate({...newRate, item_no: e.target.value})}
                                />
                             </div>
                             <div className="space-y-2">
                                <Label>ข้อย่อย (Sub-Item) *Optional</Label>
                                <Input 
                                   placeholder="เช่น 1.1.1"
                                   value={newRate.sub_item_no}
                                   onChange={(e) => setNewRate({...newRate, sub_item_no: e.target.value})}
                                />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <Label>เงื่อนไข (Condition)</Label>
                             <Input 
                                placeholder="รายละเอียดเงื่อนไขการจ่าย"
                                value={newRate.condition_desc}
                                onChange={(e) => setNewRate({...newRate, condition_desc: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <Label>จำนวนเงิน (Amount)</Label>
                             <Input 
                                type="number" 
                                placeholder="0.00"
                                value={newRate.amount}
                                onChange={(e) => setNewRate({...newRate, amount: e.target.value})}
                             />
                          </div>
                       </div>
                       <DialogFooter>
                          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>ยกเลิก</Button>
                          <Button onClick={handleCreateRate} disabled={createRate.isPending}>
                             {createRate.isPending ? "กำลังบันทึก..." : "บันทึก"}
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                 </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filter Controls */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="space-y-1">
                   <div className="text-xs font-medium text-muted-foreground">วิชาชีพ</div>
                   <Select value={selectedProfession} onValueChange={setSelectedProfession}>
                      <SelectTrigger className="w-[200px]">
                         <SelectValue placeholder="ทุกวิชาชีพ" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="ALL">ทุกวิชาชีพ</SelectItem>
                         {professions.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-1">
                   <div className="text-xs font-medium text-muted-foreground">กลุ่ม (ฉบับ)</div>
                   <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger className="w-[120px]">
                         <SelectValue placeholder="ทุกกลุ่ม" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="ALL">ทุกกลุ่ม</SelectItem>
                         {groups.map(g => (
                            <SelectItem key={g} value={String(g)}>กลุ่ม {g}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วิชาชีพ</TableHead>
                    <TableHead>กลุ่ม</TableHead>
                    <TableHead>ข้อ</TableHead>
                    <TableHead>เงื่อนไข</TableHead>
                    <TableHead className="text-right">อัตรา</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRates.map((rate) => {
                    const draft = rateDrafts[rate.rate_id] ?? rate
                    return (
                      <TableRow key={rate.rate_id}>
                        <TableCell>{rate.profession_code}</TableCell>
                        <TableCell>{rate.group_no}</TableCell>
                        <TableCell>{rate.item_no}</TableCell>
                        <TableCell>
                          <Input
                            value={draft.condition_desc ?? ""}
                            onChange={(e) =>
                              handleRateDraft(rate, "condition_desc", e.target.value)
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={draft.amount}
                            onChange={(e) =>
                              handleRateDraft(rate, "amount", Number(e.target.value))
                            }
                            className="h-8 w-28 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!draft.is_active}
                            onChange={(e) =>
                              handleRateDraft(rate, "is_active", e.target.checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleUpdateRate(rate)}>
                            บันทึก
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {sortedRates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        ยังไม่มีข้อมูลอัตรา
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
