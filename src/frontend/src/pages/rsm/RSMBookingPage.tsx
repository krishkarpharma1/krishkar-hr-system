import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import BookingManagement from "../shared/BookingManagement";

export default function RSMBookingPage() {
  return (
    <PortalLayout portalRole={Role.RSM}>
      <PageHeader
        title="Booking Requests"
        subtitle="Request samples and gift articles for your regional team"
      />
      <PageContent>
        <BookingManagement />
      </PageContent>
    </PortalLayout>
  );
}
