import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSchoolStore } from "../../store/schoolStore";
import type { Conflict } from "../../store/schoolStore";
import { ConflictPanel } from "../../components/ConflictPanel";
import { OptimizationPanel } from "../../components/OptimizationPanel";
import api from "../../services/api";
import { AlertCircle, Calendar, Plus, Trash2, FileSpreadsheet, PencilLine, Search, X } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";

function parseWorkingDays(workingDays: string) {
  const trimmed = workingDays?.trim();
  const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  if (!trimmed) {
    return defaultDays;
  }

  const normalized = trimmed.replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
  
  const capitalize = (s: string) => {
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower.startsWith("mon")) return "Mon";
    if (lower.startsWith("tue")) return "Tue";
    if (lower.startsWith("wed")) return "Wed";
    if (lower.startsWith("thu")) return "Thu";
    if (lower.startsWith("fri")) return "Fri";
    if (lower.startsWith("sat")) return "Sat";
    if (lower.startsWith("sun")) return "Sun";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const ordered = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (rangeMatch) {
    const from = capitalize(rangeMatch[1]);
    const to = capitalize(rangeMatch[2]);
    const fromIndex = ordered.indexOf(from);
    const toIndex = ordered.indexOf(to);
    if (fromIndex >= 0 && toIndex >= fromIndex) {
      return ordered.slice(fromIndex, toIndex + 1);
    }
  }

  return trimmed
    .split(",")
    .map((day) => capitalize(day.trim()))
    .filter((day) => ordered.includes(day));
}

function AllocationPage() {
  const navigate = useNavigate();
  const [periodCount, setPeriodCount] = useState(1);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");

  const teachers = useSchoolStore((state) => state.teachers);
  const subjects = useSchoolStore((state) => state.subjects);
  const classes = useSchoolStore((state) => state.classes);
  const allocations = useSchoolStore((state) => state.allocations);
  const settings = useSchoolStore((state) => state.schoolSettings);
  const conflicts = useSchoolStore((state) => state.conflicts);

  const setInitialData = useSchoolStore((state) => state.setInitialData);
  const setAllocations = useSchoolStore((state) => state.setAllocations);
  const setGeneratedTimetable = useSchoolStore((state) => state.setGeneratedTimetable);
  const { showToast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, teachersRes, subjectsRes, classesRes, allocationsRes] = await Promise.all([
          api.get("/settings"),
          api.get("/teachers"),
          api.get("/subjects"),
          api.get("/classes"),
          api.get("/allocations")
        ]);
        setInitialData({
          schoolSettings: settingsRes.data,
          teachers: teachersRes.data,
          subjects: subjectsRes.data,
          classes: classesRes.data,
          allocations: allocationsRes.data,
        });
      } catch (error) {
        console.error("Failed to load allocation page dependencies:", error);
        setAiError("Failed to load allocations data from server.");
      }
    };
    loadData();
  }, [setInitialData]);

  // Synchronize and clear stale selections if conflict is resolved
  useEffect(() => {
    if (selectedConflict && !conflicts.some((c) => c.id === selectedConflict.id)) {
      setSelectedConflict(null);
    }
  }, [conflicts, selectedConflict]);

  const days = useMemo(() => parseWorkingDays(settings.workingDays), [settings.workingDays]);
  const periodsPerDay = useMemo(() => Number(settings.periodsPerDay) || 8, [settings.periodsPerDay]);
  const capacity = useMemo(() => days.length * periodsPerDay, [days, periodsPerDay]);
  const totalAllocated = useMemo(() => allocations.reduce((sum, a) => sum + Number(a.periods), 0), [allocations]);
  const filteredAllocations = useMemo(() => {
    const query = search.toLowerCase();
    return allocations.filter((allocation) => {
      const schoolClass = classes.find((c) => c.id === allocation.classId);
      const subjectName = subjects.find((s) => s.id === allocation.subjectId)?.name || "";
      const teacherName = teachers.find((t) => t.id === allocation.teacherId)?.name || "";
      const haystack = `${schoolClass?.className ?? ""} ${schoolClass?.section ?? ""} ${subjectName} ${teacherName} ${allocation.periods}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [allocations, classes, search, subjects, teachers]);

  // Filter block constraints (Critical & Warnings block generation)
  const blockingConflicts = useMemo(() => conflicts.filter(
    (c) => c.severity === "critical" || c.severity === "warning"
  ), [conflicts]);
  
  const isGenerationBlocked = blockingConflicts.length > 0;

  const resetForm = () => {
    setEditingAllocationId(null);
    setFormClassId("");
    setFormSubjectId("");
    setFormTeacherId("");
    setPeriodCount(1);
    setAiError("");
  };

  const handleSubmitAllocation = async () => {
    if (!formClassId || !formSubjectId) {
      setAiError("Please select both a class and a subject.");
      return;
    }

    const nextAllocation = {
      id: editingAllocationId || Date.now().toString(),
      classId: formClassId,
      subjectId: formSubjectId,
      teacherId: formTeacherId || undefined,
      periods: periodCount,
    };

    const nextTotal = totalAllocated + periodCount - (editingAllocationId ? Number(allocations.find((a) => a.id === editingAllocationId)?.periods || 0) : 0);
    if (nextTotal > capacity) {
      setAiError(`Cannot save. Total would exceed capacity of ${capacity} periods.`);
      return;
    }

    try {
      setAiError("");
      const response = editingAllocationId
        ? await api.put(`/allocations/${editingAllocationId}`, nextAllocation)
        : await api.post("/allocations", nextAllocation);
      setAllocations(response.data);
      resetForm();
      showToast("success", editingAllocationId ? "Allocation updated successfully." : "Allocation created successfully.");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to save allocation to database.";
      setAiError(message);
      showToast("error", message);
    }
  };

  const startEditAllocation = (allocation: typeof allocations[number]) => {
    setEditingAllocationId(allocation.id);
    setFormClassId(allocation.classId);
    setFormSubjectId(allocation.subjectId);
    setFormTeacherId(allocation.teacherId || "");
    setPeriodCount(Number(allocation.periods) || 1);
    setAiError("");
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!window.confirm("Delete this allocation?")) {
      return;
    }

    try {
      setPendingDeleteId(id);
      setAiError("");
      await api.delete(`/allocations/${id}`);
      setAllocations(allocations.filter((a) => a.id !== id));
      if (selectedConflict?.entityId === id) {
        setSelectedConflict(null);
      }
      showToast("success", "Allocation deleted successfully.");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to delete allocation from database.";
      setAiError(message);
      showToast("error", message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleGenerateAI = async () => {
    setAiError("");
    setAiLoading(true);

    try {
      if (allocations.length === 0) {
        setAiError("Please add at least one allocation before generating.");
        setAiLoading(false);
        return;
      }

      const totalAllocated2 = allocations.reduce((sum, a) => sum + Number(a.periods), 0);
      if (totalAllocated2 > capacity) {
        setAiError(`Total allocations exceed capacity (${totalAllocated2}/${capacity}). Remove some.`);
        setAiLoading(false);
        return;
      }

      if (isGenerationBlocked) {
        setAiError("Please resolve all Critical and Warning conflicts before generating a timetable.");
        setAiLoading(false);
        return;
      }

      const response = await api.post("/ai/timetable", {
        allocations,
        teachers,
        subjects,
        classes,
        settings,
      });

      let timetable = response.data.timetable;

      if (timetable && typeof timetable === "object" && timetable.timetable) {
        timetable = timetable.timetable;
      }

      const normalizedTimetable: Record<string, Record<number, any[]>> = {};

      Object.entries(timetable).forEach(([day, periods]: [string, any]) => {
        if (typeof periods === "object" && periods !== null) {
          normalizedTimetable[day] = {};
          Object.entries(periods).forEach(([period, entries]: [string, any]) => {
            const periodNum = Number(period);
            const entriesArray = Array.isArray(entries) ? entries : [entries];
            normalizedTimetable[day][periodNum] = entriesArray
              .filter((entry) => entry && entry.subject && entry.className)
              .map((entry) => ({
                subject: entry.subject,
                className: entry.className,
                teacher: entry.teacher,
              }));
          });
        }
      });

      setGeneratedTimetable(normalizedTimetable);
      navigate("/timetable");
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to generate timetable.";
      setAiError(errorMsg);
    } finally {
      setAiLoading(false);
    }
  };

  // Determine if a card or selector is highlighted
  const isAllocationHighlighted = (a: typeof allocations[0]) => {
    if (!selectedConflict) return false;
    const { type, entityId } = selectedConflict;

    if (type === "workload" || type === "double_booking") {
      return a.teacherId === entityId;
    }
    if (type === "class_overload") {
      return a.classId === entityId;
    }
    if (type === "missing_teacher") {
      return a.id === entityId;
    }
    return false;
  };

  const isClassOptionAffected = (cId: string) => {
    if (!selectedConflict) return false;
    return selectedConflict.type === "class_overload" && selectedConflict.entityId === cId;
  };

  const isTeacherOptionAffected = (tId: string) => {
    if (!selectedConflict) return false;
    return (selectedConflict.type === "workload" || selectedConflict.type === "double_booking") && selectedConflict.entityId === tId;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Class-Subject Allocations</h1>

      {/* Conflict Panel component */}
      <ConflictPanel 
        conflicts={conflicts} 
        selectedConflict={selectedConflict} 
        onSelectConflict={setSelectedConflict} 
      />

      {/* Optimization Engine Panel — sits between conflict detection and timetable generation */}
      <OptimizationPanel />

      {/* Add Allocation Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <Plus className="w-5 h-5 mr-2 text-indigo-600" />
          Add Allocation
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col">
            <label htmlFor="class" className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Class</label>
            <select 
              id="class" 
              value={formClassId}
              onChange={(e) => setFormClassId(e.target.value)}
              className={`border rounded-xl p-3 text-slate-700 bg-white transition duration-200 ${
                selectedConflict && classes.some(c => isClassOptionAffected(c.id))
                  ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50/20"
                  : "border-slate-200 focus:border-indigo-500"
              }`}
            >
              <option value="">Select Class</option>
              {classes.map((c) => {
                const affected = isClassOptionAffected(c.id);
                return (
                  <option key={c.id} value={c.id} className={affected ? "bg-indigo-100 font-bold" : ""}>
                    {c.className} - {c.section} {affected ? "⚠️" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="subject" className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Subject</label>
            <select 
              id="subject" 
              value={formSubjectId}
              onChange={(e) => setFormSubjectId(e.target.value)}
              className="border border-slate-200 focus:border-indigo-500 rounded-xl p-3 text-slate-700 bg-white transition duration-200"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="teacher" className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Teacher</label>
            <select 
              id="teacher" 
              value={formTeacherId}
              onChange={(e) => setFormTeacherId(e.target.value)}
              className={`border rounded-xl p-3 text-slate-700 bg-white transition duration-200 ${
                selectedConflict && teachers.some(t => isTeacherOptionAffected(t.id))
                  ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50/20"
                  : "border-slate-200 focus:border-indigo-500"
              }`}
            >
              <option value="">Select Teacher (Optional)</option>
              {teachers.map((t) => {
                const affected = isTeacherOptionAffected(t.id);
                return (
                  <option key={t.id} value={t.id} className={affected ? "bg-indigo-100 font-bold" : ""}>
                    {t.name} {affected ? "⚠️" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="periods" className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Periods Per Week</label>
            <input
              id="periods"
              type="number"
              value={periodCount}
              onChange={(e) => setPeriodCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="border border-slate-200 focus:border-indigo-500 rounded-xl p-3 text-slate-700 transition duration-200"
              placeholder="Periods"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSubmitAllocation}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-sm transition duration-200"
          >
            {editingAllocationId ? "Update Allocation" : "Add Allocation"}
          </button>
          {editingAllocationId ? (
            <button onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-50">
              <span className="inline-flex items-center gap-2"><X className="h-4 w-4" />Cancel</span>
            </button>
          ) : null}
        </div>
        {aiError && (
          <div className="flex items-center space-x-2 text-red-600 font-medium mt-4 bg-red-50 p-3 rounded-lg border border-red-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{aiError}</span>
          </div>
        )}
      </div>

      {/* Allocations List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-8">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-indigo-600" />
            Allocations List
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search allocations" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 focus:border-indigo-500 focus:outline-none" />
            </div>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 font-bold rounded-full">
              {filteredAllocations.length} total
            </span>
          </div>
        </div>
        
        {filteredAllocations.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No allocations added yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAllocations.map((a) => {
              const schoolClass = classes.find((c) => c.id === a.classId);
              const className = schoolClass ? `${schoolClass.className}-${schoolClass.section}` : "Unknown Class";
              const subjectName = subjects.find((s) => s.id === a.subjectId)?.name || "Unknown Subject";
              const teacherName = a.teacherId ? teachers.find((t) => t.id === a.teacherId)?.name : "—";
              
              const highlighted = isAllocationHighlighted(a);

              return (
                <div 
                  key={a.id} 
                  className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all duration-200 ${
                    highlighted 
                      ? "border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/10 scale-[1.01]" 
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">
                      Class {className} • <span className="text-indigo-600">{subjectName}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-semibold mt-1">
                      Teacher: {teacherName} ({a.periods} periods/week)
                    </span>
                    {highlighted && (
                      <span className="inline-flex items-center mt-2 text-[10px] font-bold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md border border-indigo-200 w-fit">
                        Affected by Selected Conflict
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditAllocation(a)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      title="Edit Allocation"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAllocation(a.id)}
                      disabled={pendingDeleteId === a.id}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                      title="Delete Allocation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Block Generation reason / AI Generation */}
      <div className={`p-6 rounded-2xl border ${
        isGenerationBlocked 
          ? "bg-red-50 border-red-200 text-red-950" 
          : "bg-indigo-50/50 border-indigo-100 text-slate-800"
      }`}>
        <div className="flex items-start space-x-3">
          <Calendar className={`w-6 h-6 mt-0.5 ${isGenerationBlocked ? "text-red-500" : "text-indigo-600"}`} />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Timetable Schedule Generation</h2>
            
            {isGenerationBlocked ? (
              <div className="mt-2 text-sm text-red-900 leading-relaxed font-semibold">
                ⚠️ Generation is blocked because there are {blockingConflicts.length} active Critical/Warning conflicts. 
                Please inspect the conflict reports above and resolve them to enable schedule generation.
              </div>
            ) : (
              <p className="text-sm text-slate-500 leading-relaxed mt-1">
                All validation checks pass! You can proceed to build the weekly schedule. 
                Our AI engine will schedule classes avoiding conflicts.
              </p>
            )}

            <button
              onClick={handleGenerateAI}
              disabled={aiLoading || isGenerationBlocked}
              className={`mt-4 font-bold px-8 py-3.5 rounded-xl transition duration-200 shadow-sm ${
                isGenerationBlocked
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              }`}
            >
              {aiLoading ? "Generating Schedule..." : "Generate Timetable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllocationPage;
