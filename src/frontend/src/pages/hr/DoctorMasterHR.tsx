import { Role } from "../../backend";
import DoctorMaster from "../admin/DoctorMaster";

/**
 * HR portal view of Doctor Master — delegates to the shared
 * DoctorMaster component with the HRManager portal role.
 */
export default function DoctorMasterHR() {
  return <DoctorMaster portalRole={Role.HRManager} />;
}
