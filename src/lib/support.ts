import { requireSupabase } from "./supabase";

export type SupportCategory = "bug" | "suggestion" | "billing" | "popbill" | "account" | "other";
export type SupportStatus = "open" | "in_progress" | "answered" | "closed";

export type SupportTicket = {
  id: string;
  contactEmail: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  pagePath: string;
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportDraft = {
  category: SupportCategory;
  subject: string;
  message: string;
};

type SupportTicketRow = {
  id: string;
  contact_email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  page_path: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export const supportCategoryLabels: Record<SupportCategory, string> = {
  bug: "오류 신고",
  suggestion: "기능 건의",
  billing: "결제·요금",
  popbill: "팝빌·전자발행",
  account: "계정·로그인",
  other: "기타 문의"
};

export const supportStatusLabels: Record<SupportStatus, string> = {
  open: "접수",
  in_progress: "확인 중",
  answered: "답변 완료",
  closed: "종료"
};

export function validateSupportDraft(draft: SupportDraft): string {
  const subjectLength = draft.subject.trim().length;
  const messageLength = draft.message.trim().length;
  if (subjectLength < 2) return "문의 제목을 2자 이상 입력해 주세요.";
  if (subjectLength > 80) return "문의 제목은 80자까지 입력할 수 있습니다.";
  if (messageLength < 10) return "문의 내용을 10자 이상 자세히 입력해 주세요.";
  if (messageLength > 2000) return "문의 내용은 2,000자까지 입력할 수 있습니다.";
  return "";
}

const mapTicket = (row: SupportTicketRow): SupportTicket => ({
  id: row.id,
  contactEmail: row.contact_email,
  category: row.category,
  subject: row.subject,
  message: row.message,
  status: row.status,
  pagePath: row.page_path,
  adminReply: row.admin_reply ?? undefined,
  repliedAt: row.replied_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await requireSupabase()
    .from("support_tickets")
    .select("id, contact_email, category, subject, message, status, page_path, admin_reply, replied_at, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SupportTicketRow[]).map(mapTicket);
}

export async function createSupportTicket(
  draft: SupportDraft,
  contactEmail: string,
  pagePath: string,
  context: Record<string, string>
): Promise<SupportTicket> {
  const validation = validateSupportDraft(draft);
  if (validation) throw new Error(validation);
  const { data, error } = await requireSupabase()
    .from("support_tickets")
    .insert({
      contact_email: contactEmail,
      category: draft.category,
      subject: draft.subject.trim(),
      message: draft.message.trim(),
      page_path: pagePath,
      context
    })
    .select("id, contact_email, category, subject, message, status, page_path, admin_reply, replied_at, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return mapTicket(data as SupportTicketRow);
}
