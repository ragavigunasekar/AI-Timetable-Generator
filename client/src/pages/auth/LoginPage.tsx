import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter both email and password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await api.post("/auth/login", {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (!response.data?.token) {
        throw new Error("No token received from server.");
      }

      setToken(response.data.token);
      showToast("success", "Logged in successfully. Welcome back!");
      navigate("/dashboard");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Login failed. Please check your credentials.");
      setError(message);
      showToast("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Ragavi Scheduler AI</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-rose-700 text-sm bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold p-3.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <p className="text-sm text-center text-slate-500 mt-4">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-indigo-600 font-semibold hover:underline hover:text-indigo-700 transition-colors">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
