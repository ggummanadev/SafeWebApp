import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Shield, 
  CheckCircle2, 
  Star, 
  AlertTriangle, 
  ExternalLink, 
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
  Download,
  MessageSquare,
  Settings,
  LogIn,
  LogOut,
  Trash2,
  Plus,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { cn } from "./lib/utils";
import { getBasicAnalysis, getDeepAnalysisGuide, getAppSummary, getStructuredAnalysis } from "./services/gemini";
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
  User as FirebaseUser
} from "./firebase";

export default function App() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [storeApps, setStoreApps] = useState<AnalysisResult[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState<"home" | "result" | "store" | "community" | "admin">("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  
  // Search and Filter
  const [storeSearch, setStoreSearch] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [regPassword, setRegPassword] = useState("");
  
  // Community State
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Admin State
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    
    try {
      const basicReport = await getBasicAnalysis(normalizedUrl);
      const summary = await getAppSummary(normalizedUrl, basicReport);
      const deepGuide = await getDeepAnalysisGuide(normalizedUrl, basicReport);
      const structured = await getStructuredAnalysis(basicReport);

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
        timestamp: Date.now(),
        thumbnail: `https://picsum.photos/seed/${encodeURIComponent(summary.name || normalizedUrl)}/400/300`,
        isSafe: summary.isSafe
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

  const handleRegisterToStore = async () => {
    if (!currentResult || !regPassword) return;
    if (regPassword.length < 4) {
      alert("비밀번호는 4자리 이상이어야 합니다.");
      return;
    }

    setIsRegistering(true);
    try {
      const appId = btoa(currentResult.url).replace(/=/g, "");
      await setDoc(doc(db, "apps", appId), {
        ...currentResult,
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
    }
  };

  const handleDeleteApp = async (app: AnalysisResult) => {
    if (isAdmin) {
      if (confirm("관리자 권한으로 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "apps", app.id!));
      }
      return;
    }

    const pw = prompt("등록 시 설정한 비밀번호를 입력하세요.");
    if (pw === app.password) {
      await deleteDoc(doc(db, "apps", app.id!));
      alert("삭제되었습니다.");
    } else if (pw !== null) {
      alert("비밀번호가 일치하지 않습니다.");
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!newPostTitle || !newPostContent) return;

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
          {[
            { icon: Shield, title: "기초 분석", desc: "구조 및 데이터 민감도 파악" },
            { icon: Star, title: "정밀 가이드", desc: "전문 도구 연동 및 가이드" },
            { icon: CheckCircle2, title: "안전 인증", desc: "신뢰할 수 있는 앱 리스트" }
          ].map((item, i) => (
            <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-left">
              <item.icon className="w-8 h-8 text-blue-500 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
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
                <p className="text-slate-600 font-medium mb-3 text-sm sm:text-base">{currentResult.serviceDescription}</p>
                <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-1 overflow-hidden">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <a href={currentResult.url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                    {currentResult.url}
                  </a>
                </p>
              </div>
            </div>

            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 mb-8">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">보안 상태 요약</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">{currentResult.securitySummary}</p>
                </div>
              </div>
            </div>

            {currentResult.isSafe && (
              <div className="pt-6 border-t border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <p className="text-xs sm:text-sm font-bold">안전한 사이트로 판명되어 스토어 등록이 가능합니다.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
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

          {/* Basic Analysis Report */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-900">상세 분석 리포트</h3>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 prose prose-slate max-w-none shadow-sm overflow-x-auto">
              <Markdown>{currentResult.basicReport}</Markdown>
            </div>
          </section>

          {/* Deep Analysis Guide */}
          {currentResult.deepGuide && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h3 className="text-xl font-bold text-slate-900">정밀 분석 가이드</h3>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 prose prose-amber max-w-none shadow-sm">
                <Markdown>{currentResult.deepGuide}</Markdown>
              </div>
            </section>
          )}
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
                      }}
                    >
                      {item.name}
                    </h3>
                    <div className="flex gap-1 shrink-0">
                      <CheckCircle2 className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", item.isBasicVerified ? "text-green-500 saturate-100" : "text-slate-200 grayscale")} />
                      <Star className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", item.isDeepVerified ? "text-amber-500 fill-amber-500 saturate-100" : "text-slate-200 grayscale")} />
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteApp(item)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors md:hidden"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <textarea 
              placeholder="내용을 입력하세요"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none min-h-[120px]"
              required
            />
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
            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>
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
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
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
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">웹앱모음</span>
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
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold">웹앱모음 (SafeWebApp)</span>
          </div>
          <p className="text-sm text-slate-400">
            &copy; 2026 SafeWebApp. Google AI Studio (Gemini) 기반 보안 분석 서비스.
          </p>
        </div>
      </footer>
    </div>
  );
}
