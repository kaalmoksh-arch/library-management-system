import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import ConfirmDialog from "../components/ConfirmDialog";
import { PageSpinner } from "../components/Spinner";

function daysOverdue(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
}

export default function Overdue() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [returnTarget, setReturnTarget] = useState(null);

  function load() {
    api.get("/borrows/overdue")
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Failed to load overdue books"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleReturn() {
    try {
      const { data } = await api.put(`/borrows/${returnTarget.id}/return`);
      toast.success(`Returned. Fine: ₹${data.fine} (${data.overdue_days} days overdue)`);
      setReturnTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Return failed");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overdue Books</h1>
        <p className="text-gray-500 text-sm">
          {rows.length} overdue book(s) — fine rate: ₹5/day
        </p>
      </div>

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-500 font-medium">No overdue books right now!</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50 border-b border-red-100">
                <tr>
                  {["Book", "Member", "Member ID", "Due Date", "Days Overdue", "Est. Fine", "Action"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-red-700 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((b) => {
                  const days = daysOverdue(b.due_date);
                  const fine = days * 5;
                  return (
                    <tr key={b.id} className="hover:bg-red-50/50">
                      <td className="px-4 py-3 font-medium">{b.book_title}</td>
                      <td className="px-4 py-3 text-gray-700">{b.member_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.member_code}</td>
                      <td className="px-4 py-3 text-red-600 font-semibold">{b.due_date}</td>
                      <td className="px-4 py-3">
                        <span className="badge-red">{days} days</span>
                      </td>
                      <td className="px-4 py-3 text-red-700 font-bold">₹{fine}</td>
                      <td className="px-4 py-3">
                        <button className="btn-success text-xs px-3 py-1" onClick={() => setReturnTarget(b)}>
                          Return
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        onConfirm={handleReturn}
        title="Return Overdue Book"
        message={`Return "${returnTarget?.book_title}" for ${returnTarget?.member_name}? Fine will be calculated automatically.`}
        confirmLabel="Return & Collect Fine"
        variant="primary"
      />
    </div>
  );
}
