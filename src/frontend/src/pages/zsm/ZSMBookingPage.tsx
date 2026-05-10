import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import BookingManagement from "../shared/BookingManagement";

export default function ZSMBookingPage() {
  return (
    <PortalLayout portalRole={Role.ZSM}>
      <PageHeader
        title="Booking Requests"
        subtitle="Request samples and gift articles for your zone"
      />
      <PageContent>
        <BookingManagement />
      </PageContent>
    </PortalLayout>
  );
}
