import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import api from "../api/axios";
import { PageSpinner } from "../components/Spinner";

function StatCard({ icon, label, value, color, to }) {
  const content = (
    <div className={`card flex items-center gap-4 hover:shadow-md transition-shadow ${to ? "cursor-pointer" : ""}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/borrows/stats")
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const chartData = [
    { name: "Books",    value: stats.totalBooks,    fill: "#3b82f6" },
    { name: "Members",  value: stats.totalMembers,  fill: "#10b981" },
    { name: "Borrowed", value: stats.activeBorrows, fill: "#f59e0b" },
    { name: "Overdue",  value: stats.overdueCount,  fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Library overview at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="📚" label="Total Books"    value={stats.totalBooks}    color="bg-blue-100"   to="/books" />
        <StatCard icon="👥" label="Total Members"  value={stats.totalMembers}  color="bg-green-100"  to="/members" />
        <StatCard icon="📋" label="Active Borrows" value={stats.activeBorrows} color="bg-yellow-100" to="/borrows?status=borrowed" />
        <StatCard icon="⚠️" label="Overdue"        value={stats.overdueCount}  color="bg-red-100"    to="/overdue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={48}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fines card */}
        <div className="card flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Total Fines Collected</h2>
            <p className="text-4xl font-bold text-red-500">₹{stats.totalFines.toFixed(2)}</p>
            <p className="text-sm text-gray-400 mt-1">Across all returned books</p>
          </div>
          <div className="mt-4 flex gap-3">
            <Link to="/borrows" className="btn-primary text-xs">View Borrows</Link>
            <Link to="/overdue" className="btn-danger text-xs">View Overdue</Link>
          </div>
        </div>
      </div>

      {/* Recent borrows */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Borrows</h2>
        {stats.recentBorrows.length === 0 ? (
          <p className="text-gray-400 text-sm">No borrow records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Book</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Member</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Borrow Date</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBorrows.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{b.title}</td>
                    <td className="py-2 pr-4 text-gray-600">{b.member_name}</td>
                    <td className="py-2 pr-4 text-gray-500">{b.borrow_date?.split("T")[0]}</td>
                    <td className="py-2">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    borrowed: "badge-blue",
    returned: "badge-green",
    overdue:  "badge-red",
  };
  return <span className={map[status] || "badge-gray"}>{status}</span>;
}
