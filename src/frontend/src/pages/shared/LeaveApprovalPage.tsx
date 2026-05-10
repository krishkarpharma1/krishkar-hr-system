import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useAuthStore } from "../../store/authStore";
import LeaveApprovalPanel from "./LeaveApprovalPanel";

interface LeaveApprovalPageProps {
  portalRole: Role;
  title?: string;
}

export default function LeaveApprovalPage({
  portalRole,
  title = "Leave Approvals",
}: LeaveApprovalPageProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title={title}
        subtitle="Review and action pending leave applications from your team"
      />
      <PageContent>
        <LeaveApprovalPanel token={token} />
      </PageContent>
    </PortalLayout>
  );
}
