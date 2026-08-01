import FnoScanner from "@/components/FnoScanner";
import ScanBar from "@/components/ScanBar";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader title="F&O" subtitle="Near-month future + live ATM options, sized to your capital" />
      <ScanBar />
      <FnoScanner />
    </div>
  );
}
