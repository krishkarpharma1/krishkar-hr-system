import { Role } from "../../backend";
import MRCallDetailsReport from "../shared/MRCallDetailsReport";

export default function MRCallDetailsReportPage() {
  return <MRCallDetailsReport portalRole={Role.MR} />;
}
