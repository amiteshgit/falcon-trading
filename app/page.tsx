import EquityScanner from "@/components/EquityScanner";
import ScanBar from "@/components/ScanBar";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader title="Equity Scanner" subtitle="Validated NSE cash-market fade strategies" />
      <ScanBar />
      <EquityScanner />
    </div>
  );
}
