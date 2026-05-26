import type React from "react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import SharedDoctorCallReport from "../shared/DoctorCallReport30Days";

const AdminDoctorCallReport30Days: React.FC = () => {
  const { session } = useAuthStore();
  const [mrList, setMrList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMrId, setSelectedMrId] = useState("");

  useEffect(() => {
    if (!session) return;
    api
      .listUsersByRole(session.token, Role.MR)
      .then((users: any[]) =>
        setMrList(
          users.map((u: any) => ({ id: u.employeeId ?? u.id, name: u.name })),
        ),
      )
      .catch(() => setMrList([]));
  }, [session]);

  if (!session) return null;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold text-foreground">
        Doctor Call Report — Last 30 Days
      </h2>
      <div className="flex items-center gap-3">
        <label
          htmlFor="admin-mr-select"
          className="text-sm font-medium text-foreground"
        >
          Select MR:
        </label>
        <select
          id="admin-mr-select"
          data-ocid="admin_doctor_call_report.select"
          value={selectedMrId}
          onChange={(e) => setSelectedMrId(e.target.value)}
          className="border border-input rounded px-3 py-1.5 text-sm min-w-[200px] bg-background text-foreground"
        >
          <option value="">— Select an MR —</option>
          {mrList.map((mr) => (
            <option key={mr.id} value={mr.id}>
              {mr.name}
            </option>
          ))}
        </select>
      </div>
      {selectedMrId ? (
        <SharedDoctorCallReport mrId={selectedMrId} />
      ) : (
        <div
          data-ocid="admin_doctor_call_report.empty_state"
          className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-card"
        >
          Select an MR above to view their doctor call history.
        </div>
      )}
    </div>
  );
};

export default AdminDoctorCallReport30Days;
