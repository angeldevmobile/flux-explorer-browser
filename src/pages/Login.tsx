import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import TermsOfService from "@/components/politics/Terms";
import PrivacyPolicy from "@/components/politics/Privacity";

/* ────────────────────────────────────────────
   Utilidad: fuerza de contraseña
   ──────────────────────────────────────────── */
function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Débil", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Media", color: "bg-amber-500" };
  return { score, label: "Fuerte", color: "bg-emerald-500" };
}

function getPasswordChecks(pw: string) {
  return [
    { label: "Mín. 6 caracteres", ok: pw.length >= 6 },
    { label: "Una mayúscula", ok: /[A-Z]/.test(pw) },
    { label: "Un número", ok: /[0-9]/.test(pw) },
    { label: "Un especial", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

/* ────────────────────────────────────────────
   Partículas flotantes de fondo
   ──────────────────────────────────────────── */
function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.4 + 0.1,
      })),
    []
  );

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {dots.map((d) => (
        <div
          key={d.id}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            background:
              d.id % 3 === 0
                ? "rgb(34,211,238)"
                : d.id % 3 === 1
                ? "rgb(45,212,191)"
                : "rgb(99,102,241)",
            animation: `floatParticle ${d.duration}s ${d.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatParticle {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(30px, -40px) scale(1.5); }
          100% { transform: translate(-20px, 30px) scale(0.8); }
        }
      `}</style>
    </div>
  );
}

/* ────────────────────────────────────────────
   Iconos SVG inline
   ──────────────────────────────────────────── */
const IconUser = () => (
  <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
  </svg>
);

const IconIdCard = () => (
  <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);

const IconMail = () => (
  <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.5-9.75-6.5" />
  </svg>
);

const IconLock = () => (
  <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const IconShield = () => (
  <svg className="w-4.5 h-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const IconEye = () => (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5s8.577 3.01 9.964 7.178a1.012 1.012 0 010 .639C20.577 16.49 16.64 19.5 12 19.5s-8.577-3.01-9.964-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconEyeOff = () => (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5 1.79 0 3.484-.45 4.966-1.243M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.066 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

const IconArrow = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

const IconGlobe = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 014 9 15 15 0 01-4 9 15 15 0 01-4-9 15 15 0 014-9z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const IconX = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Login
   ════════════════════════════════════════════ */
export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const strength = getPasswordStrength(password);
  const passwordChecks = getPasswordChecks(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const showEmailError = email.length > 0 && !isValidEmail;

  const isValidUsername = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const showUsernameError = username.length > 0 && !isValidUsername;

  const canSubmitRegister =
    isValidEmail &&
    isValidUsername &&
    fullName.trim().length >= 2 &&
    strength.score >= 2 &&
    passwordsMatch &&
    acceptTerms;

  const canSubmitLogin = isValidEmail && password.length >= 6;

  const handleSwitch = useCallback(() => {
    setSwitching(true);
    setTimeout(() => {
      setIsRegister((v) => !v);
      setError("");
      setFieldErrors({});
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSwitching(false);
    }, 250);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (isRegister) {
      const errors: Record<string, string> = {};
      if (!isValidUsername) errors.username = "3-20 caracteres, solo letras, números y _";
      if (fullName.trim().length < 2) errors.fullName = "Ingresa tu nombre completo";
      if (!isValidEmail) errors.email = "Ingresa un email válido";
      if (strength.score < 2) errors.password = "La contraseña es muy débil";
      if (!passwordsMatch) errors.confirmPassword = "Las contraseñas no coinciden";
      if (!acceptTerms) errors.terms = "Debes aceptar los términos";

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, username);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      type ApiError = { response?: { data?: { error?: string } } };
      if (err && typeof err === "object" && "response" in err && (err as ApiError).response?.data?.error) {
        setError((err as ApiError).response!.data!.error!);
      } else {
        setError("Error en la operación. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* Clases de input reutilizables */
  const inputBase =
    "w-full pl-11 pr-4 py-2.5 bg-white/[0.04] border rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm";
  const inputDefault = "border-white/[0.08] focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20";
  const inputError = "border-red-500/50 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20";
  const inputSuccess = "border-emerald-500/40 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20";

  const getInputClass = (hasError: boolean, hasSuccess: boolean) =>
    `${inputBase} ${hasError ? inputError : hasSuccess ? inputSuccess : inputDefault}`;

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#05080f] selection:bg-cyan-500/30">
      {/* ── Modales ── */}
      <TermsOfService open={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyPolicy open={showPrivacy} onClose={() => setShowPrivacy(false)} />

      {/* ── Fondo ── */}
      <div className="fixed inset-0 z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_20%_50%,rgba(6,182,212,0.08)_0%,transparent_50%)]" />
        <div className="absolute -top-1/2 -right-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_80%_20%,rgba(99,102,241,0.07)_0%,transparent_50%)]" />
        <div className="absolute -bottom-1/2 left-1/3 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_50%_80%,rgba(20,184,166,0.06)_0%,transparent_50%)]" />
      </div>

      <Particles />

      <div
        className="fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Card principal — ancho dinámico ── */}
      <div
        className={`relative z-10 w-full mx-4 transition-all duration-700 ease-out ${
          isRegister ? "max-w-[620px]" : "max-w-[440px]"
        } ${
          mounted
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-95"
        }`}
      >
        {/* Glow */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-teal-500/20 blur-xl opacity-60" />

        <div className="relative rounded-3xl border border-white/[0.08] bg-slate-950/70 backdrop-blur-2xl shadow-[0_0_80px_-20px_rgba(6,182,212,0.15)] overflow-hidden">
          {/* Top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-teal-400" />

          <div className="p-7 sm:p-8">
            {/* ── Logo & Header ── */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group mb-3">
                <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 opacity-20 blur-lg group-hover:opacity-40 transition-opacity duration-500 animate-pulse" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-400 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <span className="text-lg font-black text-white tracking-tighter">O</span>
                </div>
              </div>

              <div
                className={`text-center transition-all duration-300 ${
                  switching ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
              >
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {isRegister ? "Crea tu cuenta" : "Bienvenido de vuelta"}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {isRegister
                    ? "Completa tus datos para unirte a Flux"
                    : "Inicia sesión en tu navegador Flux"}
                </p>
              </div>
            </div>

            {/* ── Formulario ── */}
            <form
              onSubmit={handleSubmit}
              className={`space-y-3.5 transition-all duration-300 ${
                switching ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
              }`}
            >
              {/* ═══ Fila 1: Nombre completo + Username (registro) ═══ */}
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  isRegister ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="grid grid-cols-2 gap-3">
                  {/* Nombre completo */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                      Nombre completo
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400">
                        <IconIdCard />
                      </div>
                      <input
                        type="text"
                        placeholder="Juan Pérez"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={getInputClass(!!fieldErrors.fullName, fullName.trim().length >= 2)}
                        tabIndex={isRegister ? 0 : -1}
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-[10px] text-red-400 mt-0.5 ml-1">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  {/* Username */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                      Usuario
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400">
                        <IconUser />
                      </div>
                      <input
                        type="text"
                        placeholder="orion_user"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                        className={`${getInputClass(
                          showUsernameError || !!fieldErrors.username,
                          isValidUsername && username.length > 0
                        )} !pr-9`}
                        required={isRegister}
                        tabIndex={isRegister ? 0 : -1}
                      />
                      {username.length > 0 && isRegister && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isValidUsername ? (
                            <span className="text-emerald-400"><IconCheck /></span>
                          ) : (
                            <span className="text-red-400"><IconX /></span>
                          )}
                        </div>
                      )}
                    </div>
                    {showUsernameError && (
                      <p className="text-[10px] text-red-400 mt-0.5 ml-1">3-20: letras, números, _</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══ Email (ancho completo) ═══ */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400">
                    <IconMail />
                  </div>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${getInputClass(
                      showEmailError || !!fieldErrors.email,
                      isValidEmail && email.length > 0
                    )} !pr-9`}
                    required
                  />
                  {email.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidEmail ? (
                        <span className="text-emerald-400"><IconCheck /></span>
                      ) : (
                        <span className="text-red-400"><IconX /></span>
                      )}
                    </div>
                  )}
                </div>
                {showEmailError && (
                  <p className="text-[10px] text-red-400 mt-0.5 ml-1">Ingresa un email válido</p>
                )}
              </div>

              {/* ═══ Fila 2: Contraseña + Confirmar (registro) / Solo contraseña (login) ═══ */}
              <div className={isRegister ? "grid grid-cols-2 gap-3" : ""}>
                {/* Contraseña */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                    Contraseña
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400">
                      <IconLock />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${getInputClass(!!fieldErrors.password, false)} !pr-10`}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña (solo registro) */}
                {isRegister && (
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                      Confirmar contraseña
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400">
                        <IconShield />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`${getInputClass(
                          passwordsMismatch || !!fieldErrors.confirmPassword,
                          passwordsMatch
                        )} !pr-10`}
                        required={isRegister}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                    {passwordsMismatch && (
                      <p className="text-[10px] text-red-400 mt-0.5 ml-1 flex items-center gap-1">
                        <IconX /> No coinciden
                      </p>
                    )}
                    {passwordsMatch && (
                      <p className="text-[10px] text-emerald-400 mt-0.5 ml-1 flex items-center gap-1">
                        <IconCheck /> Coinciden
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ═══ Indicador de fuerza + requisitos ═══ */}
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                          i <= strength.score ? strength.color : "bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                      Seguridad:{" "}
                      <span
                        className={`font-medium ${
                          strength.score <= 1
                            ? "text-red-400"
                            : strength.score <= 3
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {strength.label}
                      </span>
                    </p>

                    {/* Requisitos inline (solo registro) */}
                    {isRegister && (
                      <div className="flex items-center gap-3">
                        {passwordChecks.map((check) => (
                          <span
                            key={check.label}
                            className={`text-[10px] flex items-center gap-1 ${
                              check.ok ? "text-emerald-400/80" : "text-slate-600"
                            }`}
                            title={check.label}
                          >
                            {check.ok ? <IconCheck /> : <IconX />}
                            {check.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Términos (solo registro) ═══ */}
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  isRegister ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="sr-only peer"
                      tabIndex={isRegister ? 0 : -1}
                    />
                    <div
                      className={`w-[18px] h-[18px] rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                        acceptTerms
                          ? "bg-cyan-500 border-cyan-500"
                          : fieldErrors.terms
                          ? "border-red-500/60 bg-red-500/10"
                          : "border-slate-600 bg-white/[0.04] group-hover:border-slate-500"
                      }`}
                    >
                      {acceptTerms && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    Acepto los{" "}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Términos de servicio
                    </button>{" "}
                    y la{" "}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Política de privacidad
                    </button>
                  </span>
                </label>
                {fieldErrors.terms && (
                  <p className="text-[10px] text-red-400 mt-0.5 ml-7">{fieldErrors.terms}</p>
                )}
              </div>

              {/* Error general */}
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {/* Botón submit */}
              <button
                type="submit"
                disabled={loading || (isRegister ? !canSubmitRegister : !canSubmitLogin)}
                className="relative w-full py-3 rounded-xl font-semibold text-sm text-white overflow-hidden group disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 transition-all duration-500 group-hover:scale-105 group-disabled:saturate-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <div className="absolute inset-0 rounded-xl shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow duration-300" />

                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Spinner />
                      <span>Procesando…</span>
                    </>
                  ) : (
                    <>
                      <span>{isRegister ? "Crear cuenta segura" : "Iniciar sesión"}</span>
                      <IconArrow />
                    </>
                  )}
                </span>
              </button>

              {/* Nota seguridad */}
              {isRegister && (
                <div className="flex items-center justify-center gap-1.5">
                  <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-[10px] text-slate-600">Cifrado de extremo a extremo</span>
                </div>
              )}
            </form>

            {/* ── Divisor ── */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
              <span className="text-[10px] text-slate-600 uppercase tracking-widest">o</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
            </div>

            {/* ── Toggle + continuar sin cuenta ── */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}
                <button
                  onClick={handleSwitch}
                  className="ml-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 underline-offset-4 hover:underline"
                >
                  {isRegister ? "Inicia sesión" : "Regístrate"}
                </button>
              </p>

              <button
                onClick={() => { window.location.href = "/browser"; }}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-all duration-200 group"
              >
                <IconGlobe />
                <span className="group-hover:underline underline-offset-4">Sin cuenta</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="px-7 py-3 flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-600">Flux Browser v1.0 — Conexión segura SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}