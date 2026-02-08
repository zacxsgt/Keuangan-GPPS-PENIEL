import React, { useState, useMemo, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  ref, 
  onValue, 
  set, 
  push, 
  update,
  remove,
  get
} from 'firebase/database';
import { 
  getToken, 
  onMessage 
} from 'firebase/messaging';
import { 
  auth, 
  database, 
  messaging, 
  VAPID_KEY,
  EMAIL_TO_ROLE 
} from './firebase';
import { useNotificationListener } from './useNotificationListener'; // ← TAMBAHKAN INI
import {
  Users,
  Wallet,
  CheckCircle,
  XCircle,
  PlusCircle,
  LogOut,
  Bell,
  BarChart3,
  ShieldCheck,
  Menu,
  X,
  Music,
  Building2,
  HeartHandshake,
  Clock,
  AlertCircle,
  Lock,
  KeyRound,
  Calendar,
  Megaphone,
  BellRing,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

// ===============================
// CONSTANTS & CONFIG
// ===============================

const CHURCH_NAME = "GPPS PENIEL";
const CHURCH_LOGO_URL = "./logo-gpps.jpeg";

const KATEGORI = {
  PEMBANGUNAN: 'pembangunan',
  MUSIK: 'musik',
  DIAKONIA: 'diakonia'
};

const ROLES = {
  ADMIN: 'admin',
  PEMBANGUNAN: 'pembangunan',
  DIAKONIA: 'diakonia',
  MUSIK: 'musik',
  JEMAAT: 'jemaat'
};

// ===============================
// MAIN APP COMPONENT
// ===============================

const App = () => {
  // ========== STATE MANAGEMENT ==========
  
  // Auth & User
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStep, setLoginStep] = useState('choose');  // ← TAMBAHKAN BARIS INI
  const [selectedRole, setSelectedRole] = useState(null); // ← TAMBAHKAN BARIS INI

  // UI State
  const [view, setView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  // Modals
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isJadwalOpen, setIsJadwalOpen] = useState(false);
  const [isPengumumanOpen, setIsPengumumanOpen] = useState(false);
  
  // Data
  const [transactions, setTransactions] = useState([]);
  const [jadwalKebaktian, setJadwalKebaktian] = useState([]);
  const [pengumuman, setPengumuman] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  
  // Forms
  const [formData, setFormData] = useState({
    tipe: 'masuk',
    kategori: KATEGORI.PEMBANGUNAN,
    nominal: '',
    keterangan: '',
    tanggal: new Date().toISOString().split('T')[0]
  });
  
  const [changePassForm, setChangePassForm] = useState({
    old: '',
    new: '',
    confirm: ''
  });
  
  const [jadwalForm, setJadwalForm] = useState({
    judul: '',
    tanggal: '',
    waktu: '',
    lokasi: '',
    keterangan: ''
  });
  
  const [pengumumanForm, setPengumumanForm] = useState({
    judul: '',
    isi: '',
    tanggal: new Date().toISOString().split('T')[0]
  });
  
  // Notification Permission
  const [notifPermission, setNotifPermission] = useState(
    Notification.permission
  );

  // ========== FIREBASE AUTH LISTENER ==========
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Get role from Firebase Database
        const roleRef = ref(database, `roles/${currentUser.uid}`);
        const roleSnapshot = await get(roleRef);
        
        if (roleSnapshot.exists()) {
          const role = roleSnapshot.val();
          setUserRole(role);
          
          // Set default kategori berdasarkan role
          if (role === ROLES.PEMBANGUNAN) {
            setFormData(prev => ({ ...prev, kategori: KATEGORI.PEMBANGUNAN }));
          } else if (role === ROLES.DIAKONIA) {
            setFormData(prev => ({ ...prev, kategori: KATEGORI.DIAKONIA }));
          } else if (role === ROLES.MUSIK) {
            setFormData(prev => ({ ...prev, kategori: KATEGORI.MUSIK }));
          }
        } else {
          // Fallback: cek dari email
          const fallbackRole = EMAIL_TO_ROLE[currentUser.email] || ROLES.JEMAAT;
          setUserRole(fallbackRole);
        }
        
        // Request notification permission
        requestNotificationPermission();
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ========== FIREBASE REALTIME LISTENERS ==========
  
  // Listen to transactions
  useEffect(() => {
    if (!user) return;
    
    const transactionsRef = ref(database, 'transactions');
    const unsubscribe = onValue(transactionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const transactionsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Sort by timestamp (newest first)
        transactionsArray.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(transactionsArray);
      } else {
        setTransactions([]);
      }
    });

    return () => unsubscribe();
  }, [user]);
  
  // Listen to jadwal kebaktian
  useEffect(() => {
    const jadwalRef = ref(database, 'jadwal_kebaktian');
    const unsubscribe = onValue(jadwalRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const jadwalArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Sort by date
        jadwalArray.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        setJadwalKebaktian(jadwalArray);
      } else {
        setJadwalKebaktian([]);
      }
    });

    return () => unsubscribe();
  }, []);
  
  // Listen to pengumuman
  useEffect(() => {
    const pengumumanRef = ref(database, 'pengumuman');
    const unsubscribe = onValue(pengumumanRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const pengumumanArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Sort by date (newest first)
        pengumumanArray.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        setPengumuman(pengumumanArray);
      } else {
        setPengumuman([]);
      }
    });

    return () => unsubscribe();
  }, []);
  
  // Listen to audit log (admin only)
  useEffect(() => {
    if (!user || userRole !== ROLES.ADMIN) return;
    
    const auditRef = ref(database, 'audit_log');
    const unsubscribe = onValue(auditRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const auditArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Sort by timestamp (newest first)
        auditArray.sort((a, b) => b.timestamp - a.timestamp);
        setAuditLog(auditArray);
      } else {
        setAuditLog([]);
      }
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // ========== PUSH NOTIFICATION ==========
  
  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      
      if (permission === 'granted' && user) {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        
        // Save token to Firebase
        const tokenRef = ref(database, `fcm_tokens/${user.uid}`);
        await set(tokenRef, {
          token,
          timestamp: Date.now()
        });
        
        console.log('FCM Token saved:', token);
      }
    } catch (error) {
      console.error('Error getting notification permission:', error);
    }
  };
  
  // Listen for foreground messages
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      addNotification(
        payload.notification?.title || 'Notifikasi Baru',
        payload.notification?.body || ''
      );
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'GPPS PENIEL', {
          body: payload.notification?.body,
          icon: '/logo-gpps.jpeg',
          badge: '/logo-gpps.jpeg'
        });
      }
    });

    return () => unsubscribe();
  }, [user]);
  
  // Check for upcoming jadwal (30 minutes before)
  useEffect(() => {
    const checkUpcomingJadwal = () => {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60000);
      
      jadwalKebaktian.forEach(jadwal => {
        const jadwalDateTime = new Date(`${jadwal.tanggal}T${jadwal.waktu}`);
        
        // Check if jadwal is in 30 minutes (with 1 minute tolerance)
        const diff = jadwalDateTime - now;
        if (diff > 0 && diff <= 31 * 60000 && diff >= 29 * 60000) {
          // Send notification
          if (Notification.permission === 'granted') {
            new Notification(`Pengingat: ${jadwal.judul}`, {
              body: `Kebaktian akan dimulai dalam 30 menit di ${jadwal.lokasi}`,
              icon: '/logo-gpps.jpeg',
              badge: '/logo-gpps.jpeg',
              requireInteraction: true
            });
          }
          
          addNotification(
            `Pengingat: ${jadwal.judul}`,
            `Kebaktian akan dimulai dalam 30 menit`
          );
        }
      });
    };
    
    // Check every minute
    const interval = setInterval(checkUpcomingJadwal, 60000);
    
    return () => clearInterval(interval);
  }, [jadwalKebaktian]);

  // ========== UTILITY FUNCTIONS ==========
  
const addNotification = (title, message = '') => {
    const id = Date.now();
    setNotifications(prev => [
      { id, title, message, timestamp: new Date() },
      ...prev
    ].slice(0, 10));
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // ========== LISTEN TO BROADCAST NOTIFICATIONS ==========
  useNotificationListener(user, addNotification); // ← PINDAHKAN KE SINI
  
  const getTimestamp = () => {
    const now = new Date();
    return {
      tanggal: now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      jam: now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      timestamp: now.getTime()
    };
  };
  
  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };
  
  const createAuditLog = async (aksi, detail) => {
    try {
      const timestamp = getTimestamp();
      const auditRef = push(ref(database, 'audit_log'));
      
      await set(auditRef, {
        aksi,
        oleh: userRole,
        email: user?.email,
        waktu: timestamp.tanggal + ', ' + timestamp.jam,
        timestamp: timestamp.timestamp,
        detail
      });
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  };

  // ========== BROADCAST NOTIFICATION TO ALL USERS ==========
  
  const broadcastNotification = async (title, body, type = 'info') => {
    try {
      const notificationRef = push(ref(database, 'notifications'));
      const timestamp = Date.now();
      
      await set(notificationRef, {
        title,
        body,
        type,
        timestamp,
        createdAt: timestamp,
        createdBy: user?.email || 'System',
        createdByRole: userRole
      });

      console.log('✅ Notification broadcasted:', title);
    } catch (error) {
      console.error('❌ Error broadcasting notification:', error);
    }
  };

  // ========== AUTH FUNCTIONS ==========
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      addNotification('Login Berhasil', `Selamat datang!`);
      setEmail('');
      setPassword('');
      setLoginStep('choose'); 
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential') {
        setLoginError('Email atau password salah');
      } else if (error.code === 'auth/user-not-found') {
        setLoginError('User tidak ditemukan');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Password salah');
      } else {
        setLoginError('Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  
const handleLogout = async () => {
  try {
    await signOut(auth);
    addNotification('Logout Berhasil', 'Sampai jumpa!');
    setView('dashboard');
    setIsSidebarOpen(false);
    setLoginStep('choose');
  } catch (error) {
    console.error('Logout error:', error);
    addNotification('Error', 'Gagal logout');
  }
};

const handleSelectRole = (roleName) => {
  if (roleName === ROLES.JEMAAT) {
    setIsLoggingIn(true);

    signInWithEmailAndPassword(auth, 'jemaat@gpps.com', 'jemaat123')
      .then(() => {
        addNotification('Login Berhasil', 'Selamat datang Jemaat!');
      })
      .catch((error) => {
        console.error('Auto login error:', error);
        addNotification('Error', 'Gagal login sebagai Jemaat');
      })
      .finally(() => {
        setIsLoggingIn(false);
      });

  } else {
    setSelectedRole(roleName);
    setLoginStep('password');
    setLoginError('');
    setEmail('');
    setPassword('');
  }
};

const handleChangePassword = async (e) => {
  e.preventDefault();

  if (changePassForm.new !== changePassForm.confirm) {
    addNotification('Error', 'Password baru tidak cocok');
    return;
  }

  if (changePassForm.new.length < 6) {
    addNotification('Error', 'Password minimal 6 karakter');
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(
      user.email,
      changePassForm.old
    );

    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, changePassForm.new);

    addNotification('Sukses', 'Password berhasil diubah');

    setIsChangePassOpen(false);
    setChangePassForm({ old: '', new: '', confirm: '' });

    await createAuditLog('Ganti Password', 'User mengubah password');

  } catch (error) {
    console.error('Change password error:', error);

    if (error.code === 'auth/wrong-password') {
      addNotification('Error', 'Password lama salah');
    } else {
      addNotification('Error', 'Gagal mengubah password');
    }
  }
};


// ========== TRANSACTION FUNCTIONS ==========
  
  const getAllowedCategories = () => {
    if (!userRole) return [];
    if (userRole === ROLES.ADMIN) return Object.values(KATEGORI);
    if (userRole === ROLES.PEMBANGUNAN) return [KATEGORI.PEMBANGUNAN];
    if (userRole === ROLES.DIAKONIA) return [KATEGORI.DIAKONIA];
    if (userRole === ROLES.MUSIK) return [KATEGORI.MUSIK];
    return [];
  };
  
  const canInput = userRole && userRole !== ROLES.JEMAAT;
  
  const addTransaction = async (e) => {
    e.preventDefault();
    
    if (!formData.nominal || !formData.keterangan) {
      addNotification('Error', 'Lengkapi semua field');
      return;
    }
    
    try {
      // Determine status
      let finalStatus = 'pending';
      
      // Auto-approve for diakonia and musik
      if (userRole === ROLES.DIAKONIA || userRole === ROLES.MUSIK) {
        finalStatus = 'approved';
      }
      
      // Auto-approve for admin
      if (userRole === ROLES.ADMIN) {
        finalStatus = 'approved';
      }
      
      const timestamp = getTimestamp();
      const transactionRef = push(ref(database, 'transactions'));
      
      const newTransaction = {
        ...formData,
        nominal: parseInt(formData.nominal),
        status: finalStatus,
        input_by: userRole,
        input_email: user.email,
        input_tanggal: timestamp.tanggal,
        input_jam: timestamp.jam,
        timestamp: timestamp.timestamp,
        validation_timestamp: finalStatus === 'approved' ? timestamp.timestamp : null,
        validation_tanggal: finalStatus === 'approved' ? timestamp.tanggal : null,
        validation_jam: finalStatus === 'approved' ? timestamp.jam : null,
        validated_by: finalStatus === 'approved' ? userRole : null
      };
      
      await set(transactionRef, newTransaction);
      
      // Create audit log
      await createAuditLog(
        'Tambah Transaksi',
        `${formData.tipe} ${formatIDR(formData.nominal)} - ${formData.kategori} - ${formData.keterangan}`
      );
      
      addNotification(
        'Berhasil',
        finalStatus === 'approved' 
          ? 'Transaksi berhasil disimpan dan disetujui'
          : 'Transaksi berhasil disimpan, menunggu validasi'
      );
      
      // Reset form
      setFormData({
        tipe: 'masuk',
        kategori: userRole === ROLES.PEMBANGUNAN ? KATEGORI.PEMBANGUNAN :
                  userRole === ROLES.DIAKONIA ? KATEGORI.DIAKONIA :
                  userRole === ROLES.MUSIK ? KATEGORI.MUSIK :
                  KATEGORI.PEMBANGUNAN,
        nominal: '',
        keterangan: '',
        tanggal: new Date().toISOString().split('T')[0]
      });
      
      setIsInputOpen(false);
      
      // 🔔 BROADCAST NOTIFICATION (hanya untuk admin dan validator)
      if (finalStatus === 'pending') {
        await broadcastNotification(
          '💰 Transaksi Baru Menunggu Validasi',
          `${formData.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} ${formatIDR(formData.nominal)} - ${formData.kategori}`,
          'transaction'
        );
      }
      
    } catch (error) {
      console.error('Error adding transaction:', error);
      addNotification('Error', 'Gagal menyimpan transaksi');
    }
  };
  
  const updateTransactionStatus = async (transactionId, status) => {
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa validasi');
      return;
    }
    
    try {
      const timestamp = getTimestamp();
      const transactionRef = ref(database, `transactions/${transactionId}`);
      
      await update(transactionRef, {
        status,
        validation_timestamp: timestamp.timestamp,
        validation_tanggal: timestamp.tanggal,
        validation_jam: timestamp.jam,
        validated_by: userRole
      });
      
      await createAuditLog(
        `Validasi Transaksi - ${status}`,
        `Transaksi ID: ${transactionId}`
      );
      
      addNotification(
        'Berhasil',
        `Transaksi ${status === 'approved' ? 'disetujui' : 'ditolak'}`
      );
      
      // 🔔 BROADCAST NOTIFICATION
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        await broadcastNotification(
          status === 'approved' ? '✅ Transaksi Disetujui' : '❌ Transaksi Ditolak',
          `${transaction.keterangan} - ${formatIDR(transaction.nominal)}`,
          'validation'
        );
      }
      
    } catch (error) {
      console.error('Error updating transaction status:', error);
      addNotification('Error', 'Gagal update status transaksi');
    }
  };
  
  const deleteTransaction = async (transactionId) => {
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa hapus transaksi');
      return;
    }
    
    if (!window.confirm('Yakin ingin menghapus transaksi ini?')) {
      return;
    }
    
    try {
      const transactionRef = ref(database, `transactions/${transactionId}`);
      await remove(transactionRef);
      
      await createAuditLog(
        'Hapus Transaksi',
        `Transaksi ID: ${transactionId}`
      );
      
      addNotification('Berhasil', 'Transaksi berhasil dihapus');
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      addNotification('Error', 'Gagal menghapus transaksi');
    }
  };
  
  const handleResetData = async () => {
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa reset data');
      return;
    }
    
    if (!window.confirm('⚠️ PERINGATAN!\n\nApakah Anda yakin ingin menghapus SEMUA data transaksi?\n\nData yang dihapus tidak dapat dikembalikan!')) {
      return;
    }
    
    try {
      const transactionsRef = ref(database, 'transactions');
      await remove(transactionsRef);
      
      await createAuditLog(
        'Reset Data Transaksi',
        'Semua transaksi dihapus'
      );
      
      addNotification('Berhasil', 'Semua data transaksi berhasil dihapus');
      
    } catch (error) {
      console.error('Error resetting data:', error);
      addNotification('Error', 'Gagal reset data');
    }
  };

  // ========== JADWAL KEBAKTIAN FUNCTIONS ==========
  
  const addJadwalKebaktian = async (e) => {
    e.preventDefault();
    
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa tambah jadwal');
      return;
    }
    
    if (!jadwalForm.judul || !jadwalForm.tanggal || !jadwalForm.waktu || !jadwalForm.lokasi) {
      addNotification('Error', 'Lengkapi semua field');
      return;
    }
    
    try {
      const timestamp = getTimestamp();
      const jadwalRef = push(ref(database, 'jadwal_kebaktian'));
      
      await set(jadwalRef, {
        ...jadwalForm,
        created_by: userRole,
        created_at: timestamp.timestamp,
        created_date: timestamp.tanggal
      });
      
      await createAuditLog(
        'Tambah Jadwal Kebaktian',
        `${jadwalForm.judul} - ${jadwalForm.tanggal} ${jadwalForm.waktu}`
      );
      
    addNotification('Berhasil', 'Jadwal kebaktian berhasil ditambahkan');
      
      // Reset form
      setJadwalForm({
        judul: '',
        tanggal: '',
        waktu: '',
        lokasi: '',
        keterangan: ''
      });
      
      setIsJadwalOpen(false);
      
      // 🔔 BROADCAST NOTIFICATION TO ALL USERS
      await broadcastNotification(
        '📅 Jadwal Kebaktian Baru',
        `${jadwalForm.judul} - ${new Date(jadwalForm.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} pukul ${jadwalForm.waktu}`,
        'jadwal'
      );
      // Send notification to all users (via FCM - will be sent in background)
      // Note: Actual FCM push requires backend/cloud function
      // For now, just show local notification
      if (Notification.permission === 'granted') {
        new Notification('Jadwal Kebaktian Baru', {
          body: `${jadwalForm.judul} - ${jadwalForm.tanggal} ${jadwalForm.waktu}`,
          icon: '/logo-gpps.jpeg',
          badge: '/logo-gpps.jpeg'
        });
      }
      
    } catch (error) {
      console.error('Error adding jadwal:', error);
      addNotification('Error', 'Gagal menambahkan jadwal');
    }
  };
  
  const deleteJadwal = async (jadwalId) => {
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa hapus jadwal');
      return;
    }
    
    if (!window.confirm('Yakin ingin menghapus jadwal ini?')) {
      return;
    }
    
    try {
      const jadwalRef = ref(database, `jadwal_kebaktian/${jadwalId}`);
      await remove(jadwalRef);
      
      await createAuditLog(
        'Hapus Jadwal Kebaktian',
        `Jadwal ID: ${jadwalId}`
      );
      
      addNotification('Berhasil', 'Jadwal berhasil dihapus');
      
    } catch (error) {
      console.error('Error deleting jadwal:', error);
      addNotification('Error', 'Gagal menghapus jadwal');
    }
  };

  // ========== PENGUMUMAN FUNCTIONS ==========
  
  const addPengumuman = async (e) => {
    e.preventDefault();
    
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa tambah pengumuman');
      return;
    }
    
    if (!pengumumanForm.judul || !pengumumanForm.isi) {
      addNotification('Error', 'Lengkapi semua field');
      return;
    }
    
    try {
      const timestamp = getTimestamp();
      const pengumumanRef = push(ref(database, 'pengumuman'));
      
      await set(pengumumanRef, {
        ...pengumumanForm,
        created_by: userRole,
        created_at: timestamp.timestamp,
        created_date: timestamp.tanggal
      });
      
      await createAuditLog(
        'Tambah Pengumuman',
        `${pengumumanForm.judul}`
      );
      
      addNotification('Berhasil', 'Pengumuman berhasil ditambahkan');
      
      // Reset form
      setPengumumanForm({
        judul: '',
        isi: '',
        tanggal: new Date().toISOString().split('T')[0]
      });
      
      setIsPengumumanOpen(false);
      
      // 🔔 BROADCAST NOTIFICATION TO ALL USERS
      await broadcastNotification(
        '📢 Pengumuman Baru',
        pengumumanForm.judul,
        'pengumuman'
      );
      
      // Send notification to all users
      if (Notification.permission === 'granted') {
        new Notification('Pengumuman Baru', {
          body: pengumumanForm.judul,
          icon: '/logo-gpps.jpeg',
          badge: '/logo-gpps.jpeg'
        });
      }
      
    } catch (error) {
      console.error('Error adding pengumuman:', error);
      addNotification('Error', 'Gagal menambahkan pengumuman');
    }
  };
  
  const deletePengumuman = async (pengumumanId) => {
    if (userRole !== ROLES.ADMIN) {
      addNotification('Error', 'Hanya admin yang bisa hapus pengumuman');
      return;
    }
    
    if (!window.confirm('Yakin ingin menghapus pengumuman ini?')) {
      return;
    }
    
    try {
      const pengumumanRef = ref(database, `pengumuman/${pengumumanId}`);
      await remove(pengumumanRef);
      
      await createAuditLog(
        'Hapus Pengumuman',
        `Pengumuman ID: ${pengumumanId}`
      );
      
      addNotification('Berhasil', 'Pengumuman berhasil dihapus');
      
    } catch (error) {
      console.error('Error deleting pengumuman:', error);
      addNotification('Error', 'Gagal menghapus pengumuman');
    }
  };

  // ========== STATISTICS CALCULATION ==========
  
  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    
    const calc = (cat) => {
      const data = approved.filter(t => t.kategori === cat);
      const masuk = data.filter(t => t.tipe === 'masuk').reduce((sum, t) => sum + t.nominal, 0);
      const keluar = data.filter(t => t.tipe === 'keluar').reduce((sum, t) => sum + t.nominal, 0);
      return masuk - keluar;
    };
    
    const totalMasuk = approved.filter(t => t.tipe === 'masuk').reduce((sum, t) => sum + t.nominal, 0);
    const totalKeluar = approved.filter(t => t.tipe === 'keluar').reduce((sum, t) => sum + t.nominal, 0);
    
    return {
      totalSaldo: totalMasuk - totalKeluar,
      totalMasuk,
      totalKeluar,
      pembangunan: calc(KATEGORI.PEMBANGUNAN),
      musik: calc(KATEGORI.MUSIK),
      diakonia: calc(KATEGORI.DIAKONIA),
      pending: transactions.filter(t => t.status === 'pending').length,
      approved: approved.length,
      rejected: transactions.filter(t => t.status === 'rejected').length
    };
  }, [transactions]);

  // ========== LOADING STATE ==========
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">Loading...</p>
        </div>
      </div>
    );
  }
// ========== LOGIN UI (IF NOT LOGGED IN) ==========
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[3rem] shadow-2xl overflow-hidden">
          {/* LEFT SIDE - LOGO */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
            
            <div className="relative z-10">
              <div className="w-32 h-32 bg-white rounded-full p-6 mb-6 shadow-2xl flex items-center justify-center mx-auto">
                <img 
                  src={CHURCH_LOGO_URL} 
                  alt="Logo GPPS" 
                  className="w-full h-full object-cover rounded-full" 
                  onError={(e) => {
                    e.target.parentElement.innerHTML = '<span class="text-5xl font-black text-indigo-600">GP</span>';
                  }}
                />
              </div>
              
              <h1 className="text-4xl font-black tracking-tight mb-4">GPPS PENIEL</h1>
              <p className="text-indigo-100 text-base font-medium">
                Manajemen Keuangan Jemaat & Pembangunan
              </p>
            </div>
          </div>

          {/* RIGHT SIDE - LOGIN OPTIONS */}
          <div className="p-10 md:p-14 flex flex-col justify-center bg-slate-50">
            {loginStep === 'choose' ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Login Aplikasi</h2>
                <p className="text-slate-500 text-sm mb-8 font-medium">
                  Pilih hak akses untuk masuk:
                </p>
                
                <div className="space-y-3">
                  {/* Admin Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSelectRole(ROLES.PEMBANGUNAN)}
                      className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white p-5 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      <Building2 size={24} className="mb-2 mx-auto" />
                      <span className="block">Admin</span>
                      <span className="block text-xs font-bold opacity-90">Pembangunan</span>
                    </button>

                    <button
                      onClick={() => handleSelectRole(ROLES.ADMIN)}
                      className="group relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white p-5 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      <ShieldCheck size={24} className="mb-2 mx-auto" />
                      <span className="block">Admin Validasi</span>
                      <span className="block text-xs font-bold opacity-90">&nbsp;</span>
                    </button>

                    <button
                      onClick={() => handleSelectRole(ROLES.DIAKONIA)}
                      className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white p-5 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      <HeartHandshake size={24} className="mb-2 mx-auto" />
                      <span className="block">Admin Diakonia</span>
                      <span className="block text-xs font-bold opacity-90">&nbsp;</span>
                    </button>

                    <button
                      onClick={() => handleSelectRole(ROLES.MUSIK)}
                      className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white p-5 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      <Music size={24} className="mb-2 mx-auto" />
                      <span className="block">Admin Musik</span>
                      <span className="block text-xs font-bold opacity-90">&nbsp;</span>
                    </button>
                  </div>

                  {/* Jemaat Button */}
                  <button
                    onClick={() => handleSelectRole(ROLES.JEMAAT)}
                    className="group relative overflow-hidden w-full bg-white hover:bg-slate-50 text-slate-700 p-5 rounded-2xl font-black text-sm transition-all shadow-md hover:shadow-lg border-2 border-slate-200 hover:border-slate-300 active:scale-95"
                  >
                    <Users size={24} className="mb-2 mx-auto text-slate-500" />
                    <span className="block">Jemaat</span>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleLogin} className="animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  type="button" 
                  onClick={() => {
                    setLoginStep('choose');
                    setLoginError('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-indigo-600 text-xs font-black uppercase mb-6 flex items-center gap-2 hover:underline transition-all hover:gap-3"
                >
                  <X size={14}/> Kembali ke pilihan
                </button>
                
                <h2 className="text-2xl font-black text-slate-900 mb-2">Verifikasi Password</h2>
                <p className="text-slate-500 text-sm mb-6 font-medium italic">
                  Role: {selectedRole}
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                      placeholder="nama@gpps.com"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  
                  {loginError && (
                    <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 flex items-center gap-2 animate-in fade-in">
                      <AlertCircle size={18} className="text-rose-600 shrink-0" />
                      <p className="text-rose-700 text-sm font-bold">{loginError}</p>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-base shadow-xl hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                  >
                    {isLoggingIn ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      'Masuk Sekarang'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== MAIN APP UI (LOGGED IN) ==========
  
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* TOP NAVBAR */}
      <nav className="sticky top-0 z-[60] bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 hover:bg-slate-100 rounded-lg lg:hidden transition-all active:scale-95"
          >
            <Menu size={20} className="text-slate-600" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-full overflow-hidden border-2 border-indigo-100 hover:border-indigo-300 transition-all hover:scale-110">
              <img 
                src={CHURCH_LOGO_URL} 
                alt="Logo" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%234f46e5' font-size='14' font-weight='bold'%3EG%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <span className="font-black text-slate-900 tracking-tighter text-sm sm:text-base">
              {CHURCH_NAME}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Icon */}
          <button 
            onClick={() => setView('notifications')}
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <Bell size={20} className="text-slate-600" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            )}
          </button>
          
          {/* User Info */}
          <div className="hidden md:block text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
              {userRole}
            </p>
            <p className="text-xs font-medium text-slate-600 leading-none">
              {user?.email}
            </p>
          </div>
          
          {/* Logout Button */}
          <button 
            onClick={handleLogout} 
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90 hover:rotate-12" 
            title="Keluar"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 z-[70] backdrop-blur-sm lg:hidden" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}
        
        <aside className={`fixed inset-y-0 left-0 z-[80] w-64 bg-white border-r border-slate-100 lg:static transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            {/* Mobile Close Button */}
            <div className="flex items-center justify-between mb-8 lg:hidden">
              <span className="font-black text-slate-800">Menu Navigasi</span>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="hover:rotate-90 transition-transform"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Navigation */}
            <nav className="space-y-1 flex-1">
              <NavItem 
                active={view === 'dashboard'} 
                icon={<BarChart3 size={18}/>} 
                label="Dashboard" 
                onClick={() => {setView('dashboard'); setIsSidebarOpen(false);}} 
              />
              
              <NavItem 
                active={view === 'keuangan'} 
                icon={<Wallet size={18}/>} 
                label="Semua Transaksi" 
                onClick={() => {setView('keuangan'); setIsSidebarOpen(false);}} 
              />
              
              {/* Kategori Kas */}
              <div className="py-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Kategori Kas
              </div>
              
              {(userRole === ROLES.ADMIN || userRole === ROLES.PEMBANGUNAN || userRole === ROLES.JEMAAT) && (
                <NavItem 
                  active={view === 'pembangunan'} 
                  icon={<Building2 size={18}/>} 
                  label="Kas Pembangunan" 
                  onClick={() => {setView('pembangunan'); setIsSidebarOpen(false);}} 
                />
              )}
              
              {(userRole === ROLES.ADMIN || userRole === ROLES.MUSIK || userRole === ROLES.JEMAAT) && (
                <NavItem 
                  active={view === 'musik'} 
                  icon={<Music size={18}/>} 
                  label="Kas Musik" 
                  onClick={() => {setView('musik'); setIsSidebarOpen(false);}} 
                />
              )}
              
              {(userRole === ROLES.ADMIN || userRole === ROLES.DIAKONIA || userRole === ROLES.JEMAAT) && (
                <NavItem 
                  active={view === 'diakonia'} 
                  icon={<HeartHandshake size={18}/>} 
                  label="Kas Diakonia" 
                  onClick={() => {setView('diakonia'); setIsSidebarOpen(false);}} 
                />
              )}
              
              {/* Jadwal & Pengumuman */}
              <div className="py-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Informasi
              </div>
              
              <NavItem 
                active={view === 'jadwal'} 
                icon={<Calendar size={18}/>} 
                label="Jadwal Kebaktian" 
                onClick={() => {setView('jadwal'); setIsSidebarOpen(false);}} 
              />
              
              <NavItem 
                active={view === 'pengumuman'} 
                icon={<Megaphone size={18}/>} 
                label="Pengumuman" 
                onClick={() => {setView('pengumuman'); setIsSidebarOpen(false);}} 
              />
              
              {/* Admin Only */}
              {userRole === ROLES.ADMIN && (
                <>
                  <div className="py-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Admin
                  </div>
                  
                  <NavItem 
                    active={view === 'audit'} 
                    icon={<Eye size={18}/>} 
                    label="Audit Log" 
                    onClick={() => {setView('audit'); setIsSidebarOpen(false);}} 
                  />
                </>
              )}
              
              {/* Settings */}
              {userRole !== ROLES.JEMAAT && (
                <>
                  <div className="py-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Pengaturan
                  </div>
                  
                  <NavItem 
                    active={isChangePassOpen} 
                    icon={<KeyRound size={18}/>} 
                    label="Ganti Password" 
                    onClick={() => {setIsChangePassOpen(true); setIsSidebarOpen(false);}} 
                  />
                  
                  {userRole === ROLES.ADMIN && (
                    <>
                      <div className="py-2 px-4 text-[10px] font-black text-rose-300 uppercase tracking-widest mt-2">
                        Zona Bahaya
                      </div>
                      <button 
                        onClick={() => {handleResetData(); setIsSidebarOpen(false);}} 
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-black text-xs text-rose-500 hover:bg-rose-50 active:scale-95 hover:gap-4"
                      >
                        <AlertCircle size={18}/> 
                        <span className="tracking-tight">Reset Semua Data</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </nav>
            
            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl">
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-900">{userRole}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
{/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter capitalize leading-none">
                  {view === 'keuangan' ? 'Semua Transaksi' : 
                  view === 'pembangunan' ? 'Kas Pembangunan' :
                  view === 'musik' ? 'Kas Musik' :
                  view === 'diakonia' ? 'Kas Diakonia' :
                  view === 'jadwal' ? 'Jadwal Kebaktian' :
                  view === 'pengumuman' ? 'Pengumuman' :
                  view === 'audit' ? 'Audit Log' :
                  view === 'notifications' ? 'Notifikasi' :
                  'Dashboard'}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Sistem Manajemen Keuangan Real-time
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {canInput && (view === 'keuangan' || view === 'pembangunan' || view === 'musik' || view === 'diakonia' || view === 'dashboard') && (
                <button
                  onClick={() => setIsInputOpen(true)}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-100 active:scale-95 hover:shadow-xl hover:gap-3"
                >
                  <PlusCircle size={18} /> Tambah Transaksi
                </button>
              )}
              
              {userRole === ROLES.ADMIN && view === 'jadwal' && (
                <button
                  onClick={() => setIsJadwalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95"
                >
                  <Calendar size={18} /> Tambah Jadwal
                </button>
              )}
              
              {userRole === ROLES.ADMIN && view === 'pengumuman' && (
                <button
                  onClick={() => setIsPengumumanOpen(true)}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95"
                >
                  <Megaphone size={18} /> Tambah Pengumuman
                </button>
              )}
            </div>
          </div>

          {/* DASHBOARD VIEW */}
          {view === 'dashboard' && (
            <div className="space-y-6">
              {/* Total Saldo Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 sm:p-12 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                  <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
                    <ShieldCheck size={14} /> Total Kas (Approved)
                  </p>
                  <h4 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8">
                    {formatIDR(stats.totalSaldo)}
                  </h4>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-white/20">
                    <StatItem 
                      icon={<Building2 size={16}/>} 
                      label="Pembangunan" 
                      value={stats.pembangunan} 
                      color="amber" 
                    />
                    <StatItem 
                      icon={<Music size={16}/>} 
                      label="Musik" 
                      value={stats.musik} 
                      color="indigo" 
                    />
                    <StatItem 
                      icon={<HeartHandshake size={16}/>} 
                      label="Diakonia" 
                      value={stats.diakonia} 
                      color="emerald" 
                    />
                  </div>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-emerald-200 rounded-2xl p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase">Total Pemasukan</p>
                      <p className="text-xl font-black text-emerald-600">{formatIDR(stats.totalMasuk)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-rose-200 rounded-2xl p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                      <TrendingDown size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase">Total Pengeluaran</p>
                      <p className="text-xl font-black text-rose-600">{formatIDR(stats.totalKeluar)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-amber-200 rounded-2xl p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase">Menunggu Validasi</p>
                      <p className="text-xl font-black text-amber-600">{stats.pending} Transaksi</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Transactions (Admin Only) */}
              {userRole === ROLES.ADMIN && stats.pending > 0 && (
                <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={18} /> Perlu Validasi ({stats.pending})
                  </h3>
                  <div className="space-y-3">
                    {transactions.filter(t => t.status === 'pending').slice(0, 5).map(tx => (
                      <div key={tx.id} className="bg-amber-50 p-4 rounded-xl flex items-center justify-between border border-amber-100 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400">
                            {tx.kategori === KATEGORI.PEMBANGUNAN ? <Building2 size={18}/> :
                              tx.kategori === KATEGORI.MUSIK ? <Music size={18}/> :
                              <HeartHandshake size={18}/>}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black text-slate-800">{tx.keterangan}</p>
                            <p className="text-xs text-slate-500">
                              {tx.input_by} • {formatIDR(tx.nominal)} • {tx.input_tanggal}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => updateTransactionStatus(tx.id, 'approved')}
                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all active:scale-90"
                            title="Setujui"
                          >
                            <CheckCircle size={18}/>
                          </button>
                          <button 
                            onClick={() => updateTransactionStatus(tx.id, 'rejected')}
                            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                            title="Tolak"
                          >
                            <XCircle size={18}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-900">Transaksi Terbaru</h3>
                  <button 
                    onClick={() => setView('keuangan')}
                    className="text-indigo-600 text-sm font-bold hover:underline"
                  >
                    Lihat Semua →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {transactions.slice(0, 5).length === 0 ? (
                    <div className="p-12 text-center">
                      <Wallet size={48} className="text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">Belum ada transaksi</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-black text-slate-400 uppercase">
                          <th className="px-6 py-4 text-left">Tanggal</th>
                          <th className="px-6 py-4 text-left">Keterangan</th>
                          <th className="px-6 py-4 text-left">Kategori</th>
                          <th className="px-6 py-4 text-right">Nominal</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.slice(0, 5).map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-slate-600">
                              {tx.tanggal}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">
                              {tx.keterangan}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-black uppercase px-2 py-1 rounded ${
                                tx.kategori === KATEGORI.PEMBANGUNAN ? 'bg-amber-100 text-amber-700' :
                                tx.kategori === KATEGORI.MUSIK ? 'bg-indigo-100 text-indigo-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {tx.kategori}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-right font-black ${
                              tx.tipe === 'masuk' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {tx.tipe === 'masuk' ? '+' : '-'} {formatIDR(tx.nominal)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={tx.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TRANSACTIONS TABLE VIEW */}
          {(view === 'keuangan' || view === 'pembangunan' || view === 'musik' || view === 'diakonia') && (
            <TransactionTable 
              transactions={transactions.filter(t => 
                view === 'keuangan' ? true : t.kategori === view
              )}
              userRole={userRole}
              onApprove={(id) => updateTransactionStatus(id, 'approved')}
              onReject={(id) => updateTransactionStatus(id, 'rejected')}
              onDelete={deleteTransaction}
              formatIDR={formatIDR}
            />
          )}

          {/* JADWAL KEBAKTIAN VIEW */}
          {view === 'jadwal' && (
            <div className="space-y-4">
              {jadwalKebaktian.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-20 text-center">
                  <Calendar size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">Belum ada jadwal kebaktian</p>
                </div>
              ) : (
                jadwalKebaktian.map(jadwal => (
                  <div key={jadwal.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex flex-col items-center justify-center text-indigo-600 shrink-0">
                          <p className="text-xs font-black uppercase">
                            {new Date(jadwal.tanggal).toLocaleDateString('id-ID', { month: 'short' })}
                          </p>
                          <p className="text-2xl font-black">
                            {new Date(jadwal.tanggal).getDate()}
                          </p>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-black text-slate-900 mb-2">{jadwal.judul}</h3>
                          <div className="space-y-1 text-sm text-slate-600">
                            <p className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-400" />
                              <span className="font-bold">{jadwal.waktu}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Building2 size={16} className="text-slate-400" />
                              <span className="font-bold">{jadwal.lokasi}</span>
                            </p>
                            {jadwal.keterangan && (
                              <p className="text-slate-500 mt-2">{jadwal.keterangan}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {userRole === ROLES.ADMIN && (
                        <button
                          onClick={() => deleteJadwal(jadwal.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* PENGUMUMAN VIEW */}
          {view === 'pengumuman' && (
            <div className="space-y-4">
              {pengumuman.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-20 text-center">
                  <Megaphone size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">Belum ada pengumuman</p>
                </div>
              ) : (
                pengumuman.map(item => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-slate-900 mb-2">{item.judul}</h3>
                        <p className="text-xs text-slate-400 font-bold">
                          {item.tanggal} • {item.created_by}
                        </p>
                      </div>
                      {userRole === ROLES.ADMIN && (
                        <button
                          onClick={() => deletePengumuman(item.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-slate-600 whitespace-pre-line">{item.isi}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* AUDIT LOG VIEW */}
          {view === 'audit' && userRole === ROLES.ADMIN && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-black text-slate-900">Riwayat Aktivitas</h3>
              </div>
              <div className="overflow-x-auto">
                {auditLog.length === 0 ? (
                  <div className="p-20 text-center">
                    <Eye size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">Belum ada aktivitas</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-black text-slate-400 uppercase">
                        <th className="px-6 py-4 text-left">Waktu</th>
                        <th className="px-6 py-4 text-left">Aksi</th>
                        <th className="px-6 py-4 text-left">Oleh</th>
                        <th className="px-6 py-4 text-left">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLog.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-600">{log.waktu}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{log.aksi}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{log.oleh}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{log.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS VIEW */}
          {view === 'notifications' && (
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-20 text-center">
                  <Bell size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">Tidak ada notifikasi</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                        <Bell size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-slate-900">{notif.title}</p>
                        {notif.message && (
                          <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                          {notif.timestamp.toLocaleTimeString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      
      {/* Add Transaction Modal */}
      {isInputOpen && (
        <Modal onClose={() => setIsInputOpen(false)} title="Tambah Transaksi Baru">
          <form onSubmit={addTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-2">Kategori</label>
                <select
                  disabled={userRole !== ROLES.ADMIN}
                  value={formData.kategori}
                  onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {getAllowedCategories().map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-2">Jenis</label>
                <select
                  value={formData.tipe}
                  onChange={(e) => setFormData({...formData, tipe: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="masuk">Pemasukan (+)</option>
                  <option value="keluar">Pengeluaran (-)</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Nominal (Rp)</label>
              <input
                type="number"
                required
                value={formData.nominal}
                onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Tanggal</label>
              <input
                type="date"
                required
                value={formData.tanggal}
                onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Keterangan</label>
              <textarea
                required
                value={formData.keterangan}
                onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                placeholder="Detail transaksi..."
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-base shadow-xl transition-all active:scale-95"
            >
              Simpan Transaksi
            </button>
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {isChangePassOpen && (
        <Modal onClose={() => setIsChangePassOpen(false)} title="Ganti Password">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Password Lama</label>
              <input
                type="password"
                required
                value={changePassForm.old}
                onChange={(e) => setChangePassForm({...changePassForm, old: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Password Baru</label>
              <input
                type="password"
                required
                value={changePassForm.new}
                onChange={(e) => setChangePassForm({...changePassForm, new: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Konfirmasi Password Baru</label>
              <input
                type="password"
                required
                value={changePassForm.confirm}
                onChange={(e) => setChangePassForm({...changePassForm, confirm: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-base shadow-xl transition-all active:scale-95"
            >
              Ubah Password
            </button>
          </form>
        </Modal>
      )}

      {/* Add Jadwal Modal */}
      {isJadwalOpen && (
        <Modal onClose={() => setIsJadwalOpen(false)} title="Tambah Jadwal Kebaktian">
          <form onSubmit={addJadwalKebaktian} className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Judul Acara</label>
              <input
                type="text"
                required
                value={jadwalForm.judul}
                onChange={(e) => setJadwalForm({...jadwalForm, judul: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Contoh: Ibadah Minggu"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-2">Tanggal</label>
                <input
                  type="date"
                  required
                  value={jadwalForm.tanggal}
                  onChange={(e) => setJadwalForm({...jadwalForm, tanggal: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-2">Waktu</label>
                <input
                  type="time"
                  required
                  value={jadwalForm.waktu}
                  onChange={(e) => setJadwalForm({...jadwalForm, waktu: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Lokasi</label>
              <input
                type="text"
                required
                value={jadwalForm.lokasi}
                onChange={(e) => setJadwalForm({...jadwalForm, lokasi: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Contoh: Gedung Gereja Utama"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Keterangan (Opsional)</label>
              <textarea
                value={jadwalForm.keterangan}
                onChange={(e) => setJadwalForm({...jadwalForm, keterangan: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                placeholder="Informasi tambahan..."
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-base shadow-xl transition-all active:scale-95"
            >
              Simpan Jadwal
            </button>
          </form>
        </Modal>
      )}

      {/* Add Pengumuman Modal */}
      {isPengumumanOpen && (
        <Modal onClose={() => setIsPengumumanOpen(false)} title="Tambah Pengumuman">
          <form onSubmit={addPengumuman} className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Judul</label>
              <input
                type="text"
                required
                value={pengumumanForm.judul}
                onChange={(e) => setPengumumanForm({...pengumumanForm, judul: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Judul pengumuman"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Tanggal</label>
              <input
                type="date"
                required
                value={pengumumanForm.tanggal}
                onChange={(e) => setPengumumanForm({...pengumumanForm, tanggal: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="text-xs font-black uppercase text-slate-400 block mb-2">Isi Pengumuman</label>
              <textarea
                required
                value={pengumumanForm.isi}
                onChange={(e) => setPengumumanForm({...pengumumanForm, isi: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500 h-32"
                placeholder="Tulis pengumuman di sini..."
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-base shadow-xl transition-all active:scale-95"
            >
              Kirim Pengumuman
            </button>
          </form>
        </Modal>
      )}

      {/* Floating Notifications */}
      <div className="fixed bottom-6 right-6 z-[200] space-y-3 max-w-sm">
        {notifications.slice(0, 3).map(notif => (
          <div 
            key={notif.id} 
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-right-10 border border-white/10"
          >
            <BellRing size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black">{notif.title}</p>
              {notif.message && (
                <p className="text-xs text-slate-300 mt-1">{notif.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===============================
// SUB-COMPONENTS
// ===============================

const StatItem = ({ icon, label, value, color }) => {
  const colorClasses = {
    amber: 'bg-amber-500/10 text-amber-200',
    indigo: 'bg-indigo-500/10 text-indigo-200',
    emerald: 'bg-emerald-500/10 text-emerald-200'
  };
  
  return (
    <div className="flex items-center gap-3 hover:scale-105 transition-transform cursor-pointer">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-50 leading-none mb-1">
          {label}
        </p>
        <p className="text-xs font-black tracking-tight">
          {new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            maximumFractionDigits: 0 
          }).format(value)}
        </p>
      </div>
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-black text-xs hover:gap-4 active:scale-95 ${
      active 
        ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    {icon} <span className="tracking-tight">{label}</span>
  </button>
);

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200'
  };
  
  return (
    <span className={`text-[8px] px-2 py-1 rounded font-black uppercase tracking-widest border inline-flex items-center gap-1 ${styles[status]}`}>
      {status === 'pending' && <Clock size={8}/>}
      {status === 'approved' && <CheckCircle size={8}/>}
      {status === 'rejected' && <XCircle size={8}/>}
      {status}
    </span>
  );
};

const Modal = ({ children, onClose, title }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl relative animate-in zoom-in duration-200">
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-all hover:rotate-90"
      >
        <X size={20} />
      </button>
      <h3 className="text-xl font-black text-slate-800 mb-6">{title}</h3>
      {children}
    </div>
  </div>
);

const TransactionTable = ({ transactions, userRole, onApprove, onReject, onDelete, formatIDR }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <h3 className="font-black text-slate-800">Daftar Transaksi</h3>
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-100">
          <CheckCircle size={10}/> Approved
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black border border-amber-100">
          <Clock size={10}/> Pending
        </div>
      </div>
    </div>
    <div className="overflow-x-auto">
      {transactions.length === 0 ? (
        <div className="p-20 text-center">
          <Wallet size={48} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">Belum ada transaksi</p>
        </div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Tanggal</th>
              <th className="px-6 py-4">Kategori</th>
              <th className="px-6 py-4">Keterangan</th>
              <th className="px-6 py-4">Nominal</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Input By</th>
              {userRole === ROLES.ADMIN && <th className="px-6 py-4 text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {transactions.map(tx => (
              <tr key={tx.id} className={`group hover:bg-slate-50/50 transition-colors ${
                tx.status === 'pending' ? 'bg-amber-50/20' : ''
              }`}>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">
                  {tx.tanggal}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                    tx.kategori === KATEGORI.PEMBANGUNAN ? 'bg-amber-100 text-amber-700' :
                    tx.kategori === KATEGORI.MUSIK ? 'bg-indigo-100 text-indigo-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {tx.kategori}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-black text-slate-800">{tx.keterangan}</p>
                </td>
                <td className={`px-6 py-4 font-black text-sm ${
                  tx.tipe === 'masuk' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {tx.tipe === 'masuk' ? '+' : '-'} {formatIDR(tx.nominal)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={tx.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {tx.input_by}
                </td>
                {userRole === ROLES.ADMIN && (
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {tx.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => onApprove(tx.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all active:scale-90"
                            title="Setujui"
                          >
                            <CheckCircle size={16}/>
                          </button>
                          <button 
                            onClick={() => onReject(tx.id)}
                            className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-all active:scale-90"
                            title="Tolak"
                          >
                            <XCircle size={16}/>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => onDelete(tx.id)}
                        className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-all active:scale-90"
                        title="Hapus"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

export default App;
