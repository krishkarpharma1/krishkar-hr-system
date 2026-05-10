/**
 * Secondary Sale page for ASM portal — re-uses the MR version.
 */
import { Role } from "../../backend";
import SecondarySaleBase from "../mr/SecondarySale";

export default function ASMSecondarySale() {
  return <SecondarySaleBase portalRole={Role.ASM} />;
}
