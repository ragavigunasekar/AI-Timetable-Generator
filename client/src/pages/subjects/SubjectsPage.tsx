import { useEffect, useMemo, useState } from "react";
import { PencilLine, Search, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import { EmptyState, LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";

interface SubjectFormState {
  id?: string;
  name: string;
  periodsPerWeek: string;
}

function SubjectsPage() {
  const [subjectName, setSubjectName] = useState("");
  const [periodsPerWeek, setPeriodsPerWeek] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const subjects = useSchoolStore((state) => state.subjects);
  const setSubjects = useSchoolStore((state) => state.setSubjects);
  const { showToast } = useToast();

  useEffect(() => {
    const loadSubjects = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await api.get("/subjects");
        setSubjects(response.data);
      } catch (err) {
        setError("Unable to load subjects. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSubjects();
  }, [setSubjects]);

  const resetForm = () => {
    setEditingId(null);
    setSubjectName("");
    setPeriodsPerWeek("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!subjectName || !periodsPerWeek) {
      setError("Please enter subject and periods per week.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const payload: SubjectFormState = {
        id: editingId || undefined,
        name: subjectName.trim(),
        periodsPerWeek: periodsPerWeek.trim(),
      };
      const response = editingId
        ? await api.put(`/subjects/${editingId}`, payload)
        : await api.post("/subjects", { ...payload, id: Date.now().toString() });
      setSubjects(response.data);
      resetForm();
      showToast("success", editingId ? "Subject updated successfully." : "Subject created successfully.");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Unable to save subject. Please try again.";
      setError(message);
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (subject: { id: string; name: string; periodsPerWeek: string }) => {
    setEditingId(subject.id);
    setSubjectName(subject.name);
    setPeriodsPerWeek(subject.periodsPerWeek);
    setError("");
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm("Delete this subject?")) {
      return;
    }

    try {
      setPendingDeleteId(id);
      await api.delete(`/subjects/${id}`);
      setSubjects(subjects.filter((subject) => subject.id !== id));
      showToast("success", "Subject deleted successfully.");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Unable to delete subject. Please try again.";
      setError(message);
      showToast("error", message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const filteredSubjects = useMemo(() => {
    const query = search.toLowerCase();
    return subjects.filter((subject) => [subject.name, subject.periodsPerWeek].some((value) => value.toLowerCase().includes(query)));
  }, [search, subjects]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Subjects Management</h1>
          <p className="text-sm text-slate-500">Manage subjects and weekly periods with a consistent workflow.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Subject Name" className="rounded-xl border border-slate-200 p-3 focus:border-green-500 focus:outline-none" />
          <input value={periodsPerWeek} onChange={(e) => setPeriodsPerWeek(e.target.value)} placeholder="Periods Per Week" className="rounded-xl border border-slate-200 p-3 focus:border-green-500 focus:outline-none" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={handleSubmit} disabled={isSaving} className="rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? "Saving..." : editingId ? "Update Subject" : "Add Subject"}
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subjects" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 focus:border-green-500 focus:outline-none" />
          </div>
          <div className="text-sm text-slate-500">{filteredSubjects.length} records</div>
        </div>

        {isLoading ? (
          <LoadingState title="Loading subjects" message="Fetching subject data from the database." compact />
        ) : filteredSubjects.length === 0 ? (
          <EmptyState title="No subjects yet" message="Add your first subject to start planning timetable allocations." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Periods/Week</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-700">{subject.name}</td>
                    <td className="px-3 py-3 text-slate-700">{subject.periodsPerWeek}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startEdit(subject)} disabled={isSaving || pendingDeleteId === subject.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                          <PencilLine className="h-4 w-4" />Edit
                        </button>
                        <button onClick={() => handleDeleteSubject(subject.id)} disabled={isSaving || pendingDeleteId === subject.id} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                          {pendingDeleteId === subject.id ? "Deleting..." : <><Trash2 className="h-4 w-4" />Delete</>}
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

export default SubjectsPage;