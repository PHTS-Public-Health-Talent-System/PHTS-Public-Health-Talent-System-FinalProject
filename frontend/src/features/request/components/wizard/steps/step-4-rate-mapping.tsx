'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { RequestFormData } from '@/types/request.types';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  Users,
  Stethoscope,
  Smile,
  Pill,
  Activity,
  Wallet,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useRateHierarchy } from '@/features/master-data/hooks';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import {
  normalizeProfessionCode,
  PROFESSION_CODE_ALIASES,
  resolveProfessionLabel,
} from '@/shared/constants/profession';

// Interfaces
interface Criterion {
  id: string;
  label: string;
  description?: string;
  subCriteria?: Criterion[];
  choices?: string[];
}
interface ProfessionGroup {
  id: string;
  name: string;
  rate: number;
  criteria: Criterion[];
}
interface ProfessionDef {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  groups: ProfessionGroup[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  DOCTOR: Stethoscope,
  DENTIST: Smile,
  PHARMACIST: Pill,
  NURSE: Activity,
  OTHERS: Users,
};

interface Step4Props {
  data: RequestFormData;
  updateData: (field: keyof RequestFormData, value: unknown) => void;
}

// UI Helper: Selection Step Block
const SelectionStep = ({
  title,
  isActive,
  isCompleted,
  onEdit,
  children,
}: {
  title: string;
  isActive: boolean;
  isCompleted: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={`mb-4 border rounded-xl overflow-hidden transition-all duration-300 ${isActive ? 'border-primary/50 shadow-md ring-1 ring-primary/10' : 'border-border'}`}
    >
      <div
        className={`px-4 py-3 flex justify-between items-center ${isCompleted ? 'bg-secondary/30 cursor-pointer hover:bg-secondary/50' : isActive ? 'bg-primary/5' : 'bg-muted/10 opacity-60'}`}
        onClick={isCompleted ? onEdit : undefined}
      >
        <h3
          className={`font-semibold flex items-center gap-2 text-sm md:text-base ${isActive ? 'text-primary' : 'text-foreground/70'}`}
        >
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {!isCompleted && isActive && (
            <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
            </div>
          )}
          {!isCompleted && !isActive && (
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30"></div>
          )}
          {title}
        </h3>
        {isCompleted && onEdit && (
          <button type="button" className="text-xs text-primary hover:underline">
            แก้ไข
          </button>
        )}
      </div>

      {isActive && (
        <div className="p-4 bg-card animate-in fade-in slide-in-from-top-1">{children}</div>
      )}

      {isCompleted && !isActive && (
        <div className="px-4 py-2 bg-card text-sm text-muted-foreground border-t border-border flex flex-wrap items-center gap-2">
          <span className="font-medium text-xs uppercase tracking-wide opacity-70">เลือกแล้ว:</span>
          {children}
        </div>
      )}
    </div>
  );
};

export function Step4RateMapping({ data, updateData }: Step4Props) {
  const { data: hierarchyData, isLoading: isHeirarchyLoading } = useRateHierarchy();
  const isLoading = isHeirarchyLoading;

  const [selectedGroup, setSelectedGroup] = useState<ProfessionGroup | null>(null);
  const [selectedCriteria, setSelectedCriteria] = useState<Criterion | null>(null);
  const [selectedSubCriteria, setSelectedSubCriteria] = useState<Criterion | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const selectedProfCode = (data.professionCode || data.rateMapping?.professionCode || '').toUpperCase();
  const normalizedProfCode = useMemo(
    () => normalizeProfessionCode(selectedProfCode || null),
    [selectedProfCode],
  );

  const selectedProfData = useMemo(() => {
    if (!hierarchyData || !selectedProfCode) return null;

    const aliasCode = Object.entries(PROFESSION_CODE_ALIASES).find(
      ([, canonical]) => canonical === selectedProfCode,
    )?.[0];
    const candidates = [selectedProfCode, normalizedProfCode, aliasCode].filter(Boolean);

    let found: ProfessionDef | undefined;
    for (const candidate of candidates) {
      found = hierarchyData.find((p: ProfessionDef) => p.id === candidate);
      if (found) break;
    }

    if (!found) found = hierarchyData.find((p: ProfessionDef) => p.id === 'ALLIED');
    if (!found) found = hierarchyData.find((p: ProfessionDef) => p.id === 'OTHERS');
    if (found) return { ...found, icon: ICON_MAP[found.id] || Users };
    return null;
  }, [selectedProfCode, normalizedProfCode, hierarchyData]);

  const fallbackProfData = useMemo(() => {
    if (!hierarchyData?.length) return null;
    const allied = hierarchyData.find((p: ProfessionDef) => p.id === 'ALLIED');
    if (allied) return { ...allied, icon: ICON_MAP[allied.id] || Users };
    const others = hierarchyData.find((p: ProfessionDef) => p.id === 'OTHERS');
    if (others) return { ...others, icon: ICON_MAP[others.id] || Users };
    const firstWithGroup = hierarchyData.find(
      (p: ProfessionDef) => Array.isArray(p.groups) && p.groups.length > 0,
    );
    if (firstWithGroup) return { ...firstWithGroup, icon: ICON_MAP[firstWithGroup.id] || Users };
    return null;
  }, [hierarchyData]);

  const effectiveProfData = selectedProfData ?? fallbackProfData;

  const selectedProfessionDisplay = useMemo(() => {
    if (!selectedProfCode) return 'ไม่พบข้อมูลวิชาชีพ';
    if (effectiveProfData?.id) {
      return resolveProfessionLabel(
        effectiveProfData.id,
        effectiveProfData.name || effectiveProfData.id,
      );
    }
    return resolveProfessionLabel(selectedProfCode, selectedProfCode);
  }, [selectedProfCode, effectiveProfData]);
  const activeProfessionId = effectiveProfData?.id ?? selectedProfCode;
  const previousProfessionRef = useRef<string>('');

  useEffect(() => {
    if (!activeProfessionId) return;

    if (!previousProfessionRef.current) {
      previousProfessionRef.current = activeProfessionId;
      return;
    }
    if (previousProfessionRef.current === activeProfessionId) return;

    previousProfessionRef.current = activeProfessionId;
    const t = setTimeout(() => {
      setSelectedGroup(null);
      setSelectedCriteria(null);
      setSelectedSubCriteria(null);
      setSelectedChoice(null);
      flushSync(() => {
        updateData('rateMapping', {
          ...data.rateMapping,
          professionCode: activeProfessionId,
          groupId: '',
          itemId: '',
          subItemId: '',
          amount: 0,
        });
      });
    }, 0);
    return () => clearTimeout(t);
  }, [activeProfessionId, data.rateMapping, updateData]);

  // Rehydration Effect
  useEffect(() => {
    if (data.rateMapping?.groupId && effectiveProfData) {
      const savedGroup = effectiveProfData.groups.find(
        (g: ProfessionGroup) => g.id === data.rateMapping?.groupId,
      );
      if (!savedGroup || savedGroup.id === selectedGroup?.id) return;
      // Avoid calling setState directly in the effect body (react-hooks/set-state-in-effect).
      const t = setTimeout(() => setSelectedGroup(savedGroup), 0);
      return () => clearTimeout(t);
    }
    return;
  }, [effectiveProfData, data.rateMapping?.groupId, selectedGroup?.id]);

  // Sync Logic
  const NONE_ITEM_ID = '__NONE__';

  const writeRateMapping = (next: {
    group: ProfessionGroup | null;
    criteria?: Criterion | null;
    subCriteria?: Criterion | null;
  }) => {
    if (!next.group) {
      // Ensure parent state is updated synchronously so Step 5 doesn't read stale rateMapping.
      flushSync(() => {
        updateData('rateMapping', {
          ...data.rateMapping,
          amount: 0,
          groupId: '',
          itemId: '',
          subItemId: '',
        });
      });
      return;
    }

    const group = next.group;
    const hasCriteria = (group.criteria?.length ?? 0) > 0;
    // Backend can include a "group-level" rate row where item_no is NULL. That becomes a criterion with empty id.
    // Represent "no specific item" with a sentinel that is truthy for UI validation but will map to NULL item_no
    // when submitting (see parseGroupItem in useRequestForm).
    const rawCriteriaId = String(next.criteria?.id ?? '').trim();
    const nextItemId = !hasCriteria
      ? NONE_ITEM_ID
      : !next.criteria
        ? ''
        : rawCriteriaId === '' || rawCriteriaId === NONE_ITEM_ID
          ? NONE_ITEM_ID
          : rawCriteriaId;
    const nextSubId = next.subCriteria?.id ?? '';

    // Ensure parent state is updated synchronously so Step 5 doesn't read stale rateMapping.
    flushSync(() => {
        updateData('rateMapping', {
          ...data.rateMapping,
          professionCode: activeProfessionId,
          groupId: group.id,
          itemId: nextItemId,
          subItemId: nextSubId,
          amount: group.rate,
        });
    });
  };

  // Handlers
  const handleGroupSelect = (group: ProfessionGroup | null) => {
    setSelectedGroup(group);
    setSelectedCriteria(null);
    setSelectedSubCriteria(null);
    setSelectedChoice(null);
    writeRateMapping({ group, criteria: null, subCriteria: null });
  };
  const handleCriteriaSelect = (criteria: Criterion | null) => {
    // If this criterion has empty id, treat it as "no specific item" (group-level rule).
    const normalized =
      criteria && String(criteria.id ?? '').trim() === '' ? { ...criteria, id: NONE_ITEM_ID } : criteria;
    setSelectedSubCriteria(null);
    setSelectedChoice(null);
    setSelectedCriteria(normalized);
    writeRateMapping({ group: selectedGroup, criteria: normalized, subCriteria: null });
  };
  const handleSubCriteriaSelect = (sub: Criterion | null) => {
    setSelectedSubCriteria(sub);
    setSelectedChoice(null);
    writeRateMapping({ group: selectedGroup, criteria: selectedCriteria, subCriteria: sub });
  };
  const handleChoiceSelect = (choice: string | null) => setSelectedChoice(choice);
  const handleReset = () => {
    handleGroupSelect(null);
  };
const renderMoney = (amount: number) => formatThaiNumber(amount) + ' บาท';

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h3 className="text-xl font-semibold text-primary">ตรวจสอบสิทธิการเบิก</h3>
          <p className="text-sm text-muted-foreground">เลือกกลุ่มงานและเกณฑ์ที่ตรงกับคุณ</p>
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1 border px-3 py-1.5 rounded-md hover:bg-destructive/5 transition-colors"
        >
          <RefreshCw size={14} /> ล้างค่าเริ่มต้น
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Selection Area */}
        <div className="lg:col-span-8 space-y-2">
          {/* 1. Profession Display */}
          <SelectionStep title="1. วิชาชีพ" isActive={false} isCompleted={true}>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full text-primary">
                <User size={20} />
              </div>
              <span className="font-medium text-foreground text-lg">
                {selectedProfessionDisplay}
              </span>
            </div>
          </SelectionStep>

          {/* 2. Group Selection */}
          {effectiveProfData && (
            <SelectionStep
              title="2. เลือกกลุ่มงาน"
              isActive={!selectedGroup}
              isCompleted={!!selectedGroup}
              onEdit={() => handleGroupSelect(null)}
            >
              {!selectedGroup ? (
                <div className="space-y-3">
                  {effectiveProfData.groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleGroupSelect(group)}
                      className="w-full flex justify-between items-center p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group text-left shadow-sm hover:shadow-md bg-card"
                    >
                      <span className="font-medium text-foreground">{group.name}</span>
                      <Badge
                        variant="secondary"
                        className="group-hover:bg-background text-base px-3 py-1"
                      >
                        {renderMoney(group.rate)}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-between w-full items-center">
                  <span className="font-medium">{selectedGroup.name}</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                    {renderMoney(selectedGroup.rate)}
                  </span>
                </div>
              )}
            </SelectionStep>
          )}

          {/* 3. Criteria Selection */}
          {selectedGroup && (
            <SelectionStep
              title="3. เลือกเกณฑ์/เงื่อนไข"
              isActive={!!selectedGroup && !selectedCriteria}
              isCompleted={!!selectedCriteria}
              onEdit={() => handleCriteriaSelect(null)}
            >
              {!selectedCriteria ? (
                <div className="space-y-2">
                  {selectedGroup.criteria.map((cri) => (
                    <button
                      key={cri.id}
                      type="button"
                      onClick={() => handleCriteriaSelect(cri)}
                      className="w-full text-left p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group shadow-sm bg-card"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {cri.label}
                        </div>
                        {cri.subCriteria && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            มีข้อย่อย
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-foreground font-medium">{selectedCriteria.label}</span>
              )}
            </SelectionStep>
          )}

          {/* 4. Sub-Criteria (Conditional) */}
          {selectedCriteria?.subCriteria && selectedCriteria.subCriteria.length > 0 && (
            <SelectionStep
              title="4. รายละเอียดเงื่อนไขย่อย"
              isActive={true}
              isCompleted={!!selectedSubCriteria}
              onEdit={() => setSelectedSubCriteria(null)}
            >
              {!selectedSubCriteria ? (
                <div className="space-y-2">
                  {selectedCriteria.subCriteria.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSubCriteriaSelect(sub)}
                      className="w-full text-left p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-sm group bg-card"
                    >
                      <div className="flex justify-between items-center">
                        <span className="group-hover:text-primary transition-colors font-medium">
                          {sub.label}
                        </span>
                        {sub.choices && (
                          <span className="text-[10px] text-muted-foreground italic">
                            (ต้องระบุงาน)
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-foreground">{selectedSubCriteria.label}</span>
              )}
            </SelectionStep>
          )}

          {/* 5. Choices */}
          {selectedSubCriteria?.choices && (
            <div className="ml-4 md:ml-8 p-5 bg-amber-50/50 rounded-xl border border-amber-100 mt-4 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <Info size={16} className="text-amber-600" /> ระบุงานเฉพาะทาง (จำเป็น):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedSubCriteria.choices.map((choice, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedChoice === choice ? 'bg-amber-100 border-amber-300 ring-1 ring-amber-200 shadow-sm' : 'bg-white border-amber-100 hover:border-amber-300'}`}
                  >
                    <input
                      type="radio"
                      name="specific_job"
                      className="accent-amber-600 w-4 h-4"
                      onChange={() => handleChoiceSelect(choice)}
                    />
                    <span className="text-sm text-slate-700 font-medium">{choice}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Effective Date */}
          {(selectedGroup || selectedProfCode) && (
            <div className="mt-6 pt-6 border-t">
              <div className="max-w-xs">
                <label className="text-sm font-semibold mb-2 block">วันที่มีผล</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={data.effectiveDate}
                  onChange={(e) => updateData('effectiveDate', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Summary Sticky */}
        <div className="lg:col-span-4">
          <Card className="sticky top-6 border border-primary/20 shadow-lg overflow-hidden">
            <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center gap-2">
              <div className="p-2 bg-white rounded-full shadow-sm border border-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-primary">สรุปยอดเงิน</h3>
            </div>

            <div className="p-6 space-y-6">
              {/* รายละเอียดการเลือก */}
              <div className="space-y-4">
                <div className="flex justify-between items-start pb-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">กลุ่มงาน</span>
                  <span className="text-sm font-medium text-right max-w-[150px] leading-tight">
                    {selectedGroup?.name || <span className="text-muted-foreground/50">-</span>}
                  </span>
                </div>
                <div className="flex justify-between items-start pb-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">เกณฑ์</span>
                  <span className="text-sm font-medium text-right max-w-[150px] leading-tight">
                    {selectedCriteria?.label || <span className="text-muted-foreground/50">-</span>}
                  </span>
                </div>

                {selectedSubCriteria && (
                  <div className="bg-secondary/30 p-3 rounded-lg border border-border/50 text-sm space-y-1">
                    <span className="text-xs text-muted-foreground block mb-1">
                      รายละเอียดเพิ่มเติม:
                    </span>
                    <span className="font-medium text-foreground">{selectedSubCriteria.label}</span>
                    {selectedChoice && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-primary">
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-semibold text-xs">{selectedChoice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total Amount */}
              <div className="pt-2">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    ยอดสุทธิที่ได้รับ
                  </span>
                  <div className="flex items-baseline justify-center gap-1 mt-1">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      {selectedGroup ? formatThaiNumber(selectedGroup.rate) : '0'}
                    </span>
                    <span className="text-base text-muted-foreground font-medium">บาท</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground mt-3 text-center opacity-80">
                  * ยอดเงินอาจมีการเปลี่ยนแปลงตามประกาศและเงื่อนไขล่าสุดของกระทรวงสาธารณสุข
                </p>
              </div>
            </div>

            {!selectedGroup && (
              <div className="bg-amber-50 p-3 text-xs text-amber-800 text-center border-t border-amber-100 font-medium flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" /> กรุณาเลือกข้อมูลให้ครบถ้วน
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
