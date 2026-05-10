import { Role } from "../../backend";
import MRCallDetailsReport from "../shared/MRCallDetailsReport";

export default function AdminMRCallDetailsReportPage() {
  return <MRCallDetailsReport portalRole={Role.Admin} />;
}
