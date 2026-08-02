import RiskView from "@/components/RiskView";
import { PageHeader } from "@/components/shared";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Risk & Allocation"
        subtitle="How much to put behind each strategy family — and the caps that keep a bad day from becoming a blown account."
      />
      <RiskView />
    </div>
  );
}
