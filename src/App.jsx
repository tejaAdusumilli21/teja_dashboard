import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// ============================================================
// 🔥 STEP 1: Replace these values with your Firebase config
// Go to: https://console.firebase.google.com
// → Your Project → Project Settings → Your Apps → Web App
// ============================================================
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId: "YOUR_APP_ID",
// };
const firebaseConfig = {
  apiKey: "AIzaSyA7Uogd5ajbhSh3javgyQtg_dD369qSdDM",
  authDomain: "tejadashboard-afa75.firebaseapp.com",
  projectId: "tejadashboard-afa75",
  storageBucket: "tejadashboard-afa75.firebasestorage.app",
  messagingSenderId: "571810249669",
  appId: "1:571810249669:web:05342792054de54ef069ac"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | login | signup | home
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Login state
  const [loginMethod, setLoginMethod] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactMethod, setContactMethod] = useState("email");
  const [emailValue, setEmailValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const clearError = () => setError("");

  // ── Listen for auth state changes (auto-login on refresh) ──
  useEffect(() => {
    // Safety net: if Firebase never responds, unblock UI after 5s
    const timeout = setTimeout(() => setAuthChecked(true), 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      try {
        if (firebaseUser) {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            // Social login user — use Firebase display name
            const parts = (firebaseUser.displayName || "User").split(" ");
            setUserData({ firstName: parts[0], lastName: parts[1] || "" });
          }
          setUser(firebaseUser);
          setScreen("home");
        } else {
          setUser(null);
          setUserData(null);
          setScreen("landing");
        }
      } catch {
        // Firestore failed — fall back to Firebase user info so we don't stay stuck
        if (firebaseUser) {
          const parts = (firebaseUser.displayName || "User").split(" ");
          setUserData({ firstName: parts[0], lastName: parts[1] || "" });
          setUser(firebaseUser);
          setScreen("home");
        } else {
          setScreen("landing");
        }
      } finally {
        setAuthChecked(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // ── HANDLERS ──────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setLoading(true);
    clearError();
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) {
        // First time Google login — save to Firestore
        const parts = (u.displayName || "User").split(" ");
        await setDoc(doc(db, "users", u.uid), {
          firstName: parts[0],
          lastName: parts[1] || "",
          email: u.email,
          contactMethod: "email",
          provider: "google",
          createdAt: new Date().toISOString(),
        });
      }
      // onAuthStateChanged will handle screen change
    } catch (e) {
      setError(e.message.includes("popup-closed") ? "Sign-in cancelled." : e.message);
    }
    setLoading(false);
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    clearError();
    try {
      const provider = new OAuthProvider("apple.com");
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) {
        const parts = (u.displayName || "Apple User").split(" ");
        await setDoc(doc(db, "users", u.uid), {
          firstName: parts[0],
          lastName: parts[1] || "",
          email: u.email || "",
          contactMethod: "email",
          provider: "apple",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e.message.includes("popup-closed") ? "Sign-in cancelled." : e.message);
    }
    setLoading(false);
  };

  const handleEmailLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setError("Please fill all fields");
      return;
    }
    setLoading(true);
    clearError();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // onAuthStateChanged handles the rest
    } catch (e) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !signupPassword) {
      setError("Please fill all required fields.");
      return;
    }
    if (contactMethod === "email" && !emailValue) {
      setError("Please enter your email.");
      return;
    }
    if (contactMethod === "phone" && !phoneValue) {
      setError("Please enter your phone number.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    clearError();
    try {
      // For phone: we use phone as username with placeholder domain
      // For production phone auth, use Firebase Phone Auth with OTP
      const emailForAuth =
        contactMethod === "email"
          ? emailValue
          : `${phoneValue.replace(/\D/g, "")}@phone.teja.app`;

      const result = await createUserWithEmailAndPassword(
        auth,
        emailForAuth,
        signupPassword
      );

      // Save user profile to Firestore
      await setDoc(doc(db, "users", result.user.uid), {
        firstName,
        lastName,
        contactMethod,
        email: contactMethod === "email" ? emailValue : null,
        phone: contactMethod === "phone" ? phoneValue : null,
        provider: "email",
        createdAt: new Date().toISOString(),
      });

      // onAuthStateChanged handles screen change
    } catch (e) {
      if (e.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try logging in.");
      } else if (e.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginMethod("");
    setLoginEmail("");
    setLoginPassword("");
    setFirstName("");
    setLastName("");
    setEmailValue("");
    setPhoneValue("");
    setSignupPassword("");
  };

  // ── CSS ───────────────────────────────────────────────────

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #0a0a0f; color: #e8e6ff; min-height: 100vh; }

    .app {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(ellipse at 20% 50%, #1a0533 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, #001233 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, #0d1f0a 0%, transparent 50%),
        #0a0a0f;
      padding: 20px;
    }

    .card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 48px 44px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
      animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1);
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .logo {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 28px;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    .subtitle { font-size: 14px; color: rgba(255,255,255,0.35); margin-bottom: 40px; font-weight: 300; }

    h2 { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px; margin-bottom: 6px; color: #f0eeff; }
    .desc { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 32px; }

    .btn-primary {
      width: 100%; padding: 14px 20px; border-radius: 12px; border: none;
      font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
      cursor: pointer; transition: all 0.2s; margin-bottom: 12px; display: block;
    }
    .btn-login { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
    .btn-login:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(124,58,237,0.55); }
    .btn-signup { background: transparent; color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
    .btn-signup:hover { background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.6); }

    .social-btn {
      width: 100%; padding: 13px 20px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
      color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 14px;
      cursor: pointer; display: flex; align-items: center; gap: 12px;
      margin-bottom: 10px; transition: all 0.2s;
    }
    .social-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
    .social-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }

    .input-group { margin-bottom: 14px; }
    .label { font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; font-weight: 500; letter-spacing: 0.8px; text-transform: uppercase; display: block; }
    .input {
      width: 100%; padding: 13px 16px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
      color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 14px;
      outline: none; transition: border-color 0.2s, background 0.2s;
    }
    .input:focus { border-color: rgba(167,139,250,0.5); background: rgba(255,255,255,0.07); }
    .input::placeholder { color: rgba(255,255,255,0.22); }

    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .input-row .input { margin-bottom: 0; }

    .contact-toggle { display: flex; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .toggle-opt { flex: 1; padding: 11px; text-align: center; font-size: 13px; cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.35); border: none; background: transparent; font-family: 'DM Sans', sans-serif; }
    .toggle-opt.active { background: rgba(124,58,237,0.25); color: #a78bfa; font-weight: 500; }

    .btn-submit {
      width: 100%; padding: 14px 20px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white;
      font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
      cursor: pointer; margin-top: 8px; transition: all 0.2s;
      box-shadow: 0 8px 24px rgba(124,58,237,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(124,58,237,0.5); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    .back-btn {
      background: none; border: none; color: rgba(255,255,255,0.35); font-size: 13px;
      cursor: pointer; display: flex; align-items: center; gap: 6px; margin-bottom: 28px;
      padding: 0; transition: color 0.2s; font-family: 'DM Sans', sans-serif;
    }
    .back-btn:hover { color: rgba(255,255,255,0.7); }

    .error { color: #f87171; font-size: 13px; margin-top: 12px; text-align: center; padding: 10px; background: rgba(248,113,113,0.08); border-radius: 8px; }

    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Home */
    .home-card { text-align: center; }
    .home-header { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .logout-btn {
      padding: 9px 20px; border-radius: 10px; border: 1px solid rgba(248,113,113,0.3);
      background: rgba(248,113,113,0.08); color: #f87171; font-family: 'DM Sans', sans-serif;
      font-size: 13px; cursor: pointer; transition: all 0.2s;
    }
    .logout-btn:hover { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.5); }

    .avatar {
      width: 88px; height: 88px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 700; color: white;
      margin: 0 auto 24px;
      box-shadow: 0 16px 48px rgba(124,58,237,0.5);
    }

    .welcome-text {
      font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 800;
      background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      margin-bottom: 8px; line-height: 1.2;
    }

    .home-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 36px; }

    .info-box {
      padding: 18px 20px; background: rgba(255,255,255,0.03);
      border-radius: 14px; border: 1px solid rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.45); font-size: 13px; line-height: 1.7; text-align: left;
    }
    .info-box code { color: #a78bfa; font-size: 12px; }

    /* Splash loader */
    .splash { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0f; }
    .splash-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px; background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    @media (max-width: 480px) {
      .card { padding: 36px 24px; }
      .welcome-text { font-size: 28px; }
    }
  `;

  // ── RENDER ────────────────────────────────────────────────

  const displayFirst = userData?.firstName || user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "User";
  const displayLast  = userData?.lastName  || user?.displayName?.split(" ").slice(1).join(" ") || "";

  if (!authChecked) {
    return (
      <>
        <style>{styles}</style>
        <div className="splash"><div className="splash-logo">✦ teja</div></div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* ── LANDING ── */}
        {screen === "landing" && (
          <div className="card">
            <div className="logo">✦ teja</div>
            <div className="subtitle">Your space. Your identity.</div>
            <h2>Welcome</h2>
            <p className="desc">Sign in or create a new account to continue.</p>
            <button className="btn-primary btn-login" onClick={() => { setScreen("login"); clearError(); }}>
              Log In
            </button>
            <button className="btn-primary btn-signup" onClick={() => { setScreen("signup"); clearError(); }}>
              Create Account
            </button>
          </div>
        )}

        {/* ── LOGIN ── */}
        {screen === "login" && (
          <div className="card">
            <button className="back-btn" onClick={() => { setScreen("landing"); setLoginMethod(""); clearError(); }}>
              ← Back
            </button>
            <h2>Sign In</h2>
            <p className="desc">Choose how you'd like to continue</p>

            <button className="social-btn" onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <button className="social-btn" onClick={handleAppleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.33.07 2.24.74 3.02.78 1.16-.24 2.27-.93 3.51-.84 1.47.12 2.59.64 3.33 1.65-3.04 1.84-2.31 5.81.55 6.97-.65 1.67-1.52 3.32-2.41 4.32zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>

            {loginMethod !== "emailphone" && (
              <button className="social-btn" onClick={() => setLoginMethod("emailphone")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Continue with Email / Phone
              </button>
            )}

            {loginMethod === "emailphone" && (
              <div style={{ animation: "slideUp 0.3s ease" }}>
                <div className="divider">enter credentials</div>
                <div className="input-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailLogin()} />
                </div>
                <div className="input-group">
                  <label className="label">Password</label>
                  <input className="input" type="password" placeholder="Your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailLogin()} />
                </div>
                <button className="btn-submit" onClick={handleEmailLogin} disabled={loading}>
                  {loading && <span className="spinner" />}
                  Sign In
                </button>
              </div>
            )}

            {loading && loginMethod !== "emailphone" && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="spinner" /> Signing in...
              </p>
            )}

            {error && <div className="error">{error}</div>}
          </div>
        )}

        {/* ── SIGNUP ── */}
        {screen === "signup" && (
          <div className="card">
            <button className="back-btn" onClick={() => { setScreen("landing"); clearError(); }}>
              ← Back
            </button>
            <h2>Create Account</h2>
            <p className="desc">Fill in your details to get started</p>

            <div className="input-row">
              <div>
                <label className="label">First Name</label>
                <input className="input" placeholder="Jane" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <label className="label" style={{ marginBottom: 8 }}>Contact Method</label>
            <div className="contact-toggle">
              <button className={`toggle-opt ${contactMethod === "email" ? "active" : ""}`} onClick={() => setContactMethod("email")}>
                ✉ Email
              </button>
              <button className={`toggle-opt ${contactMethod === "phone" ? "active" : ""}`} onClick={() => setContactMethod("phone")}>
                📱 Phone
              </button>
            </div>

            <div className="input-group">
              {contactMethod === "email" ? (
                <>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" placeholder="you@example.com" value={emailValue} onChange={e => setEmailValue(e.target.value)} />
                </>
              ) : (
                <>
                  <label className="label">Phone Number</label>
                  <input className="input" type="tel" placeholder="+91 98765 43210" value={phoneValue} onChange={e => setPhoneValue(e.target.value)} />
                </>
              )}
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="At least 6 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()} />
            </div>

            <button className="btn-submit" onClick={handleSignup} disabled={loading}>
              {loading && <span className="spinner" />}
              Create Account
            </button>

            {error && <div className="error">{error}</div>}
          </div>
        )}

        {/* ── HOME ── */}
        {screen === "home" && (
          <div className="card home-card">
            <div className="home-header">
              <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
            </div>
            <div className="avatar">
              {displayFirst[0]?.toUpperCase() || "U"}
            </div>
            <div className="welcome-text">
              Welcome,<br />{displayFirst}!
            </div>
            <p className="home-sub">
              {displayFirst} {displayLast} · You're all set ✓
            </p>
            <div className="info-box">
              🔥 Firebase is active. Your profile is saved in Firestore at <code>users/{user?.uid?.slice(0, 8)}…</code>
              <br />Refresh the page — you'll stay logged in automatically.
            </div>
          </div>
        )}

      </div>
    </>
  );
}
