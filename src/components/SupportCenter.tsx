import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, Clock3, Inbox, LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import {
  createSupportTicket,
  listSupportTickets,
  supportCategoryLabels,
  supportStatusLabels,
  validateSupportDraft,
  type SupportCategory,
  type SupportDraft,
  type SupportTicket
} from "../lib/support";

type Props = {
  open: boolean;
  userEmail: string;
  workspaceName: string;
  currentView: string;
  onClose: () => void;
};

const emptyDraft = (): SupportDraft => ({ category: "bug", subject: "", message: "" });

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("support_tickets") || message.includes("schema cache")) {
    return "문의 저장소를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("JWT") || message.includes("로그인")) return "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.";
  return "문의를 접수하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";
};

export function SupportCenter({ open, userEmail, workspaceName, currentView, onClose }: Props) {
  const [tab, setTab] = useState<"write" | "history">("write");
  const [draft, setDraft] = useState<SupportDraft>(() => emptyDraft());
  const [includeContext, setIncludeContext] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string }>();

  const validation = useMemo(() => validateSupportDraft(draft), [draft]);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const next = await listSupportTickets();
      setTickets(next);
      setSelectedId((current) => current || next[0]?.id || "");
    } catch (error) {
      setFeedback({ tone: "error", text: friendlyError(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setFeedback(undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && tab === "history") void loadTickets();
  }, [open, tab]);

  if (!open) return null;

  const submit = async () => {
    if (validation || submitting) {
      if (validation) setFeedback({ tone: "error", text: validation });
      return;
    }
    setSubmitting(true);
    setFeedback(undefined);
    try {
      const pagePath = `${window.location.origin}${window.location.pathname}`;
      const context: Record<string, string> = includeContext
        ? {
            screen: currentView,
            workspace: workspaceName,
            submittedAt: new Date().toISOString(),
            browser: navigator.userAgent
          }
        : {};
      const ticket = await createSupportTicket(draft, userEmail, pagePath, context);
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      setDraft(emptyDraft());
      setFeedback({ tone: "success", text: "문의가 접수되었습니다. 내 문의에서 처리 상태를 확인할 수 있습니다." });
      setTab("history");
    } catch (error) {
      setFeedback({ tone: "error", text: friendlyError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-title">
        <header className="support-head">
          <span className="support-head-icon"><CircleHelp size={21} /></span>
          <div>
            <h2 id="support-title">고객센터</h2>
            <p>오류와 건의사항을 남기면 확인 후 답변드립니다.</p>
          </div>
          <button type="button" className="icon" title="고객센터 닫기" aria-label="고객센터 닫기" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="support-tabs" role="tablist" aria-label="고객센터 메뉴">
          <button type="button" role="tab" aria-selected={tab === "write"} className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>
            <MessageSquareText size={16} /> 문의하기
          </button>
          <button type="button" role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            <Inbox size={16} /> 내 문의 {tickets.length > 0 && <span>{tickets.length}</span>}
          </button>
        </div>

        {feedback && <p className={`support-feedback ${feedback.tone}`} role="status">{feedback.tone === "success" && <CheckCircle2 size={16} />}{feedback.text}</p>}

        {tab === "write" ? (
          <div className="support-form">
            <div className="support-form-row">
              <label>
                <span>문의 유형</span>
                <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as SupportCategory }))}>
                  {Object.entries(supportCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>답변받을 이메일</span>
                <input value={userEmail} readOnly aria-readonly="true" />
              </label>
            </div>
            <label>
              <span>제목 <small>{draft.subject.length}/80</small></span>
              <input maxLength={80} value={draft.subject} placeholder="문의 내용을 짧게 적어 주세요" onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} />
            </label>
            <label>
              <span>내용 <small>{draft.message.length}/2,000</small></span>
              <textarea maxLength={2000} rows={8} value={draft.message} placeholder="어떤 화면에서 무엇을 하다가 문제가 생겼는지 자세히 적어 주세요." onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} />
            </label>
            <label className="support-context-toggle">
              <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} />
              <span><strong>현재 화면 정보 함께 보내기</strong><small>문제를 빠르게 확인할 수 있도록 화면 위치와 브라우저 정보를 포함합니다.</small></span>
            </label>
            <div className="support-actions">
              <small>문의 내용은 로그인한 계정에서만 확인할 수 있습니다.</small>
              <button type="button" disabled={submitting || Boolean(validation)} onClick={() => void submit()}>
                {submitting ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{submitting ? "접수 중" : "문의 접수"}
              </button>
            </div>
          </div>
        ) : (
          <div className="support-history">
            {loading ? (
              <div className="support-empty"><LoaderCircle className="spin" size={22} /><span>문의 내역을 불러오는 중입니다.</span></div>
            ) : tickets.length === 0 ? (
              <div className="support-empty"><Inbox size={24} /><strong>아직 등록한 문의가 없습니다.</strong><button type="button" className="link" onClick={() => setTab("write")}>첫 문의 작성하기</button></div>
            ) : (
              <>
                <div className="support-ticket-list" aria-label="문의 목록">
                  {tickets.map((ticket) => (
                    <button key={ticket.id} type="button" className={selectedId === ticket.id ? "active" : ""} onClick={() => setSelectedId(ticket.id)}>
                      <span className={`support-status ${ticket.status}`}>{supportStatusLabels[ticket.status]}</span>
                      <strong>{ticket.subject}</strong>
                      <small>{supportCategoryLabels[ticket.category]} · {new Date(ticket.createdAt).toLocaleDateString("ko-KR")}</small>
                    </button>
                  ))}
                </div>
                {selectedTicket && (
                  <article className="support-ticket-detail">
                    <div className="support-detail-head">
                      <div><span>{supportCategoryLabels[selectedTicket.category]}</span><h3>{selectedTicket.subject}</h3></div>
                      <span className={`support-status ${selectedTicket.status}`}>{supportStatusLabels[selectedTicket.status]}</span>
                    </div>
                    <p className="support-ticket-message">{selectedTicket.message}</p>
                    <p className="support-ticket-date"><Clock3 size={14} /> {new Date(selectedTicket.createdAt).toLocaleString("ko-KR")}</p>
                    <div className={`support-reply ${selectedTicket.adminReply ? "answered" : "waiting"}`}>
                      <strong>{selectedTicket.adminReply ? "블링빌 답변" : "답변을 준비하고 있습니다"}</strong>
                      <p>{selectedTicket.adminReply || "문의 내용을 확인한 후 이 화면에서 답변을 안내해 드립니다."}</p>
                      {selectedTicket.repliedAt && <small>{new Date(selectedTicket.repliedAt).toLocaleString("ko-KR")}</small>}
                    </div>
                  </article>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
