import { Role } from "../../backend";
import MRCallDetailsReport from "../shared/MRCallDetailsReport";

export default function ASMMRCallDetailsReportPage() {
  return <MRCallDetailsReport portalRole={Role.ASM} />;
}
