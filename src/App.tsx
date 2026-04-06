import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Video, 
  Mic, 
  Play, 
  Download, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Key,
  History,
  ArrowRight,
  Edit3,
  Save,
  RefreshCw,
  X,
  User as UserIcon,
  LogOut,
  CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateScript, generateVoiceover, generateVideoScene, type VideoScript } from "./services/gemini";
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, doc, onSnapshot, setDoc, FirebaseUser, handleFirestoreError, OperationType } from "./lib/firebase";

type Step = "input" | "script" | "generating" | "preview";

interface SceneAsset {
  videoUrl: string;
  audioUrl: string;
  text: string;
}

const EXAMPLES = [
  "5 Fakta unik tentang luar angkasa yang jarang diketahui",
  "Tips produktivitas untuk mahasiswa di pagi hari",
  "Resep rahasia kopi susu kekinian ala cafe",
  "Misteri sejarah yang belum terpecahkan hingga saat ini",
  "Cara memulai investasi saham untuk pemula"
];

export default function App() {
  const [step, setStep] = useState<Step>("input");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState<VideoScript | null>(null);
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [history, setHistory] = useState<VideoScript[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem("viral_shorts_history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        // Sync user to Firestore
        const userRef = doc(db, "users", firebaseUser.uid);
        try {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            isPaid: false, // Default to false, will be updated by admin/payment system
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, "users");
        }

        // Listen for payment status
        const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setIsPaid(docSnap.data().isPaid || false);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        return () => unsubscribeDoc();
      } else {
        setIsPaid(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
      setError("Gagal masuk dengan Google.");
    }
  };

  const handleLogout = () => auth.signOut();

  const handleGenerateScript = async (customTopic?: string) => {
    const targetTopic = customTopic || topic;
    if (!targetTopic.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await generateScript(targetTopic);
      setScript(res);
      setStep("script");
      
      const newHistory = [res, ...history].slice(0, 5);
      setHistory(newHistory);
      localStorage.setItem("viral_shorts_history", JSON.stringify(newHistory));
    } catch (err: any) {
      const errorMessage = err.message || "Gagal membuat skrip. Silakan coba lagi.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScene = (index: number, field: 'visualPrompt' | 'scriptText', value: string) => {
    if (!script) return;
    const newScenes = [...script.scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setScript({ ...script, scenes: newScenes });
  };

  const handleGenerateVideo = async () => {
    if (!script) return;

    if (!user) {
      setError("Silakan masuk terlebih dahulu.");
      handleLogin();
      return;
    }

    if (!isPaid) {
      setShowPaymentModal(true);
      return;
    }

    setStep("generating");
    setLoading(true);
    setError(null);
    setAssets([]);
    const newAssets: SceneAsset[] = [];

    try {
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        const [videoUrl, audioUrl] = await Promise.all([
          generateVideoScene(scene.visualPrompt),
          generateVoiceover(scene.scriptText)
        ]);
        newAssets.push({ videoUrl, audioUrl, text: scene.scriptText });
        setAssets([...newAssets]);
      }
      setStep("preview");
    } catch (err: any) {
      setError("Gagal membuat video. Pastikan server dikonfigurasi dengan API Key yang benar.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const playPreview = () => {
    setCurrentSceneIndex(0);
    if (videoRef.current && audioRef.current) {
      videoRef.current.src = assets[0].videoUrl;
      audioRef.current.src = assets[0].audioUrl;
      videoRef.current.play();
      audioRef.current.play();
    }
  };

  const onSceneEnd = () => {
    if (currentSceneIndex < assets.length - 1) {
      const nextIndex = currentSceneIndex + 1;
      setCurrentSceneIndex(nextIndex);
      if (videoRef.current && audioRef.current) {
        videoRef.current.src = assets[nextIndex].videoUrl;
        audioRef.current.src = assets[nextIndex].audioUrl;
        videoRef.current.play();
        audioRef.current.play();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans selection:bg-indigo-500/30">
      {/* Premium Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">ViralShorts <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">AI</span></h1>
              <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold mt-1">Next-Gen Content Creator</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-white">{user.displayName}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isPaid ? 'text-green-400' : 'text-neutral-500'}`}>
                    {isPaid ? 'Premium Member' : 'Free Account'}
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-white transition-all"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="px-6 py-2.5 bg-white text-black rounded-xl font-black text-sm flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-lg"
              >
                <UserIcon className="w-4 h-4" />
                Masuk
              </button>
            )}
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">AI Active</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <AnimatePresence mode="wait">
          {step === "input" && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto space-y-16"
            >
              <div className="text-center space-y-6">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-block px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-black text-indigo-400 uppercase tracking-[0.2em]"
                >
                  AI Video Generator
                </motion.div>
                <h2 className="text-5xl font-black tracking-tighter sm:text-7xl leading-none">
                  Buat Konten <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Viral</span> Dalam Detik.
                </h2>
                <p className="text-xl text-neutral-400 max-w-2xl mx-auto font-medium">
                  Tulis ide Anda, dan biarkan AI kami merancang skrip, video, dan suara secara otomatis.
                </p>
              </div>

              <div className="space-y-10">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-focus-within:opacity-50" />
                  <div className="relative bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl">
                    <textarea 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Apa yang ingin Anda buat hari ini? (Contoh: 5 Fakta unik tentang kucing)"
                      className="w-full h-48 bg-transparent text-2xl font-bold placeholder:text-neutral-700 outline-none resize-none"
                    />
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                      <div className="flex items-center gap-2 text-neutral-500 text-sm font-bold">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        AI Siap Membantu
                      </div>
                      <button 
                        onClick={() => handleGenerateScript()}
                        disabled={loading || !topic.trim()}
                        className="px-8 py-4 bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-neutral-200 transition-all active:scale-[0.95]"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        Buat Skrip
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Contoh Topik Populer
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {EXAMPLES.map((ex, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                          setTopic(ex);
                          handleGenerateScript(ex);
                        }}
                        className="text-left p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group"
                      >
                        <p className="text-sm font-bold text-neutral-300 group-hover:text-white line-clamp-2">{ex}</p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Gunakan <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="space-y-6 pt-10 border-t border-white/5">
                    <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <History className="w-4 h-4" /> Proyek Terakhir
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {history.map((h, i) => (
                        <button 
                          key={i}
                          onClick={() => {
                            setScript(h);
                            setStep("script");
                          }}
                          className="shrink-0 w-64 p-5 bg-neutral-900 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all text-left"
                        >
                          <h4 className="font-bold text-neutral-200 truncate">{h.title}</h4>
                          <p className="text-xs text-neutral-500 mt-1">{h.scenes.length} Adegan</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400 shadow-lg">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <p className="font-bold">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {step === "script" && script && (
            <motion.div 
              key="script"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-[0.2em]">
                    <CheckCircle2 className="w-4 h-4" /> Skrip Selesai
                  </div>
                  <h2 className="text-4xl font-black tracking-tight">{script.title}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setStep("input")}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all"
                  >
                    Edit Topik
                  </button>
                  <button 
                    onClick={handleGenerateVideo}
                    className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-black flex items-center gap-3 shadow-2xl shadow-indigo-500/30 transition-all active:scale-[0.98]"
                  >
                    <Video className="w-5 h-5" />
                    Buat Video Sekarang
                  </button>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                {script.scenes.map((scene, i) => (
                  <div key={i} className="group relative">
                    <div className="absolute -inset-px bg-gradient-to-br from-white/10 to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative bg-neutral-900/50 border border-white/5 rounded-[2rem] p-8 space-y-6 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-lg border border-indigo-500/20">
                            {i + 1}
                          </div>
                          <span className="text-sm font-black text-neutral-500 uppercase tracking-widest">Adegan {i + 1}</span>
                        </div>
                        <button 
                          onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                          className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-white transition-all"
                        >
                          {editingIndex === i ? <Save className="w-5 h-5 text-indigo-400" /> : <Edit3 className="w-5 h-5" />}
                        </button>
                      </div>

                      {editingIndex === i ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Visual Prompt</label>
                            <textarea 
                              value={scene.visualPrompt}
                              onChange={(e) => handleUpdateScene(i, 'visualPrompt', e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-neutral-300 focus:border-indigo-500 outline-none min-h-[100px]"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Voiceover</label>
                            <textarea 
                              value={scene.scriptText}
                              onChange={(e) => handleUpdateScene(i, 'scriptText', e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-neutral-300 focus:border-indigo-500 outline-none min-h-[100px]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Visual Prompt</label>
                            <p className="text-sm text-neutral-400 italic leading-relaxed">"{scene.visualPrompt}"</p>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Voiceover</label>
                            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex items-start gap-4">
                              <Mic className="w-5 h-5 text-indigo-400 mt-1 shrink-0" />
                              <p className="text-neutral-200 leading-relaxed font-medium">{scene.scriptText}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div 
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-3xl mx-auto text-center space-y-16 py-20"
            >
              <div className="relative w-48 h-48 mx-auto">
                <div className="absolute inset-0 border-8 border-indigo-500/10 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-8 border-indigo-500 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="w-16 h-16 text-indigo-400 animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-5xl font-black tracking-tight italic">Sedang Meracik Keajaiban...</h2>
                <div className="max-w-md mx-auto p-6 bg-white/5 border border-white/5 rounded-3xl space-y-3">
                  <p className="text-indigo-400 font-black text-xs uppercase tracking-[0.2em]">Tips Viral</p>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Tahukah Anda? Video dengan durasi di bawah 60 detik memiliki tingkat retensi 40% lebih tinggi di TikTok.
                  </p>
                </div>
              </div>

              <div className="space-y-6 max-w-xl mx-auto">
                <div className="flex justify-between text-sm font-black text-neutral-500 uppercase tracking-[0.1em]">
                  <span>Proses Pembuatan</span>
                  <span className="text-indigo-400">{assets.length} / {script?.scenes.length} Adegan Siap</span>
                </div>
                <div className="h-4 bg-neutral-900 rounded-full overflow-hidden p-1 border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(assets.length / (script?.scenes.length || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-center gap-3">
                  {script?.scenes.map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-3 rounded-full transition-all duration-500 ${i < assets.length ? 'bg-indigo-500 scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-neutral-800'}`} 
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === "preview" && assets.length > 0 && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid lg:grid-cols-2 gap-16 items-start"
            >
              <div className="space-y-8 sticky top-32">
                <div className="aspect-[9/16] bg-black rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(99,102,241,0.15)] border border-white/10 relative group">
                  <video 
                    ref={videoRef}
                    onEnded={onSceneEnd}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  <audio ref={audioRef} />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <button 
                      onClick={playPreview}
                      className="w-24 h-24 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
                    >
                      <Play className="w-10 h-10 text-white fill-white" />
                    </button>
                  </div>

                  <div className="absolute bottom-12 left-8 right-8 text-center space-y-4">
                    <AnimatePresence mode="wait">
                      <motion.p 
                        key={currentSceneIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-white text-xl font-black drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-tight"
                      >
                        {assets[currentSceneIndex]?.text}
                      </motion.p>
                    </AnimatePresence>
                    <div className="flex justify-center gap-1.5">
                      {assets.map((_, i) => (
                        <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentSceneIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={playPreview}
                  className="w-full py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all shadow-xl active:scale-[0.98]"
                >
                  <Play className="w-6 h-6 fill-black" />
                  Putar Pratinjau Lengkap
                </button>
              </div>

              <div className="space-y-12">
                <div className="space-y-4">
                  <div className="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-black text-green-400 uppercase tracking-[0.2em]">
                    Siap Diunggah
                  </div>
                  <h2 className="text-5xl font-black tracking-tight">Karya Anda <span className="text-indigo-400">Selesai.</span></h2>
                  <p className="text-lg text-neutral-400 font-medium">Unduh aset di bawah ini dan gabungkan untuk hasil terbaik, atau gunakan langsung untuk konten Anda.</p>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Download className="w-4 h-4" /> Daftar Aset Adegan
                  </h3>
                  <div className="grid gap-4">
                    {assets.map((asset, i) => (
                      <div key={i} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 flex items-center justify-between group hover:border-indigo-500/40 transition-all backdrop-blur-sm">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 font-black text-xl border border-indigo-500/20">
                            {i + 1}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-neutral-200 truncate max-w-[200px] md:max-w-[300px]">{asset.text}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                                <Video className="w-3 h-3" /> Video Ready
                              </span>
                              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                                <Mic className="w-3 h-3" /> Audio Ready
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <a 
                            href={asset.videoUrl} 
                            download={`scene-${i+1}.mp4`}
                            className="p-3 bg-white/5 hover:bg-indigo-500 rounded-xl text-neutral-400 hover:text-white transition-all shadow-lg"
                            title="Download Video"
                          >
                            <Video className="w-5 h-5" />
                          </a>
                          <a 
                            href={asset.audioUrl} 
                            download={`audio-${i+1}.wav`}
                            className="p-3 bg-white/5 hover:bg-purple-500 rounded-xl text-neutral-400 hover:text-white transition-all shadow-lg"
                            title="Download Audio"
                          >
                            <Mic className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-[2rem] space-y-6 relative overflow-hidden group">
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000" />
                  <div className="flex items-center gap-4 text-indigo-400">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-xl font-black tracking-tight">Siap Monetisasi</h4>
                  </div>
                  <p className="text-neutral-400 leading-relaxed font-medium">
                    Aset ini dibuat khusus menggunakan Google AI. Anda memiliki hak penuh untuk menggunakan suara dan video ini untuk konten yang dimonetisasi di YouTube, TikTok, dan Instagram.
                  </p>
                  <div className="flex gap-4 pt-4">
                    <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-widest border border-white/5">No Copyright</div>
                    <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-widest border border-white/5">AI Generated</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl space-y-8"
            >
              <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center border border-green-500/20 mx-auto">
                <CreditCard className="w-10 h-10 text-green-400" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-3xl font-black tracking-tight">Upgrade ke Premium</h3>
                <p className="text-neutral-400 leading-relaxed font-medium">
                  Fitur pembuatan video otomatis memerlukan akun Premium. Dapatkan akses tak terbatas ke Veo 3.1 dan Gemini Pro.
                </p>
              </div>
              <div className="space-y-4">
                <button 
                  className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-2xl font-black text-lg shadow-xl shadow-green-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  Berlangganan Sekarang <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-4 text-neutral-500 font-bold hover:text-white transition-colors"
                >
                  Mungkin Nanti
                </button>
              </div>
              <div className="pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                  Pembayaran Aman & Terenkripsi
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/5 py-20 mt-20 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tight">ViralShorts <span className="text-indigo-400">AI</span></h1>
            </div>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Platform revolusioner untuk kreator konten masa depan. Buat video pendek viral dalam hitungan detik dengan kekuatan Google AI.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Teknologi</h4>
            <ul className="space-y-3 text-sm text-neutral-500 font-bold">
              <li className="hover:text-indigo-400 transition-colors">Gemini 3.1 Flash</li>
              <li className="hover:text-indigo-400 transition-colors">Veo 3.1 Lite</li>
              <li className="hover:text-indigo-400 transition-colors">Imagen 4.0</li>
              <li className="hover:text-indigo-400 transition-colors">Google Cloud AI</li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Bantuan</h4>
            <ul className="space-y-3 text-sm text-neutral-500 font-bold">
              <li className="hover:text-indigo-400 transition-colors">Panduan Pengguna</li>
              <li className="hover:text-indigo-400 transition-colors">Kebijakan Privasi</li>
              <li className="hover:text-indigo-400 transition-colors">Syarat & Ketentuan</li>
              <li className="hover:text-indigo-400 transition-colors">Hubungi Kami</li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-20 text-center">
          <p className="text-neutral-600 text-[10px] font-black uppercase tracking-[0.3em]">
            &copy; 2026 ViralShorts AI. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
