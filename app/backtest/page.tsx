import BacktestView from "@/components/BacktestView";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader title="Backtest" subtitle="Train/test validation of the gap-fade edge on daily history" />
      <BacktestView />
    </div>
  );
}
