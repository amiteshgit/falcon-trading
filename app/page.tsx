import ScannerView from "@/components/ScannerView";
import ScanBar from "@/components/ScanBar";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Intraday"
        subtitle="Validated same-day fades — entered in the morning, closed at the bell."
      />
      <ScanBar />
      <ScannerView
        horizon="intraday"
        emptyNote="No intraday strategies registered."
      />
    </div>
  );
}
