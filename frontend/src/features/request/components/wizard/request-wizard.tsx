'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useRequestForm } from '@/features/request/components/hooks/useRequestForm';
import { Step1PersonalInfo } from './steps/step-1-personal';
import { Step2WorkInfo } from './steps/step-2-work-info';
import { Step3Attachments } from './steps/step-3-attachments';
import { Step4RateMapping } from './steps/step-4-rate-mapping';
import { Step5Review } from './steps/step-5-review';
import { useCheckSignature } from '@/features/signature/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { cn } from '@/lib/utils';

const steps = [
  { id: 1, title: 'ข้อมูลส่วนตัว' },
  { id: 2, title: 'รายละเอียดงาน' },
  { id: 3, title: 'แนบเอกสาร' },
  { id: 4, title: 'ตรวจสอบสิทธิ' },
  { id: 5, title: 'ยืนยันข้อมูล' },
];

interface RequestWizardProps {
  initialRequest?: RequestWithDetails;
  returnPath?: string;
}

export function RequestWizard({ initialRequest, returnPath }: RequestWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const {
    formData,
    updateFormData,
    handleUploadFile,
    removeFile,
    isSubmitting,
    submitRequest,
    confirmAttachments,
    prefillOriginal,
  } = useRequestForm({ initialRequest, returnPath });

  const { data: signatureCheck } = useCheckSignature();

  const hasAttachments = formData.files.length > 0 || (formData.attachments ?? []).length > 0;
  const hasSignature =
    formData.signatureMode === 'SAVED' ? !!signatureCheck?.has_signature : !!formData.signature;

  const isReadyToSubmit =
    hasSignature &&
    hasAttachments &&
    !!formData.rateMapping?.groupId &&
    !!formData.rateMapping?.itemId &&
    (formData.rateMapping?.amount ?? 0) > 0;

  const missingReasons: string[] = [];
  if (!hasAttachments) missingReasons.push('เอกสารแนบ');
  if (!formData.rateMapping?.groupId || !formData.rateMapping?.itemId)
    missingReasons.push('กลุ่ม/รายการเบิก');
  if ((formData.rateMapping?.amount ?? 0) <= 0) missingReasons.push('จำนวนเงิน');
  if (!hasSignature) missingReasons.push('ลายเซ็น');

  const disabledReason = missingReasons.length > 0 ? `ยังขาด: ${missingReasons.join(', ')}` : '';
  const isStep3Valid = hasAttachments;

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const handleNext = async () => {
    // Validation Logic
    if (currentStep === 2) {
      const wa = formData.workAttributes;
      if (!wa.operation || !wa.planning || !wa.coordination || !wa.service) {
        toast.error('กรุณาเลือกลักษณะงานที่ปฏิบัติให้ครบทั้ง 4 ข้อ');
        return;
      }
    }

    // Trigger Attachment Confirmation
    if (currentStep === 3) {
      if (!isStep3Valid) {
        toast.error('กรุณาแนบเอกสารอย่างน้อย 1 รายการ');
        return;
      }
      try {
        await confirmAttachments();
      } catch {
        // Error handled in hook or ignored silently
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Stepper Header */}
      <div className="relative">
        {/* Mobile Progress */}
        <div className="md:hidden space-y-2 mb-6">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">
              ขั้นตอน {currentStep}/{steps.length}
            </span>
            <span className="text-primary">{steps.find((s) => s.id === currentStep)?.title}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-in-out"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop Stepper */}
        <div className="hidden md:flex justify-between items-center relative z-10 px-4">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-secondary -z-10 -translate-y-1/2" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all duration-500 ease-in-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            return (
              <div
                key={step.id}
                className="flex flex-col items-center gap-2 bg-background p-2 rounded-lg"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-bold text-sm',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary text-primary shadow-[0_0_0_4px_rgba(var(--primary),0.1)] scale-110'
                        : 'border-muted-foreground/30 text-muted-foreground bg-background',
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium absolute -bottom-6 w-32 text-center transition-colors duration-300',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Card */}
      <Card className="shadow-lg border-border/60 mt-8 min-h-[500px] flex flex-col">
        <CardContent className="p-6 md:p-8 flex-1">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {currentStep === 1 && (
              <Step1PersonalInfo
                data={formData}
                updateData={updateFormData}
                prefillOriginal={prefillOriginal}
              />
            )}
            {currentStep === 2 && <Step2WorkInfo data={formData} updateData={updateFormData} />}
            {currentStep === 3 && (
              <Step3Attachments
                data={formData}
                onUpload={handleUploadFile}
                onRemove={removeFile}
                showExistingAttachments={Boolean(initialRequest)}
              />
            )}
            {currentStep === 4 && <Step4RateMapping data={formData} updateData={updateFormData} />}
            {currentStep === 5 && (
              <Step5Review
                data={formData}
                updateData={updateFormData}
                onGoToStep={(step) => setCurrentStep(step)}
                prefillOriginal={prefillOriginal}
              />
            )}
          </div>
        </CardContent>

        {/* Footer Actions */}
        <CardFooter className="border-t bg-muted/5 p-6 flex justify-between items-center rounded-b-xl">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 1 || isSubmitting}
            className="gap-2 min-w-[100px]"
          >
            <ChevronLeft className="w-4 h-4" /> ย้อนกลับ
          </Button>

          {currentStep === steps.length ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      onClick={submitRequest}
                      disabled={isSubmitting || !isReadyToSubmit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[150px] gap-2 shadow-md"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      ส่งใบคำขอ
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isReadyToSubmit && (
                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                    {disabledReason}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      onClick={handleNext}
                      disabled={currentStep === 3 && !isStep3Valid}
                      className="min-w-[120px] gap-2 shadow-sm"
                    >
                      ถัดไป <ChevronRight className="w-4 h-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {currentStep === 3 && !isStep3Valid && (
                  <TooltipContent>ต้องแนบเอกสารก่อนดำเนินการต่อ</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
