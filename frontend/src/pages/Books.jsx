import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { PageSpinner } from "../components/Spinner";

const EMPTY_FORM = { title: "", author: "", isbn: "", category: "General", total_copies: 1, publisher: "", year: "" };

export default function Books() {
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);

  const [showForm, setShowForm]       = useState(false);
  const [editBook, setEditBook]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (search)   params.search   = search;
    if (category) params.category = category;
    api.get("/books", { params })
      .then((r) => setBooks(r.data))
      .catch(() => toast.error("Failed to load books"))
      .finally(() => setLoading(false));
  }, [search, category]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/books/meta/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function openAdd() {
    setEditBook(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(book) {
    setEditBook(book);
    setForm({
      title: book.title, author: book.author, isbn: book.isbn || "",
      category: book.category, total_copies: book.total_copies,
      publisher: book.publisher || "", year: book.year || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, total_copies: Number(form.total_copies), year: form.year ? Number(form.year) : null };
      if (editBook) {
        await api.put(`/books/${editBook.id}`, payload);
        toast.success("Book updated");
      } else {
        await api.post("/books", payload);
        toast.success("Book added");
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
      await api.delete(`/books/${deleteTarget.id}`);
      toast.success("Book deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-gray-500 text-sm">{books.length} book(s) found</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Book</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search title, author, ISBN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <PageSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Title", "Author", "ISBN", "Category", "Available", "Total", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {books.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No books found</td></tr>
                )}
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{book.title}</td>
                    <td className="px-4 py-3 text-gray-600">{book.author}</td>
                    <td className="px-4 py-3 text-gray-500">{book.isbn || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="badge-blue">{book.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={book.available === 0 ? "badge-red" : "badge-green"}>
                        {book.available}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{book.total_copies}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary text-xs px-3 py-1" onClick={() => openEdit(book)}>Edit</button>
                        <button className="btn-danger text-xs px-3 py-1" onClick={() => setDeleteTarget(book)}>Delete</button>
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editBook ? "Edit Book" : "Add New Book"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="label">Author *</label>
              <input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
            </div>
            <div>
              <label className="label">ISBN</label>
              <input className="input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="label">Total Copies</label>
              <input type="number" min={1} className="input" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} required />
            </div>
            <div>
              <label className="label">Publisher</label>
              <input className="input" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" min={1800} max={2099} className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Book"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
      />
    </div>
  );
}
