import { Role } from "../../backend";
import AdditionalChargesAdmin from "../admin/AdditionalChargesAdmin";

/**
 * HR portal view of Additional Charges — delegates to the shared
 * AdditionalChargesAdmin component with the HRManager portal role.
 */
export default function AdditionalChargesHR() {
  return <AdditionalChargesAdmin portalRole={Role.HRManager} />;
}
