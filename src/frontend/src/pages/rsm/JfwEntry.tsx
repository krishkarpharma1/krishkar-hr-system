/**
 * RSM Joint Field Work Entry page.
 * Uses the same JfwEntry component as ASM but scoped to the RSM portal.
 * MR dropdown shows only MRs directly reporting to this RSM.
 */
import { Role } from "../../backend";
import ASMJfwEntry from "../asm/JfwEntry";

export default function RSMJfwEntry() {
  return <ASMJfwEntry portalRole={Role.RSM} />;
}
