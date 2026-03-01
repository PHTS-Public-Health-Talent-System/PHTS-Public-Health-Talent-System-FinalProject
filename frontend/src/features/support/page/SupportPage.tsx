'use client';

import { useMemo, useState, useRef, useEffect, type ClipboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MessageCircle,
  Send,
  RotateCcw,
  Paperclip,
  X,
  Trash2,
  CheckCheck,
  Search,
  User,
  Headphones,
  MoreVertical,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCloseSupportTicket,
  useCreateSupportTicket,
  useDeleteSupportTicket,
  useMySupportTickets,
  useReopenSupportTicket,
  useSupportTickets,
  useUpdateSupportTicketStatus,
} from '@/features/support/tickets';
import {
  useCreateSupportTicketMessage,
  useSupportTicketMessages,
} from '@/features/support/messages';
import type { SupportTicketStatus } from '@/features/support/shared';
import {
  buildAttachmentUrl,
  decodeAttachmentFileName,
} from '@/features/request/detail/requestDetail.attachments';
import { useAuth } from '@/components/providers/auth-provider';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { formatThaiDate, formatThaiDateTime, formatThaiTime } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

// --- Helper Functions ---
function getFilesFromClipboard(e: ClipboardEvent<HTMLTextAreaElement>): File[] {
  const items = Array.from(e.clipboardData?.items ?? []);
  const files: File[] = [];
  for (const item of items) {
    if (!item.type?.startsWith('image/')) continue;
    const f = item.getAsFile();
    if (!f) continue;
    const ext = (f.type.split('/')[1] || 'png').replace(/[^a-z0-9]+/gi, '');
    const name = `clipboard-${Date.now()}.${ext || 'png'}`;
    files.push(new File([f], name, { type: f.type, lastModified: Date.now() }));
  }
  return files;
}

function mergeFiles(prev: File[], next: File[]): File[] {
  if (!next.length) return prev;
  const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
  const merged = [...prev];
  for (const f of next) {
    const key = `${f.name}:${f.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
  }
  return merged;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-amber-500/15 text-amber-700 border-amber-500/20';
    case 'in_progress': return 'bg-blue-500/15 text-blue-700 border-blue-500/20';
    case 'closed': return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20';
    default: return 'bg-muted text-muted-foreground border-muted';
  }
};

const normalizeStatus = (status: string) => {
  switch (status) {
    case 'OPEN':
    case 'REOPENED': return 'open';
    case 'IN_PROGRESS': return 'in_progress';
    case 'RESOLVED':
    case 'CLOSED': return 'closed';
    default: return 'open';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'OPEN':
    case 'REOPENED': return 'รอดำเนินการ';
    case 'IN_PROGRESS': return 'กำลังดำเนินการ';
    case 'RESOLVED': return 'แก้ไขแล้ว';
    case 'CLOSED': return 'ปิดแล้ว';
    default: return status;
  }
};

const getCategoryLabel = (category?: string | null) => {
  switch ((category ?? '').toLowerCase()) {
    case 'bug':
    case 'issue': return 'ปัญหาการใช้งาน';
    case 'question': return 'สอบถามข้อมูล';
    case 'suggestion': return 'ข้อเสนอแนะ';
    case 'other': return 'อื่นๆ';
    default: return category || 'อื่นๆ';
  }
};

const SUPPORT_STATUS_VALUES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'];

const isSupportTicketStatus = (value: string): value is SupportTicketStatus =>
  SUPPORT_STATUS_VALUES.includes(value as SupportTicketStatus);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) return maybeMessage;
  }
  return 'เกิดข้อผิดพลาด';
};

const getMetadataCategory = (metadata: unknown): string | undefined => {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const category = (metadata as { category?: unknown }).category;
  return typeof category === 'string' ? category : undefined;
};

type TicketActionMutation = {
  mutate: (
    ticketId: string | number,
    options?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => void;
};

// --- Component: Empty State (ขวา) ---
const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
    <div className="rounded-full bg-muted/40 p-5 mb-4 border border-border/50 shadow-sm">
      <Inbox className="h-10 w-10 text-muted-foreground/50" />
    </div>
    <h3 className="text-lg font-semibold text-foreground">เลือกรายการที่ต้องการดู</h3>
    <p className="text-sm mt-1 max-w-[280px] mx-auto leading-relaxed">
      คลิกที่รายการทางด้านซ้ายเพื่อดูรายละเอียดการสนทนา หรือส่งข้อความติดต่อทีมงาน
    </p>
  </div>
);

// --- Main Page Component ---
interface SupportPageProps {
  adminMode?: boolean;
}

export function SupportPage({ adminMode = false }: SupportPageProps) {
  // Hooks
  const { user } = useAuth();
  const [adminStatusFilter, setAdminStatusFilter] = useState<'ALL' | SupportTicketStatus>('ALL');
  const isAdminView = adminMode || user?.role === 'ADMIN';

  const myTicketsQuery = useMySupportTickets(!isAdminView);
  const allTicketsQuery = useSupportTickets(
    { status: adminStatusFilter === 'ALL' ? undefined : adminStatusFilter, page: 1, limit: 100 },
    isAdminView,
  );
  const ticketData = useMemo(
    () => (isAdminView ? (allTicketsQuery.data?.rows ?? []) : (myTicketsQuery.data ?? [])),
    [allTicketsQuery.data?.rows, isAdminView, myTicketsQuery.data],
  );

  const createTicket = useCreateSupportTicket();
  const createMessage = useCreateSupportTicketMessage();
  const reopenTicket = useReopenSupportTicket();
  const closeTicket = useCloseSupportTicket();
  const deleteTicket = useDeleteSupportTicket();
  const updateStatus = useUpdateSupportTicketStatus();

  // Local State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [newTicket, setNewTicket] = useState({ subject: '', category: '', message: '' });
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [newTicketError, setNewTicketError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [previewName, setPreviewName] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const isTicketsLoading = isAdminView ? allTicketsQuery.isLoading : myTicketsQuery.isLoading;

  // Derived Data
  const tickets = useMemo(() => {
    return ticketData
      .map((ticket) => ({
        id: String(ticket.id),
        subject: ticket.subject,
        category: getCategoryLabel(getMetadataCategory((ticket as { metadata?: unknown }).metadata)),
        status: normalizeStatus(ticket.status),
        rawStatus: ticket.status,
        statusLabel: getStatusLabel(ticket.status),
        createdAt: ticket.created_at,
        lastUpdated: ticket.updated_at ?? ticket.created_at,
      }))
      .filter((t) => t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery))
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [ticketData, searchQuery]);

  const selectedTicket = useMemo(() => tickets.find((t) => t.id === selectedTicketId) ?? null, [tickets, selectedTicketId]);

  const { data: ticketMessages = [], isLoading: isMessagesLoading } = useSupportTicketMessages(selectedTicketId ?? undefined);

  const messages = useMemo(() => ticketMessages.map((msg) => ({
    sender: msg.sender_role === 'USER' ? 'user' : 'support',
    senderUserId: msg.sender_user_id,
    senderRole: msg.sender_role,
    message: msg.message,
    timestamp: msg.created_at,
    attachments: msg.attachments ?? [],
  })), [ticketMessages]);

  useEffect(() => {
    if (messageEndRef.current) messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedTicketId]);

  useEffect(() => {
    return () => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // Handlers
  const handleCreateTicket = () => {
    setNewTicketError(null);
    if (newTicket.message.trim().length < 10) {
      setNewTicketError('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
      return;
    }
    const formData = new FormData();
    formData.append('subject', newTicket.subject.trim());
    formData.append('description', newTicket.message.trim());
    formData.append('page_url', window.location.href);
    formData.append('user_agent', window.navigator.userAgent);
    formData.append('metadata', JSON.stringify({ category: newTicket.category }));
    newTicketFiles.forEach((f) => formData.append('attachments', f));

    createTicket.mutate(formData, {
      onSuccess: () => {
        toast.success('สร้างรายการแจ้งปัญหาเรียบร้อย');
        setIsDialogOpen(false);
        setNewTicket({ subject: '', category: '', message: '' });
        setNewTicketFiles([]);
      },
      onError: (err: unknown) => setNewTicketError(getErrorMessage(err)),
    });
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
    const files = getFilesFromClipboard(e);
    if (!files.length) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) e.preventDefault();
    setFiles((prev) => mergeFiles(prev, files));
    toast.success(`แนบรูปจากคลิปบอร์ด ${files.length} ไฟล์`);
  };

  const openFilePreview = (file: File) => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewName(file.name);
    setIsPreviewOpen(true);
  };

  const openAttachmentPreview = (url: string, fileName: string) => {
    setPreviewName(decodeAttachmentFileName(fileName));
    setPreviewUrl(url);
    setIsPreviewOpen(true);
  };

  const closeFilePreview = () => {
    setIsPreviewOpen(false);
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewName('');
    setPreviewUrl('');
  };

  const handleSendMessage = () => {
    setReplyError(null);
    if (!selectedTicketId || (!replyMessage.trim() && replyFiles.length === 0)) {
      setReplyError('กรุณาพิมพ์ข้อความหรือแนบไฟล์ก่อนส่ง');
      return;
    }
    const formData = new FormData();
    if (replyMessage.trim()) formData.append('message', replyMessage.trim());
    replyFiles.forEach((file) => formData.append('attachments', file));

    createMessage.mutate({ ticketId: selectedTicketId, payload: formData }, {
      onSuccess: () => {
        setReplyMessage('');
        setReplyFiles([]);
      },
      onError: (err: unknown) => setReplyError(getErrorMessage(err)),
    });
  };

  const handleAction = (mutation: TicketActionMutation, successMsg: string) => {
    if (!selectedTicketId) return;
    mutation.mutate(selectedTicketId, {
      onSuccess: () => {
        toast.success(successMsg);
        if (mutation === deleteTicket) {
          setSelectedTicketId(null);
          setIsDeleteDialogOpen(false);
        }
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    });
  };

  const handleAdminStatusChange = (status: SupportTicketStatus) => {
    if (!selectedTicketId) return;
    updateStatus.mutate({ ticketId: selectedTicketId, status }, {
      onSuccess: () => toast.success('อัปเดตสถานะแล้ว'),
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    });
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ศูนย์ช่วยเหลือ</h1>
          <p className="text-muted-foreground text-sm mt-1">
            แจ้งปัญหา สอบถามข้อมูล และติดตามสถานะรายการแจ้งปัญหา
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> สร้างรายการใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>สร้างรายการแจ้งปัญหาใหม่</DialogTitle>
              <DialogDescription>กรอกรายละเอียดปัญหาหรือคำถามของคุณ ทีมงานจะตอบกลับโดยเร็วที่สุด</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {newTicketError && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ไม่สามารถสร้างรายการได้</AlertTitle>
                  <AlertDescription>{newTicketError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="subject">หัวข้อ <span className="text-destructive">*</span></Label>
                <Input id="subject" placeholder="เช่น เข้าใช้งานระบบไม่ได้" value={newTicket.subject} onChange={(e) => setNewTicket(p => ({...p, subject: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">ประเภท <span className="text-destructive">*</span></Label>
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket(p => ({...p, category: v}))}>
                  <SelectTrigger id="category"><SelectValue placeholder="เลือกประเภทปัญหา" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">ปัญหาการใช้งาน</SelectItem>
                    <SelectItem value="question">สอบถามข้อมูล</SelectItem>
                    <SelectItem value="suggestion">ข้อเสนอแนะ</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">รายละเอียด <span className="text-destructive">*</span></Label>
                <Textarea
                  id="message"
                  placeholder="อธิบายรายละเอียดปัญหาหรือคำถามของคุณ..."
                  rows={5}
                  className="resize-none"
                  value={newTicket.message}
                  onChange={(e) => setNewTicket(p => ({...p, message: e.target.value}))}
                  onPaste={(e) => handlePaste(e, setNewTicketFiles)}
                />
              </div>
              <div className="space-y-2">
                <Label>แนบไฟล์ (ถ้ามี)</Label>
                <div className="flex items-center gap-2">
                  <Input id="ticket-attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="cursor-pointer" onChange={(e) => setNewTicketFiles(p => mergeFiles(p, Array.from(e.target.files ?? [])))} />
                </div>
                {newTicketFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newTicketFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1 font-normal">
                        <button type="button" onClick={() => openFilePreview(f)} className="hover:underline truncate max-w-[150px] text-xs">{f.name}</button>
                        <button type="button" onClick={() => setNewTicketFiles(p => p.filter((_, idx) => idx !== i))} className="hover:text-destructive ml-1"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleCreateTicket} disabled={createTicket.isPending || !newTicket.subject.trim() || !newTicket.category || newTicket.message.trim().length < 10}>
                {createTicket.isPending ? 'กำลังส่ง...' : 'ส่งรายการแจ้งปัญหา'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* Left Column: Ticket List */}
        <Card className="lg:col-span-4 flex flex-col h-full border-border/60 shadow-sm overflow-hidden bg-background">
          <div className="p-4 border-b border-border/60 space-y-3 bg-muted/10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ค้นหารายการ..." className="pl-9 bg-background" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {isAdminView && (
              <Select
                value={adminStatusFilter}
                onValueChange={(value) => {
                  if (value === 'ALL' || isSupportTicketStatus(value)) {
                    setAdminStatusFilter(value);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background"><SelectValue placeholder="กรองสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                  <SelectItem value="OPEN">รอดำเนินการ</SelectItem>
                  <SelectItem value="IN_PROGRESS">กำลังดำเนินการ</SelectItem>
                  <SelectItem value="RESOLVED">แก้ไขแล้ว</SelectItem>
                  <SelectItem value="CLOSED">ปิดแล้ว</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary" className="font-normal">ทั้งหมด {tickets.length}</Badge>
              <Badge variant="outline" className="font-normal text-amber-600 border-amber-200 bg-amber-50">{tickets.filter(t => t.status === 'open').length} รอ</Badge>
              <Badge variant="outline" className="font-normal text-emerald-600 border-emerald-200 bg-emerald-50">{tickets.filter(t => t.status === 'closed').length} ปิด</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isTicketsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-lg" />)
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center">
                <Inbox className="h-8 w-8 mb-3 opacity-20" /> ไม่พบรายการ
              </div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg p-3 text-left transition-all w-full border",
                    selectedTicketId === ticket.id
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-background border-transparent hover:bg-muted/50 border-b-border/40"
                  )}
                >
                  <div className="flex items-start justify-between w-full gap-3">
                    <span className={cn("font-medium text-sm line-clamp-1", selectedTicketId === ticket.id ? "text-primary" : "text-foreground")}>
                      {ticket.subject}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {formatThaiDate(ticket.lastUpdated, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-normal", getStatusColor(ticket.status))}>
                        {ticket.statusLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{ticket.category}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/50 font-mono">#{ticket.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right Column: Chat Interface */}
        <Card className="lg:col-span-8 flex flex-col h-full border-border/60 shadow-sm overflow-hidden bg-background">
          {selectedTicket ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border/60 bg-muted/5 flex items-start justify-between shrink-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg line-clamp-1 text-foreground">{selectedTicket.subject}</h2>
                    <Badge variant="outline" className={cn("px-2 font-medium", getStatusColor(selectedTicket.status))}>
                      {selectedTicket.statusLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="font-mono">#{selectedTicket.id}</span>
                    <span className="text-border text-[10px]">●</span>
                    <span>{selectedTicket.category}</span>
                    <span className="text-border text-[10px]">●</span>
                    <span>{formatThaiDateTime(selectedTicket.createdAt)}</span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {isAdminView ? (
                      <>
                        <DropdownMenuItem disabled={selectedTicket.rawStatus === 'OPEN'} onClick={() => handleAdminStatusChange('OPEN')}>ตั้งเป็น รอดำเนินการ</DropdownMenuItem>
                        <DropdownMenuItem disabled={selectedTicket.rawStatus === 'IN_PROGRESS'} onClick={() => handleAdminStatusChange('IN_PROGRESS')}>ตั้งเป็น กำลังดำเนินการ</DropdownMenuItem>
                        <DropdownMenuItem disabled={selectedTicket.rawStatus === 'RESOLVED'} onClick={() => handleAdminStatusChange('RESOLVED')}>ตั้งเป็น แก้ไขแล้ว</DropdownMenuItem>
                        <DropdownMenuItem disabled={selectedTicket.rawStatus === 'CLOSED'} onClick={() => handleAdminStatusChange('CLOSED')}><CheckCheck className="mr-2 h-4 w-4" /> ปิดแล้ว</DropdownMenuItem>
                      </>
                    ) : selectedTicket.status !== 'closed' ? (
                      <DropdownMenuItem onClick={() => handleAction(closeTicket, 'ปิดรายการเรียบร้อย')}><CheckCheck className="mr-2 h-4 w-4" /> ปิดงานนี้</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleAction(reopenTicket, 'เปิดรายการอีกครั้ง')}><RotateCcw className="mr-2 h-4 w-4" /> เปิดอีกครั้ง</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> ลบรายการ</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-muted/10 space-y-6">
                {isMessagesLoading ? (
                   <div className="space-y-4">
                     <Skeleton className="h-16 w-[60%] rounded-2xl rounded-tl-none ml-12" />
                     <Skeleton className="h-20 w-[60%] rounded-2xl rounded-tr-none ml-auto mr-12" />
                   </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10 flex flex-col items-center">
                    <MessageCircle className="h-10 w-10 opacity-10 mb-3" />
                    <p>เริ่มการสนทนาโดยพิมพ์ข้อความด้านล่าง</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = (user?.id && String(msg.senderUserId) === String(user.id)) || msg.sender === 'user' || msg.senderRole === 'USER';
                    return (
                      <div key={index} className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
                        <div className={cn("flex gap-3 max-w-[85%] sm:max-w-[75%]", isUser ? "flex-row-reverse" : "flex-row")}>
                          <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border shadow-sm", isUser ? "bg-background text-primary border-primary/20" : "bg-primary/10 text-primary border-primary/20")}>
                            {isUser ? <User className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                          </div>
                          <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
                            <div className={cn("rounded-2xl px-4 py-2.5 text-sm shadow-sm", isUser ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-background border border-border/50 rounded-tl-none")}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                            </div>
                            {msg.attachments.length > 0 && (
                              <div className={cn("flex flex-wrap gap-2", isUser ? "justify-end" : "justify-start")}>
                                {msg.attachments.map((att) => (
                                  <button key={att.attachment_id} type="button" onClick={() => openAttachmentPreview(buildAttachmentUrl(att.file_path), att.file_name)} className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted transition-colors shadow-sm">
                                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-[150px]">{decodeAttachmentFileName(att.file_name)}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground px-1">{formatThaiTime(msg.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Unified Chat Input Area */}
              {selectedTicket.status !== 'closed' ? (
                <div className="p-4 border-t bg-background">
                  {replyError && (
                    <Alert variant="destructive" className="mb-3 py-2 border-destructive/40 bg-destructive/5">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{replyError}</AlertDescription>
                    </Alert>
                  )}
                  {/* Styled Container for Input + Actions */}
                  <div className="rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/20 transition-all overflow-hidden">
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => { setReplyMessage(e.target.value); setReplyError(null); }}
                      placeholder="พิมพ์ข้อความตอบกลับ..."
                      className="min-h-[60px] max-h-[150px] border-0 focus-visible:ring-0 shadow-none resize-none pb-0 text-sm"
                      onPaste={(e) => handlePaste(e, setReplyFiles)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                      }}
                    />

                    {/* Attachments Preview Area (Inside the input box) */}
                    {replyFiles.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto px-3 pb-2 no-scrollbar">
                        {replyFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs border whitespace-nowrap animate-in fade-in">
                            <button type="button" className="truncate max-w-[150px] hover:underline" onClick={() => openFilePreview(file)}>{file.name}</button>
                            <button onClick={() => setReplyFiles(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive ml-1"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-2 py-2 bg-muted/5 border-t border-border/40">
                      <label htmlFor="reply-file" className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/80">
                        <Paperclip className="h-4 w-4" /> แนบไฟล์
                        <input id="reply-file" type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setReplyFiles(p => mergeFiles(p, Array.from(e.target.files ?? [])))} />
                      </label>
                      <Button size="sm" className="h-8 rounded-lg px-4 gap-2" onClick={handleSendMessage} disabled={(!replyMessage.trim() && replyFiles.length === 0) || createMessage.isPending}>
                        <Send className="h-3.5 w-3.5" /> ส่งข้อความ
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border-t bg-muted/10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCheck className="h-8 w-8 text-emerald-500 opacity-50" />
                    <p className="text-sm text-muted-foreground font-medium">รายการแจ้งปัญหานี้ถูกปิดแล้ว</p>
                    {isAdminView ? (
                      <Button variant="outline" size="sm" onClick={() => handleAdminStatusChange('OPEN')} disabled={updateStatus.isPending} className="mt-2"><RotateCcw className="mr-2 h-3.5 w-3.5" /> ตั้งเป็น รอดำเนินการ</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleAction(reopenTicket, 'เปิดรายการอีกครั้ง')} disabled={reopenTicket.isPending} className="mt-2"><RotateCcw className="mr-2 h-3.5 w-3.5" /> เปิดใช้งานอีกครั้ง</Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบรายการแจ้งปัญหา</AlertDialogTitle>
            <AlertDialogDescription>การลบจะทำให้ข้อมูลการสนทนาและไฟล์แนบหายไปถาวร ยืนยันที่จะลบหรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleAction(deleteTicket, 'ลบรายการเรียบร้อย')}>ลบรายการ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttachmentPreviewDialog open={isPreviewOpen} onOpenChange={(open) => (open ? setIsPreviewOpen(true) : closeFilePreview())} previewUrl={previewUrl} previewName={previewName} />
    </div>
  );
}
