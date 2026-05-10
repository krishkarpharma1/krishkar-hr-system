import { Role } from "../../backend";
import MonthlyTargetsAdmin from "../admin/MonthlyTargetsAdmin";

/**
 * HR portal view of Monthly Sales Targets — delegates to the shared
 * MonthlyTargetsAdmin component with the HRManager portal role.
 */
export default function MonthlyTargetsHR() {
  return <MonthlyTargetsAdmin portalRole={Role.HRManager} />;
}
