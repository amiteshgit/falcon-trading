import PortfolioView from "@/components/PortfolioView";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader title="Portfolio" subtitle="Live holdings and open positions" />
      <PortfolioView />
    </div>
  );
}
