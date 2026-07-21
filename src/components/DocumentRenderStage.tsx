import type { CustomerSnapshot, QuoteRecord, TaxApiIntegration, WorkspaceProfile } from "../types";
import { QuotePreview } from "../views/QuotePreview";
import { TransactionStatementPreview } from "../views/TransactionStatementPreview";

export function DocumentRenderStage({ quote, customer, supplier, logo, workspaceProfile }: { quote: QuoteRecord; customer?: CustomerSnapshot; supplier: TaxApiIntegration; logo?: string; workspaceProfile: WorkspaceProfile }) {
  return (
    <div className="document-render-stage" aria-hidden="true">
      <div data-email-document="quote"><QuotePreview quote={quote} logo={logo} workspaceProfile={workspaceProfile} /></div>
      <TransactionStatementPreview quote={quote} customer={customer} supplier={supplier} workspaceProfile={workspaceProfile} logo={logo} />
    </div>
  );
}
