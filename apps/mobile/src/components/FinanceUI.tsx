import { financeStatusTone } from "../modules/finance-presentation";
import { BrandedPageHeader, StatusChip } from "./InstitutionalUI";

export function FinancePageHeader({ description, title }: { description: string; title: string }) {
  return <BrandedPageHeader description={description} eyebrow="Finance" title={title} />;
}

export function FinanceStatusChip({ label, status }: { label: string; status: string }) {
  return <StatusChip label={label} tone={financeStatusTone(status)} />;
}
