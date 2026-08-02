import ScannerView from "@/components/ScannerView";
import ScanBar from "@/components/ScanBar";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Swing"
        subtitle="2–5 day holds. Long-side only — Indian rules forbid carrying a short equity position overnight."
      />
      <ScanBar />
      <ScannerView
        horizon="swing"
        emptyNote="No swing strategy has passed validation yet. All three validated edges are short, and a short equity position cannot be held overnight in India — so the swing book has to be built from long-side strategies, which is open research."
      />
    </div>
  );
}
