import FnoScanner from "@/components/FnoScanner";
import ScanBar from "@/components/ScanBar";
import { PageHeader, TONE } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Options & F&O"
        subtitle="Near-month futures and live ATM options, sized to your capital."
      />

      <div className={`rounded-lg px-3.5 py-3 text-[12.5px] mb-5 ${TONE.amber}`}>
        <b>No validated options strategy is tradeable yet.</b> The short strangle from the research
        (~80% win rate, positive in both train and test on real settlement data) is a genuine edge,
        but it needs roughly ₹1.45L margin and its worst tested week lost ₹40k — so it stays locked
        until capital and sizing are re-derived. NSE also cut index lot sizes in January 2026
        (Nifty 75→65, BankNifty 35→30), which invalidates every per-lot rupee figure in that
        research. What&apos;s below is contract discovery and affordable directional expression,
        not a validated options edge.
      </div>

      <ScanBar />
      <FnoScanner />
    </div>
  );
}
