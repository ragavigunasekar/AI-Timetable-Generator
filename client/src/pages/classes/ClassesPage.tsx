import { useEffect, useMemo, useState } from "react";
import { PencilLine, Search, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import { EmptyState, LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

interface ClassFormState {
  id?: string;
  className: string;
  section: string;
}

function ClassesPage() {
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const classes = useSchoolStore((state) => state.classes);
  const setClasses = useSchoolStore((state) => state.setClasses);
  const { showToast } = useToast();

  useEffect(() => {
    const loadClasses = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await api.get("/classes");
        setClasses(response.data);
      } catch (err: unknown) {
        const message = getApiErrorMessage(err, "Unable to load classes. Please refresh the page.");
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadClasses();
  }, [setClasses]);

  const resetForm = () => {
    setEditingId(null);
    setClassName("");
    setSection("");
    setError("");
  };

  const handleSubmit = async () => {
    const trimmedClass = className.trim();
    const trimmedSection = section.trim();

    if (!trimmedClass || !trimmedSection) {
      setError("Please enter a valid class and section.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const payload: ClassFormState = {
        id: editingId || undefined,
        className: trimmedClass,
        section: trimmedSection,
      };
      const response = editingId
        ? await api.put(`/classes/${editingId}`, payload)
        : await api.post("/classes", { ...payload, id: Date.now().toString() });
      setClasses(response.data);
      resetForm();
      showToast("success", editingId ? "Class updated successfully." : "Class created successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Unable to save class. Please try again.");
      setError(message);
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (schoolClass: { id: string; className: string; section: string }) => {
    setEditingId(schoolClass.id);
    setClassName(schoolClass.className);
    setSection(schoolClass.section);
    setError("");
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm("Delete this class?")) {
      return;
    }

    try {
      setPendingDeleteId(id);
      await api.delete(`/classes/${id}`);
      setClasses(classes.filter((schoolClass) => schoolClass.id !== id));
      showToast("success", "Class deleted successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Unable to delete class. Please try again.");
      setError(message);
      showToast("error", message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const filteredClasses = useMemo(() => {
    const query = search.toLowerCase();
    return classes.filter((schoolClass) => [schoolClass.className, schoolClass.section].some((value) => value.toLowerCase().includes(query)));
  }, [search, classes]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Classes Management</h1>
          <p className="text-sm text-slate-500">Maintain class sections and keep the scheduling data organized.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class (6,7,8...)" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
          <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (A,B,C)" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={handleSubmit} disabled={isSaving} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? "Saving..." : editingId ? "Update Class" : "Add Class"}
          </button>
          {editingId ? (
            <button onClick={resetForm} disabled={isSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
              <span className="inline-flex items-center gap-2"><X className="h-4 w-4" />Cancel</span>
            </button>
          ) : null}
        </div>

        {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="text-sm text-slate-500">{filteredClasses.length} records</div>
        </div>

        {isLoading ? (
          <LoadingState title="Loading classes" message="Fetching class records from the database." compact />
        ) : filteredClasses.length === 0 ? (
          <EmptyState title="No classes yet" message="Create class sections to start assigning timetable allocations." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold">Class</th>
                  <th className="px-3 py-3 font-semibold">Section</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.map((schoolClass) => (
                  <tr key={schoolClass.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-700">{schoolClass.className}</td>
                    <td className="px-3 py-3 text-slate-700">{schoolClass.section}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startEdit(schoolClass)} disabled={isSaving || pendingDeleteId === schoolClass.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                          <PencilLine className="h-4 w-4" />Edit
                        </button>
                        <button onClick={() => handleDeleteClass(schoolClass.id)} disabled={isSaving || pendingDeleteId === schoolClass.id} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                          {pendingDeleteId === schoolClass.id ? "Deleting..." : <><Trash2 className="h-4 w-4" />Delete</>}
                        </button>
                      </div>
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

export default ClassesPage;