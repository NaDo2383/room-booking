import React, { useState, useMemo, useEffect } from "react"
// 1. Import toast and Toaster
import toast, { Toaster } from "react-hot-toast"
import {
  Calendar,
  Plus,
  LayoutDashboard,
  ChevronRight,
  Coffee,
  Briefcase,
  Users2,
  Zap,
  Info,
  Trash2,
  LogOut,
  User,
  CheckCircle,
} from "lucide-react"

// FIREBASE IMPORTS
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore"
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth"

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

// --- TYPES ---
export interface Booking {
  id: string
  title: string
  organizer: string
  date: string
  startTime: string
  endTime: string
  type: "internal" | "client" | "focus" | "social"
  bookedBy: string
  userId: string
}

const getTodayString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString())
  const [newBooking, setNewBooking] = useState({
    title: "",
    organizer: "",
    date: getTodayString(),
    start: "10:00",
    end: "11:00",
    type: "internal",
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "bookings"), orderBy("startTime", "asc"))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookingsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[]
        setBookings(bookingsData)
      },
      (error) => {
        console.error("Firestore Listen Error:", error)
      },
    )
    return () => unsubscribe()
  }, [user])

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider()
    try {
      setAuthLoading(true)
      await signInWithPopup(auth, provider)
      toast.success("Welcome back!")
    } catch (error) {
      toast.error("Google login failed")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setAuthLoading(true)
      await signInWithEmailAndPassword(auth, email, password)
      toast.success("Signed in successfully")
    } catch (error) {
      toast.error("Invalid email or password")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    signOut(auth)
    toast.success("Signed out")
  }

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newBooking.title || !newBooking.organizer) return

    // Duration Logic
    if (newBooking.end <= newBooking.start) {
      toast.error("End time must be after start time")
      return
    }

    const hasConflict = bookings.some(
      (b) =>
        b.date === newBooking.date &&
        newBooking.start < b.endTime &&
        newBooking.end > b.startTime,
    )

    if (hasConflict) {
      toast.error("This time slot is already reserved")
      return
    }

    const loadToast = toast.loading("Saving booking...")
    try {
      await addDoc(collection(db, "bookings"), {
        title: newBooking.title,
        organizer: newBooking.organizer,
        date: newBooking.date,
        startTime: newBooking.start,
        endTime: newBooking.end,
        type: newBooking.type,
        bookedBy: user.displayName || user.email || "Unknown",
        userId: user.uid,
      })

      setNewBooking({ ...newBooking, title: "", organizer: "" })
      toast.success("Space reserved successfully!", { id: loadToast })
    } catch (error) {
      toast.error("Failed to save booking", { id: loadToast })
    }
  }

  const handleDeleteBooking = async (id: string) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      try {
        await deleteDoc(doc(db, "bookings", id))
        toast.success("Booking cancelled")
      } catch (error) {
        toast.error("Permission denied")
      }
    }
  }

  // --- UTILS & MEMOS ---
  const next7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return {
        full: `${year}-${month}-${day}`,
        dayName: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
        dateNum: d.getDate(),
      }
    })
  }, [])

  const timeSlots = Array.from({ length: 19 }, (_, i) => {
    const totalMinutes = 540 + i * 30
    const h = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, "0")
    const m = (totalMinutes % 60).toString().padStart(2, "0")
    return `${h}:${m}`
  })

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const currentBookings = useMemo(() => {
    return bookings.filter((b) => b.date === selectedDate)
  }, [bookings, selectedDate])

  // Calculate live status (re-runs when 'now' updates)
  const isRoomOccupiedNow = useMemo(() => {
    const today = getTodayString()
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`

    return bookings.some(
      (b) => b.date === today && currentTime >= b.startTime && currentTime < b.endTime,
    )
  }, [bookings, now])

  const getStyleForType = (type: string) => {
    switch (type) {
      case "client":
        return "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-emerald-100"
      case "internal":
        return "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-indigo-100"
      case "focus":
        return "bg-amber-50 border-amber-500 text-amber-900 shadow-amber-100"
      case "social":
        return "bg-rose-50 border-rose-500 text-rose-900 shadow-rose-100"
      default:
        return "bg-slate-50 border-slate-500 text-slate-900"
    }
  }

  if (authLoading)
    return <div className='min-h-screen flex items-center justify-center'>Loading...</div>

  if (!user) {
    return (
      <div className='min-h-screen bg-slate-100 flex items-center justify-center p-6'>
        {/* 2. Place Toaster inside your component */}
        <Toaster position='top-center' reverseOrder={false} />
        <div className='bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200 text-center'>
          <h1 className='text-2xl font-bold text-slate-900 mb-6'>Room Booking BGM</h1>
          <button
            onClick={handleGoogleLogin}
            className='w-full py-3 border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all'>
            <svg width='20' height='20' viewBox='0 0 24 24'>
              <path
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                fill='#4285F4'
              />
              <path
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                fill='#34A853'
              />
              <path
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z'
                fill='#FBBC05'
              />
              <path
                d='M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                fill='#EA4335'
              />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-slate-50 flex flex-col md:flex-row'>
      <Toaster position='top-right' reverseOrder={false} />
      <aside className='w-full md:w-80 bg-white border-r border-slate-200  p-6 flex-shrink-0 flex flex-col'>
        <div className='flex items-center justify-between mb-8 sticky top-8'>
          <div className='flex items-center gap-2'>
            <div className='bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-100'>
              <Calendar className='text-white w-5 h-5' />
            </div>
            <h1 className='text-xl font-bold tracking-tight text-slate-900'>Confero</h1>
          </div>
          <button
            onClick={handleLogout}
            className='p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors'>
            <LogOut className='w-4 h-4' />
          </button>
        </div>

        <div className='mb-8 sticky top-24'>
          <div className='p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold'>
                {user.displayName?.charAt(0).toUpperCase() ||
                  user.email?.charAt(0).toUpperCase()}
              </div>
              <div className='overflow-hidden'>
                <p className='text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1'>
                  Signed in as
                </p>
                <p className='font-bold text-slate-900 truncate'>
                  {user.displayName || user.email}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border transition-all duration-500 ${
              isRoomOccupiedNow
                ? "bg-amber-50 border-amber-200"
                : "bg-emerald-50 border-emerald-200"
            }`}>
            <div className='flex items-center gap-2 mb-1'>
              <div
                className={`w-2 h-2 rounded-full animate-pulse ${
                  isRoomOccupiedNow ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isRoomOccupiedNow ? "text-amber-700" : "text-emerald-700"
                }`}>
                Live Status
              </span>
            </div>
            <p
              className={`text-lg font-bold ${
                isRoomOccupiedNow ? "text-amber-900" : "text-emerald-900"
              }`}>
              {isRoomOccupiedNow ? "Occupied" : "Available Now"}
            </p>
          </div>
        </div>

        <div className='bg-slate-50 p-5 rounded-2xl border border-slate-100 mt-auto'>
          <h3 className='text-sm font-bold text-slate-900 mb-3 flex items-center gap-2'>
            <Info className='w-4 h-4 text-indigo-600' />
            Guidelines
          </h3>
          <ul className='space-y-3'>
            <li className='text-[11px] text-slate-600 flex gap-2'>
              <span className='text-indigo-400 font-bold'>•</span> Only owners can delete.
            </li>
            <li className='text-[11px] text-slate-600 flex gap-2'>
              <span className='text-indigo-400 font-bold'>•</span> Minimum booking time is
              30 minutes.
            </li>
          </ul>
        </div>
      </aside>

      <main className='flex-1 p-6 md:p-10 overflow-y-auto'>
        <div className='max-w-5xl mx-auto space-y-8'>
          <div className='space-y-6'>
            <h2 className='text-3xl font-bold text-slate-900 tracking-tight'>
              Weekly Schedule
            </h2>
            <div className='flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit overflow-x-auto no-scrollbar shadow-inner'>
              {next7Days.map((day) => (
                <button
                  key={day.full}
                  onClick={() => setSelectedDate(day.full)}
                  className={`flex flex-col items-center min-w-[70px] py-3 px-4 rounded-xl transition-all ${
                    selectedDate === day.full
                      ? "bg-white shadow-md text-indigo-600"
                      : "text-slate-500 hover:bg-white/40"
                  }`}>
                  <span className='text-[10px] font-bold uppercase tracking-wider mb-1'>
                    {day.dayName}
                  </span>
                  <span className='text-lg font-bold'>{day.dateNum}</span>
                </button>
              ))}
            </div>
          </div>

          <div className='bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='p-6 border-b border-slate-100 flex items-center justify-between'>
              <h3 className='font-bold text-slate-900 flex items-center gap-2'>
                <LayoutDashboard className='w-4 h-4 text-slate-400' />
                Schedule for{" "}
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </h3>
            </div>

            <div className='relative p-6 bg-slate-50/10 min-h-[500px]'>
              <div className='space-y-6 relative z-10'>
                {timeSlots.map((time) => {
                  const [h, m] = time.split(":").map(Number)
                  const slotMinutes = h * 60 + m

                  const bookingAtTime = currentBookings.find((b) => {
                    const [bh, bm] = b.startTime.split(":").map(Number)
                    const bStart = bh * 60 + bm
                    return bStart >= slotMinutes && bStart < slotMinutes + 30
                  })
                  const isOwner = bookingAtTime?.userId === user.uid

                  let duration = 1
                  if (bookingAtTime) {
                    const [sh, sm] = bookingAtTime.startTime.split(":").map(Number)
                    const [eh, em] = bookingAtTime.endTime.split(":").map(Number)
                    const diff = eh * 60 + em - (sh * 60 + sm)
                    duration = diff / 30
                  }

                  return (
                    <div key={time} className='flex gap-4 group'>
                      <div className='w-12 text-[10px] font-bold text-slate-400 pt-1 font-mono'>
                        {time}
                      </div>
                      <div className='flex-1 h-6 border-t border-slate-100 relative'>
                        {bookingAtTime && (
                          <div
                            className={`absolute top-0 left-0 right-0 m-1 p-1 rounded-xl border-l-4 transition-all hover:scale-[1.01] flex flex-col justify-between ${getStyleForType(
                              bookingAtTime.type,
                            )}`}
                            style={{
                              height: `calc(${duration} * 1.5rem + ${
                                duration - 0.3
                              } * 1.5rem)`,
                              zIndex: 20,
                            }}>
                            <div className='flex justify-between items-start'>
                              <div className='overflow-hidden  flex  gap-2'>
                                <p className='font-bold text-sm truncate leading-tight flex items-end'>
                                  {bookingAtTime.title}:
                                </p>
                                <p className='text-[10px] font-medium opacity-70 truncate flex items-end'>
                                  {bookingAtTime.organizer}
                                </p>
                              </div>
                              <div className='flex items-center gap-2'>
                                <span className='text-[10px] font-mono font-bold opacity-40 whitespace-nowrap'>
                                  {bookingAtTime.startTime}-{bookingAtTime.endTime}
                                </span>
                                {isOwner && (
                                  <button
                                    onClick={() => handleDeleteBooking(bookingAtTime.id)}
                                    className='p-1.5 bg-white/40 hover:bg-rose-500 hover:text-white rounded-lg transition-all'>
                                    <Trash2 className='w-3.5 h-3.5' />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className='flex items-center justify-between mt-auto'>
                              <div className='flex items-center gap-1.5 opacity-60'>
                                <User className='w-3 h-3' />
                                <span className='text-[10px] font-bold'>
                                  Booked by {bookingAtTime.bookedBy}
                                </span>
                              </div>
                              {isOwner && <CheckCircle className='w-3 h-3 opacity-40' />}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className='bg-white p-8 rounded-3xl shadow-sm border border-slate-200'>
            <h3 className='text-xl font-bold mb-6 flex items-center gap-2 text-slate-900'>
              <Plus className='w-5 h-5 text-indigo-600' />
              Reserve Space
            </h3>
            <form
              onSubmit={handleAddBooking}
              className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              <div className='space-y-1.5'>
                <label className='text-xs font-bold text-slate-500 uppercase px-1'>
                  Meeting Title
                </label>
                <input
                  type='text'
                  placeholder='e.g. Sales Review'
                  required
                  value={newBooking.title}
                  onChange={(e) =>
                    setNewBooking({ ...newBooking, title: e.target.value })
                  }
                  className='w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-xs font-bold text-slate-500 uppercase px-1'>
                  Organization Unit
                </label>
                <input
                  type='text'
                  placeholder='e.g. Sales Dept'
                  required
                  value={newBooking.organizer}
                  onChange={(e) =>
                    setNewBooking({ ...newBooking, organizer: e.target.value })
                  }
                  className='w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-xs font-bold text-slate-500 uppercase px-1'>
                  Meeting Date
                </label>
                <input
                  type='date'
                  min={getTodayString()}
                  value={newBooking.date}
                  onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                  className='w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono'
                />
              </div>

              <div className='md:col-span-2 lg:col-span-3 space-y-3'>
                <label className='text-xs font-bold text-slate-500 uppercase px-1'>
                  Select Type
                </label>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                  {[
                    {
                      id: "internal",
                      label: "Internal",
                      icon: Users2,
                      color: "text-indigo-600",
                      bg: "bg-indigo-50",
                    },
                    {
                      id: "client",
                      label: "Client",
                      icon: Briefcase,
                      color: "text-emerald-600",
                      bg: "bg-emerald-50",
                    },
                    {
                      id: "focus",
                      label: "Focus",
                      icon: Zap,
                      color: "text-amber-600",
                      bg: "bg-amber-50",
                    },
                    {
                      id: "social",
                      label: "Social",
                      icon: Coffee,
                      color: "text-rose-600",
                      bg: "bg-rose-50",
                    },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type='button'
                      onClick={() =>
                        setNewBooking({ ...newBooking, type: type.id as any })
                      }
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        newBooking.type === type.id
                          ? `border-indigo-600 ${type.bg}`
                          : "border-slate-100 bg-white"
                      }`}>
                      <type.icon className={`w-4 h-4 ${type.color}`} />
                      <span
                        className={`text-xs font-bold ${
                          newBooking.type === type.id
                            ? "text-indigo-900"
                            : "text-slate-600"
                        }`}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4 md:col-span-2'>
                <div className='space-y-1.5'>
                  <label className='text-xs font-bold text-slate-500 uppercase px-1 font-mono'>
                    Start
                  </label>
                  <div className='relative'>
                    <select
                      value={newBooking.start}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, start: e.target.value })
                      }
                      className='w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono appearance-none'>
                      {Array.from({ length: 19 }).map((_, i) => {
                        const totalMinutes = 540 + i * 30
                        const h = Math.floor(totalMinutes / 60)
                          .toString()
                          .padStart(2, "0")
                        const m = (totalMinutes % 60).toString().padStart(2, "0")
                        const t = `${h}:${m}`
                        return (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      })}
                    </select>
                    <ChevronRight className='w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none' />
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-xs font-bold text-slate-500 uppercase px-1 font-mono'>
                    End
                  </label>
                  <div className='relative'>
                    <select
                      value={newBooking.end}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, end: e.target.value })
                      }
                      className='w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono appearance-none'>
                      {Array.from({ length: 19 }).map((_, i) => {
                        const totalMinutes = 540 + i * 30
                        const h = Math.floor(totalMinutes / 60)
                          .toString()
                          .padStart(2, "0")
                        const m = (totalMinutes % 60).toString().padStart(2, "0")
                        const t = `${h}:${m}`
                        return (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      })}
                    </select>
                    <ChevronRight className='w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none' />
                  </div>
                </div>
              </div>

              <div className='md:col-span-1 flex items-end'>
                <button
                  type='submit'
                  className='w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100'>
                  Confirm Booking <ChevronRight className='w-4 h-4' />
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
