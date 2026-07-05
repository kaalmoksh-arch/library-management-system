import { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

export default function Users() {
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "librarian" });
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return (
      <div className="card text-center py-16">
        <div className="text-5xl mb-3">🔒</div>
        <p className="text-gray-500 font-medium">Admin access required</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/register", form);
      toast.success(`${form.role === "admin" ? "Admin" : "Librarian"} account created`);
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "librarian" });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm">Manage librarian and admin accounts</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add User</button>
      </div>

      <div className="card">
        <p className="text-gray-500 text-sm">
          Use this page to create additional librarian or admin accounts. The default admin account
          is <code className="bg-gray-100 px-1 rounded">admin@library.com</code>.
        </p>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create New User">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password *</label>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="librarian">Librarian</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
