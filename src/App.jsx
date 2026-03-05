import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, query, where, getDocs, orderBy,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

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
  const [screen, setScreen] = useState("landing");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("home");

  // ── Kanban state ──
  const [kanbanBoards, setKanbanBoards]     = useState([]);
  const [boardsLoaded, setBoardsLoaded]     = useState(false);
  const [kanbanBoard, setKanbanBoard]       = useState(null);
  const [tasks, setTasks]                   = useState([]);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [pendingBoardType, setPendingBoardType] = useState(null);
  const [boardNameInput, setBoardNameInput]     = useState("");
  const [showAddTask, setShowAddTask]       = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle]     = useState("");
  const [newTaskDesc, setNewTaskDesc]       = useState("");
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskEndDate, setNewTaskEndDate]     = useState("");
  const [newTaskStatus, setNewTaskStatus]       = useState("todo");
  const [shareEmail, setShareEmail]         = useState("");
  const [shareError, setShareError]         = useState("");
  const [shareMembers, setShareMembers]     = useState([]);
  const [uidCopied, setUidCopied]           = useState(false);
  const [dragTaskId, setDragTaskId]         = useState(null);
  const [dragOverCol, setDragOverCol]       = useState(null);
  const [kanbanLoading, setKanbanLoading]   = useState(false);
  const [selectedTask, setSelectedTask]     = useState(null);
  const [editTaskTitle, setEditTaskTitle]   = useState("");
  const [editTaskDesc, setEditTaskDesc]     = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState("todo");
  const [editTaskStart, setEditTaskStart]   = useState("");
  const [editTaskEnd, setEditTaskEnd]       = useState("");
  const [addTaskError, setAddTaskError]     = useState("");
  const [editTaskError, setEditTaskError]   = useState("");
  const [overdueTasks, setOverdueTasks]     = useState([]);
  const [notifOpen, setNotifOpen]           = useState(false);

  // ── Notes state ──
  const [notes, setNotes]             = useState([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [activeNote, setActiveNote]   = useState(null);
  const [noteTitle, setNoteTitle]     = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSearch, setNoteSearch]     = useState("");
  const [noteSaving, setNoteSaving]     = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteError, setNoteError]       = useState("");
  const activeNoteRef  = useRef(null);
  const isSavingRef    = useRef(false);

  // ── Theme / Settings state ──
  const [theme, setTheme]           = useState(() => localStorage.getItem("app_theme") || "dark");
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem("app_accent") || "purple");

  // Login state
  const [loginMethod, setLoginMethod] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const clearError = () => setError("");

  // ── KANBAN HELPERS (Firestore) ─────────────────────────────

  const initBoard = async (type, customName) => {
    setKanbanLoading(true);
    try {
      const boardName = customName?.trim() || (type === "individual"
        ? `${displayFirst}'s Kanban Board`
        : `${displayFirst}'s Shared Board`);
      const ref = await addDoc(collection(db, "boards"), {
        ownerId: user.uid,
        ownerEmail: user.email,
        type,
        boardName,
        memberIds: [],
        memberEmails: [],
        createdAt: serverTimestamp(),
      });
      const board = { id: ref.id, ownerId: user.uid, ownerEmail: user.email, type, boardName, memberIds: [], memberEmails: [] };
      setKanbanBoards(prev => [...prev, board]);
      setKanbanBoard(board);
      setShareMembers([]);
      setTasks([]);
      setShowBoardModal(false);
      setPendingBoardType(null);
      setBoardNameInput("");
    } catch (e) {
      setError("Failed to create board: " + e.message);
    }
    setKanbanLoading(false);
  };

  const loadBoards = async () => {
    setKanbanLoading(true);
    try {
      const ownedSnap = await getDocs(query(collection(db, "boards"), where("ownerId", "==", user.uid)));
      const sharedSnap = await getDocs(query(collection(db, "boards"), where("memberIds", "array-contains", user.uid)));
      const seen = new Set();
      const boards = [];
      [...ownedSnap.docs, ...sharedSnap.docs].forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); boards.push({ id: d.id, ...d.data() }); }
      });
      setKanbanBoards(boards);
      setBoardsLoaded(true);
      // Fetch overdue tasks across all boards (background)
      const today = new Date().toISOString().split("T")[0];
      const allOverdue = [];
      await Promise.all(boards.map(async (board) => {
        try {
          const tSnap = await getDocs(collection(db, "boards", board.id, "tasks"));
          tSnap.docs.forEach(d => {
            const t = { id: d.id, boardId: board.id, boardName: board.name, ...d.data() };
            if (t.status !== "done" && t.endDate && t.endDate < today) allOverdue.push(t);
          });
        } catch (_) {}
      }));
      setOverdueTasks(allOverdue);
    } catch (e) {
      setError("Failed to load boards: " + e.message);
    }
    setKanbanLoading(false);
  };

  const openBoard = async (board) => {
    setKanbanLoading(true);
    try {
      const snap = await getDocs(collection(db, "boards", board.id, "tasks"));
      const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(tasks);
      setKanbanBoard(board);
      setShareMembers(board.memberEmails || []);
    } catch (e) {
      setError("Failed to open board: " + e.message);
    }
    setKanbanLoading(false);
  };

  const addMember = async (input) => {
    if (!input || !kanbanBoard) return;
    setKanbanLoading(true);
    setShareError("");
    const trimmed = input.trim();
    try {
      let memberId = null;
      let memberEmail = null;

      if (trimmed.includes("@")) {
        // Search by email
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", trimmed)));
        if (snap.empty) { setShareError("No user found with that email."); setKanbanLoading(false); return; }
        memberId = snap.docs[0].id;
        memberEmail = trimmed;
      } else {
        // Search by User ID — direct document lookup
        const userSnap = await getDoc(doc(db, "users", trimmed));
        if (!userSnap.exists()) { setShareError("No user found with that User ID."); setKanbanLoading(false); return; }
        memberId = trimmed;
        memberEmail = userSnap.data().email || trimmed;
      }

      if (memberId === user.uid) { setShareError("You can't add yourself."); setKanbanLoading(false); return; }

      await updateDoc(doc(db, "boards", kanbanBoard.id), {
        memberIds: arrayUnion(memberId),
        memberEmails: arrayUnion(memberEmail),
      });
      setShareMembers(prev => [...prev, memberEmail]);
      setShareEmail("");
      setShowShareModal(false);
    } catch (e) {
      setShareError("Failed to add member: " + e.message);
    }
    setKanbanLoading(false);
  };

  // Returns error string or "" if valid
  const validateTaskDates = (start, end) => {
    const isReal = (str) => {
      if (!str) return true;
      const d = new Date(str + "T00:00:00");
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
    };
    if (!isReal(start)) return "Invalid start date (e.g. Feb 31 doesn't exist).";
    if (!isReal(end))   return "Invalid end date (e.g. Feb 31 doesn't exist).";
    if (start && end && start > end) return "Start date must be on or before end date.";
    return "";
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !kanbanBoard) return;
    const dateErr = validateTaskDates(newTaskStartDate, newTaskEndDate);
    if (dateErr) { setAddTaskError(dateErr); return; }
    setAddTaskError("");
    setKanbanLoading(true);
    try {
      const ref = await addDoc(collection(db, "boards", kanbanBoard.id, "tasks"), {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        status: newTaskStatus || "todo",
        startDate: newTaskStartDate,
        endDate: newTaskEndDate,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      });
      setTasks(prev => [...prev, {
        id: ref.id,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        status: newTaskStatus || "todo",
        startDate: newTaskStartDate,
        endDate: newTaskEndDate,
        createdBy: user.email,
      }]);
      setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskStartDate(""); setNewTaskEndDate(""); setNewTaskStatus("todo"); setShowAddTask(false);
    } catch (e) {
      setError("Failed to add task: " + e.message);
    }
    setKanbanLoading(false);
  };

  const handleDrop = async (column) => {
    if (!dragTaskId || !kanbanBoard) return;
    const task = tasks.find(t => t.id === dragTaskId);
    if (!task || task.status === column) { setDragTaskId(null); setDragOverCol(null); return; }
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: column } : t));
    setDragTaskId(null); setDragOverCol(null);
    try {
      await updateDoc(doc(db, "boards", kanbanBoard.id, "tasks", task.id), { status: column });
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      setError("Failed to move task: " + e.message);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!kanbanBoard) return;
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      await deleteDoc(doc(db, "boards", kanbanBoard.id, "tasks", task.id));
    } catch (e) {
      setError("Failed to delete task: " + e.message);
      const snap = await getDocs(collection(db, "boards", kanbanBoard.id, "tasks"));
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setEditTaskTitle(task.title || "");
    setEditTaskDesc(task.description || "");
    setEditTaskStatus(task.status || "todo");
    setEditTaskStart(task.startDate || "");
    setEditTaskEnd(task.endDate || "");
  };

  const handleUpdateTask = async () => {
    if (!selectedTask || !kanbanBoard) return;
    const dateErr = validateTaskDates(editTaskStart, editTaskEnd);
    if (dateErr) { setEditTaskError(dateErr); return; }
    setEditTaskError("");
    setKanbanLoading(true);
    const updated = {
      title: editTaskTitle.trim(),
      description: editTaskDesc.trim(),
      status: editTaskStatus,
      startDate: editTaskStart,
      endDate: editTaskEnd,
    };
    try {
      await updateDoc(doc(db, "boards", kanbanBoard.id, "tasks", selectedTask.id), updated);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updated } : t));
      setSelectedTask(null);
    } catch (e) {
      setError("Failed to update task: " + e.message);
    }
    setKanbanLoading(false);
  };

  // ── NOTES HELPERS (Firestore) ──────────────────────────────

  const noteErrMsg = (e) => {
    if (e?.code === "permission-denied" || e?.message?.includes("permission"))
      return "FIRESTORE_RULES";
    return e?.message || "Unknown error";
  };

  const loadNotes = async () => {
    if (!user) return;
    setNoteError("");
    try {
      let snap;
      try {
        snap = await getDocs(query(collection(db, "notes"), where("uid", "==", user.uid), orderBy("updatedAt", "desc")));
      } catch {
        snap = await getDocs(query(collection(db, "notes"), where("uid", "==", user.uid)));
      }
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setNoteError(noteErrMsg(e));
    } finally {
      setNotesLoaded(true);
    }
  };

  const saveNote = async (id, title, content) => {
    if (!user || isSavingRef.current) return;
    isSavingRef.current = true;
    setNoteSaving(true);
    setNoteError("");
    try {
      const now = serverTimestamp();
      if (id) {
        await updateDoc(doc(db, "notes", id), { title: title || "Untitled", content, updatedAt: now });
        const saved = { ...activeNoteRef.current, title: title || "Untitled", content };
        setActiveNote(saved);
        activeNoteRef.current = saved;
        setNotes(prev => prev.map(n => n.id === id ? { ...n, title: title || "Untitled", content } : n));
      } else {
        const ref = await addDoc(collection(db, "notes"), {
          uid: user.uid, title: title || "Untitled", content, createdAt: now, updatedAt: now,
        });
        const newNote = { id: ref.id, uid: user.uid, title: title || "Untitled", content };
        setNotes(prev => [newNote, ...prev]);
        setActiveNote(newNote);
        activeNoteRef.current = newNote;
      }
    } catch (e) {
      setNoteError(noteErrMsg(e));
    } finally {
      setNoteSaving(false);
      isSavingRef.current = false;
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await deleteDoc(doc(db, "notes", noteId));
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (activeNoteRef.current?.id === noteId) {
        setActiveNote(null); activeNoteRef.current = null;
        setNoteTitle(""); setNoteContent(""); setNoteEditorOpen(false);
      }
    } catch (e) { setNoteError(noteErrMsg(e)); }
  };

  const openNote = (note) => {
    activeNoteRef.current = note;
    setActiveNote(note);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
    setNoteEditorOpen(true);
  };

  const startNewNote = () => {
    activeNoteRef.current = null;
    setActiveNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteEditorOpen(true);
  };

  // ── Close profile dropdown on outside click ──
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (!e.target.closest(".profile-wrap")) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // ── Close notification dropdown on outside click ──
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (!e.target.closest(".notif-wrap")) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // ── Listen for auth state changes (auto-login on refresh) ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const parts = (firebaseUser.displayName || "User").split(" ");
        setUserData({ firstName: parts[0], lastName: parts[1] || "" });
        setUser(firebaseUser);
        setScreen("home");
        setAuthChecked(true);
        // Fetch full profile in background; create doc if missing (e.g. Google login)
        getDoc(doc(db, "users", firebaseUser.uid)).then(snap => {
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            const parts = (firebaseUser.displayName || "User").split(" ");
            const newData = {
              firstName: parts[0], lastName: parts[1] || "",
              email: firebaseUser.email || "", contactMethod: "email",
              provider: firebaseUser.providerData?.[0]?.providerId || "unknown",
              createdAt: new Date().toISOString(),
            };
            setDoc(doc(db, "users", firebaseUser.uid), newData).catch(() => {});
            setUserData(newData);
          }
        }).catch(() => {});
      } else {
        setUser(null);
        setUserData(null);
        setScreen("landing");
        setAuthChecked(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Kanban: load board when panel opens ──
  useEffect(() => {
    if (activePanel === "kanban" && user && !boardsLoaded) {
      loadBoards();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  // ── Notes: load when panel opens ──
  useEffect(() => {
    if (activePanel === "notes" && user && !notesLoaded) loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  // ── Notes: auto-save (new + existing) after 1.5s idle ──
  useEffect(() => {
    if (activePanel !== "notes" || !noteEditorOpen) return;
    if (!noteTitle.trim() && !noteContent.trim()) return;
    const timer = setTimeout(() => {
      const current = activeNoteRef.current;
      // Skip if nothing changed on existing note
      if (current?.id && current.title === noteTitle && current.content === noteContent) return;
      saveNote(current?.id || null, noteTitle, noteContent);
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTitle, noteContent, activePanel, noteEditorOpen]);

  // ── Theme: apply class to body ──
  useEffect(() => {
    document.body.className = theme === "light" ? "theme-light" : "";
    localStorage.setItem("app_theme", theme);
    localStorage.setItem("app_accent", accentColor);
  }, [theme, accentColor]);

  // ── HANDLERS ──────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setLoading(true); clearError();
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) {
        const parts = (u.displayName || "User").split(" ");
        await setDoc(doc(db, "users", u.uid), {
          firstName: parts[0], lastName: parts[1] || "",
          email: u.email, contactMethod: "email", provider: "google",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e.message.includes("popup-closed") ? "Sign-in cancelled." : e.message);
    }
    setLoading(false);
  };


  const handleEmailLogin = async () => {
    if (!loginEmail || !loginPassword) { setError("Please fill all fields"); return; }
    setLoading(true); clearError();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (e) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !signupPassword) { setError("Please fill all required fields."); return; }
    if (!emailValue) { setError("Please enter your email."); return; }
    if (signupPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); clearError();
    try {
      const result = await createUserWithEmailAndPassword(auth, emailValue, signupPassword);
      await setDoc(doc(db, "users", result.user.uid), {
        firstName, lastName, contactMethod: "email",
        email: emailValue,
        provider: "email", createdAt: new Date().toISOString(),
      });
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setError("This email is already registered. Try logging in.");
      else if (e.code === "auth/invalid-email") setError("Please enter a valid email address.");
      else setError(e.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setProfileOpen(false);
    setActivePanel("home");
    setKanbanBoards([]); setBoardsLoaded(false);
    setKanbanBoard(null); setTasks([]);
    setShowBoardModal(false);
    setNotes([]); setNotesLoaded(false); setNoteError("");
    setActiveNote(null); activeNoteRef.current = null;
    setNoteTitle(""); setNoteContent(""); setNoteEditorOpen(false);
    setLoginMethod(""); setLoginEmail(""); setLoginPassword("");
    setFirstName(""); setLastName(""); setEmailValue(""); setSignupPassword("");
  };

  // ── CSS ───────────────────────────────────────────────────

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #0a0a0f; color: #e8e6ff; min-height: 100vh; }

    /* ── AUTH SCREENS ── */
    .app {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background:
        radial-gradient(ellipse at 20% 50%, #1a0533 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, #001233 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, #0d1f0a 0%, transparent 50%),
        #0a0a0f;
      padding: 20px;
    }
    .card {
      background: rgba(255,255,255,0.04); backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
      padding: 48px 44px; width: 100%; max-width: 440px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
      animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

    .logo {
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 28px; letter-spacing: -1px;
      background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      margin-bottom: 8px;
    }
    .subtitle { font-size: 14px; color: rgba(255,255,255,0.35); margin-bottom: 40px; font-weight: 300; }
    h2 { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px; margin-bottom: 6px; color: #f0eeff; }
    .desc { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 32px; }

    .btn-primary { width: 100%; padding: 14px 20px; border-radius: 12px; border: none; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; display: block; }
    .btn-login { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
    .btn-login:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(124,58,237,0.55); }
    .btn-signup { background: transparent; color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
    .btn-signup:hover { background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.6); }

    .social-btn { width: 100%; padding: 13px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 10px; transition: all 0.2s; }
    .social-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
    .social-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }

    .input-group { margin-bottom: 14px; }
    .label { font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; font-weight: 500; letter-spacing: 0.8px; text-transform: uppercase; display: block; }
    .input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s, background 0.2s; }
    .input:focus { border-color: rgba(167,139,250,0.5); background: rgba(255,255,255,0.07); }
    .input::placeholder { color: rgba(255,255,255,0.22); }

    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .contact-toggle { display: flex; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .toggle-opt { flex: 1; padding: 11px; text-align: center; font-size: 13px; cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.35); border: none; background: transparent; font-family: 'DM Sans', sans-serif; }
    .toggle-opt.active { background: rgba(124,58,237,0.25); color: #a78bfa; font-weight: 500; }

    .btn-submit { width: 100%; padding: 14px 20px; border-radius: 12px; border: none; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; margin-top: 8px; transition: all 0.2s; box-shadow: 0 8px 24px rgba(124,58,237,0.35); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(124,58,237,0.5); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    .back-btn { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin-bottom: 28px; padding: 0; transition: color 0.2s; font-family: 'DM Sans', sans-serif; }
    .back-btn:hover { color: rgba(255,255,255,0.7); }
    .error { color: #f87171; font-size: 13px; margin-top: 12px; text-align: center; padding: 10px; background: rgba(248,113,113,0.08); border-radius: 8px; }
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── SPLASH ── */
    .splash { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0f; }
    .splash-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px; background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* ── DASHBOARD LAYOUT ── */
    .dashboard {
      min-height: 100vh;
      background:
        radial-gradient(ellipse at 20% 50%, #1a0533 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, #001233 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, #0d1f0a 0%, transparent 50%),
        #0a0a0f;
    }

    /* Header */
    .dash-header {
      height: 60px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; background: rgba(255,255,255,0.03); backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    }
    .dash-logo {
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.5px;
      background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    /* Bell / notification */
    .notif-wrap { position: relative; }
    .notif-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.6);
    }
    .notif-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .notif-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      min-width: 16px; height: 16px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; padding: 0 3px;
      pointer-events: none;
    }
    .notif-dropdown {
      position: absolute; top: calc(100% + 10px); right: 0;
      background: rgba(11,9,22,0.97); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; width: 300px; max-height: 380px; overflow-y: auto;
      z-index: 200; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .notif-header { padding: 13px 16px; font-size: 13px; font-weight: 600; color: #f0eeff; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .notif-item { padding: 11px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: default; }
    .notif-item:last-child { border-bottom: none; }
    .notif-item-title { font-size: 13px; color: #e8e6ff; font-weight: 500; }
    .notif-item-meta { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; }
    .notif-empty { padding: 22px 16px; text-align: center; font-size: 13px; color: rgba(255,255,255,0.3); }

    /* Profile avatar + dropdown */
    .profile-wrap { position: relative; }
    .profile-btn {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: white;
      cursor: pointer; border: 2px solid rgba(167,139,250,0.3); transition: all 0.2s; user-select: none;
    }
    .profile-btn:hover { border-color: rgba(167,139,250,0.75); box-shadow: 0 0 18px rgba(124,58,237,0.45); }
    .profile-dropdown {
      position: absolute; top: 50px; right: 0;
      background: rgba(11,9,22,0.97); backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
      padding: 8px; min-width: 210px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      animation: dropIn 0.15s cubic-bezier(0.16,1,0.3,1);
      z-index: 200;
    }
    @keyframes dropIn { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .profile-info { padding: 12px 14px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 6px; }
    .profile-name { font-weight: 600; font-size: 14px; color: #f0eeff; }
    .profile-email { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 182px; }
    .dd-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: 10px; cursor: pointer; font-size: 14px; color: rgba(255,255,255,0.65);
      transition: all 0.15s; border: none; background: none; width: 100%;
      text-align: left; font-family: 'DM Sans', sans-serif;
    }
    .dd-item:hover { background: rgba(255,255,255,0.07); color: #f0eeff; }
    .dd-item.danger { color: #f87171; }
    .dd-item.danger:hover { background: rgba(248,113,113,0.1); color: #fca5a5; }
    .dd-sep { height: 1px; background: rgba(255,255,255,0.07); margin: 6px 0; }

    /* Sidebar */
    .dash-body { display: flex; margin-top: 60px; min-height: calc(100vh - 60px); }
    .sidebar {
      width: 64px; background: rgba(255,255,255,0.02);
      border-right: 1px solid rgba(255,255,255,0.05);
      display: flex; flex-direction: column; align-items: center;
      padding: 16px 0; gap: 6px;
      position: fixed; left: 0; top: 60px; bottom: 0; z-index: 50;
    }
    .sb-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.35);
      border: none; background: none; position: relative;
    }
    .sb-icon:hover { background: rgba(124,58,237,0.15); color: rgba(167,139,250,0.8); }
    .sb-icon.active { background: rgba(124,58,237,0.25); color: #a78bfa; }
    .sb-icon .tip {
      position: absolute; left: 54px;
      background: rgba(11,9,22,0.97); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 5px 10px;
      font-size: 12px; color: #e8e6ff; white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity 0.15s; z-index: 300;
    }
    .sb-icon:hover .tip { opacity: 1; }

    /* Main content area */
    .dash-main {
      margin-left: 64px; flex: 1; padding: 48px 40px;
      display: flex; align-items: center; justify-content: center;
    }

    /* Home content card */
    .home-content { text-align: center; width: 100%; max-width: 440px; }
    .big-avatar {
      width: 96px; height: 96px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-size: 38px; font-weight: 700; color: white;
      margin: 0 auto 28px;
      box-shadow: 0 20px 56px rgba(124,58,237,0.5);
    }
    .welcome-text {
      font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800;
      background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      margin-bottom: 10px; line-height: 1.2;
    }
    .home-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 36px; }
    .info-box {
      padding: 18px 20px; background: rgba(255,255,255,0.03);
      border-radius: 14px; border: 1px solid rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.45); font-size: 13px; line-height: 1.7; text-align: left;
    }
    .info-box code { color: #a78bfa; font-size: 12px; }

    /* Profile Panel */
    .profile-panel { max-width: 540px; width: 100%; }
    .pp-avatar {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 600; color: white;
      margin-bottom: 16px; border: 2px solid rgba(167,139,250,0.3);
    }
    .pp-name { font-size: 22px; font-weight: 600; color: #f0eeff; margin-bottom: 28px; }
    .pp-fields { width: 100%; display: flex; flex-direction: column; gap: 2px; }
    .pp-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-radius: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .pp-row:last-child { border-bottom: none; }
    .pp-row:hover { background: rgba(255,255,255,0.03); }
    .pp-label { font-size: 13px; color: rgba(255,255,255,0.4); min-width: 140px; }
    .pp-value { font-size: 14px; color: #e8e6ff; text-align: right; }
    .pp-mono { font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.5); word-break: break-all; }
    .pp-badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; background: rgba(255,255,255,0.07); }
    .pp-green { background: rgba(52,211,153,0.15); color: #6ee7b7; }
    .pp-yellow { background: rgba(251,191,36,0.15); color: #fcd34d; }

    @media (max-width: 640px) {
      .dash-main { padding: 24px 16px; }
      .welcome-text { font-size: 28px; }
    }

    /* ── KANBAN ── */
    .kanban-panel { flex: 1; padding: 32px; display: flex; flex-direction: column; min-height: calc(100vh - 60px); overflow: hidden; margin-left: 64px; }
    .kanban-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-shrink: 0; }
    .kanban-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #f0eeff; }
    .kanban-actions { display: flex; gap: 10px; }
    .kb-btn { padding: 9px 18px; border-radius: 10px; border: none; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .kb-btn-primary { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; box-shadow: 0 4px 14px rgba(124,58,237,0.35); }
    .kb-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,0.5); }
    .kb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .kb-btn-secondary { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.1); }
    .kb-btn-secondary:hover { background: rgba(255,255,255,0.1); color: #f0eeff; }

    .kanban-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; flex: 1; overflow: hidden; }
    .kanban-col { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; overflow: hidden; transition: border-color 0.15s, background 0.15s; }
    .kanban-col.drag-over { border-color: rgba(124,58,237,0.5); background: rgba(124,58,237,0.06); }
    .kanban-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-shrink: 0; }
    .kanban-col-title { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.7px; }
    .col-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }
    .col-cards { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; }

    .task-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; cursor: grab; transition: all 0.15s; position: relative; }
    .task-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }
    .task-card.dragging { opacity: 0.4; cursor: grabbing; }
    .task-card-title { font-size: 14px; font-weight: 500; color: #e8e6ff; margin-bottom: 4px; padding-right: 22px; }
    .task-card-desc { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
    .task-card-dates { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; }
    .task-delete { position: absolute; top: 10px; right: 10px; background: none; border: none; color: rgba(255,255,255,0.2); font-size: 18px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.15s; }
    .task-delete:hover { color: #f87171; }

    .board-type-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px; backdrop-filter: blur(4px); }
    .btm-inner { background: rgba(11,9,22,0.97); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px 36px; max-width: 520px; width: 100%; }
    .btm-title { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; color: #f0eeff; text-align: center; margin-bottom: 8px; }
    .btm-sub { font-size: 14px; color: rgba(255,255,255,0.35); text-align: center; margin-bottom: 32px; }
    .btm-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .bt-option { padding: 28px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); cursor: pointer; text-align: center; transition: all 0.2s; }
    .bt-option:hover { background: rgba(124,58,237,0.12); border-color: rgba(124,58,237,0.4); transform: translateY(-2px); }
    .bt-icon { font-size: 32px; margin-bottom: 12px; }
    .bt-label { font-size: 16px; font-weight: 600; color: #f0eeff; margin-bottom: 6px; }
    .bt-desc { font-size: 13px; color: rgba(255,255,255,0.35); line-height: 1.5; }

    .overlay-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px; backdrop-filter: blur(4px); }
    .overlay-inner { background: rgba(11,9,22,0.97); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 440px; }
    .overlay-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #f0eeff; margin-bottom: 22px; }
    .overlay-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }

    .member-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .member-chip { padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 8px; }
    .member-chip-owner { color: #a78bfa; font-size: 11px; margin-left: auto; }
    .kb-loading { display: flex; align-items: center; justify-content: center; flex: 1; color: rgba(255,255,255,0.35); font-size: 14px; gap: 10px; }

    /* Boards list */
    .boards-list-view { display: flex; flex-direction: column; flex: 1; }
    .boards-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .boards-empty { color: rgba(255,255,255,0.25); font-size: 14px; text-align: center; margin-top: 60px; }
    .boards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .board-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 22px 20px; cursor: pointer; transition: all 0.18s; display: flex; flex-direction: column; gap: 8px; }
    .board-card:hover { background: rgba(124,58,237,0.12); border-color: rgba(124,58,237,0.4); transform: translateY(-2px); }
    .board-card-icon { color: #7c3aed; margin-bottom: 4px; }
    .board-card-name { font-size: 15px; font-weight: 600; color: #e8e6ff; }
    .board-card-meta { font-size: 12px; color: rgba(255,255,255,0.3); }

    /* ── NOTES PANEL ── */
    .notes-panel { display: flex; flex: 1; height: calc(100vh - 60px); overflow: hidden; margin-left: 64px; }

    /* Notes list sidebar */
    .notes-list-col {
      width: 280px; min-width: 220px; border-right: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column; background: rgba(255,255,255,0.015); overflow: hidden;
    }
    .notes-list-header {
      padding: 20px 16px 12px; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    .notes-list-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #f0eeff; }
    .notes-add-btn {
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      font-size: 18px; line-height: 1; transition: all 0.2s;
    }
    .notes-add-btn:hover { transform: scale(1.08); box-shadow: 0 4px 14px rgba(124,58,237,0.45); }
    .notes-search {
      padding: 10px 16px; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .notes-search input {
      width: 100%; padding: 8px 12px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
      color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    }
    .notes-search input::placeholder { color: rgba(255,255,255,0.25); }
    .notes-search input:focus { border-color: rgba(167,139,250,0.4); background: rgba(255,255,255,0.06); }
    .notes-list { flex: 1; overflow-y: auto; padding: 8px 8px; display: flex; flex-direction: column; gap: 2px; }
    .note-item {
      padding: 11px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; position: relative;
      border: 1px solid transparent;
    }
    .note-item:hover { background: rgba(255,255,255,0.05); }
    .note-item.active { background: rgba(124,58,237,0.15); border-color: rgba(124,58,237,0.35); }
    .note-item-title { font-size: 14px; font-weight: 500; color: #e8e6ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
    .note-item-preview { font-size: 12px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .note-item-date { font-size: 11px; color: rgba(255,255,255,0.22); margin-top: 4px; }
    .note-delete-btn {
      position: absolute; top: 10px; right: 8px; width: 22px; height: 22px;
      border: none; background: rgba(248,113,113,0.12); border-radius: 6px; color: #f87171;
      font-size: 13px; cursor: pointer; display: none; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .note-item:hover .note-delete-btn { display: flex; }
    .note-delete-btn:hover { background: rgba(248,113,113,0.25); }
    .notes-empty { padding: 40px 16px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; }
    .notes-err-banner {
      margin: 12px; padding: 12px 14px; border-radius: 10px;
      background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3);
      font-size: 12px; color: #fca5a5; line-height: 1.6;
    }
    .notes-err-banner code {
      display: block; margin-top: 8px; padding: 8px 10px;
      background: rgba(0,0,0,0.35); border-radius: 6px;
      font-size: 11px; color: #86efac; white-space: pre; overflow-x: auto;
    }
    .notes-err-banner a { color: #93c5fd; text-underline-offset: 2px; }

    /* Notes editor */
    .notes-editor-col { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .notes-editor-header {
      padding: 16px 28px 0; display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .notes-save-indicator { font-size: 12px; color: rgba(255,255,255,0.25); display: flex; align-items: center; gap: 6px; }
    .notes-editor-title {
      width: 100%; padding: 20px 28px 10px; background: none; border: none; outline: none;
      font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; color: #f0eeff;
      resize: none; line-height: 1.2;
    }
    .notes-editor-title::placeholder { color: rgba(255,255,255,0.15); }
    .notes-editor-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 0 28px; flex-shrink: 0; }
    .notes-editor-body {
      flex: 1; padding: 16px 28px 28px; outline: none; border: none; background: none;
      font-family: 'DM Sans', sans-serif; font-size: 15px; color: rgba(255,255,255,0.8);
      line-height: 1.75; resize: none; overflow-y: auto;
    }
    .notes-editor-body::placeholder { color: rgba(255,255,255,0.18); }
    .notes-empty-editor {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.2); gap: 12px;
    }
    .notes-empty-editor svg { opacity: 0.25; }
    .notes-empty-editor p { font-size: 14px; }
    .notes-create-btn {
      margin-top: 16px; padding: 10px 22px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white;
      font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(124,58,237,0.35);
    }
    .notes-create-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,0.5); }
    .notes-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── SETTINGS PANEL ── */
    .settings-panel { max-width: 560px; width: 100%; }
    .settings-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #f0eeff; margin-bottom: 32px; }
    .settings-section { margin-bottom: 32px; }
    .settings-section-label { font-size: 11px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; margin-bottom: 12px; }
    .theme-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .theme-option {
      padding: 16px 14px; border-radius: 14px; cursor: pointer; transition: all 0.2s;
      border: 2px solid transparent; display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .theme-option.selected { border-color: #a78bfa; background: rgba(124,58,237,0.12); }
    .theme-option:not(.selected) { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); }
    .theme-option:not(.selected):hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); }
    .theme-preview {
      width: 52px; height: 36px; border-radius: 8px; overflow: hidden; display: flex; gap: 2px; padding: 4px;
    }
    .theme-preview-dark { background: #0a0a0f; border: 1px solid rgba(255,255,255,0.12); }
    .theme-preview-light { background: #f0f0f5; border: 1px solid rgba(0,0,0,0.12); }
    .theme-preview-bar { height: 100%; border-radius: 3px; flex: 1; }
    .theme-option-name { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 500; }
    .accent-options { display: flex; gap: 12px; flex-wrap: wrap; }
    .accent-swatch {
      width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: all 0.2s;
      border: 3px solid transparent; display: flex; align-items: center; justify-content: center;
    }
    .accent-swatch.selected { border-color: white; box-shadow: 0 0 0 2px rgba(255,255,255,0.3); transform: scale(1.12); }
    .accent-swatch:not(.selected):hover { transform: scale(1.08); }

    /* ── LIGHT THEME OVERRIDES ── */
    body.theme-light { background: #f0f0f5; color: #1a1a2e; }
    body.theme-light .dashboard {
      background: radial-gradient(ellipse at 20% 50%, #ede8ff 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, #e0eaff 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, #e0fff0 0%, transparent 50%), #f0f0f5;
    }
    body.theme-light .dash-header { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.08); }
    body.theme-light .dash-logo { background: linear-gradient(135deg,#7c3aed,#4f46e5,#059669); -webkit-background-clip: text; background-clip: text; }
    body.theme-light .sidebar { background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.08); }
    body.theme-light .sb-icon { color: rgba(0,0,0,0.4); }
    body.theme-light .sb-icon:hover { background: rgba(124,58,237,0.1); color: #7c3aed; }
    body.theme-light .sb-icon.active { background: rgba(124,58,237,0.15); color: #7c3aed; }
    body.theme-light .sb-icon .tip { background: rgba(255,255,255,0.97); border-color: rgba(0,0,0,0.1); color: #1a1a2e; }
    body.theme-light .profile-btn { border-color: rgba(124,58,237,0.3); }
    body.theme-light .profile-dropdown { background: rgba(255,255,255,0.97); border-color: rgba(0,0,0,0.1); }
    body.theme-light .profile-name { color: #1a1a2e; }
    body.theme-light .profile-email { color: rgba(0,0,0,0.45); }
    body.theme-light .dd-item { color: rgba(0,0,0,0.6); }
    body.theme-light .dd-item:hover { background: rgba(0,0,0,0.05); color: #1a1a2e; }
    body.theme-light .dd-sep { background: rgba(0,0,0,0.07); }
    body.theme-light .home-sub { color: rgba(0,0,0,0.45); }
    body.theme-light .welcome-text { background: linear-gradient(135deg,#7c3aed,#4f46e5,#059669); -webkit-background-clip: text; background-clip: text; }
    body.theme-light .info-box { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
    body.theme-light .info-box code { color: #7c3aed; }
    body.theme-light .profile-panel .pp-row { border-color: rgba(0,0,0,0.06); }
    body.theme-light .pp-row:hover { background: rgba(0,0,0,0.02); }
    body.theme-light .pp-label { color: rgba(0,0,0,0.45); }
    body.theme-light .pp-value { color: #1a1a2e; }
    body.theme-light .pp-badge { background: rgba(0,0,0,0.06); color: #1a1a2e; }
    body.theme-light .pp-green { background: rgba(5,150,105,0.12); color: #059669; }
    body.theme-light .pp-yellow { background: rgba(217,119,6,0.12); color: #d97706; }
    body.theme-light .pp-mono { color: rgba(0,0,0,0.4); }
    body.theme-light .kanban-panel { background: transparent; }
    body.theme-light .kanban-col { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.07); }
    body.theme-light .kanban-col.drag-over { background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.3); }
    body.theme-light .kanban-col-title { color: rgba(0,0,0,0.45); }
    body.theme-light .task-card { background: white; border-color: rgba(0,0,0,0.08); }
    body.theme-light .task-card:hover { background: #fafafa; border-color: rgba(0,0,0,0.14); }
    body.theme-light .task-card-title { color: #1a1a2e; }
    body.theme-light .task-card-desc { color: rgba(0,0,0,0.4); }
    body.theme-light .task-card-dates { color: rgba(0,0,0,0.35); }
    body.theme-light .task-delete { color: rgba(0,0,0,0.2); }
    body.theme-light .kb-btn-secondary { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.65); border-color: rgba(0,0,0,0.1); }
    body.theme-light .kb-btn-secondary:hover { background: rgba(0,0,0,0.08); color: #1a1a2e; }
    body.theme-light .board-card { background: white; border-color: rgba(0,0,0,0.08); }
    body.theme-light .board-card:hover { background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.3); }
    body.theme-light .board-card-name { color: #1a1a2e; }
    body.theme-light .board-card-meta { color: rgba(0,0,0,0.35); }
    body.theme-light .kanban-title { color: #1a1a2e; }
    body.theme-light .boards-empty { color: rgba(0,0,0,0.3); }
    body.theme-light .overlay-inner { background: rgba(255,255,255,0.99); border-color: rgba(0,0,0,0.1); }
    body.theme-light .overlay-title { color: #1a1a2e; }
    body.theme-light .input { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #1a1a2e; }
    body.theme-light .input:focus { border-color: rgba(124,58,237,0.4); background: white; }
    body.theme-light .input::placeholder { color: rgba(0,0,0,0.3); }
    body.theme-light .label { color: rgba(0,0,0,0.45); }
    body.theme-light .member-chip { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.6); }
    body.theme-light .btm-inner { background: rgba(255,255,255,0.99); border-color: rgba(0,0,0,0.1); }
    body.theme-light .btm-title { color: #1a1a2e; }
    body.theme-light .btm-sub { color: rgba(0,0,0,0.4); }
    body.theme-light .bt-option { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
    body.theme-light .bt-option:hover { background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.3); }
    body.theme-light .bt-label { color: #1a1a2e; }
    body.theme-light .bt-desc { color: rgba(0,0,0,0.4); }
    body.theme-light .notes-list-col { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.07); }
    body.theme-light .notes-list-title { color: #1a1a2e; }
    body.theme-light .notes-list-header { border-color: rgba(0,0,0,0.07); }
    body.theme-light .notes-search input { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: #1a1a2e; }
    body.theme-light .notes-search input::placeholder { color: rgba(0,0,0,0.3); }
    body.theme-light .note-item:hover { background: rgba(0,0,0,0.04); }
    body.theme-light .note-item.active { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.3); }
    body.theme-light .note-item-title { color: #1a1a2e; }
    body.theme-light .note-item-preview { color: rgba(0,0,0,0.35); }
    body.theme-light .note-item-date { color: rgba(0,0,0,0.25); }
    body.theme-light .notes-empty { color: rgba(0,0,0,0.25); }
    body.theme-light .notes-editor-title { color: #1a1a2e; }
    body.theme-light .notes-editor-title::placeholder { color: rgba(0,0,0,0.18); }
    body.theme-light .notes-editor-divider { background: rgba(0,0,0,0.07); }
    body.theme-light .notes-editor-body { color: rgba(0,0,0,0.75); }
    body.theme-light .notes-editor-body::placeholder { color: rgba(0,0,0,0.2); }
    body.theme-light .notes-save-indicator { color: rgba(0,0,0,0.3); }
    body.theme-light .settings-title { color: #1a1a2e; }
    body.theme-light .settings-section-label { color: rgba(0,0,0,0.4); }
    body.theme-light .theme-option-name { color: rgba(0,0,0,0.7); }
    body.theme-light .theme-option:not(.selected) { border-color: rgba(0,0,0,0.1); background: rgba(0,0,0,0.03); }
    body.theme-light .theme-option.selected { background: rgba(124,58,237,0.08); }
  `;

  // ── RENDER ────────────────────────────────────────────────

  // Dynamic accent color CSS
  const accentMap = {
    purple:  { c1: "#7c3aed", c2: "#4f46e5", light: "#a78bfa", sh: "rgba(124,58,237,0.4)",  shH: "rgba(124,58,237,0.55)", bg1: "#1a0533", bg2: "#001233", bg3: "#0d1f0a" },
    blue:    { c1: "#2563eb", c2: "#1d4ed8", light: "#60a5fa", sh: "rgba(37,99,235,0.4)",   shH: "rgba(37,99,235,0.55)",  bg1: "#00112b", bg2: "#001a44", bg3: "#001a44" },
    rose:    { c1: "#e11d48", c2: "#be123c", light: "#fb7185", sh: "rgba(225,29,72,0.4)",   shH: "rgba(225,29,72,0.55)",  bg1: "#2d0011", bg2: "#1a0011", bg3: "#0d0520" },
    emerald: { c1: "#059669", c2: "#047857", light: "#34d399", sh: "rgba(5,150,105,0.4)",   shH: "rgba(5,150,105,0.55)", bg1: "#002218", bg2: "#001a33", bg3: "#00240f" },
    amber:   { c1: "#d97706", c2: "#b45309", light: "#fbbf24", sh: "rgba(217,119,6,0.4)",   shH: "rgba(217,119,6,0.55)",  bg1: "#241400", bg2: "#1a0e00", bg3: "#0d1f0a" },
  };
  const ac = accentMap[accentColor] || accentMap.purple;
  const accentCSS = `
    .btn-login,.btn-submit,.kb-btn-primary,.notes-add-btn,.notes-create-btn {
      background: linear-gradient(135deg, ${ac.c1}, ${ac.c2}) !important;
    }
    .btn-login { box-shadow: 0 8px 24px ${ac.sh} !important; }
    .btn-submit { box-shadow: 0 8px 24px ${ac.sh} !important; }
    .btn-submit:hover:not(:disabled) { box-shadow: 0 12px 32px ${ac.shH} !important; }
    .kb-btn-primary { box-shadow: 0 4px 14px ${ac.sh} !important; }
    .kb-btn-primary:hover:not(:disabled) { box-shadow: 0 8px 20px ${ac.shH} !important; }
    .notes-add-btn:hover { box-shadow: 0 4px 14px ${ac.sh} !important; }
    .notes-create-btn { box-shadow: 0 4px 14px ${ac.sh} !important; }
    .notes-create-btn:hover:not(:disabled) { box-shadow: 0 8px 20px ${ac.shH} !important; }
    .sb-icon:hover { background: ${ac.c1}26 !important; color: ${ac.light} !important; }
    .sb-icon.active { background: ${ac.c1}40 !important; color: ${ac.light} !important; }
    .input:focus { border-color: ${ac.light}80 !important; }
    .big-avatar { background: linear-gradient(135deg, ${ac.c1}, ${ac.c2}) !important; box-shadow: 0 20px 56px ${ac.sh} !important; }
    .profile-btn { background: linear-gradient(135deg, ${ac.c1}, ${ac.c2}) !important; }
    .pp-avatar { background: linear-gradient(135deg, ${ac.c1}, ${ac.c2}) !important; }
    .toggle-opt.active { background: ${ac.c1}40 !important; color: ${ac.light} !important; }
    .note-item.active { background: ${ac.c1}26 !important; border-color: ${ac.c1}59 !important; }
    .theme-option.selected { border-color: ${ac.light} !important; background: ${ac.c1}1f !important; }
    .board-card:hover { background: ${ac.c1}1f !important; border-color: ${ac.c1}66 !important; }
    .bt-option:hover { background: ${ac.c1}1f !important; border-color: ${ac.c1}66 !important; }
    .kanban-col.drag-over { border-color: ${ac.c1}80 !important; background: ${ac.c1}0f !important; }
    .splash-logo { background: linear-gradient(135deg, ${ac.light}, ${ac.c1}, #34d399) !important; -webkit-background-clip: text !important; background-clip: text !important; }
    .dash-logo,.logo { background: linear-gradient(135deg, ${ac.light}, ${ac.c1}, #34d399) !important; -webkit-background-clip: text !important; background-clip: text !important; }
    .welcome-text { background: linear-gradient(135deg, ${ac.light}, ${ac.c1}, #34d399) !important; -webkit-background-clip: text !important; background-clip: text !important; }
    .dashboard {
      background:
        radial-gradient(ellipse at 20% 50%, ${ac.bg1} 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, ${ac.bg2} 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, ${ac.bg3} 0%, transparent 50%),
        #0a0a0f !important;
    }
    .app {
      background:
        radial-gradient(ellipse at 20% 50%, ${ac.bg1} 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, ${ac.bg2} 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, ${ac.bg3} 0%, transparent 50%),
        #0a0a0f !important;
    }
  `;

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

  // ── DASHBOARD (home screen) ──
  if (screen === "home") {
    return (
      <>
        <style>{styles}</style>
        <style>{accentCSS}</style>
        <div className="dashboard">

          {/* ── HEADER ── */}
          <header className="dash-header">
            <div className="dash-logo">✦ teja</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Bell / Notifications */}
              <div className="notif-wrap">
                <div className="notif-btn" onClick={() => setNotifOpen(o => !o)} title="Notifications">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {overdueTasks.length > 0 && (
                    <span className="notif-badge">{overdueTasks.length > 9 ? "9+" : overdueTasks.length}</span>
                  )}
                </div>
                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      Overdue Tasks {overdueTasks.length > 0 && `(${overdueTasks.length})`}
                    </div>
                    {overdueTasks.length === 0
                      ? <div className="notif-empty">No overdue tasks 🎉</div>
                      : overdueTasks.map(t => (
                        <div key={t.id + t.boardId} className="notif-item">
                          <div className="notif-item-title">{t.title}</div>
                          <div className="notif-item-meta">
                            {t.boardName} · Due {new Date(t.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Profile avatar + click dropdown */}
              <div
                className="profile-wrap"
              >
              <div className="profile-btn" onClick={() => setProfileOpen(o => !o)}>
                {displayFirst[0]?.toUpperCase() || "U"}
              </div>

              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-info">
                    <div className="profile-name">{displayFirst} {displayLast}</div>
                    <div className="profile-email">{user?.email || "Signed in"}</div>
                  </div>

                  {/* Profile */}
                  <button className="dd-item" onClick={() => { setActivePanel("profile"); setProfileOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                    Profile
                  </button>

                  {/* Settings */}
                  <button className="dd-item" onClick={() => { setActivePanel("settings"); setProfileOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Settings
                  </button>

                  <div className="dd-sep" />

                  {/* Sign Out */}
                  <button className="dd-item danger" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
              </div>{/* end profile-wrap */}
            </div>{/* end header-right flex */}
          </header>

          {/* ── BODY ── */}
          <div className="dash-body">

            {/* Left Sidebar */}
            <nav className="sidebar">
              {/* Home */}
              <button className={`sb-icon ${activePanel === "home" ? "active" : ""}`} onClick={() => setActivePanel("home")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span className="tip">Home</span>
              </button>

              {/* Kanban */}
              <button className={`sb-icon ${activePanel === "kanban" ? "active" : ""}`} onClick={() => setActivePanel("kanban")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="4" height="18" rx="1"/>
                  <rect x="10" y="3" width="4" height="13" rx="1"/>
                  <rect x="17" y="3" width="4" height="15" rx="1"/>
                </svg>
                <span className="tip">Kanban</span>
              </button>

              {/* Notes */}
              <button className={`sb-icon ${activePanel === "notes" ? "active" : ""}`} onClick={() => setActivePanel("notes")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="tip">Notes</span>
              </button>

              {/* Settings */}
              <button className={`sb-icon ${activePanel === "settings" ? "active" : ""}`} onClick={() => setActivePanel("settings")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span className="tip">Settings</span>
              </button>
            </nav>

            {/* Main content */}
            <main className="dash-main" style={(activePanel === "kanban" || activePanel === "notes") ? { display: "none" } : {}}>

              {activePanel === "home" && (
                <div className="home-content">
                  <div className="big-avatar">
                    {displayFirst[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="welcome-text">
                    Welcome,<br />{displayFirst}!
                  </div>
                  <p className="home-sub">
                    {displayFirst} {displayLast} · You're all set ✓
                  </p>
                </div>
              )}

              {activePanel === "profile" && (
                <div className="profile-panel">
                  <button className="back-btn" onClick={() => setActivePanel("home")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back
                  </button>

                  <div className="pp-avatar">
                    {displayFirst[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="pp-name">{displayFirst} {displayLast}</div>

                  <div className="pp-fields">
                    <div className="pp-row">
                      <span className="pp-label">First Name</span>
                      <span className="pp-value">{userData?.firstName || "—"}</span>
                    </div>
                    <div className="pp-row">
                      <span className="pp-label">Last Name</span>
                      <span className="pp-value">{userData?.lastName || "—"}</span>
                    </div>
                    <div className="pp-row">
                      <span className="pp-label">Email</span>
                      <span className="pp-value">{user?.email || "—"}</span>
                    </div>
                    <div className="pp-row">
                      <span className="pp-label">Sign-in Provider</span>
                      <span className="pp-value pp-badge">{userData?.provider || user?.providerData?.[0]?.providerId || "—"}</span>
                    </div>
                    <div className="pp-row">
                      <span className="pp-label">Email Verified</span>
                      <span className={`pp-value pp-badge ${user?.emailVerified ? "pp-green" : "pp-yellow"}`}>
                        {user?.emailVerified ? "Verified" : "Not verified"}
                      </span>
                    </div>
                    <div className="pp-row" style={{ alignItems: "flex-start", paddingTop: 16, paddingBottom: 16 }}>
                      <span className="pp-label">
                        User ID
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 3, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                          Share this to be added to boards
                        </div>
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <span className="pp-value pp-mono" style={{ fontSize: 11, wordBreak: "break-all", textAlign: "right", maxWidth: 280 }}>
                          {user?.uid || "—"}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(user?.uid || "");
                            setUidCopied(true);
                            setTimeout(() => setUidCopied(false), 2000);
                          }}
                          style={{
                            padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
                            background: uidCopied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
                            color: uidCopied ? "#34d399" : "rgba(255,255,255,0.6)",
                            fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {uidCopied ? "✓ Copied!" : "Copy ID"}
                        </button>
                      </div>
                    </div>
                    <div className="pp-row">
                      <span className="pp-label">Account Created</span>
                      <span className="pp-value">{userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "settings" && (
                <div className="settings-panel">
                  <div className="settings-title">Settings</div>

                  {/* Theme section */}
                  <div className="settings-section">
                    <div className="settings-section-label">Appearance</div>
                    <div className="theme-options">
                      {/* Dark */}
                      <div className={`theme-option ${theme === "dark" ? "selected" : ""}`} onClick={() => setTheme("dark")}>
                        <div className="theme-preview theme-preview-dark">
                          <div className="theme-preview-bar" style={{ background: "#7c3aed" }} />
                          <div className="theme-preview-bar" style={{ background: "rgba(255,255,255,0.08)" }} />
                          <div className="theme-preview-bar" style={{ background: "rgba(255,255,255,0.04)" }} />
                        </div>
                        <span className="theme-option-name">Dark</span>
                      </div>
                      {/* Light */}
                      <div className={`theme-option ${theme === "light" ? "selected" : ""}`} onClick={() => setTheme("light")}>
                        <div className="theme-preview theme-preview-light">
                          <div className="theme-preview-bar" style={{ background: "#7c3aed" }} />
                          <div className="theme-preview-bar" style={{ background: "rgba(0,0,0,0.08)" }} />
                          <div className="theme-preview-bar" style={{ background: "rgba(0,0,0,0.04)" }} />
                        </div>
                        <span className="theme-option-name">Light</span>
                      </div>
                      {/* System */}
                      <div
                        className={`theme-option ${theme === "system" ? "selected" : ""}`}
                        onClick={() => {
                          const sys = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
                          setTheme(sys);
                        }}
                      >
                        <div className="theme-preview" style={{ background: "linear-gradient(135deg, #0a0a0f 50%, #f0f0f5 50%)", border: "1px solid rgba(128,128,128,0.3)" }}>
                          <div className="theme-preview-bar" style={{ background: "#7c3aed", opacity: 0.7 }} />
                          <div className="theme-preview-bar" style={{ background: "rgba(128,128,128,0.2)" }} />
                        </div>
                        <span className="theme-option-name">System</span>
                      </div>
                    </div>
                  </div>

                  {/* Accent color section */}
                  <div className="settings-section">
                    <div className="settings-section-label">Accent Color</div>
                    <div className="accent-options">
                      {[
                        { id: "purple", color: "linear-gradient(135deg, #7c3aed, #a78bfa)", label: "Purple" },
                        { id: "blue",   color: "linear-gradient(135deg, #2563eb, #60a5fa)", label: "Blue"   },
                        { id: "rose",   color: "linear-gradient(135deg, #e11d48, #fb7185)", label: "Rose"   },
                        { id: "emerald",color: "linear-gradient(135deg, #059669, #34d399)", label: "Emerald"},
                        { id: "amber",  color: "linear-gradient(135deg, #d97706, #fbbf24)", label: "Amber"  },
                      ].map(a => (
                        <div
                          key={a.id}
                          className={`accent-swatch ${accentColor === a.id ? "selected" : ""}`}
                          style={{ background: a.color }}
                          title={a.label}
                          onClick={() => setAccentColor(a.id)}
                        >
                          {accentColor === a.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* About section */}
                  <div className="settings-section">
                    <div className="settings-section-label">About</div>
                    <div className="info-box" style={{ fontSize: 13 }}>
                      <div style={{ marginBottom: 4 }}><code>✦ teja dashboard</code></div>
                      <div style={{ color: "rgba(255,255,255,0.35)" }}>Logged in as <strong style={{ color: "rgba(255,255,255,0.6)" }}>{user?.email}</strong></div>
                    </div>
                  </div>
                </div>
              )}

            </main>

            {/* ── NOTES PANEL ── */}
            {activePanel === "notes" && (
              <div className="notes-panel">
                {/* Notes list column */}
                <div className="notes-list-col">
                  <div className="notes-list-header">
                    <span className="notes-list-title">Notes</span>
                    <button className="notes-add-btn" onClick={startNewNote} title="New note">+</button>
                  </div>

                  {/* Firestore error banner */}
                  {noteError && (
                    <div className="notes-err-banner">
                      {noteError === "FIRESTORE_RULES" ? (
                        <>
                          <strong>Permission denied.</strong> Add this rule in{" "}
                          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
                            Firebase Console → Firestore → Rules
                          </a>:
                          <code>{`match /notes/{noteId} {
  allow read, write: if request.auth != null
    && request.auth.uid == resource.data.uid;
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.uid;
}`}</code>
                        </>
                      ) : (
                        <><strong>Error:</strong> {noteError}</>
                      )}
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => setNoteError("")} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Dismiss</button>
                      </div>
                    </div>
                  )}

                  <div className="notes-search">
                    <input
                      placeholder="Search notes…"
                      value={noteSearch}
                      onChange={e => setNoteSearch(e.target.value)}
                    />
                  </div>
                  <div className="notes-list">
                    {!notesLoaded && (
                      <div className="notes-empty"><span className="spinner" style={{ width: 16, height: 16 }} /></div>
                    )}
                    {notesLoaded && (() => {
                      const relDate = (ts) => {
                        if (!ts?.toDate) return "";
                        const d = ts.toDate(), now = new Date();
                        const diff = Math.floor((now - d) / 86400000);
                        if (diff === 0) return "Today";
                        if (diff === 1) return "Yesterday";
                        if (diff < 7) return `${diff} days ago`;
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      };
                      return notes.filter(n =>
                        !noteSearch || n.title?.toLowerCase().includes(noteSearch.toLowerCase()) || n.content?.toLowerCase().includes(noteSearch.toLowerCase())
                      ).map(note => (
                        <div
                          key={note.id}
                          className={`note-item ${activeNote?.id === note.id ? "active" : ""}`}
                          onClick={() => openNote(note)}
                        >
                          <div className="note-item-title">{note.title || "Untitled"}</div>
                          <div className="note-item-preview">{note.content?.replace(/\n/g, " ") || "No content yet"}</div>
                          <div className="note-item-date">{relDate(note.updatedAt)}</div>
                          <button
                            className="note-delete-btn"
                            onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                            title="Delete"
                          >×</button>
                        </div>
                      ));
                    })()}
                    {notesLoaded && notes.length === 0 && (
                      <div className="notes-empty">No notes yet.<br/>Click + to create one.</div>
                    )}
                  </div>
                </div>

                {/* Notes editor column */}
                <div className="notes-editor-col">
                  {!noteEditorOpen ? (
                    <div className="notes-empty-editor">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                      <p>Select a note or create a new one</p>
                      <button className="notes-create-btn" onClick={startNewNote}>+ New Note</button>
                    </div>
                  ) : (
                    <>
                      <div className="notes-editor-header">
                        <div className="notes-save-indicator">
                          {noteSaving && (
                            <><span className="spinner" style={{ width: 12, height: 12, borderTopColor: "rgba(167,139,250,0.8)" }} /> Saving…</>
                          )}
                          {!noteSaving && activeNote?.id && (
                            <span>Saved · Last edited {(() => {
                              const ts = activeNote?.updatedAt;
                              if (!ts?.toDate) return "just now";
                              const d = ts.toDate(), now = new Date();
                              const diff = Math.floor((now - d) / 86400000);
                              if (diff === 0) return "Today";
                              if (diff === 1) return "Yesterday";
                              return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                            })()}</span>
                          )}
                          {!noteSaving && !activeNote?.id && (noteTitle || noteContent) && (
                            <span style={{ color: "rgba(255,255,255,0.2)" }}>Auto-saving in a moment…</span>
                          )}
                        </div>
                      </div>
                      <input
                        className="notes-editor-title"
                        placeholder="Note title…"
                        value={noteTitle}
                        onChange={e => { setNoteError(""); setNoteTitle(e.target.value); }}
                      />
                      <div className="notes-editor-divider" />
                      <textarea
                        className="notes-editor-body"
                        placeholder="Start writing…"
                        value={noteContent}
                        onChange={e => { setNoteError(""); setNoteContent(e.target.value); }}
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── KANBAN PANEL ── */}
            {activePanel === "kanban" && (
              <div className="kanban-panel">

                {/* Board Type Modal */}
                {showBoardModal && (
                  <div className="board-type-modal">
                    <div className="btm-inner">
                      {!pendingBoardType ? (
                        <>
                          <div className="btm-title">Set Up Your Board</div>
                          <p className="btm-sub">Choose how you want to use your Kanban board</p>
                          <div className="btm-options">
                            <div className="bt-option" onClick={() => { setPendingBoardType("individual"); setBoardNameInput(""); }}>
                              <div className="bt-icon">🧑</div>
                              <div className="bt-label">Individual</div>
                              <div className="bt-desc">A personal board just for you</div>
                            </div>
                            <div className="bt-option" onClick={() => { setPendingBoardType("sharing"); setBoardNameInput(""); }}>
                              <div className="bt-icon">👥</div>
                              <div className="bt-label">Sharing</div>
                              <div className="bt-desc">Collaborate with others by email</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="btm-title">Name Your Board</div>
                          <p className="btm-sub">{pendingBoardType === "individual" ? "Individual board" : "Shared board"}</p>
                          <div className="input-group" style={{ marginBottom: 20 }}>
                            <label className="label">Board Name</label>
                            <input
                              className="input"
                              placeholder="e.g. My Tasks, Sprint Board…"
                              value={boardNameInput}
                              onChange={e => setBoardNameInput(e.target.value)}
                              autoFocus
                              onKeyDown={e => e.key === "Enter" && boardNameInput.trim() && !kanbanLoading && initBoard(pendingBoardType, boardNameInput)}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button className="kb-btn kb-btn-secondary" onClick={() => setPendingBoardType(null)}>Back</button>
                            <button
                              className="kb-btn kb-btn-primary"
                              onClick={() => initBoard(pendingBoardType, boardNameInput)}
                              disabled={kanbanLoading || !boardNameInput.trim()}
                            >
                              {kanbanLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Creating…</> : "Create Board"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Add Task Modal */}
                {showAddTask && (
                  <div className="overlay-modal" onClick={e => e.target === e.currentTarget && setShowAddTask(false)}>
                    <div className="overlay-inner" style={{ maxWidth: 560 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                        <div className="overlay-title" style={{ marginBottom: 0 }}>Add Task</div>
                        <button onClick={() => { setShowAddTask(false); setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskStartDate(""); setNewTaskEndDate(""); setNewTaskStatus("todo"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
                      </div>
                      <div className="input-group">
                        <label className="label">Name <span style={{ color: "#f87171" }}>*</span></label>
                        <input className="input" placeholder="Task name" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} autoFocus />
                      </div>
                      <div className="input-group">
                        <label className="label">Description</label>
                        <textarea className="input" placeholder="Task description" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} style={{ minHeight: 90, resize: "vertical" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div className="input-group">
                          <label className="label">Start Date</label>
                          <input className="input" type="date" value={newTaskStartDate} onChange={e => setNewTaskStartDate(e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label className="label">End Date</label>
                          <input className="input" type="date" value={newTaskEndDate} onChange={e => setNewTaskEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="input-group">
                        <label className="label">Status</label>
                        <select className="input" value={newTaskStatus} onChange={e => setNewTaskStatus(e.target.value)} style={{ cursor: "pointer" }}>
                          <option value="todo">To Do</option>
                          <option value="inprogress">In Progress</option>
                          <option value="done">Completed</option>
                        </select>
                      </div>
                      {addTaskError && <div className="error" style={{ fontSize: 12, marginTop: 4 }}>{addTaskError}</div>}
                      <div className="overlay-actions">
                        <button className="kb-btn kb-btn-secondary" onClick={() => { setShowAddTask(false); setAddTaskError(""); setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskStartDate(""); setNewTaskEndDate(""); setNewTaskStatus("todo"); }}>Cancel</button>
                        <button className="kb-btn kb-btn-primary" onClick={handleAddTask} disabled={kanbanLoading || !newTaskTitle.trim()}>
                          {kanbanLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Share Modal */}
                {showShareModal && (
                  <div className="overlay-modal" onClick={e => e.target === e.currentTarget && (setShowShareModal(false), setShareError(""))}>
                    <div className="overlay-inner">
                      <div className="overlay-title">Share Board</div>
                      <div className="member-list">
                        {shareMembers.length === 0
                          ? <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No members yet</p>
                          : shareMembers.map(m => (
                            <div key={m} className="member-chip">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                              {m}
                              {m === kanbanBoard?.ownerEmail && <span className="member-chip-owner">owner</span>}
                            </div>
                          ))
                        }
                      </div>
                      <div className="input-group">
                        <label className="label">Add by Email or User ID</label>
                        <input
                          className="input"
                          type="text"
                          placeholder="email@example.com  or  User ID"
                          value={shareEmail}
                          onChange={e => setShareEmail(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addMember(shareEmail)}
                          autoComplete="off"
                        />
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                          Find your User ID in <strong style={{ color: "rgba(255,255,255,0.4)" }}>Profile → User ID</strong>
                        </div>
                      </div>
                      <div className="overlay-actions">
                        {shareError && <div className="error" style={{ fontSize: 12, marginBottom: 0 }}>{shareError}</div>}
                        <button className="kb-btn kb-btn-secondary" onClick={() => { setShowShareModal(false); setShareError(""); }}>Close</button>
                        <button className="kb-btn kb-btn-primary" onClick={() => addMember(shareEmail)} disabled={kanbanLoading || !shareEmail.trim()}>
                          {kanbanLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task Detail Modal */}
                {selectedTask && (
                  <div className="overlay-modal" onClick={e => e.target === e.currentTarget && setSelectedTask(null)}>
                    <div className="overlay-inner" style={{ maxWidth: 520 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                        <div className="overlay-title" style={{ marginBottom: 0 }}>Edit Task</div>
                        <button className="task-delete" style={{ position: "static", opacity: 0.5 }} onClick={() => setSelectedTask(null)}>×</button>
                      </div>
                      <div className="input-group">
                        <label className="label">Title</label>
                        <input className="input" value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} placeholder="Task title" autoFocus />
                      </div>
                      <div className="input-group">
                        <label className="label">Description</label>
                        <textarea className="input" value={editTaskDesc} onChange={e => setEditTaskDesc(e.target.value)} placeholder="Add details..." rows={3} style={{ resize: "vertical" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                        <div className="input-group">
                          <label className="label">Status</label>
                          <select className="input" value={editTaskStatus} onChange={e => setEditTaskStatus(e.target.value)} style={{ cursor: "pointer" }}>
                            <option value="todo">To Do</option>
                            <option value="inprogress">In Progress</option>
                            <option value="done">Completed</option>
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="label">Start</label>
                          <input className="input" type="date" value={editTaskStart} onChange={e => setEditTaskStart(e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label className="label">End</label>
                          <input className="input" type="date" value={editTaskEnd} onChange={e => setEditTaskEnd(e.target.value)} />
                        </div>
                      </div>
                      {editTaskError && <div className="error" style={{ fontSize: 12, marginTop: 4 }}>{editTaskError}</div>}
                      <div className="overlay-actions">
                        <button className="kb-btn kb-btn-secondary" onClick={() => { setSelectedTask(null); setEditTaskError(""); }}>Cancel</button>
                        <button className="kb-btn kb-btn-primary" onClick={handleUpdateTask} disabled={kanbanLoading || !editTaskTitle.trim()}>
                          {kanbanLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {kanbanLoading && !showBoardModal && (
                  <div className="kb-loading"><span className="spinner" /> Loading…</div>
                )}

                {/* Boards list */}
                {!kanbanLoading && !kanbanBoard && !showBoardModal && (
                  <div className="boards-list-view">
                    <div className="boards-list-header">
                      <div className="kanban-title">Kanban Boards</div>
                      <button className="kb-btn kb-btn-primary" onClick={() => setShowBoardModal(true)}>+ New Kanban Board</button>
                    </div>
                    {error && (
                      <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>
                        {error} <button className="kb-btn kb-btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setError(""); loadBoards(); }}>Retry</button>
                      </div>
                    )}
                    {kanbanBoards.length === 0 ? (
                      <div className="boards-empty">No boards yet. Create your first Kanban Board!</div>
                    ) : (
                      <div className="boards-grid">
                        {kanbanBoards.map(board => (
                          <div key={board.boardId} className="board-card" onClick={() => openBoard(board)}>
                            <div className="board-card-icon">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="12" rx="1"/><rect x="17" y="3" width="4" height="15" rx="1"/>
                              </svg>
                            </div>
                            <div className="board-card-name">{board.boardName}</div>
                            <div className="board-card-meta">{board.type === "sharing" ? "Shared board" : "Individual"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Board detail */}
                {!kanbanLoading && kanbanBoard && (
                  <>
                    <div className="kanban-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button className="kb-btn kb-btn-secondary" onClick={() => { setKanbanBoard(null); setTasks([]); }}>← Back</button>
                        <div className="kanban-title">{kanbanBoard.boardName}</div>
                      </div>
                      <div className="kanban-actions">
                        {kanbanBoard.type === "sharing" && (
                          <button className="kb-btn kb-btn-secondary" onClick={() => setShowShareModal(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Share
                          </button>
                        )}
                        <button className="kb-btn kb-btn-primary" onClick={() => setShowAddTask(true)}>+ Add Task</button>
                      </div>
                    </div>

                    <div className="kanban-cols">
                      {[
                        { key: "todo",       label: "To Do",      color: "#22c55e" },
                        { key: "inprogress", label: "In Progress", color: "#3b82f6" },
                        { key: "done",       label: "Completed",   color: "#a78bfa" },
                      ].map(col => {
                        const colTasks = tasks.filter(t => t.status === col.key);
                        const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
                        return (
                          <div
                            key={col.key}
                            className={`kanban-col ${dragOverCol === col.key ? "drag-over" : ""}`}
                            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                            onDragLeave={() => setDragOverCol(null)}
                            onDrop={() => handleDrop(col.key)}
                          >
                            <div className="kanban-col-header">
                              <span className="kanban-col-title">{col.label}</span>
                              <span className="col-badge" style={{ background: col.color + "22", color: col.color }}>{colTasks.length}</span>
                            </div>
                            <div className="col-cards">
                              {colTasks.map(task => (
                                <div
                                  key={task.id}
                                  className={`task-card ${dragTaskId === task.id ? "dragging" : ""}`}
                                  style={{ borderColor: col.color + "66" }}
                                  draggable
                                  onDragStart={() => setDragTaskId(task.id)}
                                  onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                                  onClick={() => openTaskDetail(task)}
                                >
                                  <div className="task-card-title">{task.title}</div>
                                  {task.description && <div className="task-card-desc">{task.description}</div>}
                                  {(task.startDate || task.endDate) && (
                                    <div className="task-card-dates">
                                      {fmtDate(task.startDate) && <span>📅 {fmtDate(task.startDate)}</span>}
                                      {fmtDate(task.endDate) && <span>⏰ {fmtDate(task.endDate)}</span>}
                                    </div>
                                  )}
                                  <button className="task-delete" onClick={e => { e.stopPropagation(); handleDeleteTask(task); }} title="Delete">×</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </>
    );
  }

  // ── AUTH SCREENS ──
  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* LANDING */}
        {screen === "landing" && (
          <div className="card">
            <div className="logo">✦ teja</div>
            <h2>Welcome</h2>
            <p className="desc">Sign in or create a new account to continue.</p>
            <button className="btn-primary btn-login" onClick={() => { setScreen("login"); clearError(); }}>Log In</button>
            <button className="btn-primary btn-signup" onClick={() => { setScreen("signup"); clearError(); }}>Create Account</button>
          </div>
        )}

        {/* LOGIN */}
        {screen === "login" && (
          <div className="card">
            <button className="back-btn" onClick={() => { setScreen("landing"); setLoginMethod(""); clearError(); }}>← Back</button>
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
                  {loading && <span className="spinner" />} Sign In
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

        {/* SIGNUP */}
        {screen === "signup" && (
          <div className="card">
            <button className="back-btn" onClick={() => { setScreen("landing"); clearError(); }}>← Back</button>
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

            <div className="input-group">
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="you@example.com" value={emailValue} onChange={e => setEmailValue(e.target.value)} />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="At least 6 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()} />
            </div>

            <button className="btn-submit" onClick={handleSignup} disabled={loading}>
              {loading && <span className="spinner" />} Create Account
            </button>
            {error && <div className="error">{error}</div>}
          </div>
        )}

      </div>
    </>
  );
}
