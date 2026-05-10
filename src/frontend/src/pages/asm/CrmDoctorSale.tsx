/**
 * CRM Doctor-wise Sale page for ASM portal — re-uses the MR version.
 */
import { Role } from "../../backend";
import CrmDoctorSaleBase from "../mr/CrmDoctorSale";

export default function ASMCrmDoctorSale() {
  return <CrmDoctorSaleBase portalRole={Role.ASM} />;
}
