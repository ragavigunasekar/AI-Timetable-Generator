import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

function NotFoundPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-indigo-100 text-indigo-600 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" x2="9.01" y1="9" y2="9" />
              <line x1="15" x2="15.01" y1="9" y2="9" />
            </svg>
          </div>
          <h1 className="text-7xl font-black text-slate-900 mb-2 tracking-tight">404</h1>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h2>
          <p className="text-slate-500">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or deleted.
          </p>
        </div>

        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          {isAuthenticated ? "Back to Dashboard" : "Back to Login"}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
