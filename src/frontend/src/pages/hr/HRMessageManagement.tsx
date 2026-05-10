import { Role } from "../../backend";
import AdminMessageManagement from "../admin/AdminMessageManagement";

/**
 * HR portal version of the Admin Message Management page.
 * Reuses the same component with the HRManager portal role so sidebar
 * and layout match the HR portal context.
 */
export default function HRMessageManagement() {
  return <AdminMessageManagement portalRole={Role.HRManager} />;
}
