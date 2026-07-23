import { useEffect, useMemo, useState } from "react";
import { PencilLine, Search, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import { EmptyState, LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

interface TeacherFormState {
  id?: string;
  code: string;
  name: string;
  subject: string;
  workload: string;
}

function TeachersPage() {
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [subject, setSubject] = useState("");
  const [workload, setWorkload] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const teachers = useSchoolStore((state) => state.teachers);
  const setTeachers = useSchoolStore((state) => state.setTeachers);
  const { showToast } = useToast();

  useEffect(() => {
    const loadTeachers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await api.get("/teachers");
        setTeachers(response.data);
      } catch (err: unknown) {
        const message = getApiErrorMessage(err, "Unable to load teachers. Please refresh the page.");
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeachers();
  }, [setTeachers]);

  const resetForm = () => {
    setEditingId(null);
    setTeacherCode("");
    setTeacherName("");
    setSubject("");
    setWorkload("");
    setError("");
  };

  const handleSubmit = async () => {
    const trimmedCode = teacherCode.trim();
    const trimmedName = teacherName.trim();
    const trimmedSubject = subject.trim();
    const trimmedWorkload = workload.trim();
    const numericWorkload = Number(trimmedWorkload);

    if (!trimmedCode || !trimmedName || !trimmedSubject || !trimmedWorkload) {
      setError("Please fill in all teacher fields.");
      return;
    }

    if (isNaN(numericWorkload) || numericWorkload < 0 || numericWorkload > 100) {
      setError("Workload must be a valid non-negative number (max 100).");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const payload: TeacherFormState = {
        id: editingId || undefined,
        code: trimmedCode,
        name: trimmedName,
        subject: trimmedSubject,
        workload: trimmedWorkload,
      };

      const response = editingId
        ? await api.put(`/teachers/${editingId}`, payload)
        : await api.post("/teachers", { ...payload, id: Date.now().toString() });

      setTeachers(response.data);
      resetForm();
      showToast("success", editingId ? "Teacher updated successfully." : "Teacher created successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Unable to save teacher. Please try again.");
      setError(message);
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (teacher: { id: string; code: string; name: string; subject: string; workload: string }) => {
    setEditingId(teacher.id);
    setTeacherCode(teacher.code);
    setTeacherName(teacher.name);
    setSubject(teacher.subject);
    setWorkload(teacher.workload);
    setError("");
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!window.confirm("Delete this teacher record?")) {
      return;
    }

    try {
      setPendingDeleteId(id);
      await api.delete(`/teachers/${id}`);
      setTeachers(teachers.filter((teacher) => teacher.id !== id));
      showToast("success", "Teacher deleted successfully.");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Unable to delete teacher. Please try again.");
      setError(message);
      showToast("error", message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const filteredTeachers = useMemo(() => {
    const query = search.toLowerCase();
    return teachers.filter((teacher) => [teacher.code, teacher.name, teacher.subject, teacher.workload].some((value) => value.toLowerCase().includes(query)));
  }, [search, teachers]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Teachers Management</h1>
          <p className="text-sm text-slate-500">Create, edit, and manage teacher records with consistent validation.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} placeholder="Teacher Code" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
          <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher Name" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
          <input value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="Weekly Workload" className="rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={handleSubmit} disabled={isSaving} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? "Saving..." : editingId ? "Update Teacher" : "Add Teacher"}
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teachers" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="text-sm text-slate-500">{filteredTeachers.length} records</div>
        </div>

        {isLoading ? (
          <LoadingState title="Loading teachers" message="Fetching teacher records from the database." compact />
        ) : filteredTeachers.length === 0 ? (
          <EmptyState title="No teachers yet" message="Create your first teacher record to start assigning subjects and workloads." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold">Code</th>
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Subject</th>
                  <th className="px-3 py-3 font-semibold">Workload</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-700">{teacher.code}</td>
                    <td className="px-3 py-3 text-slate-700">{teacher.name}</td>
                    <td className="px-3 py-3 text-slate-700">{teacher.subject}</td>
                    <td className="px-3 py-3 text-slate-700">{teacher.workload}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startEdit(teacher)} disabled={isSaving || pendingDeleteId === teacher.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                          <PencilLine className="h-4 w-4" />Edit
                        </button>
                        <button onClick={() => handleDeleteTeacher(teacher.id)} disabled={isSaving || pendingDeleteId === teacher.id} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                          {pendingDeleteId === teacher.id ? "Deleting..." : <><Trash2 className="h-4 w-4" />Delete</>}
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

export default TeachersPage;