import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { PageSpinner } from "../components/Spinner";

export default function Borrows() {
  const [searchParams] = useSearchParams();
  const [borrows, setBorrows]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const [showIssue, setShowIssue] = useState(false);
  const [books, setBooks]         = useState([]);
  const [members, setMembers]     = useState([]);
  const [issueForm, setIssueForm] = useState({ book_id: "", member_id: "", loan_days: 14 });
  const [issuing, setIssuing]     = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    api.get("/borrows", { params })
      .then((r) => setBorrows(r.data))
      .catch(() => toast.error("Failed to load borrows"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function openIssue() {
    try {
      const [booksRes, membersRes] = await Promise.all([
        api.get("/books", { params: {} }),
        api.get("/members", { params: { status: "active" } }),
      ]);
      setBooks(booksRes.data.filter((b) => b.available > 0));
      setMembers(membersRes.data);
    } catch {
      toast.error("Failed to load books/members");
      return;
    }
    setIssueForm({ book_id: "", member_id: "", loan_days: 14 });
    setShowIssue(true);
  }

  async function handleIssue(e) {
    e.preventDefault();
    setIssuing(true);
    try {
      await api.post("/borrows", issueForm);
      toast.success("Book issued successfully");
      setShowIssue(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Issue failed");
    } finally {
      setIssuing(false);
    }
  }

  async function handleReturn() {
    try {
      const { data } = await api.put(`/borrows/${returnTarget.id}/return`);
      if (data.fine > 0) {
        toast.success(`Book returned. Fine: ₹${data.fine} (${data.overdue_days} days overdue)`);
      } else {
        toast.success("Book returned successfully");
      }
      setReturnTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Return failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrows</h1>
          <p className="text-gray-500 text-sm">{borrows.length} record(s)</p>
        </div>
        <button className="btn-primary" onClick={openIssue}>+ Issue Book</button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="borrowed">Borrowed</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      {loading ? <PageSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Book", "Member", "Member ID", "Borrow Date", "Due Date", "Return Date", "Fine", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {borrows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
                )}
                {borrows.map((b) => {
                  const isOverdue = b.status === "borrowed" && new Date(b.due_date) < new Date();
                  return (
                    <tr key={b.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3 font-medium max-w-[160px] truncate">{b.book_title}</td>
                      <td className="px-4 py-3 text-gray-700">{b.member_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.member_code}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.borrow_date?.split("T")[0]}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>{b.due_date}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.return_date || "—"}</td>
                      <td className="px-4 py-3 text-red-600 font-medium">{b.fine > 0 ? `₹${b.fine}` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={{ borrowed: isOverdue ? "badge-red" : "badge-blue", returned: "badge-green" }[b.status] || "badge-gray"}>
                          {isOverdue ? "overdue" : b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.status === "borrowed" && (
                          <button className="btn-success text-xs px-3 py-1" onClick={() => setReturnTarget(b)}>
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Book Modal */}
      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue Book to Member">
        <form onSubmit={handleIssue} className="space-y-4">
          <div>
            <label className="label">Select Book *</label>
            <select className="input" value={issueForm.book_id} onChange={(e) => setIssueForm({ ...issueForm, book_id: e.target.value })} required>
              <option value="">— Choose a book —</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} by {b.author} ({b.available} available)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Select Member *</label>
            <select className="input" value={issueForm.member_id} onChange={(e) => setIssueForm({ ...issueForm, member_id: e.target.value })} required>
              <option value="">— Choose a member —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.member_id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Loan Period (days)</label>
            <input type="number" min={1} max={90} className="input" value={issueForm.loan_days}
              onChange={(e) => setIssueForm({ ...issueForm, loan_days: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowIssue(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={issuing}>{issuing ? "Issuing…" : "Issue Book"}</button>
          </div>
        </form>
      </Modal>

      {/* Return confirm */}
      <ConfirmDialog
        isOpen={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        onConfirm={handleReturn}
        title="Return Book"
        message={`Confirm return of "${returnTarget?.book_title}" by ${returnTarget?.member_name}?`}
        confirmLabel="Confirm Return"
        variant="primary"
      />
    </div>
  );
}
