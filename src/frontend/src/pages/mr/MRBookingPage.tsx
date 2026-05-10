import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import BookingManagement from "../shared/BookingManagement";

export default function MRBookingPage() {
  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Booking Requests"
        subtitle="Request samples and gift articles for your field visits"
      />
      <PageContent>
        <BookingManagement />
      </PageContent>
    </PortalLayout>
  );
}
