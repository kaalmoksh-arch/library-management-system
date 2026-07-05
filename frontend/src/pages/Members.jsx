import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { PageSpinner } from "../components/Spinner";

const EMPTY_FORM = { name: "", email: "", phone: "", address: "", status: "active" };

export default function Members() {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm]         = useState(false);
  const [editMember, setEditMember]     = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [viewMember, setViewMember]   = useState(null);
  const [history, setHistory]         = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (search)       params.search = search;
    if (statusFilter) params.status = statusFilter;
    api.get("/members", { params })
      .then((r) => setMembers(r.data))
      .catch(() => toast.error("Failed to load members"))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditMember(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(member) {
    setEditMember(member);
    setForm({ name: member.name, email: member.email, phone: member.phone || "", address: member.address || "", status: member.status });
    setShowForm(true);
  }

  async function openHistory(member) {
    setViewMember(member);
    setHistLoading(true);
    try {
      const r = await api.get(`/members/${member.id}/borrows`);
      setHistory(r.data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editMember) {
        await api.put(`/members/${editMember.id}`, form);
        toast.success("Member updated");
      } else {
        await api.post("/members", form);
        toast.success("Member added");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/members/${deleteTarget.id}`);
      toast.success("Member deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm">{members.length} member(s) found</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Member</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, email, member ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? <PageSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Member ID", "Name", "Email", "Phone", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No members found</td></tr>
                )}
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.member_id}</td>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3 text-gray-500">{m.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={m.status === "active" ? "badge-green" : "badge-red"}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.joined_at?.split("T")[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button className="btn-secondary text-xs px-3 py-1" onClick={() => openHistory(m)}>History</button>
                        <button className="btn-secondary text-xs px-3 py-1" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn-danger text-xs px-3 py-1" onClick={() => setDeleteTarget(m)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editMember ? "Edit Member" : "Add New Member"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Member"}</button>
          </div>
        </form>
      </Modal>

      {/* Borrow history Modal */}
      <Modal isOpen={!!viewMember} onClose={() => setViewMember(null)} title={`Borrow History — ${viewMember?.name}`} size="lg">
        {histLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 h-8 w-8" /></div>
        ) : history.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No borrow records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  {["Book", "Borrow Date", "Due Date", "Return Date", "Status", "Fine"].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-4 font-medium">{b.title}</td>
                    <td className="py-2 pr-4 text-gray-500">{b.borrow_date?.split("T")[0]}</td>
                    <td className="py-2 pr-4 text-gray-500">{b.due_date}</td>
                    <td className="py-2 pr-4 text-gray-500">{b.return_date || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={{ borrowed: "badge-blue", returned: "badge-green", overdue: "badge-red" }[b.status] || "badge-gray"}>{b.status}</span>
                    </td>
                    <td className="py-2 text-red-600 font-medium">{b.fine > 0 ? `₹${b.fine}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Member"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
