import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  File,
  FileImage,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { EmployeeDocument, UserInfo } from "../../types";
import { DocumentType } from "../../types";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.offerLetter]: "Offer Letter",
  [DocumentType.idProof]: "ID Proof",
  [DocumentType.agreement]: "Agreement",
  [DocumentType.other]: "Other",
};

const isImage = (name: string) =>
  /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);

function DocIcon({ fileName }: { fileName: string }) {
  if (isImage(fileName)) return <FileImage className="w-4 h-4 text-accent" />;
  if (/\.pdf$/i.test(fileName))
    return <FileText className="w-4 h-4 text-primary" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

export default function DocumentManagement() {
  const { session } = useAuthStore();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>(
    DocumentType.offerLetter,
  );
  const [urlInput, setUrlInput] = useState("");
  const [fileNameInput, setFileNameInput] = useState("");
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
  }, [session]);

  const loadDocs = useCallback(async () => {
    if (!session || !selectedEmpId) return;
    setLoading(true);
    try {
      const data = await api.getEmployeeDocuments(
        session.token,
        BigInt(selectedEmpId),
      );
      setDocs(data);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [session, selectedEmpId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async () => {
    if (!session || !selectedEmpId || !urlInput || !fileNameInput) {
      toast.error("Provide a file name and URL");
      return;
    }
    setUploading(true);
    try {
      const res = await api.addDocument(
        session.token,
        BigInt(selectedEmpId),
        docType,
        fileNameInput,
        urlInput,
      );
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Document added");
      setUrlInput("");
      setFileNameInput("");
      await loadDocs();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: bigint) => {
    if (!session || !confirm("Delete this document?")) return;
    setDeletingId(docId);
    try {
      const res = await api.deleteDocument(session.token, docId);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Document deleted");
      await loadDocs();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const cols = [
    { key: "type", label: "Type" },
    { key: "name", label: "File Name" },
    { key: "uploaded", label: "Uploaded" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  const selectedEmp = employees.find((e) => String(e.id) === selectedEmpId);

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Document Management"
        subtitle="Upload and manage employee documents"
      />
      <PageContent>
        {/* Employee selector */}
        <div className="flex flex-wrap gap-3 mb-5 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Employee
            </Label>
            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
              <SelectTrigger data-ocid="doc-emp-select">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={String(e.id)} value={String(e.id)}>
                    {e.name} ({e.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedEmpId && (
          <>
            {/* Upload panel */}
            <div className="bg-card border border-border rounded-lg p-4 mb-5">
              <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                Add Document
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Document Type
                  </Label>
                  <Select
                    value={docType}
                    onValueChange={(v) => setDocType(v as DocumentType)}
                  >
                    <SelectTrigger data-ocid="doc-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    File Name
                  </Label>
                  <Input
                    value={fileNameInput}
                    onChange={(e) => setFileNameInput(e.target.value)}
                    placeholder="e.g. offer_letter.pdf"
                    className="h-9"
                    data-ocid="doc-filename-input"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Document URL
                  </Label>
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://…"
                    className="h-9"
                    data-ocid="doc-url-input"
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !urlInput || !fileNameInput}
                  data-ocid="upload-doc-btn"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {uploading ? "Saving…" : "Add Document"}
                </Button>
              </div>
            </div>

            <DataTable
              columns={cols}
              data={docs}
              getKey={(d) => String(d.id)}
              loading={loading}
              emptyMessage={`No documents for ${selectedEmp?.name ?? "this employee"}`}
              renderRow={(d) => (
                <>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                      {DOC_TYPE_LABELS[d.documentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DocIcon fileName={d.fileName} />
                      <span className="text-sm font-body text-foreground">
                        {d.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(
                      Number(d.uploadedAt) / 1_000_000,
                    ).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(d.storageUrl, "_blank")}
                        data-ocid={`view-doc-${d.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(d.id)}
                        disabled={deletingId === d.id}
                        data-ocid={`delete-doc-${d.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            />
          </>
        )}

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="docs-empty"
          >
            Select an employee to view and manage their documents
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
