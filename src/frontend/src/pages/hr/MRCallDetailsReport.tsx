import { Role } from "../../backend";
import MRCallDetailsReport from "../shared/MRCallDetailsReport";

export default function HRMRCallDetailsReportPage() {
  return <MRCallDetailsReport portalRole={Role.HRManager} />;
}
