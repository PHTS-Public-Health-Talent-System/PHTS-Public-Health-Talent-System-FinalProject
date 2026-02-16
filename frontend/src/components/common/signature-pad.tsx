'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PenTool, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  className?: string;
  clearLabel?: string;
  placeholder?: string;
  height?: number;
  initialData?: string | null;
}

export default function SignaturePad({
  onSave,
  className,
  clearLabel = 'เซ็นใหม่',
  placeholder = 'เซ็นชื่อในช่องนี้',
  height = 200,
  initialData,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!initialData);

  // Refs for drawing state (to avoid re-renders during draw loop)
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize with existing signature if provided
  useEffect(() => {
    if (initialData && canvasRef.current) {
      const img = new Image();
      img.src = initialData;
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
          setIsEmpty(false);
        }
      };
    }
  }, [initialData]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Save current content before resize
    const dataUrl = canvas.toDataURL();

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = container.clientWidth;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(ratio, ratio);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a'; // Slate-900

    // Restore content
    if (!isEmpty) {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
    }
  }, [height, isEmpty]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const getPoint = (e: React.PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling on touch devices
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setIsDrawing(true);
    const point = getPoint(e);
    lastPointRef.current = point;

    // Draw a single dot in case it's just a tap
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    e.preventDefault();

    const ctx = canvasRef.current.getContext('2d');
    const point = getPoint(e);
    const lastPoint = lastPointRef.current;
    if (!ctx || !lastPoint) return;

    // Continuous stroke without clearing canvas
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;

    setIsEmpty(false);
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    lastPointRef.current = null;

    // Auto Save
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      onSave(url);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onSave('');
  };

  return (
    <div className={cn('space-y-3 select-none', className)}>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 transition-colors',
          isDrawing ? 'border-primary bg-white' : 'border-slate-300 hover:border-slate-400',
          !isEmpty && 'border-solid border-slate-200 bg-white',
        )}
        style={{ touchAction: 'none' }} // Important for mobile scrolling
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-crosshair touch-none"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={endDrawing}
          onPointerLeave={endDrawing}
          onPointerCancel={endDrawing}
        />

        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted-foreground animate-in fade-in">
            <div className="p-3 bg-slate-100 rounded-full mb-2">
              <PenTool className="h-6 w-6 opacity-50" />
            </div>
            <span className="text-sm font-medium">{placeholder}</span>
          </div>
        )}

        {/* Floating Clear Button (visible only when content exists) */}
        {!isEmpty && (
          <div className="absolute top-2 right-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/80 backdrop-blur hover:bg-red-50 hover:text-red-600 shadow-sm"
              onClick={clearCanvas}
              title={clearLabel}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Helper text if needed */}
      {!isEmpty && (
        <p className="text-[10px] text-muted-foreground text-right flex items-center justify-end gap-1">
          <CheckCircleIcon className="w-3 h-3 text-emerald-500" /> บันทึกอัตโนมัติแล้ว
        </p>
      )}
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
