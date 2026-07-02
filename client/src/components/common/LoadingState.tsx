interface LoadingStateProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

export function LoadingState({ title = "Loading", message = "Please wait while we load your data.", compact = false }: LoadingStateProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${compact ? "max-w-xl" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        <div>
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
