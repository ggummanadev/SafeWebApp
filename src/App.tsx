import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Shield, 
  CheckCircle2, 
  Star, 
  AlertTriangle, 
  ExternalLink, 
  FileText,
  Info, 
  Loader2,
  ArrowRight,
  ShieldCheck,
  History,
  LayoutGrid,
  Lock,
  User,
  Globe,
  Zap,
  TrendingUp,
  AppWindow,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Menu,
  Download,
  MessageSquare,
  Settings,
  LogIn,
  LogOut,
  Trash2,
  Edit2,
  X,
  Plus,
  ShieldAlert,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
// @ts-ignore
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { cn } from "./lib/utils";
import { getBasicAnalysis, getDeepAnalysisGuide, getAppSummary, getStructuredAnalysis, getOwaspAnalysis } from "./services/gemini";
import { AnalysisResult, Post, AppInfo, AdminSettings } from "./types";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  where,
  User as FirebaseUser,
  handleFirestoreError,
  OperationType
} from "./firebase";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error && parsedError.error.includes("insufficient permissions")) {
          errorMessage = "권한이 부족하여 작업을 수행할 수 없습니다. 관리자에게 문의하세요.";
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">오류가 발생했습니다</h2>
            <p className="text-slate-600 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [storeApps, setStoreApps] = useState<AnalysisResult[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState<"home" | "result" | "store" | "community" | "admin" | "settings">("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  
  // Delete Modal State
  const [appToDelete, setAppToDelete] = useState<AnalysisResult | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [userApiKey, setUserApiKey] = useState(typeof window !== 'undefined' ? localStorage.getItem('user_gemini_api_key') || "" : "");
  
  // Search and Filter
  const [storeSearch, setStoreSearch] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [regPassword, setRegPassword] = useState("");
  const [uploadedThumbnail, setUploadedThumbnail] = useState<string | null>(null);
  
  // Community State
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Admin State
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Expand/Collapse State
  const [isReportExpanded, setIsReportExpanded] = useState(true);
  const [isGuideExpanded, setIsGuideExpanded] = useState(true);

  // Edit Modal State
  const [appToEdit, setAppToEdit] = useState<AnalysisResult | null>(null);
  const [editForm, setEditForm] = useState({ name: "", serviceDescription: "", thumbnail: "", category: "" });
  const [isEditing, setIsEditing] = useState(false);

  // Analysis Info State
  const [activeAnalysisInfo, setActiveAnalysisInfo] = useState<{title: string, desc: string, detail: string, icon: any} | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Admin Settings
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "admins"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AdminSettings;
        setAdminEmails(data.adminEmails || []);
      } else {
        // Bootstrap first admin if not exists
        setAdminEmails(["jabang78@gmail.com"]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Check Admin Status
  useEffect(() => {
    if (user && user.email) {
      setIsAdmin(adminEmails.includes(user.email) || user.email === "jabang78@gmail.com");
    } else {
      setIsAdmin(false);
    }
  }, [user, adminEmails]);

  // Fetch Store Apps
  useEffect(() => {
    const q = query(collection(db, "apps"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalysisResult));
      setStoreApps(apps);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Posts
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(p);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView("home");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('user_gemini_api_key', key);
    setUserApiKey(key);
    alert("API Key가 저장되었습니다. 이제 분석 기능을 사용할 수 있습니다.");
  };

  const handleAnalyze = async (e?: React.FormEvent, targetUrl?: string) => {
    if (e) e.preventDefault();
    const finalUrl = targetUrl || url;
    if (!finalUrl) return;

    let normalizedUrl = finalUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    setIsAnalyzing(true);
    setView("result");
    setCurrentResult(null);
    setIsReportExpanded(true);
    setIsGuideExpanded(true);
    
    try {
      const basicReport = await getBasicAnalysis(normalizedUrl);
      const summary = await getAppSummary(normalizedUrl, basicReport);
      const deepGuide = await getDeepAnalysisGuide(normalizedUrl, basicReport);
      const structured = await getStructuredAnalysis(basicReport);
      const owasp = await getOwaspAnalysis(basicReport);

      const result: AnalysisResult = {
        url: normalizedUrl,
        name: summary.name || normalizedUrl,
        category: summary.category || "기타",
        serviceDescription: summary.serviceDescription || "분석된 웹 서비스",
        securitySummary: summary.securitySummary || "분석이 완료되었습니다.",
        isBasicVerified: true,
        isDeepVerified: deepGuide.length > 0,
        basicReport,
        deepGuide,
        structuredPoints: structured.points || [],
        owaspAnalysis: owasp.owasp || [],
        timestamp: Date.now(),
        thumbnail: `https://picsum.photos/seed/${encodeURIComponent(summary.name || normalizedUrl)}/400/300`,
        isSafe: !!summary.isSafe
      };

      setCurrentResult(result);
    } catch (error: any) {
      console.error("Analysis failed", error);
      const errorMsg = error.message || "분석 중 오류가 발생했습니다.";
      alert(`${errorMsg}\n다시 시도해주세요.`);
      setView("home");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setUploadedThumbnail(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterToStore = async () => {
    if (!currentResult || !regPassword) return;
    if (regPassword.length < 4) {
      alert("비밀번호는 4자리 이상이어야 합니다.");
      return;
    }

    setIsRegistering(true);
    try {
      // UTF-8 safe base64 and URL-safe for Firestore ID (replace + with - and / with _)
      const appId = btoa(unescape(encodeURIComponent(currentResult.url)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      await setDoc(doc(db, "apps", appId), {
        ...currentResult,
        thumbnail: uploadedThumbnail || currentResult.thumbnail,
        password: regPassword,
        timestamp: Date.now()
      });
      alert("웹앱 스토어에 등록되었습니다.");
      setView("store");
    } catch (e) {
      console.error("Registration failed", e);
      alert("등록에 실패했습니다.");
    } finally {
      setIsRegistering(false);
      setRegPassword("");
      setUploadedThumbnail(null);
    }
  };

  const handleDeleteApp = async (app: AnalysisResult) => {
    setAppToDelete(app);
    setDeletePassword("");
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!appToDelete) return;
    
    try {
      setIsDeleting(true);
      setDeleteError("");

      // If not admin, check password
      if (!isAdmin) {
        if (!deletePassword) {
          setDeleteError("비밀번호를 입력해주세요.");
          setIsDeleting(false);
          return;
        }
        if (deletePassword !== appToDelete.password) {
          setDeleteError("비밀번호가 일치하지 않습니다.");
          setIsDeleting(false);
          return;
        }
      }

      await deleteDoc(doc(db, "apps", appToDelete.id!));
      setAppToDelete(null);
      alert("삭제되었습니다.");
    } catch (e) {
      console.error("Deletion failed", e);
      setDeleteError("삭제 중 오류가 발생했습니다.");
      handleFirestoreError(e, OperationType.DELETE, `apps/${appToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (app: AnalysisResult) => {
    setAppToEdit(app);
    setEditForm({
      name: app.name || "",
      serviceDescription: app.serviceDescription || "",
      thumbnail: app.thumbnail || "",
      category: app.category || ""
    });
  };

  const handleEditThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditForm(prev => ({ ...prev, thumbnail: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appToEdit || !appToEdit.id) return;
    
    setIsEditing(true);
    try {
      await setDoc(doc(db, "apps", appToEdit.id), {
        ...appToEdit,
        name: editForm.name,
        serviceDescription: editForm.serviceDescription,
        thumbnail: editForm.thumbnail,
        category: editForm.category
      }, { merge: true });
      
      alert("수정되었습니다.");
      setAppToEdit(null);
    } catch (error) {
      console.error("Update failed", error);
      alert("수정에 실패했습니다.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!newPostTitle || !newPostContent || newPostContent === '<p><br></p>') return;

    setIsPosting(true);
    try {
      const postRef = doc(collection(db, "posts"));
      await setDoc(postRef, {
        title: newPostTitle,
        content: newPostContent,
        authorName: user.displayName || "익명",
        authorEmail: user.email || "",
        authorUid: user.uid,
        timestamp: Date.now()
      });
      setNewPostTitle("");
      setNewPostContent("");
      alert("게시글이 등록되었습니다.");
    } catch (e) {
      console.error("Posting failed", e);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string, authorUid: string) => {
    if (isAdmin || (user && user.uid === authorUid)) {
      if (confirm("게시글을 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "posts", postId));
      }
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) return;
    try {
      const updatedEmails = [...adminEmails, newAdminEmail];
      await setDoc(doc(db, "settings", "admins"), { adminEmails: updatedEmails });
      setNewAdminEmail("");
      alert("관리자가 추가되었습니다.");
    } catch (e) {
      console.error("Failed to add admin", e);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email === "jabang78@gmail.com") {
      alert("기본 관리자는 삭제할 수 없습니다.");
      return;
    }
    try {
      const updatedEmails = adminEmails.filter(e => e !== email);
      await setDoc(doc(db, "settings", "admins"), { adminEmails: updatedEmails });
    } catch (e) {
      console.error("Failed to remove admin", e);
    }
  };

  const filteredApps = storeApps.filter(app => 
    app.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
    app.serviceDescription.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const popularApps = storeApps.slice(0, 6);

  const analysisMethods = [
    { icon: Shield, title: "기초 분석", desc: "구조 및 데이터 민감도 파악", detail: "웹사이트의 기본적인 구조, 사용된 기술 스택, 인증 방식, 그리고 개인정보 요구 수준을 파악하여 기초적인 보안 상태를 점검합니다. 바이브코딩 특유의 패턴이나 OWASP Top 10 취약점 노출 여부도 함께 분석합니다." },
    { icon: Star, title: "정밀 가이드", desc: "전문 도구 연동 및 가이드", detail: "기초 분석에서 위험 요소가 발견되거나 개인정보 요구가 높은 사이트의 경우, Sucuri, UpGuard, VirusTotal 등 전문 보안 검사 도구를 추천하고 초보자도 쉽게 따라할 수 있는 단계별 정밀 검사 가이드를 제공합니다." },
    { icon: CheckCircle2, title: "안전 인증", desc: "신뢰할 수 있는 앱 리스트", detail: "분석 결과 보안상 큰 위협이 없고 신뢰할 수 있다고 판명된 웹사이트만 '안전한 사이트'로 분류되어 웹앱 스토어에 등록할 수 있는 자격이 주어집니다. 이를 통해 사용자들은 검증된 앱만 안전하게 이용할 수 있습니다." }
  ];

  const getIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "shield": return <Shield className="w-6 h-6 text-blue-500" />;
      case "lock": return <Lock className="w-6 h-6 text-indigo-500" />;
      case "user": return <User className="w-6 h-6 text-emerald-500" />;
      case "globe": return <Globe className="w-6 h-6 text-sky-500" />;
      case "zap": return <Zap className="w-6 h-6 text-amber-500" />;
      default: return <Info className="w-6 h-6 text-slate-400" />;
    }
  };

  const renderHome = () => (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Popular Section */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">인기 웹앱 및 웹사이트</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {popularApps.length > 0 ? popularApps.map((app, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              onClick={() => {
                setCurrentResult(app);
                setView("result");
                setIsReportExpanded(false);
                setIsGuideExpanded(false);
              }}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer text-center group"
            >
              <div className="w-16 h-16 mx-auto mb-3 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <img 
                  src={app.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(app.name!)}/100/100`} 
                  alt={app.name}
                  className="w-12 h-12 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{app.name}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold">{app.category}</p>
            </motion.div>
          )) : (
            <div className="col-span-full py-10 text-center text-slate-400 text-sm">
              등록된 웹앱이 없습니다. 첫 번째 웹앱을 분석하고 등록해보세요!
            </div>
          )}
        </div>
      </section>

      {/* Search Section - Blue Border Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16 p-6 sm:p-10 border-2 border-blue-500 rounded-[2rem] bg-white shadow-xl shadow-blue-50"
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-8 text-center">
          새로운 웹사이트 분석하기
        </h1>
        <form onSubmit={handleAnalyze} className="w-full max-w-2xl mx-auto mb-10">
          <div className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="block w-full p-4 pl-12 text-base sm:text-lg text-slate-900 border border-slate-200 rounded-2xl bg-white shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : "분석 시작"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl mx-auto">
          {analysisMethods.map((item, i) => (
            <div 
              key={i} 
              onClick={() => setActiveAnalysisInfo(item)}
              className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-left cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group"
            >
              <item.icon className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderResult = () => (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <button 
        onClick={() => setView("home")}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        홈으로 돌아가기
      </button>

      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">웹사이트 분석 중...</h2>
          <p className="text-slate-500 text-sm sm:text-base px-4">Gemini AI가 사이트 구조와 보안 요소를 뜯어보고 있습니다.</p>
        </div>
      ) : currentResult ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Summary Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-100 relative overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 mb-6">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all",
                currentResult.isBasicVerified 
                  ? "bg-green-50 text-green-700 border-green-100" 
                  : "bg-slate-50 text-slate-400 border-slate-100"
              )}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Basic Check ✔
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all",
                currentResult.isDeepVerified 
                  ? "bg-amber-50 text-amber-700 border-amber-100" 
                  : "bg-slate-50 text-slate-400 border-slate-100"
              )}>
                <Star className={cn("w-3.5 h-3.5", currentResult.isDeepVerified && "fill-amber-500 text-amber-500")} />
                Deep Scan ★
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start mb-8">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-100 rounded-3xl overflow-hidden flex-shrink-0 shadow-inner">
                <img 
                  src={currentResult.thumbnail} 
                  alt={currentResult.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                  {currentResult.category}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 truncate">{currentResult.name}</h2>
                <p className="text-slate-600 font-medium mb-3 text-sm sm:text-base whitespace-pre-wrap">{currentResult.serviceDescription}</p>
                <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-1 overflow-hidden">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <a href={currentResult.url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                    {currentResult.url}
                  </a>
                </p>
              </div>
            </div>

            {/* Website Preview & Main Menus Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Website Preview</span>
                </div>
                <div className="aspect-video relative group">
                  <img 
                    src={currentResult.thumbnail} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Menu className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-900 text-sm">주요 메뉴 목록</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentResult.mainMenus && currentResult.mainMenus.length > 0 ? (
                    currentResult.mainMenus.map((menu, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                        {menu}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">추출된 메뉴가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 mb-8">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">보안 상태 요약</h4>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{currentResult.securitySummary}</p>
                </div>
              </div>
            </div>

            {currentResult.isSafe ? (
              <div className="pt-6 border-t border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <p className="text-xs sm:text-sm font-bold">안전한 사이트로 판명되어 스토어 등록이 가능합니다.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="썸네일 이미지 업로드"
                      />
                      <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {uploadedThumbnail ? "썸네일 변경" : "썸네일 업로드"}
                      </button>
                    </div>
                    {uploadedThumbnail && (
                      <img src={uploadedThumbnail} alt="Thumbnail preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                    )}
                  </div>
                  <input 
                    type="password" 
                    placeholder="등록 비밀번호"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full sm:w-40 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  <button
                    onClick={handleRegisterToStore}
                    disabled={isRegistering || !regPassword}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    웹앱 스토어 등록
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-6 border-t border-slate-100">
                <div className="p-5 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-900 text-lg mb-1">분석 결과: 부적합 (Unsuitable)</h4>
                    <p className="text-red-700 text-sm leading-relaxed font-medium">
                      해당 사이트는 도박, 성인, 불법 공유 또는 피싱 의심 요소가 발견되어 안전하지 않은 사이트로 분류되었습니다. 
                      보안 및 정책상의 이유로 웹앱 스토어 등록이 불가능합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Structured Points */}
          {currentResult.structuredPoints && currentResult.structuredPoints.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentResult.structuredPoints.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4"
                >
                  <div className="p-3 bg-slate-50 rounded-xl">
                    {getIcon(point.icon)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">{point.title}</h4>
                    <p className="text-sm text-slate-500 leading-snug">{point.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Detailed Analysis Report */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsReportExpanded(!isReportExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">상세 분석 리포트</h3>
              </div>
              {isReportExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            <motion.div 
              initial={false}
              animate={{ height: isReportExpanded ? "auto" : 0, opacity: isReportExpanded ? 1 : 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 sm:p-8 prose prose-slate max-w-none">
                <div className="markdown-body whitespace-pre-wrap">
                  <Markdown remarkPlugins={[remarkBreaks, remarkGfm]}>{currentResult.basicReport}</Markdown>
                </div>
              </div>
            </motion.div>
          </div>

          {/* OWASP Top 10 Analysis */}
          {currentResult.owaspAnalysis && currentResult.owaspAnalysis.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-xl font-bold text-slate-900">OWASP Top 10 보안 취약점 검사</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {currentResult.owaspAnalysis.map((item, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 text-center w-16",
                      item.status === 'safe' ? "bg-green-100 text-green-700" :
                      item.status === 'warning' ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {item.status === 'safe' ? '안전' : item.status === 'warning' ? '주의' : '위험'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{item.item}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Deep Analysis Guide */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsGuideExpanded(!isGuideExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">정밀 분석 가이드</h3>
              </div>
              {isGuideExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            <motion.div 
              initial={false}
              animate={{ height: isGuideExpanded ? "auto" : 0, opacity: isGuideExpanded ? 1 : 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 sm:p-8 prose prose-amber max-w-none bg-amber-50/30">
                <div className="markdown-body whitespace-pre-wrap">
                  {currentResult.deepGuide ? (
                    <Markdown remarkPlugins={[remarkBreaks, remarkGfm]}>{currentResult.deepGuide}</Markdown>
                  ) : (
                    <div className="text-slate-700 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        정밀 분석 가이드 미진행
                      </p>
                      <p className="leading-relaxed">해당 사이트는 기초 분석 결과 보안상 큰 위협이 발견되지 않은 안전한 사이트로 판명되어, 추가적인 정밀 분석 가이드를 진행하지 않았습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderStore = () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">웹앱 스토어</h2>
          <p className="text-slate-500">검증된 안전한 웹앱들을 검색하고 이용해보세요.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="웹앱 이름 또는 설명 검색..."
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
      </div>

      {filteredApps.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-slate-200">
          <AppWindow className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">검색 결과가 없거나 등록된 앱이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApps.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex items-center gap-6"
            >
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100 cursor-pointer"
                onClick={() => {
                  setCurrentResult(item);
                  setView("result");
                }}
              >
                <img 
                  src={item.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(item.name)}/200/200`} 
                  alt={item.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 
                      className="font-bold text-slate-900 text-base sm:text-lg truncate group-hover:text-blue-600 transition-colors cursor-pointer"
                      onClick={() => {
                        setCurrentResult(item);
                        setView("result");
                        setIsReportExpanded(false);
                        setIsGuideExpanded(false);
                      }}
                    >
                      {item.name}
                    </h3>
                    <div className="flex gap-1 shrink-0">
                      <CheckCircle2 className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", item.isBasicVerified ? "text-green-500 saturate-100" : "text-slate-200 grayscale")} />
                      <Star className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", item.isDeepVerified ? "text-amber-500 fill-amber-500 saturate-100" : "text-slate-200 grayscale")} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:hidden">
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditClick(item)}
                        className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteApp(item)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mb-2 line-clamp-1">{item.serviceDescription}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
                    {item.category}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="hidden md:flex flex-shrink-0 items-center gap-4">
                {isAdmin && (
                  <button 
                    onClick={() => handleEditClick(item)}
                    className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    title="수정"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteApp(item)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div 
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer"
                  onClick={() => {
                    setCurrentResult(item);
                    setView("result");
                    setIsReportExpanded(false);
                    setIsGuideExpanded(false);
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCommunity = () => (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">커뮤니티 게시판</h2>
        <p className="text-slate-500">웹앱 사용 후기 및 정보를 공유해보세요.</p>
      </div>

      {user ? (
        <form onSubmit={handleCreatePost} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-12">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            새 글 작성
          </h3>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="제목을 입력하세요"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
              required
            />
            <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
              <ReactQuill 
                theme="snow" 
                value={newPostContent} 
                onChange={setNewPostContent} 
                className="h-48 mb-12"
              />
            </div>
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isPosting}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : "등록하기"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-blue-50 p-8 rounded-3xl text-center mb-12 border border-blue-100">
          <Lock className="w-10 h-10 text-blue-300 mx-auto mb-3" />
          <p className="text-blue-700 font-medium mb-4">로그인 후 글을 작성할 수 있습니다.</p>
          <button 
            onClick={handleLogin}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
          >
            <LogIn className="w-5 h-5" />
            구글 로그인
          </button>
        </div>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <motion.div 
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{post.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-bold text-slate-600">{post.authorName}</span>
                  <span>•</span>
                  <span>{new Date(post.timestamp).toLocaleString()}</span>
                </div>
              </div>
              {(isAdmin || (user && user.uid === post.authorUid)) && (
                <button 
                  onClick={() => handleDeletePost(post.id, post.authorUid)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="text-slate-600 leading-relaxed prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderAdmin = () => {
    if (!isAdmin) {
      return (
        <div className="max-w-md mx-auto py-20 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">접근 권한 없음</h2>
          <p className="text-slate-500 mb-6">관리자 계정으로 로그인해주세요.</p>
          <button onClick={() => setView("home")} className="text-blue-600 font-bold hover:underline">홈으로 돌아가기</button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">관리자 페이지</h2>
          <p className="text-slate-500">시스템 설정 및 관리자 계정을 관리합니다.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            관리자 계정 설정
          </h3>
          
          <div className="flex gap-2 mb-8">
            <input 
              type="email" 
              placeholder="추가할 관리자 이메일"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <button 
              onClick={handleAddAdmin}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              추가
            </button>
          </div>

          <div className="space-y-3">
            {adminEmails.map((email) => (
              <div key={email} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-medium text-slate-700">{email}</span>
                {email !== "jabang78@gmail.com" && (
                  <button 
                    onClick={() => handleRemoveAdmin(email)}
                    className="text-red-500 hover:text-red-600 font-bold text-sm"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-amber-500" />
            <h3 className="text-xl font-bold text-slate-900">Gemini API 설정</h3>
          </div>
          
          <p className="text-slate-600 mb-8 leading-relaxed">
            Vercel 배포 환경에서 분석 기능이 작동하지 않을 경우, 본인의 Gemini API Key를 입력하여 사용할 수 있습니다.
            입력된 키는 브라우저의 로컬 스토리지에만 안전하게 저장됩니다.
          </p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">Gemini API Key</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="password"
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  placeholder="AI Studio에서 발급받은 API Key를 입력하세요"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none font-mono text-sm"
                />
                <button 
                  onClick={() => handleSaveApiKey(userApiKey)}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all whitespace-nowrap shadow-lg shadow-blue-100"
                >
                  저장하기
                </button>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-5 bg-blue-50 rounded-2xl text-blue-700 text-sm leading-relaxed border border-blue-100">
              <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold mb-2 text-blue-800">API Key 발급 방법:</p>
                <ol className="list-decimal ml-4 space-y-2">
                  <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-blue-900 transition-colors">Google AI Studio</a>에 접속합니다.</li>
                  <li>'Create API key' 버튼을 클릭하여 새 키를 발급받습니다.</li>
                  <li>발급받은 키를 위 입력창에 붙여넣고 저장하세요.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteModal = () => {
    if (!appToDelete) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
        >
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8" />
          </div>
          
          <h3 className="text-2xl font-bold text-slate-900 text-center mb-2">앱 삭제</h3>
          <p className="text-slate-500 text-center mb-8">
            <span className="font-bold text-slate-900">"{appToDelete.name}"</span> 앱을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>

          {!isAdmin && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">등록 시 설정한 비밀번호</label>
              <input 
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          )}

          {deleteError && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {deleteError}
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={() => setAppToDelete(null)}
              disabled={isDeleting}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              취소
            </button>
            <button 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "삭제하기"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!appToEdit) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              앱 정보 수정
            </h3>
            <button 
              onClick={() => setAppToEdit(null)}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleUpdateApp} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">앱 이름</label>
              <input 
                type="text" 
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">카테고리</label>
              <input 
                type="text" 
                value={editForm.category}
                onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">서비스 설명</label>
              <textarea 
                value={editForm.serviceDescription}
                onChange={(e) => setEditForm(prev => ({ ...prev, serviceDescription: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none min-h-[80px]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">썸네일</label>
              <div className="flex items-center gap-4">
                {editForm.thumbnail && (
                  <img src={editForm.thumbnail} alt="Thumbnail preview" className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0" />
                )}
                <div className="relative flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleEditThumbnailUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="썸네일 이미지 업로드"
                  />
                  <button type="button" className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    썸네일 이미지 업로드
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setAppToEdit(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button 
                type="submit"
                disabled={isEditing}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  };

  const renderAnalysisInfoModal = () => {
    if (!activeAnalysisInfo) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="p-8 text-center relative">
            <button 
              onClick={() => setActiveAnalysisInfo(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <activeAnalysisInfo.icon className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{activeAnalysisInfo.title}</h3>
            <p className="text-sm font-bold text-blue-600 mb-4">{activeAnalysisInfo.desc}</p>
            <p className="text-slate-600 text-sm leading-relaxed text-left bg-slate-50 p-4 rounded-xl border border-slate-100">
              {activeAnalysisInfo.detail}
            </p>
            <button 
              onClick={() => setActiveAnalysisInfo(null)}
              className="mt-6 w-full px-4 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              확인
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        {renderDeleteModal()}
        {renderEditModal()}
        {renderAnalysisInfoModal()}
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center gap-2 cursor-pointer shrink-0"
              onClick={() => {
                setView("home");
                setIsMenuOpen(false);
              }}
            >
              <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">안전웹앱</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={() => setView("store")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  view === "store" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                웹앱 스토어
              </button>
              <button 
                onClick={() => setView("community")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  view === "community" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                커뮤니티
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setView("admin")}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    view === "admin" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  관리자
                </button>
              )}
              
              <div className="h-6 w-px bg-slate-200 mx-2" />
              
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden lg:block">
                    <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                    <p className="text-[10px] text-slate-400">{user.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="로그아웃"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  로그인
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-3">
              {user && (
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                {isMenuOpen ? <Plus className="w-6 h-6 rotate-45" /> : <LayoutGrid className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-4 py-6 space-y-4">
                <button 
                  onClick={() => { setView("store"); setIsMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all",
                    view === "store" ? "bg-blue-50 text-blue-600" : "text-slate-600 bg-slate-50"
                  )}
                >
                  <AppWindow className="w-5 h-5" />
                  웹앱 스토어
                </button>
                <button 
                  onClick={() => { setView("community"); setIsMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all",
                    view === "community" ? "bg-blue-50 text-blue-600" : "text-slate-600 bg-slate-50"
                  )}
                >
                  <MessageSquare className="w-5 h-5" />
                  커뮤니티
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => { setView("admin"); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all",
                      view === "admin" ? "bg-blue-50 text-blue-600" : "text-slate-600 bg-slate-50"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                    관리자
                  </button>
                )}
                {!user && (
                  <button 
                    onClick={() => { handleLogin(); setIsMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-blue-600 text-white rounded-xl text-base font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    <LogIn className="w-5 h-5" />
                    구글 로그인
                  </button>
                )}
                {user && (
                  <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {user.displayName?.[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="py-6">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderHome()}
            </motion.div>
          )}
          {view === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderResult()}
            </motion.div>
          )}
          {view === "store" && (
            <motion.div
              key="store"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderStore()}
            </motion.div>
          )}
          {view === "community" && (
            <motion.div
              key="community"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderCommunity()}
            </motion.div>
          )}
          {view === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderAdmin()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-slate-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 max-w-3xl mx-auto">
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700 block mb-2">⚠️ 서비스 이용 및 등록 안내</span>
              분석 후 등록된 웹앱 및 웹사이트는 실시간 확인되며 
              도박, 포르노, 불법영상공유, 불법웹툰 및 만화공유, 불법 이미지 및 생성형 페이크이미지 공유사이트 는 등록이 안되거나, 등록 후에도 안내없이 삭제될 수 있습니다.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold">안전웹앱 (SafeWebApp)</span>
          </div>
          <p className="text-sm text-slate-400">
            &copy; 2026 SafeWebApp. Google AI Studio (Gemini) 기반 보안 분석 서비스.
          </p>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
