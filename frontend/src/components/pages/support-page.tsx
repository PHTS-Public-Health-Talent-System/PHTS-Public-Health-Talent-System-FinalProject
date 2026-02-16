'use client';

import { useMemo, useState, useRef, useEffect, type ClipboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  HelpCircle,
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
  useCreateSupportTicketMessage,
  useDeleteSupportTicket,
  useMySupportTickets,
  useReopenSupportTicket,
  useSupportTickets,
  useSupportTicketMessages,
  useUpdateSupportTicketStatus,
} from '@/features/support/hooks';
import type { SupportTicketStatus } from '@/features/support/api';
import {
  buildAttachmentUrl,
  decodeAttachmentFileName,
} from '@/features/request/detail/requestDetail.attachments';
import { useAuth } from '@/components/providers/auth-provider';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { formatThaiDate, formatThaiDateTime, formatThaiTime } from '@/shared/utils/thai-locale';

// --- Helper Functions ---

function getFilesFromClipboard(
  e: ClipboardEvent<HTMLTextAreaElement>,
): File[] {
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
  // Dedup by name+size to reduce accidental duplicates on repeated paste.
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
    case 'open':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'in_progress':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'closed':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const normalizeStatus = (status: string) => {
  switch (status) {
    case 'OPEN':
    case 'REOPENED':
      return 'open';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'RESOLVED':
    case 'CLOSED':
      return 'closed';
    default:
      return 'open';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'OPEN':
    case 'REOPENED':
      return 'รอดำเนินการ';
    case 'IN_PROGRESS':
      return 'กำลังดำเนินการ';
    case 'RESOLVED':
      return 'แก้ไขแล้ว';
    case 'CLOSED':
      return 'ปิดแล้ว';
    default:
      return status;
  }
};

const getCategoryLabel = (category?: string | null) => {
  switch ((category ?? '').toLowerCase()) {
    case 'bug':
    case 'issue':
      return 'ปัญหาการใช้งาน';
    case 'question':
      return 'สอบถามข้อมูล';
    case 'suggestion':
      return 'ข้อเสนอแนะ';
    case 'other':
      return 'อื่นๆ';
    default:
      return category || 'อื่นๆ';
  }
};

// --- Component: Empty State (ขวา) ---
const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
    <div className="rounded-full bg-muted/50 p-6 mb-4">
      <Inbox className="h-12 w-12 text-muted-foreground/30" />
    </div>
    <h3 className="text-lg font-semibold text-foreground">เลือกรายการที่ต้องการดู</h3>
    <p className="text-sm mt-1 max-w-xs mx-auto">
      คลิกที่รายการทางด้านซ้ายเพื่อดูรายละเอียดการสนทนาหรือส่งข้อความเพิ่มเติม
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
    {
      status: adminStatusFilter === 'ALL' ? undefined : adminStatusFilter,
      page: 1,
      limit: 100,
    },
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

  // Local preview state (for files not yet uploaded)
  const [previewName, setPreviewName] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Derived Data
  const tickets = useMemo(() => {
    return ticketData
      .map((ticket) => ({
        id: String(ticket.id),
        subject: ticket.subject,
        category: getCategoryLabel(
          (ticket as { metadata?: { category?: string | null } | null }).metadata?.category,
        ),
        status: normalizeStatus(ticket.status),
        rawStatus: ticket.status,
        statusLabel: getStatusLabel(ticket.status),
        createdAt: ticket.created_at,
        lastUpdated: ticket.updated_at ?? ticket.created_at,
      }))
      .filter(
        (t) =>
          t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery),
      )
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [ticketData, searchQuery]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const { data: ticketMessages = [] } = useSupportTicketMessages(selectedTicketId ?? undefined);

  const messages = useMemo(
    () =>
      ticketMessages.map((msg) => ({
        sender: msg.sender_role === 'USER' ? 'user' : 'support',
        senderUserId: msg.sender_user_id,
        senderRole: msg.sender_role,
        message: msg.message,
        timestamp: msg.created_at,
        attachments: msg.attachments ?? [],
      })),
    [ticketMessages],
  );

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedTicketId]);

  useEffect(() => {
    // Cleanup object URL when dialog closes / file changes.
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Handlers ---

  const handleCreateTicket = () => {
    setNewTicketError(null);
    if (newTicket.message.trim().length < 10) {
      setNewTicketError('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
      toast.error('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
      return;
    }
    const formData = new FormData();
    formData.append('subject', newTicket.subject.trim());
    formData.append('description', newTicket.message.trim());
    formData.append('page_url', window.location.href);
    formData.append('user_agent', window.navigator.userAgent);
    formData.append('metadata', JSON.stringify({ category: newTicket.category }));
    newTicketFiles.forEach((file) => formData.append('attachments', file));

    createTicket.mutate(formData, {
      onSuccess: () => {
        toast.success('สร้างรายการแจ้งปัญหาเรียบร้อย');
        setIsDialogOpen(false);
        setNewTicket({ subject: '', category: '', message: '' });
        setNewTicketFiles([]);
        setNewTicketError(null);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        setNewTicketError(message);
        toast.error(message);
      },
    });
  };

  const handlePasteNewTicket = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = getFilesFromClipboard(e);
    if (!files.length) return;

    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) e.preventDefault();

    setNewTicketFiles((prev) => mergeFiles(prev, files));
    toast.success(`แนบรูปจากคลิปบอร์ด ${files.length} ไฟล์`);
  };

  const handlePasteReply = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = getFilesFromClipboard(e);
    if (!files.length) return;

    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) e.preventDefault();

    setReplyFiles((prev) => mergeFiles(prev, files));
    toast.success(`แนบรูปจากคลิปบอร์ด ${files.length} ไฟล์`);
  };

  const openFilePreview = (file: File) => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewName(file.name);
    setPreviewUrl(url);
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
    if (!selectedTicketId || !replyMessage.trim()) {
      setReplyError('กรุณาพิมพ์ข้อความก่อนส่ง');
      return;
    }
    const formData = new FormData();
    formData.append('message', replyMessage.trim());
    replyFiles.forEach((file) => formData.append('attachments', file));
    createMessage.mutate(
      { ticketId: selectedTicketId, payload: formData },
      {
        onSuccess: () => {
          setReplyMessage('');
          setReplyFiles([]);
          setReplyError(null);
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
          setReplyError(message);
          toast.error(message);
        },
      },
    );
  };

  const handleReopen = () => {
    if (!selectedTicketId) return;
    reopenTicket.mutate(selectedTicketId, {
      onSuccess: () => toast.success('เปิดรายการแจ้งปัญหาอีกครั้งแล้ว'),
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  const handleCloseTicket = () => {
    if (!selectedTicketId) return;
    closeTicket.mutate(selectedTicketId, {
      onSuccess: () => toast.success('ปิดรายการแจ้งปัญหาเรียบร้อย'),
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  const handleDeleteTicket = () => {
    if (!selectedTicketId) return;
    deleteTicket.mutate(selectedTicketId, {
      onSuccess: () => {
        toast.success('ลบรายการแจ้งปัญหาเรียบร้อย');
        setSelectedTicketId(null);
        setReplyMessage('');
        setReplyFiles([]);
        setIsDeleteDialogOpen(false);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  const handleAdminStatusChange = (status: SupportTicketStatus) => {
    if (!selectedTicketId) return;
    updateStatus.mutate(
      { ticketId: selectedTicketId, status },
      {
        onSuccess: () => toast.success('อัปเดตสถานะแล้ว'),
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
          toast.error(message);
        },
      },
    );
  };

  // --- Render ---

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ศูนย์ช่วยเหลือ</h1>
          <p className="text-muted-foreground text-sm">
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
              <DialogDescription>
                กรอกรายละเอียดปัญหาหรือคำถามของคุณ ทีมงานจะตอบกลับโดยเร็วที่สุด
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {newTicketError && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ไม่สามารถสร้างรายการแจ้งปัญหาได้</AlertTitle>
                  <AlertDescription>{newTicketError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="subject">หัวข้อ *</Label>
                <Input
                  id="subject"
                  placeholder="เช่น เข้าใช้งานระบบไม่ได้"
                  value={newTicket.subject}
                  onChange={(e) => {
                    setNewTicket((prev) => ({ ...prev, subject: e.target.value }));
                    setNewTicketError(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">ประเภท *</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(value) => {
                    setNewTicket((prev) => ({ ...prev, category: value }));
                    setNewTicketError(null);
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">ปัญหาการใช้งาน</SelectItem>
                    <SelectItem value="question">สอบถามข้อมูล</SelectItem>
                    <SelectItem value="suggestion">ข้อเสนอแนะ</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">รายละเอียด *</Label>
	                <Textarea
	                  id="message"
	                  placeholder="อธิบายรายละเอียดปัญหาหรือคำถาม..."
	                  rows={5}
	                  value={newTicket.message}
	                  onChange={(e) => {
                      setNewTicket((prev) => ({ ...prev, message: e.target.value }));
                      setNewTicketError(null);
                    }}
	                  onPaste={handlePasteNewTicket}
	                />
                {newTicket.message.trim().length > 0 && newTicket.message.trim().length < 10 && (
                  <p className="text-xs text-destructive">กรุณากรอกอย่างน้อย 10 ตัวอักษร</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-attachments">แนบไฟล์ (ถ้ามี)</Label>
	                <Input
	                  id="ticket-attachments"
	                  type="file"
	                  multiple
	                  accept=".pdf,.png,.jpg,.jpeg"
	                  className="cursor-pointer"
	                  onChange={(e) => {
	                    const files = Array.from(e.target.files ?? []);
	                    setNewTicketFiles((prev) => mergeFiles(prev, files));
	                  }}
	                />
	                {newTicketFiles.length > 0 && (
	                  <div className="space-y-1 mt-2">
	                    {newTicketFiles.map((file, index) => (
	                      <div
	                        key={index}
	                        className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded"
	                      >
	                        <button
	                          type="button"
	                          className="truncate max-w-[250px] text-left hover:underline"
	                          onClick={() => openFilePreview(file)}
	                          title="ดูตัวอย่าง"
	                        >
	                          {file.name}
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() =>
	                            setNewTicketFiles((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="text-destructive hover:bg-destructive/10 p-1 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleCreateTicket}
                disabled={
                  createTicket.isPending ||
                  !newTicket.subject.trim() ||
                  !newTicket.category.trim() ||
                  newTicket.message.trim().length < 10
                }
              >
                {createTicket.isPending ? 'กำลังส่ง...' : 'ส่งรายการแจ้งปัญหา'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: List */}
        <Card className="lg:col-span-4 flex flex-col h-full border-border/60 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/60 space-y-3 bg-muted/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหารายการแจ้งปัญหา..."
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {isAdminView && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">กรองสถานะ (ดึงจาก API)</Label>
                <Select
                  value={adminStatusFilter}
                  onValueChange={(value) =>
                    setAdminStatusFilter(value as 'ALL' | SupportTicketStatus)
                  }
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทั้งหมด</SelectItem>
                    <SelectItem value="OPEN">รอดำเนินการ</SelectItem>
                    <SelectItem value="IN_PROGRESS">กำลังดำเนินการ</SelectItem>
                    <SelectItem value="RESOLVED">แก้ไขแล้ว</SelectItem>
                    <SelectItem value="CLOSED">ปิดแล้ว</SelectItem>
                    <SelectItem value="REOPENED">เปิดอีกครั้ง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 text-xs">
              <Badge
                variant="secondary"
                className="font-normal text-muted-foreground hover:bg-secondary"
              >
                ทั้งหมด {tickets.length}
              </Badge>
              <Badge
                variant="outline"
                className="font-normal text-amber-600 border-amber-200 bg-amber-50"
              >
                {tickets.filter((t) => t.status === 'open').length} รอ
              </Badge>
              <Badge
                variant="outline"
                className="font-normal text-emerald-600 border-emerald-200 bg-emerald-50"
              >
                {tickets.filter((t) => t.status === 'closed').length} จบ
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {tickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center">
                <HelpCircle className="h-8 w-8 mb-2 opacity-20" />
                ไม่พบรายการ
              </div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-all w-full hover:bg-accent/50 ${
                    selectedTicketId === ticket.id
                      ? 'bg-accent border-primary/40 ring-1 ring-primary/20'
                      : 'border-transparent border-b-border/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <span
                      className={`font-medium text-sm line-clamp-1 ${selectedTicketId === ticket.id ? 'text-primary' : 'text-foreground'}`}
                    >
                      {ticket.subject}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatThaiDate(ticket.lastUpdated, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 font-normal border ${getStatusColor(ticket.status)}`}
                      >
                        {ticket.statusLabel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {ticket.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">#{ticket.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right Column: Chat */}
        <Card className="lg:col-span-8 flex flex-col h-full border-border/60 shadow-sm overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border/60 bg-muted/5 flex items-start justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg line-clamp-1">{selectedTicket.subject}</h2>
                    <Badge variant="outline" className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.statusLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>เลขที่รายการ #{selectedTicket.id}</span>
                    <span className="text-border">|</span>
                    <span>{selectedTicket.category}</span>
                    <span className="text-border">|</span>
                    <span>
                      สร้างเมื่อ {formatThaiDateTime(selectedTicket.createdAt)}
                    </span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAdminView ? (
                      <>
                        <DropdownMenuItem
                          disabled={selectedTicket.rawStatus === 'OPEN' || updateStatus.isPending}
                          onClick={() => handleAdminStatusChange('OPEN')}
                        >
                          ตั้งเป็น รอดำเนินการ
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            selectedTicket.rawStatus === 'IN_PROGRESS' || updateStatus.isPending
                          }
                          onClick={() => handleAdminStatusChange('IN_PROGRESS')}
                        >
                          ตั้งเป็น กำลังดำเนินการ
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={selectedTicket.rawStatus === 'RESOLVED' || updateStatus.isPending}
                          onClick={() => handleAdminStatusChange('RESOLVED')}
                        >
                          ตั้งเป็น แก้ไขแล้ว
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={selectedTicket.rawStatus === 'CLOSED' || updateStatus.isPending}
                          onClick={() => handleAdminStatusChange('CLOSED')}
                        >
                          <CheckCheck className="mr-2 h-4 w-4" /> ตั้งเป็น ปิดแล้ว
                        </DropdownMenuItem>
                      </>
                    ) : selectedTicket.status !== 'closed' ? (
                      <DropdownMenuItem onClick={handleCloseTicket}>
                        <CheckCheck className="mr-2 h-4 w-4" /> ปิดงาน
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleReopen}>
                        <RotateCcw className="mr-2 h-4 w-4" /> เปิดอีกครั้ง
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> ลบรายการ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-muted/5 space-y-6">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10 flex flex-col items-center">
                    <MessageCircle className="h-10 w-10 opacity-10 mb-2" />
                    <p>เริ่มการสนทนาโดยพิมพ์ข้อความด้านล่าง</p>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const isUser =
                    (user?.id && String(msg.senderUserId) === String(user.id)) ||
                    msg.sender === 'user' ||
                    msg.senderRole === 'USER';
                  return (
                    <div
                      key={index}
                      className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border shadow-sm ${
                            isUser
                              ? 'bg-white text-primary border-primary/20'
                              : 'bg-orange-50 text-orange-600 border-orange-200'
                          }`}
                        >
                          {isUser ? <User className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                        </div>

                        <div
                          className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isUser
                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                : 'bg-white border border-border rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          </div>

                          {/* Attachments */}
                          {msg.attachments.length > 0 && (
                            <div
                              className={`mt-1.5 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                              {msg.attachments.map((att) => (
                                <button
                                  type="button"
                                  key={att.attachment_id}
                                  className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted transition-colors shadow-sm"
                                  onClick={() =>
                                    openAttachmentPreview(
                                      buildAttachmentUrl(att.file_path),
                                      att.file_name,
                                    )
                                  }
                                >
                                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                                  <span className="truncate max-w-[120px]">
                                    {decodeAttachmentFileName(att.file_name)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-70">
                            {formatThaiTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>

              {/* Chat Input */}
              {selectedTicket.status !== 'closed' ? (
                <div className="p-4 border-t bg-background">
                  {replyError && (
                    <Alert
                      variant="destructive"
                      className="mb-3 border-destructive/40 bg-destructive/10"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{replyError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="relative">
	                    <Textarea
	                      value={replyMessage}
	                      onChange={(e) => {
                          setReplyMessage(e.target.value);
                          setReplyError(null);
                        }}
	                      placeholder="พิมพ์ข้อความตอบกลับ..."
	                      className="min-h-[50px] pr-14 resize-none bg-muted/20 focus-visible:ring-primary/20 max-h-[150px]"
	                      onPaste={handlePasteReply}
	                      onKeyDown={(e) => {
	                        if (e.key === 'Enter' && !e.shiftKey) {
	                          e.preventDefault();
	                          handleSendMessage();
	                        }
                      }}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full shadow-sm"
                        onClick={handleSendMessage}
                        disabled={!replyMessage.trim() || createMessage.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label
                      htmlFor="reply-file"
                      className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      แนบไฟล์
                      <input
                        id="reply-file"
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          setReplyFiles((prev) => [...prev, ...files]);
                        }}
                      />
                    </label>

                    {/* Pending Files List */}
	                    {replyFiles.length > 0 && (
	                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
	                        {replyFiles.map((file, i) => (
	                          <div
	                            key={i}
	                            className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap animate-in fade-in zoom-in duration-200"
	                          >
	                            <button
	                              type="button"
	                              className="truncate max-w-[120px] hover:underline"
	                              onClick={() => openFilePreview(file)}
	                              title="ดูตัวอย่าง"
	                            >
	                              {file.name}
	                            </button>
	                            <button
	                              onClick={() =>
	                                setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))
	                              }
                              className="text-muted-foreground hover:text-destructive ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 border-t bg-muted/10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCheck className="h-8 w-8 text-emerald-500 opacity-50" />
                    <p className="text-sm text-muted-foreground font-medium">
                      รายการแจ้งปัญหานี้ถูกปิดแล้ว
                    </p>
                    {isAdminView ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdminStatusChange('OPEN')}
                        disabled={updateStatus.isPending}
                        className="mt-2"
                      >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" /> ตั้งเป็น รอดำเนินการ
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReopen}
                        disabled={reopenTicket.isPending}
                        className="mt-2"
                      >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" /> เปิดใช้งานอีกครั้ง
                      </Button>
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

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบรายการแจ้งปัญหา</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะทำให้ข้อมูลการสนทนาและไฟล์แนบหายไปถาวร ยืนยันที่จะลบหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTicket}
            >
              ลบรายการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
	      </AlertDialog>

      <AttachmentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={(open) => (open ? setIsPreviewOpen(true) : closeFilePreview())}
        previewUrl={previewUrl}
        previewName={previewName}
      />
	    </div>
	  );
	}
