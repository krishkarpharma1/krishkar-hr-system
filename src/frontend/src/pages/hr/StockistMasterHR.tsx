import { Role } from "../../backend";
import StockistMaster from "../admin/StockistMaster";

/**
 * HR portal view of Stockist Master — delegates to the shared
 * StockistMaster component with the HRManager portal role.
 */
export default function StockistMasterHR() {
  return <StockistMaster portalRole={Role.HRManager} />;
}
