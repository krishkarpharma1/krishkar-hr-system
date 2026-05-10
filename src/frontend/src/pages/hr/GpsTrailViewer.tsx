import { Role } from "../../backend";
import LocationTrailPage from "../shared/LocationTrailPage";

/** HR portal GPS Trail — now delegates to the shared LocationTrailPage */
export default function GpsTrailViewer() {
  return <LocationTrailPage portalRole={Role.HRManager} />;
}
