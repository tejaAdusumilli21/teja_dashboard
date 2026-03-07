import { useState, useEffect, useRef } from "react";
import plioLogo from "./assets/plio-logo.svg";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
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
  const [verifSent, setVerifSent]           = useState(false);
  const [verifError, setVerifError]         = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName]   = useState("");
  const [editLastName, setEditLastName]     = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState(0);
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileEditError, setProfileEditError] = useState("");
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
  const [showNoteShare, setShowNoteShare]   = useState(false);
  const [noteShareInput, setNoteShareInput] = useState("");
  const [noteShareError, setNoteShareError] = useState("");
  const [noteShareSaving, setNoteShareSaving] = useState(false);
  const activeNoteRef  = useRef(null);
  const isSavingRef    = useRef(false);

  // ── TipTap rich-text editor ──
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setNoteError("");
      setNoteContent(editor.getHTML());
    },
  });

  // ── Theme / Settings state ──
  const [theme, setTheme]           = useState(() => localStorage.getItem("app_theme") || "dark");
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem("app_accent") || "purple");
  const [clockTime, setClockTime] = useState(new Date());
  const [widgetSlots, setWidgetSlots] = useState(() => {
    try { const s = localStorage.getItem("plio_ws"); return s ? JSON.parse(s) : ["clock","kanban","calendar"]; } catch(e) { return ["clock","kanban","calendar"]; }
  });
  const [wDragFrom, setWDragFrom] = useState(null);
  const [wDragOver, setWDragOver] = useState(null);
  const [widgetPicker, setWidgetPicker] = useState(null);

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
    // Use local date constructor to avoid UTC timezone shift issues
    const isReal = (str) => {
      if (!str) return true;
      const [y, m, d] = str.split("-").map(Number);
      if (!y || !m || !d) return false;
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
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
    const creatorName = userData?.firstName
      ? `${userData.firstName}${userData.lastName ? " " + userData.lastName : ""}`
      : user?.email || "Unknown";
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      const ref = await addDoc(collection(db, "boards", kanbanBoard.id, "tasks"), {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        status: newTaskStatus || "todo",
        startDate: newTaskStartDate,
        endDate: newTaskEndDate,
        createdBy: user.email,
        createdAt: serverTimestamp(),
        lastModifiedBy: creatorName,
        lastModifiedAt: todayStr,
      });
      setTasks(prev => [...prev, {
        id: ref.id,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        status: newTaskStatus || "todo",
        startDate: newTaskStartDate,
        endDate: newTaskEndDate,
        createdBy: user.email,
        lastModifiedBy: creatorName,
        lastModifiedAt: todayStr,
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
    const now = new Date().toISOString().split("T")[0];
    const modifiedBy = userData?.firstName
      ? `${userData.firstName}${userData.lastName ? " " + userData.lastName : ""}`
      : user?.email || "Unknown";
    const updated = {
      title: editTaskTitle.trim(),
      description: editTaskDesc.trim(),
      status: editTaskStatus,
      startDate: editTaskStart,
      endDate: editTaskEnd,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: now,
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
      // Own notes
      let ownSnap;
      try {
        ownSnap = await getDocs(query(collection(db, "notes"), where("uid", "==", user.uid), orderBy("updatedAt", "desc")));
      } catch {
        ownSnap = await getDocs(query(collection(db, "notes"), where("uid", "==", user.uid)));
      }
      // Notes shared with me
      let sharedSnap;
      try {
        sharedSnap = await getDocs(query(collection(db, "notes"), where("sharedWith", "array-contains", user.uid)));
      } catch {
        sharedSnap = { docs: [] };
      }
      const seen = new Set();
      const all = [];
      [...ownSnap.docs, ...sharedSnap.docs].forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); all.push({ id: d.id, ...d.data() }); }
      });
      // Sort by updatedAt desc
      all.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setNotes(all);
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
      const modName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || user.email || "Unknown";
      const modDate = new Date().toISOString().split("T")[0];
      if (id) {
        await updateDoc(doc(db, "notes", id), { title: title || "Untitled", content, updatedAt: now, lastModifiedBy: modName, lastModifiedAt: modDate });
        const saved = { ...activeNoteRef.current, title: title || "Untitled", content, lastModifiedBy: modName, lastModifiedAt: modDate };
        setActiveNote(saved);
        activeNoteRef.current = saved;
        setNotes(prev => prev.map(n => n.id === id ? { ...n, title: title || "Untitled", content, lastModifiedBy: modName, lastModifiedAt: modDate } : n));
      } else {
        const ref = await addDoc(collection(db, "notes"), {
          uid: user.uid, title: title || "Untitled", content, createdAt: now, updatedAt: now, lastModifiedBy: modName, lastModifiedAt: modDate,
        });
        const newNote = { id: ref.id, uid: user.uid, title: title || "Untitled", content, lastModifiedBy: modName, lastModifiedAt: modDate };
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

  const AVATAR_COLORS = [
    "linear-gradient(135deg,#7c3aed,#2563eb)",
    "linear-gradient(135deg,#ec4899,#8b5cf6)",
    "linear-gradient(135deg,#06b6d4,#3b82f6)",
    "linear-gradient(135deg,#10b981,#059669)",
    "linear-gradient(135deg,#f97316,#ef4444)",
    "linear-gradient(135deg,#f43f5e,#ec4899)",
    "linear-gradient(135deg,#6366f1,#8b5cf6)",
    "linear-gradient(135deg,#14b8a6,#06b6d4)",
  ];

  const openEditProfile = () => {
    const today = new Date().toISOString().split("T")[0];
    if (userData?.lastProfileEdit === today) {
      setProfileEditError("You can only edit your profile once per day.");
      return;
    }
    setEditFirstName(userData?.firstName || "");
    setEditLastName(userData?.lastName || "");
    setEditAvatarColor(userData?.avatarColor ?? 0);
    setProfileEditError("");
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!editFirstName.trim()) { setProfileEditError("First name is required."); return; }
    setProfileSaving(true); setProfileEditError("");
    try {
      const today = new Date().toISOString().split("T")[0];
      const updates = { firstName: editFirstName.trim(), lastName: editLastName.trim(), avatarColor: editAvatarColor, lastProfileEdit: today };
      await updateDoc(doc(db, "users", user.uid), updates);
      await updateProfile(user, { displayName: `${editFirstName.trim()} ${editLastName.trim()}`.trim() });
      setUserData(prev => ({ ...prev, ...updates }));
      setEditingProfile(false);
    } catch (e) {
      setProfileEditError(e.message || "Failed to save. Try again.");
    }
    setProfileSaving(false);
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

  const shareNote = async (input) => {
    if (!input.trim() || !activeNote?.id) return;
    setNoteShareSaving(true);
    setNoteShareError("");
    const trimmed = input.trim();
    try {
      let memberId = null;
      let memberEmail = null;
      if (trimmed.includes("@")) {
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", trimmed)));
        if (snap.empty) { setNoteShareError("No user found with that email."); setNoteShareSaving(false); return; }
        memberId = snap.docs[0].id;
        memberEmail = trimmed;
      } else {
        const uSnap = await getDoc(doc(db, "users", trimmed));
        if (!uSnap.exists()) { setNoteShareError("No user found with that User ID."); setNoteShareSaving(false); return; }
        memberId = trimmed;
        memberEmail = uSnap.data().email || trimmed;
      }
      if (memberId === user.uid) { setNoteShareError("You can't share with yourself."); setNoteShareSaving(false); return; }
      const sharedWith = [...(activeNote.sharedWith || [])];
      if (sharedWith.includes(memberId)) { setNoteShareError("Already shared with this user."); setNoteShareSaving(false); return; }
      sharedWith.push(memberId);
      const sharedEmails = [...(activeNote.sharedEmails || []), memberEmail];
      await updateDoc(doc(db, "notes", activeNote.id), { sharedWith, sharedEmails });
      const updatedNote = { ...activeNote, sharedWith, sharedEmails };
      activeNoteRef.current = updatedNote;
      setActiveNote(updatedNote);
      setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
      setNoteShareInput("");
    } catch (e) {
      setNoteShareError("Failed to share: " + e.message);
    }
    setNoteShareSaving(false);
  };

  const openNote = (note) => {
    activeNoteRef.current = note;
    setActiveNote(note);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
    setNoteEditorOpen(true);
    // Load existing content into TipTap (setTimeout ensures editor is ready)
    setTimeout(() => {
      if (editor) {
        editor.commands.setContent(note.content || "", false);
        editor.commands.focus("end");
      }
    }, 0);
  };

  const startNewNote = () => {
    activeNoteRef.current = null;
    setActiveNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteEditorOpen(true);
    setTimeout(() => {
      if (editor) {
        editor.commands.setContent("", false);
        editor.commands.focus();
      }
    }, 0);
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

  // clock tick
  useEffect(() => {
    const id = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Theme: apply class to body ──
  useEffect(() => {
    document.body.className = theme === "light" ? "theme-light" : "";
    localStorage.setItem("app_theme", theme);
    localStorage.setItem("app_accent", accentColor);
  }, [theme, accentColor]);

  // ── HANDLERS ──────────────────────────────────────────────
  const saveWidgetSlots = (slots) => { setWidgetSlots(slots); localStorage.setItem("plio_ws", JSON.stringify(slots)); };
  const handleWDragStart = (e, i) => { setWDragFrom(i); e.dataTransfer.effectAllowed = "move"; };
  const handleWDragOver = (e, i) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setWDragOver(i); };
  const handleWDrop = (e, i) => { e.preventDefault(); if (wDragFrom === null || wDragFrom === i) { setWDragFrom(null); setWDragOver(null); return; } const s = [...widgetSlots]; const tmp = s[i]; s[i] = s[wDragFrom]; s[wDragFrom] = tmp; saveWidgetSlots(s); setWDragFrom(null); setWDragOver(null); };
  const handleWDragEnd = () => { setWDragFrom(null); setWDragOver(null); };
  const removeWidget = (i) => { const s = [...widgetSlots]; s[i] = null; saveWidgetSlots(s); };
  const addWidget = (i, type) => { const s = [...widgetSlots]; s[i] = type; saveWidgetSlots(s); setWidgetPicker(null); };

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
      await updateProfile(result.user, { displayName: `${firstName} ${lastName}`.trim() });
      const newData = { firstName, lastName, contactMethod: "email", email: emailValue, provider: "email", createdAt: new Date().toISOString() };
      await setDoc(doc(db, "users", result.user.uid), newData);
      setUserData(newData);
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
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=Dancing+Script:wght@600;700&display=swap');

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

    .logo { height: 32px; width: auto; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: rgba(255,255,255,0.35); margin-bottom: 40px; font-weight: 300; }
    h2 { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px; margin-bottom: 6px; color: #f0eeff; }
    .desc { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 32px; }

    .btn-primary { width: 100%; padding: 14px 20px; border-radius: 12px; border: none; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; display: block; }
    .btn-login { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
    .btn-login:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(124,58,237,0.55); }
    .btn-signup { background: transparent; color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
    .btn-signup:hover { background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.6); }

    .social-btn { width: 100%; padding: 13px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: #ffffff; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 10px; transition: all 0.2s; }
    .social-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
    .social-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }

    .input-group { margin-bottom: 14px; }
    .label { font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 6px; font-weight: 500; letter-spacing: 0.8px; text-transform: uppercase; display: block; }
    .input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #e8e6ff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s, background 0.2s; }
    .input:focus { border-color: rgba(167,139,250,0.7); background: rgba(255,255,255,0.14); }
    .input::placeholder { color: rgba(255,255,255,0.4); }

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
    .splash-logo { width: 120px; height: auto; animation: pulse 1.5s ease-in-out infinite; }
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
    .dash-logo { height: 28px; width: auto; display: block; }

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
    .notif-item { padding: 11px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
    .notif-item:hover { background: rgba(255,255,255,0.06); }
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
    .home-widgets { width: 100%; max-width: 940px; align-self: flex-start; }
    .hw-top-grid { display: grid; grid-template-columns: 240px 1fr; gap: 16px; margin-bottom: 18px; }
    .hw-user-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .hw-avatar { width: 72px !important; height: 72px !important; font-size: 26px !important; flex-shrink: 0; }
    .hw-user-info { text-align: center; }
    .hw-user-name { font-size: 16px; font-weight: 600; color: #f0eeff; margin-bottom: 5px; }
    .hw-user-email { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
    .hw-user-id { font-size: 10px; color: rgba(255,255,255,0.2); font-family: monospace; }
    .hw-welcome-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px 28px; }
    .hw-welcome-script { font-family: "Dancing Script", cursive; font-size: 46px; font-weight: 700; background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip: text; background-clip: text; color: transparent; line-height: 1.15; margin-bottom: 4px; }
    .hw-welcome-sub { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.65); margin-bottom: 14px; }
    .hw-feature-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
    .hw-feature-list li { font-size: 12.5px; color: rgba(255,255,255,0.45); padding-left: 16px; position: relative; line-height: 1.5; }
    .hw-feature-list li::before { content: ""; position: absolute; left: 0; top: 7px; width: 5px; height: 5px; border-radius: 50%; background: linear-gradient(135deg,#a78bfa,#60a5fa); }
    .hw-widgets-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .hw-slot { background: rgba(255,255,255,0.03); border: 1.5px dashed rgba(255,255,255,0.13); border-radius: 20px; padding: 18px 20px; min-height: 230px; }
    .hw-slot-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .hw-slot-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.3); font-weight: 600; }
    .hw-pencil { color: rgba(255,255,255,0.22); cursor: pointer; display: flex; align-items: center; transition: color 0.2s; }
    .hw-pencil:hover { color: rgba(167,139,250,0.7); }
    .hw-open-btn { background: none; border: 1px solid rgba(167,139,250,0.3); color: #a78bfa; font-size: 11px; padding: 3px 9px; border-radius: 6px; cursor: pointer; font-family: "DM Sans",sans-serif; transition: all 0.18s; }
    .hw-open-btn:hover { background: rgba(167,139,250,0.1); }
    .hw-time { font-size: 34px; font-weight: 700; font-family: "Syne",sans-serif; color: #fff; line-height: 1; }
    .hw-date-lbl { font-size: 12px; color: rgba(255,255,255,0.38); margin-top: 5px; margin-bottom: 14px; }
    .hw-analog { width: 88px; height: 88px; }
    .hw-kb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .hw-kb-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
    .hw-kb-col-title span { background: rgba(255,255,255,0.1); border-radius: 10px; padding: 1px 6px; font-size: 10px; }
    .hw-kb-todo { color: #60a5fa; }
    .hw-kb-inprog { color: #f59e0b; }
    .hw-kb-task { font-size: 11.5px; padding: 6px 9px; border-radius: 7px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid rgba(255,255,255,0.06); }
    .hw-kb-empty { font-size: 11px; color: rgba(255,255,255,0.18); font-style: italic; }
    .hw-empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 0; color: rgba(255,255,255,0.2); font-size: 12px; text-align: center; }
    .hw-empty-state p { margin: 0; }
    .hw-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
    .hw-cal-hdr { font-size: 9.5px; color: rgba(255,255,255,0.22); text-align: center; padding: 3px 0; font-weight: 600; }
    .hw-cal-day { font-size: 11px; padding: 5px 2px; border-radius: 6px; color: rgba(255,255,255,0.48); text-align: center; }
    .hw-today { background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #fff !important; font-weight: 700; border-radius: 8px; }
    .hw-cal-empty { visibility: hidden; }
    .hw-slot { cursor: grab; }
    .hw-slot:active { cursor: grabbing; }
    .hw-dragging { opacity: 0.4; transform: scale(0.98); }
    .hw-drag-over { border-color: rgba(167,139,250,0.5) !important; background: rgba(167,139,250,0.06) !important; }
    .hw-drag-handle { color: rgba(255,255,255,0.2); cursor: grab; display: flex; align-items: center; }
    .hw-drag-handle:hover { color: rgba(255,255,255,0.5); }
    .hw-remove-btn { background: none; border: none; color: rgba(255,255,255,0.2); font-size: 16px; cursor: pointer; padding: 0 2px; line-height: 1; transition: color 0.2s; font-family: sans-serif; }
    .hw-remove-btn:hover { color: #f87171; }
    .hw-slot-empty { display: flex; align-items: center; justify-content: center; border-style: dashed; }
    .hw-add-widget { background: none; border: none; color: rgba(255,255,255,0.25); font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; font-family: "DM Sans",sans-serif; transition: color 0.2s; padding: 20px; }
    .hw-add-widget:hover { color: rgba(167,139,250,0.8); }
    .hw-picker { display: flex; flex-direction: column; gap: 8px; width: 100%; }
    .hw-picker-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
    .hw-picker-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: rgba(255,255,255,0.7); font-size: 13px; padding: 10px 14px; cursor: pointer; text-align: left; font-family: "DM Sans",sans-serif; transition: all 0.18s; display: flex; align-items: center; gap: 8px; }
    .hw-picker-btn:hover { background: rgba(167,139,250,0.1); border-color: rgba(167,139,250,0.3); color: #fff; }
    .hw-picker-cancel { background: none; border: none; color: rgba(255,255,255,0.2); font-size: 12px; cursor: pointer; padding: 4px; font-family: "DM Sans",sans-serif; transition: color 0.2s; }
    .hw-picker-cancel:hover { color: rgba(255,255,255,0.5); }
    .hw-picker-empty { font-size: 12px; color: rgba(255,255,255,0.2); font-style: italic; text-align: center; padding: 8px 0; }
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
    .pp-name { font-size: 22px; font-weight: 600; color: #f0eeff; margin-bottom: 16px; }
    .pp-edit-form { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
    body.theme-light .pp-edit-form { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); }
    .pp-info-wrap { position: relative; display: inline-flex; }
    .pp-info-icon {
      width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05); transition: all 0.15s;
    }
    .pp-info-icon:hover { color: #a78bfa; border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.08); }
    .pp-info-tooltip {
      display: none; position: absolute; left: 30px; top: 50%; transform: translateY(-50%);
      width: 260px; background: #1a1535; border: 1px solid rgba(167,139,250,0.25);
      border-radius: 10px; padding: 12px 14px; z-index: 200;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .pp-info-wrap:hover .pp-info-tooltip { display: block; }
    .pp-info-title { font-size: 12px; font-weight: 600; color: #a78bfa; margin-bottom: 8px; }
    .pp-info-list { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 5px; }
    .pp-info-list li { font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5; }
    .pp-info-list strong { color: rgba(255,255,255,0.85); font-weight: 500; }
    .pp-info-last { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: rgba(255,255,255,0.3); }
    body.theme-light .pp-info-icon { color: rgba(0,0,0,0.35); border-color: rgba(0,0,0,0.1); background: rgba(0,0,0,0.04); }
    body.theme-light .pp-info-icon:hover { color: #7c3aed; border-color: rgba(124,58,237,0.4); background: rgba(124,58,237,0.06); }
    body.theme-light .pp-info-tooltip { background: #fff; border-color: rgba(124,58,237,0.2); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
    body.theme-light .pp-info-title { color: #7c3aed; }
    body.theme-light .pp-info-list li { color: rgba(0,0,0,0.55); }
    body.theme-light .pp-info-list strong { color: rgba(0,0,0,0.8); }
    body.theme-light .pp-info-last { color: rgba(0,0,0,0.35); border-color: rgba(0,0,0,0.08); }
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
    .task-card.task-overdue { background: rgba(239,68,68,0.07); }
    .task-card.task-overdue:hover { background: rgba(239,68,68,0.12); }
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
    .overlay-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
    .task-meta-info {
      flex: 1; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      padding: 8px 12px; font-size: 11px; color: rgba(255,255,255,0.4);
      display: flex; flex-direction: column; gap: 2px; line-height: 1.5;
    }
    body.theme-light .task-meta-info { border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.45); }

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
      width: 20px; height: 20px; flex-shrink: 0;
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
    .notes-editor-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 28px 0; flex-shrink: 0; }
    .note-share-btn {
      display: flex; align-items: center; gap: 6px; padding: 5px 12px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .note-share-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }
    .note-share-count {
      background: rgba(167,139,250,0.25); color: #a78bfa; font-size: 10px; font-weight: 700;
      border-radius: 10px; padding: 1px 6px; min-width: 18px; text-align: center;
    }
    body.theme-light .note-share-btn { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.5); }
    body.theme-light .note-share-btn:hover { background: rgba(0,0,0,0.09); color: #1a1a2e; }
    body.theme-light .note-share-count { background: rgba(124,58,237,0.12); color: #7c3aed; }
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
    /* TipTap toolbar */
    .tiptap-toolbar {
      display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
      padding: 6px 28px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    .tt-btn {
      width: 30px; height: 28px; border: none; background: transparent; border-radius: 5px;
      color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
      font-family: inherit;
    }
    .tt-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
    .tt-btn.active { background: rgba(167,139,250,0.2); color: #a78bfa; }
    .tt-btn.tt-wide { width: auto; padding: 0 8px; font-size: 12px; }
    .tt-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 4px; }
    /* TipTap editor content area */
    .tiptap-editor-wrap { flex: 1; overflow-y: auto; }
    .tiptap-editor-wrap .ProseMirror {
      padding: 16px 28px 40px; outline: none; min-height: 100%;
      font-family: 'DM Sans', sans-serif; font-size: 15px; color: rgba(255,255,255,0.82);
      line-height: 1.75;
    }
    .tiptap-editor-wrap .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder); color: rgba(255,255,255,0.18); pointer-events: none;
      height: 0; float: left;
    }
    .tiptap-editor-wrap .ProseMirror h1 { font-size: 24px; font-weight: 700; color: #f0eeff; margin: 16px 0 8px; line-height: 1.3; }
    .tiptap-editor-wrap .ProseMirror h2 { font-size: 19px; font-weight: 600; color: #e8e6ff; margin: 14px 0 6px; }
    .tiptap-editor-wrap .ProseMirror h3 { font-size: 16px; font-weight: 600; color: #e0deff; margin: 12px 0 4px; }
    .tiptap-editor-wrap .ProseMirror ul,
    .tiptap-editor-wrap .ProseMirror ol { padding-left: 22px; margin: 6px 0; }
    .tiptap-editor-wrap .ProseMirror li { margin: 3px 0; }
    .tiptap-editor-wrap .ProseMirror code { background: rgba(255,255,255,0.1); border-radius: 4px; padding: 1px 5px; font-size: 13px; font-family: monospace; }
    .tiptap-editor-wrap .ProseMirror pre { background: rgba(0,0,0,0.35); border-radius: 8px; padding: 12px 16px; margin: 10px 0; overflow-x: auto; }
    .tiptap-editor-wrap .ProseMirror pre code { background: none; padding: 0; color: #a5f3fc; }
    .tiptap-editor-wrap .ProseMirror blockquote { border-left: 3px solid rgba(167,139,250,0.6); padding-left: 14px; color: rgba(255,255,255,0.5); margin: 8px 0; }
    .tiptap-editor-wrap .ProseMirror hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0; }
    .tiptap-editor-wrap .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
    .tiptap-editor-wrap .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
    .tiptap-editor-wrap .ProseMirror ul[data-type="taskList"] li > label { margin-top: 3px; flex-shrink: 0; }
    .tiptap-editor-wrap .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] { width: 14px; height: 14px; accent-color: #7c3aed; cursor: pointer; }
    .tiptap-editor-wrap .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.5; text-decoration: line-through; }
    /* Light mode overrides for TipTap */
    body.theme-light .tiptap-toolbar { border-color: rgba(0,0,0,0.07); }
    body.theme-light .tt-btn { color: rgba(0,0,0,0.45); }
    body.theme-light .tt-btn:hover { background: rgba(0,0,0,0.06); color: #1a1a2e; }
    body.theme-light .tt-btn.active { background: rgba(124,58,237,0.12); color: #7c3aed; }
    body.theme-light .tt-sep { background: rgba(0,0,0,0.1); }
    body.theme-light .tiptap-editor-wrap .ProseMirror { color: rgba(0,0,0,0.8); }
    body.theme-light .tiptap-editor-wrap .ProseMirror p.is-editor-empty:first-child::before { color: rgba(0,0,0,0.2); }
    body.theme-light .tiptap-editor-wrap .ProseMirror h1 { color: #1a1a2e; }
    body.theme-light .tiptap-editor-wrap .ProseMirror h2 { color: #1a1a2e; }
    body.theme-light .tiptap-editor-wrap .ProseMirror h3 { color: #1a1a2e; }
    body.theme-light .tiptap-editor-wrap .ProseMirror code { background: rgba(0,0,0,0.07); }
    body.theme-light .tiptap-editor-wrap .ProseMirror pre { background: rgba(0,0,0,0.06); }
    body.theme-light .tiptap-editor-wrap .ProseMirror pre code { color: #7c3aed; }
    body.theme-light .tiptap-editor-wrap .ProseMirror blockquote { border-color: rgba(124,58,237,0.5); color: rgba(0,0,0,0.45); }
    body.theme-light .tiptap-editor-wrap .ProseMirror hr { border-color: rgba(0,0,0,0.1); }
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
    /* dash-logo is now an image */
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
    body.theme-light .hw-user-card { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); }
    body.theme-light .hw-user-name { color: #1a1a2e; }
    body.theme-light .hw-user-email { color: rgba(0,0,0,0.5); }
    body.theme-light .hw-user-id { color: rgba(0,0,0,0.3); }
    body.theme-light .hw-welcome-card { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.1); }
    body.theme-light .hw-welcome-script { background: linear-gradient(135deg,#7c3aed,#4f46e5); -webkit-background-clip: text; background-clip: text; color: transparent; }
    body.theme-light .hw-welcome-sub { color: rgba(0,0,0,0.65); }
    body.theme-light .hw-feature-list li { color: rgba(0,0,0,0.55); }
    body.theme-light .hw-slot { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.15); }
    body.theme-light .hw-slot-empty { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.12); }
    body.theme-light .hw-drag-over { border-color: rgba(124,58,237,0.4) !important; background: rgba(124,58,237,0.05) !important; }
    body.theme-light .hw-slot-title { color: rgba(0,0,0,0.35); }
    body.theme-light .hw-drag-handle { color: rgba(0,0,0,0.2); }
    body.theme-light .hw-drag-handle:hover { color: rgba(0,0,0,0.5); }
    body.theme-light .hw-remove-btn { color: rgba(0,0,0,0.2); }
    body.theme-light .hw-remove-btn:hover { color: #dc2626; }
    body.theme-light .hw-time { color: #1a1a2e; }
    body.theme-light .hw-date-lbl { color: rgba(0,0,0,0.45); }
    body.theme-light .hw-analog circle { stroke: rgba(0,0,0,0.1) !important; fill: rgba(0,0,0,0.01) !important; }
    body.theme-light .hw-analog line:not([stroke="#a78bfa"]) { stroke: rgba(0,0,0,0.5) !important; }
    body.theme-light .hw-kb-col-title span { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
    body.theme-light .hw-kb-task { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.7); }
    body.theme-light .hw-kb-empty { color: rgba(0,0,0,0.3); }
    body.theme-light .hw-empty-state { color: rgba(0,0,0,0.3); }
    body.theme-light .hw-cal-hdr { color: rgba(0,0,0,0.35); }
    body.theme-light .hw-cal-day { color: rgba(0,0,0,0.55); }
    body.theme-light .hw-open-btn { border-color: rgba(124,58,237,0.35); color: #7c3aed; }
    body.theme-light .hw-open-btn:hover { background: rgba(124,58,237,0.08); }
    body.theme-light .hw-add-widget { color: rgba(0,0,0,0.3); }
    body.theme-light .hw-add-widget:hover { color: rgba(124,58,237,0.7); }
    body.theme-light .hw-picker-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.7); }
    body.theme-light .hw-picker-btn:hover { background: rgba(124,58,237,0.08); border-color: rgba(124,58,237,0.3); color: #1a1a2e; }
    body.theme-light .hw-picker-title { color: rgba(0,0,0,0.35); }
    body.theme-light .hw-picker-cancel { color: rgba(0,0,0,0.3); }
    body.theme-light .hw-pencil { color: rgba(0,0,0,0.2); }
    body.theme-light .hw-pencil:hover { color: rgba(124,58,237,0.6); }
    body.theme-light .home-sub { color: rgba(0,0,0,0.45); }
    body.theme-light .welcome-text { background: linear-gradient(135deg,#7c3aed,#4f46e5,#059669); -webkit-background-clip: text; background-clip: text; }
    body.theme-light .info-box { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
    body.theme-light .info-box code { color: #7c3aed; }
    body.theme-light .pp-name { color: #1a1a2e; }
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
    .note-meta-row { display: flex; gap: 20px; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 6px; padding-left: 2px; }
    .note-meta-row strong { color: rgba(255,255,255,0.5); font-weight: 500; }
    body.theme-light .note-meta-row { color: rgba(0,0,0,0.35); }
    body.theme-light .note-meta-row strong { color: rgba(0,0,0,0.55); }
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
    /* Bell / notifications — light mode */
    body.theme-light .notif-btn { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.5); }
    body.theme-light .notif-btn:hover { background: rgba(0,0,0,0.09); color: #1a1a2e; }
    body.theme-light .notif-dropdown { background: rgba(255,255,255,0.99); border-color: rgba(0,0,0,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    body.theme-light .notif-header { color: #1a1a2e; border-color: rgba(0,0,0,0.07); }
    body.theme-light .notif-item { border-color: rgba(0,0,0,0.05); }
    body.theme-light .notif-item:hover { background: rgba(0,0,0,0.04); }
    body.theme-light .notif-item-title { color: #1a1a2e; }
    body.theme-light .notif-item-meta { color: rgba(0,0,0,0.4); }
    body.theme-light .notif-empty { color: rgba(0,0,0,0.3); }
    /* Notes panel — light mode */
    body.theme-light .notes-panel { background: transparent; }
    body.theme-light .notes-editor-col { background: transparent; }
    /* Kanban header — light mode */
    body.theme-light .kanban-header { color: #1a1a2e; }
    body.theme-light .kanban-col-title { color: rgba(0,0,0,0.5); }
    body.theme-light .overlay-inner .label { color: rgba(0,0,0,0.5); }
    body.theme-light .member-chip-owner { color: rgba(0,0,0,0.4); }
    body.theme-light .error { background: rgba(239,68,68,0.08); }
    /* Task overdue light mode */
    body.theme-light .task-card.task-overdue { background: rgba(239,68,68,0.06); }
    body.theme-light .task-card.task-overdue:hover { background: rgba(239,68,68,0.1); }
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
    /* pp-avatar uses user-chosen color via inline style, no accent override */
    .toggle-opt.active { background: ${ac.c1}40 !important; color: ${ac.light} !important; }
    .note-item.active { background: ${ac.c1}26 !important; border-color: ${ac.c1}59 !important; }
    .theme-option.selected { border-color: ${ac.light} !important; background: ${ac.c1}1f !important; }
    .board-card:hover { background: ${ac.c1}1f !important; border-color: ${ac.c1}66 !important; }
    .bt-option:hover { background: ${ac.c1}1f !important; border-color: ${ac.c1}66 !important; }
    .kanban-col.drag-over { border-color: ${ac.c1}80 !important; background: ${ac.c1}0f !important; }
    /* logo is now an image — no text gradient override needed */
    .welcome-text { background: linear-gradient(135deg, ${ac.light}, ${ac.c1}, #34d399) !important; -webkit-background-clip: text !important; background-clip: text !important; }
    ${theme !== "light" ? `
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
    }` : ""}
  `;

  const displayFirst = userData?.firstName || user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "User";
  const displayLast  = userData?.lastName  || user?.displayName?.split(" ").slice(1).join(" ") || "";

  if (!authChecked) {
    return (
      <>
        <style>{styles}</style>
        <div className="splash"><img src={plioLogo} alt="Plio" className="splash-logo" /></div>
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
            <img src={plioLogo} alt="Plio" className="dash-logo" />

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
                        <div
                          key={t.id + t.boardId}
                          className="notif-item"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setNotifOpen(false);
                            setActivePanel("kanban");
                            const board = kanbanBoards.find(b => b.id === t.boardId);
                            if (board) openBoard(board);
                          }}
                        >
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
                <div className="home-widgets">
                  <div className="hw-top-grid">
                    <div className="hw-user-card">
                      <div className="big-avatar hw-avatar">{displayFirst[0]?.toUpperCase() || "U"}</div>
                      <div className="hw-user-info">
                        <div className="hw-user-name">{displayFirst} {displayLast}</div>
                        <div className="hw-user-email">{user?.email}</div>
                        <div className="hw-user-id">ID: {user?.uid?.slice(0, 16)}…</div>
                      </div>
                    </div>
                    <div className="hw-welcome-card">
                      <div className="hw-welcome-script">Welcome to Plio</div>
                      <div className="hw-welcome-sub">Plio is a mini workspace</div>
                      <ul className="hw-feature-list">
                        <li>Kanban Board — Create multiple boards, manage tasks across columns.</li>
                        <li>Notes — Create, edit, and view notes.</li>
                        <li>Light / Dark Theme — Toggle between dark and light mode.</li>
                        <li>Notifications — Overdue task alerts in the header.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="hw-widgets-grid">
                    {widgetSlots.map((wType, slotIdx) => {
                      const allWidgets = ["clock","kanban","calendar"];
                      const usedWidgets = widgetSlots.filter(Boolean);
                      const available = allWidgets.filter(w => !usedWidgets.includes(w));
                      const isDragOver = wDragOver === slotIdx;
                      const isDragging = wDragFrom === slotIdx;
                      if (!wType) return (
                        <div key={slotIdx} className={"hw-slot hw-slot-empty" + (isDragOver ? " hw-drag-over" : "")}
                          onDragOver={(e) => handleWDragOver(e, slotIdx)} onDrop={(e) => handleWDrop(e, slotIdx)} onDragLeave={() => setWDragOver(null)}>
                          {widgetPicker === slotIdx ? (
                            <div className="hw-picker">
                              <div className="hw-picker-title">Add Widget</div>
                              {available.length > 0 ? available.map(w => (
                                <button key={w} className="hw-picker-btn" onClick={() => addWidget(slotIdx, w)}>{w.charAt(0).toUpperCase() + w.slice(1)}</button>
                              )) : <div className="hw-picker-empty">All widgets placed</div>}
                              <button className="hw-picker-cancel" onClick={() => setWidgetPicker(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="hw-add-widget" onClick={() => setWidgetPicker(slotIdx)}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                              Add Widget
                            </button>
                          )}
                        </div>
                      );
                      const renderContent = () => {
                        if (wType === "clock") {
                          const ch = clockTime.getHours() % 12, cm = clockTime.getMinutes(), cs = clockTime.getSeconds();
                          const secDeg = cs * 6, minDeg = cm * 6 + cs * 0.1, hrDeg = ch * 30 + cm * 0.5;
                          return (<>
                            <div className="hw-time">{clockTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                            <div className="hw-date-lbl">{clockTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
                            <svg className="hw-analog" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="44" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
                              {[...Array(12)].map((_,i) => { const a=i*30*Math.PI/180, big=i%3===0; return <line key={i} x1={50+(big?35:39)*Math.sin(a)} y1={50-(big?35:39)*Math.cos(a)} x2={50+43*Math.sin(a)} y2={50-43*Math.cos(a)} stroke={big?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.15)"} strokeWidth={big?2:1.2} strokeLinecap="round"/>; })}
                              <line x1="50" y1="50" x2={50+22*Math.sin(hrDeg*Math.PI/180)} y2={50-22*Math.cos(hrDeg*Math.PI/180)} stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" strokeLinecap="round"/>
                              <line x1="50" y1="50" x2={50+32*Math.sin(minDeg*Math.PI/180)} y2={50-32*Math.cos(minDeg*Math.PI/180)} stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round"/>
                              <line x1={50-8*Math.sin(secDeg*Math.PI/180)} y1={50+8*Math.cos(secDeg*Math.PI/180)} x2={50+36*Math.sin(secDeg*Math.PI/180)} y2={50-36*Math.cos(secDeg*Math.PI/180)} stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
                              <circle cx="50" cy="50" r="3" fill="#a78bfa"/>
                            </svg>
                          </>);
                        }
                        if (wType === "kanban") return (<>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:8}}>
                            <button onClick={()=>setActivePanel("kanban")} className="hw-open-btn">Open →</button>
                          </div>
                          {tasks.length > 0 ? (
                            <div className="hw-kb-cols">
                              <div>
                                <div className="hw-kb-col-title hw-kb-todo">Todo <span>{tasks.filter(t=>t.status==="todo").length}</span></div>
                                {tasks.filter(t=>t.status==="todo").slice(0,4).map(t=>(<div key={t.id} className="hw-kb-task">{t.title}</div>))}
                                {tasks.filter(t=>t.status==="todo").length===0 && <div className="hw-kb-empty">No tasks</div>}
                              </div>
                              <div>
                                <div className="hw-kb-col-title hw-kb-inprog">In Progress <span>{tasks.filter(t=>t.status==="inprogress").length}</span></div>
                                {tasks.filter(t=>t.status==="inprogress").slice(0,4).map(t=>(<div key={t.id} className="hw-kb-task">{t.title}</div>))}
                                {tasks.filter(t=>t.status==="inprogress").length===0 && <div className="hw-kb-empty">No tasks</div>}
                              </div>
                            </div>
                          ) : (
                            <div className="hw-empty-state">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                              <p>Open a board to see tasks</p>
                              <button className="hw-open-btn" onClick={()=>setActivePanel("kanban")}>Go to Kanban</button>
                            </div>
                          )}
                        </>);
                        if (wType === "calendar") {
                          const y=clockTime.getFullYear(), mo=clockTime.getMonth(), td=clockTime.getDate();
                          const first=new Date(y,mo,1).getDay(), days=new Date(y,mo+1,0).getDate();
                          const cells=[]; for(let i=0;i<first;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d); while(cells.length%7!==0) cells.push(null);
                          return (<>
                            <div className="hw-cal-grid">
                              {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} className="hw-cal-hdr">{d}</div>)}
                              {cells.map((d,i)=>(<div key={i} className={"hw-cal-day" + (d===td ? " hw-today" : "") + (!d ? " hw-cal-empty" : "")}>{d||""}</div>))}
                            </div>
                          </>);
                        }
                        return null;
                      };
                      const WLABELS = { clock: "Clock", kanban: "Tasks" + (kanbanBoard ? " · " + kanbanBoard.name : ""), calendar: clockTime.toLocaleDateString("en-US",{month:"long",year:"numeric"}) };
                      return (
                        <div key={slotIdx} draggable
                          className={"hw-slot" + (isDragging ? " hw-dragging" : "") + (isDragOver ? " hw-drag-over" : "")}
                          onDragStart={(e) => handleWDragStart(e, slotIdx)}
                          onDragOver={(e) => handleWDragOver(e, slotIdx)}
                          onDrop={(e) => handleWDrop(e, slotIdx)}
                          onDragEnd={handleWDragEnd}
                          onDragLeave={() => setWDragOver(null)}>
                          <div className="hw-slot-header">
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span className="hw-drag-handle" title="Drag to reorder"><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="8" cy="2" r="1.2"/><circle cx="2" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/><circle cx="2" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/></svg></span>
                              <span className="hw-slot-title">{WLABELS[wType]}</span>
                            </div>
                            <button className="hw-remove-btn" onClick={() => removeWidget(slotIdx)} title="Remove">×</button>
                          </div>
                          {renderContent()}
                        </div>
                      );
                    })}
                  </div>
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

                  <div className="pp-avatar" style={{ background: AVATAR_COLORS[userData?.avatarColor ?? 0] }}>
                    {displayFirst[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="pp-name">{displayFirst} {displayLast}</div>

                  {/* Edit Profile Form */}
                  {editingProfile ? (
                    <div className="pp-edit-form">
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Avatar Color</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {AVATAR_COLORS.map((grad, i) => (
                            <button
                              key={i}
                              onClick={() => setEditAvatarColor(i)}
                              style={{
                                width: 32, height: 32, borderRadius: "50%", border: editAvatarColor === i ? "2.5px solid #fff" : "2px solid transparent",
                                background: grad, cursor: "pointer", boxShadow: editAvatarColor === i ? "0 0 0 2px rgba(167,139,250,0.6)" : "none",
                                outline: "none", transition: "all 0.15s",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>First Name <span style={{ color: "#f87171" }}>*</span></div>
                          <input className="input" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="First name" style={{ fontSize: 13 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>Last Name</div>
                          <input className="input" value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Last name" style={{ fontSize: 13 }} />
                        </div>
                      </div>
                      {profileEditError && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>{profileEditError}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="kb-btn kb-btn-secondary" onClick={() => { setEditingProfile(false); setProfileEditError(""); }}>Cancel</button>
                        <button className="kb-btn kb-btn-primary" onClick={saveProfile} disabled={profileSaving}>
                          {profileSaving ? <span className="spinner" style={{ width: 13, height: 13 }} /> : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={openEditProfile}
                          style={{
                            fontSize: 12, padding: "6px 14px", borderRadius: 8,
                            border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)",
                            color: "#a78bfa", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          Edit Profile
                        </button>
                        <div className="pp-info-wrap">
                          <div className="pp-info-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                          </div>
                          <div className="pp-info-tooltip">
                            <div className="pp-info-title">Edit Profile — Terms</div>
                            <ul className="pp-info-list">
                              <li>You can update your <strong>avatar color</strong>, <strong>first name</strong> and <strong>last name</strong></li>
                              <li>Changes are allowed <strong>once per day</strong></li>
                              <li>Email and User ID cannot be changed</li>
                            </ul>
                            {userData?.lastProfileEdit && (
                              <div className="pp-info-last">
                                Last edited: {userData.lastProfileEdit === new Date().toISOString().split("T")[0] ? "Today" : userData.lastProfileEdit}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {profileEditError && <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{profileEditError}</div>}
                    </div>
                  )}

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
                    <div className="pp-row" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}>
                      <span className="pp-label">Email Verified</span>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <span className={`pp-value pp-badge ${user?.emailVerified ? "pp-green" : "pp-yellow"}`}>
                          {user?.emailVerified ? "Verified" : "Not verified"}
                        </span>
                        {!user?.emailVerified && (
                          <>
                            <button
                              style={{
                                fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.3)",
                                background: verifSent ? "rgba(52,211,153,0.1)" : "rgba(167,139,250,0.08)",
                                color: verifSent ? "#34d399" : "#a78bfa", cursor: verifSent ? "default" : "pointer",
                              }}
                              disabled={verifSent}
                              onClick={async () => {
                                setVerifError("");
                                try {
                                  await sendEmailVerification(user);
                                  setVerifSent(true);
                                } catch (e) {
                                  if (e.code === "auth/too-many-requests") setVerifError("Too many attempts. Wait a few minutes and try again.");
                                  else setVerifError(e.message || "Failed to send. Try again.");
                                }
                              }}
                            >
                              {verifSent ? "✓ Email sent — check your inbox (& spam)" : "Send verification email"}
                            </button>
                            {verifSent && (
                              <button
                                style={{
                                  fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", cursor: "pointer",
                                }}
                                onClick={async () => {
                                  try { await user.reload(); setUser(auth.currentUser); } catch {}
                                }}
                              >
                                I've verified — refresh status
                              </button>
                            )}
                            {verifError && <span style={{ fontSize: 11, color: "#f87171", textAlign: "right" }}>{verifError}</span>}
                          </>
                        )}
                      </div>
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
                      <div style={{ marginBottom: 4 }}><code>plio dashboard</code></div>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div className="note-item-title" style={{ flex: 1 }}>{note.title || "Untitled"}</div>
                            {note.sharedWith?.length > 0 && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(167,139,250,0.7)", flexShrink: 0 }} title="Shared">
                                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                              </svg>
                            )}
                            {note.uid !== user?.uid && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(96,165,250,0.7)", flexShrink: 0 }} title="Shared with you">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                              </svg>
                            )}
                            <button
                              className="note-delete-btn"
                              onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                              title="Delete"
                            >×</button>
                          </div>
                          <div className="note-item-preview">{note.content?.replace(/<[^>]*>/g, "").replace(/\n/g, " ") || "No content yet"}</div>
                          <div className="note-item-date">{relDate(note.updatedAt)}</div>
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
                      {/* Note Share Modal */}
                      {showNoteShare && activeNote?.id && (
                        <div className="overlay-modal" onClick={e => e.target === e.currentTarget && (setShowNoteShare(false), setNoteShareError(""))}>
                          <div className="overlay-inner" style={{ maxWidth: 420 }}>
                            <div className="overlay-title">Share Note</div>
                            {(activeNote.sharedEmails?.length > 0) && (
                              <div className="member-list" style={{ marginBottom: 16 }}>
                                {activeNote.sharedEmails.map(e => (
                                  <div key={e} className="member-chip">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                                    {e}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="input-group">
                              <label className="label">Add by Email or User ID</label>
                              <input
                                className="input"
                                type="text"
                                placeholder="email@example.com  or  User ID"
                                value={noteShareInput}
                                onChange={e => { setNoteShareInput(e.target.value); setNoteShareError(""); }}
                                onKeyDown={e => e.key === "Enter" && shareNote(noteShareInput)}
                                autoFocus
                              />
                            </div>
                            <div className="overlay-actions">
                              {noteShareError && <div className="error" style={{ fontSize: 12, marginBottom: 0 }}>{noteShareError}</div>}
                              <button className="kb-btn kb-btn-secondary" onClick={() => { setShowNoteShare(false); setNoteShareError(""); setNoteShareInput(""); }}>Close</button>
                              <button className="kb-btn kb-btn-primary" onClick={() => shareNote(noteShareInput)} disabled={noteShareSaving || !noteShareInput.trim()}>
                                {noteShareSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Share"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

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
                        {activeNote?.id && activeNote?.uid === user?.uid && (
                          <button
                            className="note-share-btn"
                            onClick={() => { setShowNoteShare(true); setNoteShareError(""); setNoteShareInput(""); }}
                            title="Share note"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Share
                            {(activeNote.sharedWith?.length > 0) && (
                              <span className="note-share-count">{activeNote.sharedWith.length}</span>
                            )}
                          </button>
                        )}
                      </div>
                      {activeNote?.lastModifiedBy && (
                        <div className="note-meta-row">
                          <span>last modified by : <strong>{activeNote.lastModifiedBy}</strong></span>
                          <span>last changed date : <strong>{activeNote.lastModifiedAt}</strong></span>
                        </div>
                      )}
                      <input
                        className="notes-editor-title"
                        placeholder="Note title…"
                        value={noteTitle}
                        onChange={e => { setNoteError(""); setNoteTitle(e.target.value); }}
                      />
                      <div className="notes-editor-divider" />
                      {/* TipTap Toolbar */}
                      {editor && (
                        <div className="tiptap-toolbar">
                          <button className={`tt-btn${editor.isActive("bold") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} title="Bold (Ctrl+B)"><strong>B</strong></button>
                          <button className={`tt-btn${editor.isActive("italic") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} title="Italic (Ctrl+I)"><em>I</em></button>
                          <button className={`tt-btn${editor.isActive("underline") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} title="Underline (Ctrl+U)"><span style={{ textDecoration: "underline" }}>U</span></button>
                          <button className={`tt-btn${editor.isActive("strike") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} title="Strikethrough"><s>S</s></button>
                          <div className="tt-sep" />
                          <button className={`tt-btn tt-wide${editor.isActive("heading", { level: 1 }) ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }} title="Heading 1">H1</button>
                          <button className={`tt-btn tt-wide${editor.isActive("heading", { level: 2 }) ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} title="Heading 2">H2</button>
                          <button className={`tt-btn tt-wide${editor.isActive("heading", { level: 3 }) ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }} title="Heading 3">H3</button>
                          <div className="tt-sep" />
                          <button className={`tt-btn${editor.isActive("bulletList") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} title="Bullet List">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
                          </button>
                          <button className={`tt-btn${editor.isActive("orderedList") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} title="Ordered List">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                          </button>
                          <button className={`tt-btn${editor.isActive("taskList") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }} title="Task List / Checklist">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                          </button>
                          <div className="tt-sep" />
                          <button className={`tt-btn${editor.isActive("blockquote") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }} title="Blockquote">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                          </button>
                          <button className={`tt-btn${editor.isActive("code") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} title="Inline Code">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                          </button>
                          <button className={`tt-btn${editor.isActive("codeBlock") ? " active" : ""}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }} title="Code Block">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          </button>
                          <div className="tt-sep" />
                          <button className="tt-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }} title="Divider">—</button>
                          <div className="tt-sep" />
                          <button className="tt-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().undo().run(); }} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                          </button>
                          <button className="tt-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().redo().run(); }} title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                          </button>
                        </div>
                      )}
                      {/* TipTap editor */}
                      <div className="tiptap-editor-wrap">
                        <EditorContent editor={editor} />
                      </div>
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
                      <div className="overlay-actions" style={{ alignItems: "center" }}>
                        <div className="task-meta-info">
                          <span>last modified by : {selectedTask?.lastModifiedBy || selectedTask?.createdBy || "—"}</span>
                          <span>last changed date : {selectedTask?.lastModifiedAt || new Date().toISOString().split("T")[0]}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                          <button className="kb-btn kb-btn-secondary" onClick={() => { setSelectedTask(null); setEditTaskError(""); }}>Cancel</button>
                          <button className="kb-btn kb-btn-primary" onClick={handleUpdateTask} disabled={kanbanLoading || !editTaskTitle.trim()}>
                            {kanbanLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}
                          </button>
                        </div>
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
                              {colTasks.map(task => {
                                const today = new Date().toISOString().split("T")[0];
                                const isOverdue = task.endDate && task.endDate < today && task.status !== "done";
                                return (
                                  <div
                                  key={task.id}
                                  className={`task-card ${dragTaskId === task.id ? "dragging" : ""} ${isOverdue ? "task-overdue" : ""}`}
                                  style={{ borderColor: isOverdue ? "#ef444488" : col.color + "66" }}
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
                                );
                              })}
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
            <img src={plioLogo} alt="Plio" className="logo" />
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
