import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

function RegisterPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/\d/.test(pwd)) {
      return "Password must contain at least one number.";
    }
    return null;
  };

  const passwordStrength = useMemo(() => {
    const pwd = password.trim();
    if (!pwd) return { score: 0, label: "Enter a password", color: "bg-slate-200" };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (pwd.length >= 12) score += 1;
    if (score <= 2) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 4) return { score, label: "Good", color: "bg-amber-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  }, [password]);

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedEmail || !trimmedPassword || !trimmedConfirm) {
      setError("Please fill in all fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    const pwError = validatePassword(trimmedPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await api.post("/auth/register", {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (!response.data?.token) {
        throw new Error("No token received from server.");
      }

      setToken(response.data.token);
      showToast("success", "Account created successfully. Welcome!");
      navigate("/dashboard");
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Registration failed. Try a different email.");
      setError(message);
      showToast("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_36%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)] flex items-center justify-center p-4">
      <div className="bg-white/95 w-full max-w-md p-8 rounded-3xl shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] border border-slate-200 backdrop-blur">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 mb-4">
            <img src="/ragavi-logo.svg" alt="Ragavi Scheduler AI logo" className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Create Account</h1>
          <p className="text-sm text-slate-500 mt-1">Get started with Ragavi Scheduler AI</p>
        </div>

        <form onSubmit={handleRegister} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="register-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 pr-12 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((step) => (
                  <div key={step} className={`h-2 flex-1 rounded-full ${step < passwordStrength.score ? passwordStrength.color : "bg-slate-200"}`} />
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Strength: <span className="font-semibold text-slate-700">{passwordStrength.label}</span></p>
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 pr-12 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <p className="font-medium text-slate-700 mb-1">Password requirements:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              <li>Minimum 8 characters</li>
              <li>At least one uppercase and one lowercase letter</li>
              <li>At least one number</li>
            </ul>
          </div>

          {error && (
            <div className="text-rose-700 text-sm bg-rose-50 border border-rose-200 p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold p-3.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>

          <p className="text-sm text-center text-slate-500 mt-4">
            Already have an account?{" "}
            <Link to="/" className="text-indigo-600 font-semibold hover:underline hover:text-indigo-700 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;
