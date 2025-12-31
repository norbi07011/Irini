
import React, { useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { OrdersContext, LanguageContext, MenuContext, SettingsContext, DriversContext, ReservationsContext } from '../index';
import { TRANSLATIONS, MENU_ITEMS } from '../constants';
import { storageService, menuService, authService, siteContentService, SiteContent } from '../services/supabaseClient';
import { Order, OrderStatus, MenuItem, RestaurantSettings, Language, Reservation, ReservationStatus } from '../types';
import AdminLogin from './AdminLogin';

type AdminTab = 'orders' | 'history' | 'analytics' | 'menu' | 'reservations' | 'settings' | 'content';
type SortKey = 'date' | 'status' | 'amount';
type SortOrder = 'asc' | 'desc';
type SyncStatus = 'connected' | 'reconnecting' | 'failed' | 'offline';
type ReportRange = 'daily' | 'weekly' | 'monthly';

interface StatusChangeRequest {
  orderId: string;
  status: OrderStatus;
  customerName: string;
}

const AdminDashboard: React.FC = () => {
  const ordersCtx = useContext(OrdersContext);
  const menuCtx = useContext(MenuContext);
  const settingsCtx = useContext(SettingsContext);
  const langCtx = useContext(LanguageContext);
  const driversCtx = useContext(DriversContext);
  const reservationsCtx = useContext(ReservationsContext);
  
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservationCalendarDate, setReservationCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [reservationAdminNotes, setReservationAdminNotes] = useState('');
  const [alternativeTime, setAlternativeTime] = useState('');
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusChangePending, setStatusChangePending] = useState<StatusChangeRequest | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportRange, setReportRange] = useState<ReportRange>('daily');
  
  // Date Range Picker State
  const [customDateRange, setCustomDateRange] = useState<{start: Date | null, end: Date | null}>(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return { start: sevenDaysAgo, end: today };
  });
  
  // Real-time Sync Simulation State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connected');
  const syncIntervalRef = useRef<number | null>(null);

  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortOrder>('desc');

  // Context & Settings
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);

  // Chart refs for Chart.js instances
  const hourlyChartRef = useRef<HTMLCanvasElement>(null);
  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const categoryChartRef = useRef<HTMLCanvasElement>(null);
  const deliveryChartRef = useRef<HTMLCanvasElement>(null);
  const paymentChartRef = useRef<HTMLCanvasElement>(null);
  const weekdayChartRef = useRef<HTMLCanvasElement>(null);
  
  const chartInstancesRef = useRef<Record<string, any>>({});

  // Menu Management State
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  
  // Driver Management State
  const [editingDriver, setEditingDriver] = useState<{id: string; name: string; phone: string} | null>(null);
  const [isAddingNewDriver, setIsAddingNewDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Staff Notes State
  const [newStaffNote, setNewStaffNote] = useState('');
  const [staffName, setStaffName] = useState(() => {
    const saved = localStorage.getItem('staffName');
    return saved || 'Admin';
  });

  // Delivery Start State
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [estimatedDeliveryMinutes, setEstimatedDeliveryMinutes] = useState(30);

  // Site Content Management State
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editingContent, setEditingContent] = useState<SiteContent | null>(null);
  const [contentSectionFilter, setContentSectionFilter] = useState<string>('all');
  const [savingContent, setSavingContent] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getSession();
      setIsAuthenticated(!!user);
      setCurrentUserEmail(user?.email || null);
      setIsCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setIsAuthenticated(!!user);
      setCurrentUserEmail(user?.email || null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load site content when content tab is opened
  useEffect(() => {
    if (activeTab === 'content' && isAuthenticated) {
      loadSiteContent();
    }
  }, [activeTab, isAuthenticated]);

  const loadSiteContent = async () => {
    setLoadingContent(true);
    try {
      const data = await siteContentService.getAll();
      setSiteContent(data);
    } catch (error) {
      console.error('Error loading site content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSaveContent = async (item: SiteContent) => {
    setSavingContent(true);
    try {
      await siteContentService.update(item.id, {
        value_text: item.value_text,
        value_text_pl: item.value_text_pl,
        value_text_nl: item.value_text_nl,
        value_text_el: item.value_text_el,
        value_text_tr: item.value_text_tr,
        value_text_ar: item.value_text_ar,
        value_text_bg: item.value_text_bg,
        value_image_url: item.value_image_url
      });
      await loadSiteContent();
      setEditingContent(null);
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Error saving. Please try again.');
    } finally {
      setSavingContent(false);
    }
  };

  // Browser Notifications State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [toastNotification, setToastNotification] = useState<{id: string, message: string, type: 'info' | 'success' | 'warning'} | null>(null);

  // Handle image file upload to Supabase Storage
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Maximum size is 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      // Upload to Supabase Storage
      const imageUrl = await storageService.uploadMenuImage(file);
      if (editingMenuItem) {
        setEditingMenuItem({ ...editingMenuItem, image: imageUrl });
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle site content image upload
  const handleSiteImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingContent) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Maximum size is 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      const imageUrl = await storageService.uploadSiteImage(file);
      setEditingContent({ ...editingContent, value_image_url: imageUrl });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  if (!ordersCtx || !langCtx || !menuCtx || !settingsCtx || !driversCtx || !reservationsCtx) return null;
  const { orders, updateOrderStatus, addStaffNote, assignDriver, startDelivery } = ordersCtx;
  const { reservations, updateReservationStatus, sendConfirmation, sendRejection, addAdminNote, getPendingReservations, getConfirmedReservations } = reservationsCtx;
  const { menuItems, updateMenuItem, toggleAvailability, deleteMenuItem } = menuCtx;
  const { settings, updateSettings } = settingsCtx;
  const { language } = langCtx;
  const { drivers, addDriver, updateDriver, updateDriverStatus, removeDriver } = driversCtx;
  const t = TRANSLATIONS[language];

  // Helper function to open Gmail compose with pre-filled message from restaurant email
  const openEmailClient = (to: string, subject: string, body: string) => {
    // Gmail compose URL that opens in browser with pre-filled fields
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailComposeUrl, '_blank');
  };

  // Generate confirmation email body
  const generateConfirmationEmailBody = (reservation: any, adminNotes: string) => {
    const isPolish = language === 'pl';
    
    return isPolish 
      ? `[UWAGA: Wyślij z konta irini070dh@gmail.com]

Dzień dobry ${reservation.customerName}!

Z przyjemnością potwierdzamy Twoją rezerwację w Greek Irini!

Jest nam niezmiernie miło móc gościć Cię w naszej rodzinnej restauracji. Czekamy z niecierpliwością, aby podzielić się z Tobą autentyczną grecką gościnnością i tradycyjnymi smakami prosto z wybrzeży Morza Egejskiego.

📅 SZCZEGÓŁY TWOJEJ REZERWACJI:

Data: ${reservation.date}
Godzina: ${reservation.time}
Liczba gości: ${reservation.numberOfGuests} ${reservation.numberOfGuests === 1 ? 'osoba' : 'osoby'}
${reservation.specialRequests ? `\nSpecjalne życzenia: ${reservation.specialRequests}` : ''}
${adminNotes ? `\nDodatkowe informacje: ${adminNotes}` : ''}

✨ Do zobaczenia wkrótce w Greek Irini!

Z wyrazami szacunku,
Zespół Greek Irini

Weimarstraat 174, 2562 HD Den Haag
Tel: 0615869325
Email: irini070dh@gmail.com`
      : `[LET OP: Verzend vanaf account irini070dh@gmail.com]

Goedendag ${reservation.customerName}!

Met veel plezier bevestigen wij uw reservering bij Greek Irini!

Het is ons een eer u te mogen verwelkomen in ons familierestaurant. We kijken ernaar uit om authentieke Griekse gastvrijheid en traditionele smaken van de Egeïsche kust met u te delen.

📅 DETAILS VAN UW RESERVERING:

Datum: ${reservation.date}
Tijd: ${reservation.time}
Aantal gasten: ${reservation.numberOfGuests} ${reservation.numberOfGuests === 1 ? 'persoon' : 'personen'}
${reservation.specialRequests ? `\nBijzondere wensen: ${reservation.specialRequests}` : ''}
${adminNotes ? `\nAanvullende informatie: ${adminNotes}` : ''}

✨ Tot ziens bij Greek Irini!

Met vriendelijke groet,
Team Greek Irini

Weimarstraat 174, 2562 HD Den Haag
Tel: 0615869325
Email: irini070dh@gmail.com`;
  };

  // Generate rejection email body
  const generateRejectionEmailBody = (reservation: any, alternativeTime: string) => {
    const isPolish = language === 'pl';
    
    return isPolish
      ? `[UWAGA: Wyślij z konta irini070dh@gmail.com]

Dzień dobry ${reservation.customerName},

Bardzo nam przykro, ale niestety nie możemy potwierdzić Twojej rezerwacji na dzień ${reservation.date} o godzinie ${reservation.time}.

W tym terminie mamy już komplety rezerwacji.
${alternativeTime ? `\n\n💡 CZY MOŻE PASOWAŁABY INNA GODZINA?\n\nProponujemy: ${alternativeTime}\n\nJeśli ten termin Państwu odpowiada, prosimy o kontakt telefoniczny lub mailowy, a chętnie dokonamy rezerwacji.` : `\n\nProsimy o kontakt w celu ustalenia alternatywnego terminu. Chętnie znajdziemy dla Państwa odpowiednią godzinę.`}

📞 KONTAKT:
Tel: 0615869325
Email: irini070dh@gmail.com

Przepraszamy za niedogodności i mamy nadzieję, że wkrótce będziemy mogli Państwa gościć!

Z wyrazami szacunku,
Zespół Greek Irini

Weimarstraat 174, 2562 HD Den Haag`
      : `[LET OP: Verzend vanaf account irini070dh@gmail.com]

Goedendag ${reservation.customerName},

Het spijt ons zeer, maar helaas kunnen we uw reservering voor ${reservation.date} om ${reservation.time} niet bevestigen.

Op dit moment zijn we voor deze tijd volledig volgeboekt.
${alternativeTime ? `\n\n💡 ZOU HET MOGELIJK ZIJN OP EEN ANDER TIJDSTIP?\n\nWe stellen voor: ${alternativeTime}\n\nAls dit schikt, neem dan gerust contact met ons op en we maken graag een nieuwe reservering voor u.` : `\n\nNeem gerust contact met ons op voor een alternatief tijdstip. We helpen graag bij het vinden van een geschikt moment.`}

📞 CONTACT:
Tel: 0615869325
Email: irini070dh@gmail.com

Onze excuses voor het ongemak en we hopen u binnenkort te mogen verwelkomen!

Met vriendelijke groet,
Team Greek Irini

Weimarstraat 174, 2562 HD Den Haag`;
  };

  // Save staff name to localStorage
  useEffect(() => {
    localStorage.setItem('staffName', staffName);
  }, [staffName]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  const prevOrderCount = useRef(orders.length);

  const connectToOrderStream = useCallback(() => {
    setSyncStatus('connected');
    syncIntervalRef.current = window.setInterval(() => {
      // Simulate occasional connectivity blips for realism
      if (Math.random() < 0.05) {
        setSyncStatus('reconnecting');
        setTimeout(() => setSyncStatus('connected'), 2000);
      }
    }, 15000);
  }, []);

  useEffect(() => {
    connectToOrderStream();
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [connectToOrderStream]);

  const playNotificationSound = useCallback(() => {
    if (!audioAlertsEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
  }, [audioAlertsEnabled]);

  // Detect new orders and send notifications
  useEffect(() => {
    if (orders.length > prevOrderCount.current) {
      const newOrder = orders[orders.length - 1];
      
      // Play sound
      playNotificationSound();
      
      // Show browser notification
      if (notificationPermission === 'granted') {
        const notification = new Notification('🔔 Nowe Zamówienie!', {
          body: `Zamówienie #${newOrder.orderNumber}\nKlient: ${newOrder.customerName}\nKwota: €${newOrder.totalAmount.toFixed(2)}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: newOrder.id,
          requireInteraction: true,
          silent: false
        });
        
        notification.onclick = () => {
          window.focus();
          setActiveTab('orders');
          setSelectedOrder(newOrder);
          notification.close();
        };
      }
      
      // Show toast notification
      setToastNotification({
        id: newOrder.id,
        message: `Nowe zamówienie #${newOrder.orderNumber} od ${newOrder.customerName}`,
        type: 'info'
      });
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => setToastNotification(null), 5000);
    }
    prevOrderCount.current = orders.length;
  }, [orders, notificationPermission, playNotificationSound]);

  // Comprehensive Metrics Calculation
  const stats = useMemo(() => {
    const now = new Date();
    
    // Use custom date range for filtering
    const startDate = customDateRange.start ? new Date(customDateRange.start) : null;
    const endDate = customDateRange.end ? new Date(customDateRange.end) : null;
    
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    // Only count orders that are paid or cash (accepted)
    const paidOrders = orders.filter(o => 
      o.payment?.status === 'paid' || o.payment?.method === 'cash'
    );

    const filteredOrders = paidOrders.filter(o => {
      if (!startDate || !endDate) return o.status === 'completed';
      const orderDate = new Date(o.createdAt);
      return o.status === 'completed' && orderDate >= startDate && orderDate <= endDate;
    });

    const revenue = filteredOrders.reduce((acc, o) => acc + o.total, 0);
    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
    
    const itemCounts: Record<string, number> = {};
    const categoryRevenue: Record<string, number> = {};

    filteredOrders.forEach(o => o.items.forEach(i => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
      const menuItem = menuItems.find(m => m.id === i.id);
      if (menuItem) {
        categoryRevenue[menuItem.category] = (categoryRevenue[menuItem.category] || 0) + (i.price * i.quantity);
      }
    }));
    
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalDishes = Object.values(itemCounts).reduce((a, b) => a + b, 0);

    // Dutch BTW Calculation (9% for food)
    const btwAmount = revenue * (9 / 109);
    const netRevenue = revenue - btwAmount;

    // Active orders are only those that are paid/cash and not completed/cancelled
    const activeOrders = paidOrders.filter(o => !['completed', 'cancelled'].includes(o.status));

    // CHART DATA CALCULATIONS

    // 1. Hourly Orders Distribution (0-23 hours)
    const hourlyOrders = Array(24).fill(0);
    filteredOrders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      hourlyOrders[hour]++;
    });

    // 2. Daily Revenue Trend (last 7 or 30 days)
    const daysToShow = reportRange === 'daily' ? 7 : reportRange === 'weekly' ? 7 : 30;
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
      const dayOrders = paidOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === date.getTime() && o.status === 'completed';
      });
      dailyRevenue.push({
        date: dateStr,
        revenue: dayOrders.reduce((acc, o) => acc + o.total, 0),
        orders: dayOrders.length
      });
    }

    // 3. Delivery Method Distribution
    const deliveryMethods = { delivery: 0, pickup: 0 };
    filteredOrders.forEach(o => {
      if (o.delivery?.type === 'delivery') deliveryMethods.delivery++;
      else deliveryMethods.pickup++;
    });

    // 4. Payment Method Distribution
    const paymentMethods = { card: 0, cash: 0, ideal: 0 };
    filteredOrders.forEach(o => {
      if (o.payment?.method === 'card') paymentMethods.card++;
      else if (o.payment?.method === 'cash') paymentMethods.cash++;
      else if (o.payment?.method === 'ideal') paymentMethods.ideal++;
    });

    // 5. Day of Week Distribution
    const dayOfWeek = Array(7).fill(0);
    filteredOrders.forEach(o => {
      const day = new Date(o.createdAt).getDay();
      dayOfWeek[day]++;
    });

    // 6. Peak Hours Detection
    const peakHour = hourlyOrders.indexOf(Math.max(...hourlyOrders));
    const peakOrders = Math.max(...hourlyOrders);

    return { 
      revenue, 
      activeCount: activeOrders.length,
      orderCount, 
      totalDishes, 
      topItems, 
      btwAmount, 
      netRevenue,
      avgOrderValue,
      categoryRevenue,
      // Chart data
      hourlyOrders,
      dailyRevenue,
      deliveryMethods,
      paymentMethods,
      dayOfWeek,
      peakHour,
      peakOrders
    };
  }, [orders, reportRange, menuItems, customDateRange]);

  // Chart.js initialization and updates
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    if (typeof window === 'undefined' || !(window as any).Chart) return;

    const Chart = (window as any).Chart;

    // Destroy existing charts
    Object.values(chartInstancesRef.current).forEach((chart: any) => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    chartInstancesRef.current = {};

    // Common chart options
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            font: { size: 11, family: "'Inter', sans-serif", weight: '600' },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8
        }
      }
    };

    // 1. Hourly Orders Chart
    if (hourlyChartRef.current) {
      const ctx = hourlyChartRef.current.getContext('2d');
      if (ctx) {
        chartInstancesRef.current.hourly = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
              label: 'Zamówienia',
              data: stats.hourlyOrders,
              backgroundColor: 'rgba(37, 99, 235, 0.8)',
              borderColor: 'rgba(37, 99, 235, 1)',
              borderWidth: 2,
              borderRadius: 8,
              hoverBackgroundColor: 'rgba(59, 130, 246, 0.9)'
            }]
          },
          options: {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              },
              x: {
                ticks: { font: { size: 10 } },
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // 2. Revenue Trend Chart
    if (revenueChartRef.current) {
      const ctx = revenueChartRef.current.getContext('2d');
      if (ctx) {
        chartInstancesRef.current.revenue = new Chart(ctx, {
          type: 'line',
          data: {
            labels: stats.dailyRevenue.map(d => d.date),
            datasets: [
              {
                label: 'Przychód (€)',
                data: stats.dailyRevenue.map(d => d.revenue),
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)'
              },
              {
                label: 'Zamówienia',
                data: stats.dailyRevenue.map(d => d.orders),
                borderColor: 'rgba(251, 191, 36, 1)',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(251, 191, 36, 1)',
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            ...commonOptions,
            scales: {
              y: {
                type: 'linear',
                position: 'left',
                beginAtZero: true,
                ticks: { 
                  font: { size: 11 },
                  callback: (value) => `€${value}`
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              },
              y1: {
                type: 'linear',
                position: 'right',
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { display: false }
              },
              x: {
                ticks: { font: { size: 10 } },
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // 3. Category Pie Chart
    if (categoryChartRef.current) {
      const ctx = categoryChartRef.current.getContext('2d');
      if (ctx) {
        const categories = Object.keys(stats.categoryRevenue);
        const revenues = Object.values(stats.categoryRevenue) as number[];
        chartInstancesRef.current.category = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: categories,
            datasets: [{
              data: revenues,
              backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)'
              ],
              borderColor: '#ffffff',
              borderWidth: 3,
              hoverOffset: 15
            }]
          },
          options: {
            ...commonOptions,
            cutout: '65%',
            plugins: {
              ...commonOptions.plugins,
              tooltip: {
                ...commonOptions.plugins.tooltip,
                callbacks: {
                  label: (context) => {
                    const value = context.parsed;
                    const total = revenues.reduce((a, b) => a + b, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${context.label}: €${value.toFixed(2)} (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // 4. Delivery Methods Chart
    if (deliveryChartRef.current) {
      const ctx = deliveryChartRef.current.getContext('2d');
      if (ctx) {
        chartInstancesRef.current.delivery = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: ['Dostawa', 'Odbiór'],
            datasets: [{
              data: [stats.deliveryMethods.delivery, stats.deliveryMethods.pickup],
              backgroundColor: ['rgba(147, 51, 234, 0.8)', 'rgba(34, 197, 94, 0.8)'],
              borderColor: '#ffffff',
              borderWidth: 3,
              hoverOffset: 10
            }]
          },
          options: {
            ...commonOptions,
            plugins: {
              ...commonOptions.plugins,
              legend: { display: true, position: 'bottom' as const }
            }
          }
        });
      }
    }

    // 5. Payment Methods Chart
    if (paymentChartRef.current) {
      const ctx = paymentChartRef.current.getContext('2d');
      if (ctx) {
        chartInstancesRef.current.payment = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Karta', 'Gotówka', 'iDEAL'],
            datasets: [{
              label: 'Zamówienia',
              data: [stats.paymentMethods.card, stats.paymentMethods.cash, stats.paymentMethods.ideal],
              backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)'
              ],
              borderColor: [
                'rgba(59, 130, 246, 1)',
                'rgba(34, 197, 94, 1)',
                'rgba(251, 191, 36, 1)'
              ],
              borderWidth: 2,
              borderRadius: 8
            }]
          },
          options: {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              },
              x: {
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // 6. Weekday Distribution Chart
    if (weekdayChartRef.current) {
      const ctx = weekdayChartRef.current.getContext('2d');
      if (ctx) {
        const dayNames = ['Niedz.', 'Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.'];
        chartInstancesRef.current.weekday = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dayNames,
            datasets: [{
              label: 'Zamówienia',
              data: stats.dayOfWeek,
              backgroundColor: stats.dayOfWeek.map((_, i) => 
                i === 5 || i === 6 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(37, 99, 235, 0.8)'
              ),
              borderColor: stats.dayOfWeek.map((_, i) => 
                i === 5 || i === 6 ? 'rgba(251, 191, 36, 1)' : 'rgba(37, 99, 235, 1)'
              ),
              borderWidth: 2,
              borderRadius: 8
            }]
          },
          options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: {
              x: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              },
              y: {
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // Cleanup on unmount
    return () => {
      Object.values(chartInstancesRef.current).forEach((chart: any) => {
        if (chart && typeof chart.destroy === 'function') chart.destroy();
      });
    };
  }, [activeTab, stats, reportRange]);

  const processedOrders = useMemo(() => {
    // Filter only paid orders or cash orders (accepted for preparation)
    const validOrders = orders.filter(o => 
      o.payment?.status === 'paid' || o.payment?.method === 'cash'
    );

    return validOrders
      .filter(o => {
        const matchesSearch = o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
        let matchesTab = true;
        if (activeTab === 'orders') matchesTab = !['completed', 'cancelled'].includes(o.status);
        if (activeTab === 'history') matchesTab = ['completed', 'cancelled'].includes(o.status);
        const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchesSearch && matchesTab && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        else if (sortBy === 'amount') comparison = a.total - b.total;
        return sortDirection === 'desc' ? -comparison : comparison;
      });
  }, [orders, searchTerm, statusFilter, sortBy, sortDirection, activeTab]);

  const performActualPrint = (order: Order) => {
    setIsPrinting(true);
    setTimeout(() => {
      if (order.status !== 'completed' && order.status !== 'cancelled') {
        updateOrderStatus(order.id, 'completed');
      }
      setIsPrinting(false);
      setPrintingOrder(null);
    }, 2500);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
      case 'preparing': return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
      case 'ready': return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
      case 'delivery': return 'text-purple-500 border-purple-500/20 bg-purple-500/5';
      case 'completed': return 'text-zinc-500 border-zinc-800 bg-zinc-900/50';
      case 'cancelled': return 'text-red-500 border-red-500/20 bg-red-500/5';
      default: return 'text-zinc-500 border-zinc-800 bg-zinc-900/50';
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await authService.signOut();
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/60">Sprawdzanie autoryzacji...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col lg:flex-row pt-24 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 border-r border-blue-200 bg-white/90 backdrop-blur-3xl p-8 flex flex-col gap-12 relative z-20">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center font-serif font-bold text-white text-xl shadow-lg">I</div>
             <div className="leading-tight">
                <h2 className="text-lg font-serif font-bold text-gray-800">{t.staffConsole}</h2>
                <p className="text-[9px] uppercase tracking-[0.3em] text-gray-600 font-bold">{t.greekIriniPremium}</p>
             </div>
          </div>

          <div className="mb-8 p-4 rounded-2xl glass border border-blue-200 flex items-center gap-4">
             <div className="relative">
                <span className={`block w-2.5 h-2.5 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                {syncStatus === 'connected' && <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-40" />}
             </div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-gray-800">
                {syncStatus === 'connected' ? t.liveLink : 'Synchronizing...'}
             </p>
          </div>
          
          {[
            { id: 'orders', label: t.liveOrders, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { id: 'history', label: t.history, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'reservations', label: t.reservations, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'analytics', label: t.analytics, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2' },
            { id: 'menu', label: t.menuManagement, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13' },
            { id: 'content', label: language === 'pl' ? 'Treści Strony' : 'Website Content', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'settings', label: t.settings, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as AdminTab); setSelectedOrder(null); setSelectedReservation(null); }}
              className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-500 group relative overflow-hidden ${
                activeTab === item.id ? 'text-white' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 transition-transform duration-500 ease-out ${activeTab === item.id ? 'translate-x-0' : '-translate-x-full'}`} />
              <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] relative z-10">{item.label}</span>
              {item.id === 'orders' && stats.activeCount > 0 && (
                <span className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold relative z-10 ${activeTab === item.id ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                  {stats.activeCount}
                </span>
              )}
              {item.id === 'reservations' && getPendingReservations().length > 0 && (
                <span className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold relative z-10 ${activeTab === item.id ? 'bg-white text-blue-600' : 'bg-amber-500 text-white'}`}>
                  {getPendingReservations().length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button 
          onClick={() => setShowReport(true)}
          className="mt-auto w-full group relative overflow-hidden glass border border-blue-400/30 rounded-2xl p-6 transition-all hover:border-blue-500/50 active:scale-95"
        >
          <div className="text-left relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-0.5">{t.periodicReport}</p>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{t.financialInsight}</p>
          </div>
        </button>

        {/* User info & Logout */}
        <div className="mt-6 space-y-3">
          {currentUserEmail && (
            <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Zalogowano jako</p>
              <p className="text-xs text-gray-700 truncate">{currentUserEmail}</p>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Wyloguj</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar p-8 lg:p-16">
        {(activeTab === 'orders' || activeTab === 'history') && (
          <div className="max-w-7xl mx-auto space-y-12 animate-reveal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <h2 className="text-6xl font-serif font-bold text-gray-900 mb-2">
                  {activeTab === 'orders' ? t.serviceQueue : t.history}
                </h2>
                <p className="text-zinc-500 uppercase tracking-[0.4em] text-[10px] font-bold">
                  {activeTab === 'orders' ? `${stats.activeCount} ${t.activeRequests}` : t.history}
                </p>
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder={t.searchOrders}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/70 border border-blue-300 rounded-2xl px-6 py-4 text-sm text-gray-900 outline-none focus:border-blue-500 transition-all placeholder:text-gray-500 w-full md:w-64"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
              <div className="xl:col-span-2 space-y-4">
                {processedOrders.length === 0 ? (
                  <div className="glass rounded-[3rem] p-20 border border-zinc-900 text-center">
                    <p className="text-zinc-600 font-serif italic text-2xl">{t.noOrdersFound}</p>
                  </div>
                ) : (
                  processedOrders.map((order) => (
                    <div 
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`group relative glass rounded-[2.5rem] p-8 border bg-white/80 transition-all duration-500 cursor-pointer overflow-hidden ${
                        selectedOrder?.id === order.id ? 'border-gold-400/40 bg-gold-400/[0.02]' : 'border-blue-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-8 items-center">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg">#{order.id.split('-')[1]}</span>
                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] border ${getStatusColor(order.status)}`}>
                              {t.orderStatus[order.status]}
                            </div>
                          </div>
                          <h3 className="text-3xl font-serif font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{order.customer.name}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-serif font-bold text-gray-900">€{order.total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Detail Sidebar */}
              {selectedOrder && (
                <div className="glass rounded-[3rem] p-10 border border-blue-200 bg-white/80 sticky top-0 h-fit space-y-10 animate-reveal">
                  <div className="flex justify-between items-start border-b border-blue-200 pb-6">
                    <div>
                      <h4 className="text-3xl font-serif font-bold text-gray-900">Order Details</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Order ID: {selectedOrder.id}</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} title="Close" aria-label="Close" className="text-gray-500 hover:text-gray-900 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Items</p>
                    <div className="space-y-4">
                       {selectedOrder.items.map((item, idx) => (
                         <div key={idx} className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                               <p className="text-sm text-gray-800 font-medium">{item.quantity}x {item.name}</p>
                            </div>
                            <span className="text-zinc-400 text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-blue-200 space-y-8">
                     <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Customer Info</p>
                        <p className="text-gray-900 text-sm font-medium">{selectedOrder.customer.address}</p>
                        <p className="text-zinc-500 text-sm">{selectedOrder.customer.phone}</p>
                     </div>

                     <div className="flex justify-between items-end">
                        <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Total Bill</span>
                        <span className="text-4xl font-serif font-bold text-amber-500">€{selectedOrder.total.toFixed(2)}</span>
                     </div>

                     {/* Status Update Buttons */}
                     {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                       <div className="space-y-3">
                         <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Update Status</p>
                         <div className="grid grid-cols-2 gap-3">
                           {selectedOrder.status === 'pending' && (
                             <button
                               onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                               className="col-span-2 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                             >
                               <span>🍳</span>
                               Start Preparing
                             </button>
                           )}
                           
                           {selectedOrder.status === 'preparing' && (
                             <>
                               {selectedOrder.deliveryMethod === 'delivery' ? (
                                 <button
                                   onClick={() => {
                                     setDeliveryOrderId(selectedOrder.id);
                                     setEstimatedDeliveryMinutes(30);
                                     setShowDeliveryModal(true);
                                   }}
                                   className="col-span-2 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                 >
                                   <span>🚗</span>
                                   Out for Delivery
                                 </button>
                               ) : (
                                 <button
                                   onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                                   className="col-span-2 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                 >
                                   <span>✓</span>
                                   Ready for Pickup
                                 </button>
                               )}
                             </>
                           )}
                           
                           {(selectedOrder.status === 'ready' || selectedOrder.status === 'delivery') && (
                             <button
                               onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                               className="col-span-2 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                             >
                               <span>✓</span>
                               Mark as Completed
                             </button>
                           )}
                         </div>
                       </div>
                     )}

                     <div className="grid grid-cols-1 gap-4">
                        <button 
                          onClick={() => setPrintingOrder(selectedOrder)}
                          className="w-full py-5 glass border border-blue-300 rounded-2xl text-blue-600 font-bold uppercase text-[11px] tracking-widest hover:border-blue-500 transition-all"
                        >
                          Print Receipt
                        </button>
                     </div>

                     {/* Staff Notes Section */}
                     <div className="border-t border-blue-200 pt-8 space-y-6">
                       <div className="flex items-center justify-between">
                         <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                           </svg>
                           Staff Notes
                         </p>
                         <span className="text-[9px] text-zinc-400 font-bold">{selectedOrder.staffNotes?.length || 0} notes</span>
                       </div>

                       {/* Existing Notes */}
                       {selectedOrder.staffNotes && selectedOrder.staffNotes.length > 0 && (
                         <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                           {selectedOrder.staffNotes.map((note) => (
                             <div key={note.id} className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                               <div className="flex items-start justify-between gap-3 mb-2">
                                 <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">{note.author}</span>
                                 <span className="text-[9px] text-zinc-400">
                                   {new Date(note.timestamp).toLocaleString('pl-PL', { 
                                     day: '2-digit', 
                                     month: '2-digit', 
                                     hour: '2-digit', 
                                     minute: '2-digit' 
                                   })}
                                 </span>
                               </div>
                               <p className="text-sm text-gray-800 leading-relaxed">{note.text}</p>
                             </div>
                           ))}
                         </div>
                       )}

                       {/* Add New Note */}
                       <div className="space-y-3">
                         <textarea
                           value={newStaffNote}
                           onChange={(e) => setNewStaffNote(e.target.value)}
                           placeholder="Add internal note about this order..."
                           rows={3}
                           className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-blue-500 outline-none transition-all resize-none"
                         />
                         <div className="flex gap-3">
                           <input
                             type="text"
                             value={staffName}
                             onChange={(e) => setStaffName(e.target.value)}
                             placeholder="Your name"
                             className="flex-1 bg-white/70 border border-blue-300 rounded-xl px-4 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none transition-all"
                           />
                           <button
                             onClick={() => {
                               if (newStaffNote.trim() && staffName.trim()) {
                                 addStaffNote(selectedOrder.id, newStaffNote.trim(), staffName.trim());
                                 setNewStaffNote('');
                               }
                             }}
                             disabled={!newStaffNote.trim() || !staffName.trim()}
                             className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                           >
                             Add Note
                           </button>
                         </div>
                       </div>
                     </div>

                     {/* Driver Assignment - Only for delivery orders */}
                     {selectedOrder.delivery.type === 'delivery' && (
                       <div className="border-t border-blue-200 pt-8 space-y-4">
                         <div className="flex items-center gap-2">
                           <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                           </svg>
                           <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Assign Driver</p>
                         </div>
                         
                         <select
                           value={selectedOrder.assignedDriver || ''}
                           onChange={(e) => assignDriver(selectedOrder.id, e.target.value || null)}
                           className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-blue-500 outline-none transition-all"
                           aria-label="Przypisz kierowcę do zamówienia"
                         >
                           <option value="">-- Nie przypisano --</option>
                           {drivers
                             .filter(d => d.status !== 'offline')
                             .map(driver => (
                               <option key={driver.id} value={driver.id}>
                                 {driver.name} ({driver.status === 'available' ? '✓ Dostępny' : `🚗 ${driver.activeDeliveries} dostaw`})
                               </option>
                             ))}
                         </select>
                         
                         {selectedOrder.assignedDriver && (
                           <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                                 {drivers.find(d => d.id === selectedOrder.assignedDriver)?.name.charAt(0)}
                               </div>
                               <div className="flex-1">
                                 <p className="text-sm font-bold text-gray-900">
                                   {drivers.find(d => d.id === selectedOrder.assignedDriver)?.name}
                                 </p>
                                 <p className="text-xs text-gray-600">
                                   {drivers.find(d => d.id === selectedOrder.assignedDriver)?.phone}
                                 </p>
                               </div>
                               <div className="text-xs font-bold text-green-600 uppercase tracking-wider">
                                 Przypisany
                               </div>
                             </div>
                           </div>
                         )}
                       </div>
                     )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-7xl mx-auto space-y-16 animate-reveal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <h2 className="text-6xl font-serif font-bold text-gray-900 mb-2">Metrics</h2>
                <p className="text-zinc-500 uppercase tracking-[0.5em] text-[10px] font-bold">Comprehensive Performance</p>
              </div>
              
              {/* Date Range Picker */}
              <div className="flex flex-col gap-4 w-full md:w-auto">
                {/* Quick Select Buttons */}
                <div className="flex gap-2 glass p-1.5 rounded-2xl border border-zinc-900">
                  <button
                    onClick={() => {
                      const today = new Date();
                      setCustomDateRange({ start: today, end: today });
                    }}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  >
                    Dziś
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const sevenDaysAgo = new Date(today);
                      sevenDaysAgo.setDate(today.getDate() - 7);
                      setCustomDateRange({ start: sevenDaysAgo, end: today });
                    }}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  >
                    7 Dni
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const thirtyDaysAgo = new Date(today);
                      thirtyDaysAgo.setDate(today.getDate() - 30);
                      setCustomDateRange({ start: thirtyDaysAgo, end: today });
                    }}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  >
                    30 Dni
                  </button>
                  <button
                    onClick={() => setCustomDateRange({ start: null, end: null })}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  >
                    Wszystko
                  </button>
                </div>
                
                {/* Custom Date Inputs */}
                <div className="flex gap-3 items-center glass p-3 rounded-2xl border border-blue-300">
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Od:</label>
                    <input
                      type="date"
                      aria-label="Data początkowa"
                      value={customDateRange.start ? customDateRange.start.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        setCustomDateRange(prev => ({ ...prev, start: date }));
                      }}
                      className="bg-white/70 border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Do:</label>
                    <input
                      type="date"
                      aria-label="Data końcowa"
                      value={customDateRange.end ? customDateRange.end.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        setCustomDateRange(prev => ({ ...prev, end: date }));
                      }}
                      className="bg-white/70 border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
               {[
                 { label: t.revenue, value: `€${stats.revenue.toFixed(0)}`, color: 'gold' },
                 { label: t.totalOrders, value: stats.orderCount, color: 'emerald' },
                 { label: t.avgOrderValue, value: `€${stats.avgOrderValue.toFixed(2)}`, color: 'blue' },
                 { label: t.dishesSold, value: stats.totalDishes, color: 'amber' }
               ].map((card, i) => (
                 <div key={i} className="glass p-10 rounded-[3rem] border border-blue-200 bg-white/80 group hover:border-gold-400/30 transition-all">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-6 group-hover:text-zinc-400 transition-colors">{card.label}</p>
                    <span className={`text-5xl font-serif font-bold ${card.color === 'gold' ? 'text-amber-500' : 'text-gray-900'}`}>{card.value}</span>
                 </div>
               ))}
            </div>

            {/* Peak Hours Insight Card */}
            {stats.peakOrders > 0 && (
              <div className="glass p-8 rounded-[3rem] border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold mb-1">Godzina Szczytu</p>
                    <p className="text-2xl font-serif font-bold text-gray-900">
                      {stats.peakHour}:00 - {stats.peakOrders} zamówień
                    </p>
                    <p className="text-sm text-amber-600 mt-1">Najwyższa aktywność w tym okresie</p>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
              {/* Hourly Orders Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal">
                <div className="flex items-center justify-between">
                  <h4 className="text-2xl font-serif font-bold text-gray-900">Zamówienia według godzin</h4>
                  <div className="px-4 py-2 bg-blue-100 rounded-xl">
                    <span className="text-xs font-bold text-blue-600">24h</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-500">Rozkład zamówień w ciągu dnia</p>
                <div className="h-[300px]">
                  <canvas ref={hourlyChartRef}></canvas>
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal stagger-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-2xl font-serif font-bold text-gray-900">Trend przychodu</h4>
                  <div className="px-4 py-2 bg-emerald-100 rounded-xl">
                    <span className="text-xs font-bold text-emerald-600">{reportRange === 'daily' ? '7 dni' : reportRange === 'weekly' ? '7 dni' : '30 dni'}</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-500">Przychód i liczba zamówień</p>
                <div className="h-[300px]">
                  <canvas ref={revenueChartRef}></canvas>
                </div>
              </div>

              {/* Category Distribution Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal stagger-2">
                <h4 className="text-2xl font-serif font-bold text-gray-900">Przychód według kategorii</h4>
                <p className="text-sm text-zinc-500">Podział przychodów na kategorie menu</p>
                <div className="h-[300px] flex items-center justify-center">
                  <canvas ref={categoryChartRef}></canvas>
                </div>
              </div>

              {/* Weekday Distribution Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal stagger-3">
                <h4 className="text-2xl font-serif font-bold text-gray-900">Zamówienia według dni</h4>
                <p className="text-sm text-zinc-500">Rozkład zamówień w tygodniu</p>
                <div className="h-[300px]">
                  <canvas ref={weekdayChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Smaller Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Delivery Methods Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal stagger-4">
                <h4 className="text-2xl font-serif font-bold text-gray-900">Metody dostawy</h4>
                <p className="text-sm text-zinc-500">Podział na dostaw i odbiór własny</p>
                <div className="h-[250px] flex items-center justify-center">
                  <canvas ref={deliveryChartRef}></canvas>
                </div>
              </div>

              {/* Payment Methods Chart */}
              <div className="glass p-10 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-6 animate-reveal stagger-5">
                <h4 className="text-2xl font-serif font-bold text-gray-900">Metody płatności</h4>
                <p className="text-sm text-zinc-500">Preferowane sposoby płatności</p>
                <div className="h-[250px]">
                  <canvas ref={paymentChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div className="glass p-12 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-10 animate-reveal stagger-6">
                  <h4 className="text-2xl font-serif font-bold text-gray-900">{t.revenueByCategory}</h4>
                  <div className="space-y-8">
                     {Object.entries(stats.categoryRevenue).map(([cat, rev]) => {
                       const revNum = typeof rev === 'number' ? rev : 0;
                       const percentage = stats.revenue > 0 ? (revNum / stats.revenue) * 100 : 0;
                       return (
                         <div key={cat} className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                               <span className="text-zinc-400">{cat}</span>
                               <span className="text-amber-500">€{revNum.toFixed(2)} ({percentage.toFixed(0)}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                               <div className="h-full bg-gradient-to-r from-blue-600 to-blue-700 transition-all duration-1000" style={{ width: Math.round(percentage) + '%' }} />
                            </div>
                         </div>
                       );
                     })}
                  </div>
               </div>

               <div className="glass p-12 rounded-[3.5rem] border border-blue-200 bg-white/80 space-y-10 animate-reveal stagger-7">
                  <h4 className="text-2xl font-serif font-bold text-gray-900">{t.topBestsellers}</h4>
                  <div className="space-y-4">
                     {stats.topItems.map(([name, count], i) => (
                        <div key={i} className="flex justify-between items-center p-5 bg-blue-50/50 rounded-2xl border border-blue-200 hover:border-gold-400/20 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">#{i+1}</span>
                              <span className="text-sm text-gray-900 font-medium">{name}</span>
                           </div>
                           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{count} {t.units}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="max-w-7xl mx-auto space-y-12 animate-reveal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <h2 className="text-6xl font-serif font-bold text-gray-900 mb-2">{t.reservations}</h2>
                <p className="text-zinc-500 uppercase tracking-[0.4em] text-[10px] font-bold">
                  {getPendingReservations().length} {t.pending} • {getConfirmedReservations().length} {t.confirmed}
                </p>
              </div>
              
              {/* Calendar Navigation */}
              <div className="flex items-center gap-4 glass p-2 rounded-2xl border border-gray-200">
                <button
                  onClick={() => {
                    const newDate = new Date(reservationCalendarDate);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setReservationCalendarDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  aria-label="Poprzedni miesiąc"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-gray-800 min-w-[150px] text-center">
                  {reservationCalendarDate.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'nl-NL', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const newDate = new Date(reservationCalendarDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setReservationCalendarDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  aria-label="Następny miesiąc"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Calendar View */}
              <div className="lg:col-span-2 glass rounded-3xl p-6 border border-gray-200">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {(t.weekDays as string[]).map(day => (
                    <div key={day} className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const year = reservationCalendarDate.getFullYear();
                    const month = reservationCalendarDate.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDay = (firstDay.getDay() + 6) % 7; // Adjust for Monday start
                    
                    const days = [];
                    
                    // Empty cells before first day
                    for (let i = 0; i < startingDay; i++) {
                      days.push(<div key={`empty-${i}`} className="h-24 rounded-xl" />);
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayReservations = reservations.filter(r => r.date === dateStr);
                      const confirmedCount = dayReservations.filter(r => r.status === 'confirmed').length;
                      const pendingCount = dayReservations.filter(r => r.status === 'pending').length;
                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      const isSelected = selectedCalendarDay === dateStr;
                      
                      days.push(
                        <button
                          key={day}
                          onClick={() => {
                            setSelectedCalendarDay(dateStr);
                            setSelectedReservation(null);
                          }}
                          className={`h-24 rounded-xl p-2 text-left transition-all hover:scale-105 ${
                            isSelected ? 'bg-blue-600 text-white ring-4 ring-blue-300' :
                            isToday ? 'bg-blue-500 text-white' : 'bg-gray-50 hover:bg-gray-100'
                          } ${dayReservations.length > 0 && !isSelected ? 'ring-2 ring-blue-300' : ''}`}
                        >
                          <span className={`text-sm font-bold ${isSelected || isToday ? 'text-white' : 'text-gray-800'}`}>
                            {day}
                          </span>
                          {dayReservations.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {confirmedCount > 0 && (
                                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSelected || isToday ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                                  ✓ {confirmedCount}
                                </div>
                              )}
                              {pendingCount > 0 && (
                                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSelected || isToday ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                  ⏳ {pendingCount}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>
              </div>

              {/* Pending Reservations List */}
              <div className="glass rounded-3xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {t.pendingReservations}
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {getPendingReservations().length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">{t.noPendingReservations}</p>
                  ) : (
                    getPendingReservations().map(reservation => (
                      <button
                        key={reservation.id}
                        onClick={() => setSelectedReservation(reservation)}
                        className={`w-full text-left p-4 rounded-2xl transition-all hover:scale-[1.02] ${
                          selectedReservation?.id === reservation.id 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`font-bold ${selectedReservation?.id === reservation.id ? 'text-white' : 'text-gray-800'}`}>
                            {reservation.customerName}
                          </span>
                          <span className={`text-xs font-bold ${selectedReservation?.id === reservation.id ? 'text-white/80' : 'text-amber-600'}`}>
                            {reservation.numberOfGuests} {t.persons}
                          </span>
                        </div>
                        <div className={`text-sm ${selectedReservation?.id === reservation.id ? 'text-white/80' : 'text-gray-600'}`}>
                          📅 {new Date(reservation.date).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'nl-NL')} • {reservation.time}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Selected Reservation Details */}
            {selectedReservation && (
              <div className="glass rounded-3xl p-8 border-2 border-blue-200 animate-reveal">
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-3xl font-serif font-bold text-gray-800">{selectedReservation.customerName}</h3>
                        <p className="text-sm text-gray-500">ID: {selectedReservation.id}</p>
                      </div>
                      <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedReservation.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        selectedReservation.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        selectedReservation.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {t.reservationStatus[selectedReservation.status]}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.date}</p>
                        <p className="text-lg font-bold text-gray-800">
                          {new Date(selectedReservation.date).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.time}</p>
                        <p className="text-lg font-bold text-gray-800">{selectedReservation.time}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.guests}</p>
                        <p className="text-lg font-bold text-gray-800">{selectedReservation.numberOfGuests} {t.persons}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.phone}</p>
                        <p className="text-lg font-bold text-gray-800">{selectedReservation.customerPhone}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-lg font-bold text-blue-600">{selectedReservation.customerEmail}</p>
                    </div>
                    
                    {selectedReservation.specialRequests && (
                      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">{t.specialRequests}</p>
                        <p className="text-sm text-gray-700">{selectedReservation.specialRequests}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions Panel */}
                  <div className="lg:w-80 space-y-4">
                    {selectedReservation.status === 'pending' && (
                      <>
                        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                          <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-2">
                            {t.adminNotes}
                          </label>
                          <textarea
                            value={reservationAdminNotes}
                            onChange={(e) => setReservationAdminNotes(e.target.value)}
                            className="w-full p-3 rounded-xl border border-blue-200 text-sm resize-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            rows={3}
                            placeholder={t.adminNotesPlaceholder}
                          />
                        </div>
                        
                        <button
                          onClick={async () => {
                            const emailBody = generateConfirmationEmailBody(selectedReservation, reservationAdminNotes);
                            const subject = language === 'pl' 
                              ? `✓ Potwierdzenie rezerwacji - Greek Irini`
                              : `✓ Reserveringsbevestiging - Greek Irini`;
                            
                            // Open email client
                            openEmailClient(selectedReservation.customerEmail, subject, emailBody);
                            
                            // Update reservation status
                            await sendConfirmation(selectedReservation.id, reservationAdminNotes || undefined);
                            setReservationAdminNotes('');
                            setSelectedReservation(null);
                          }}
                          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t.confirmAndSendEmail}
                        </button>
                        
                        <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                          <label className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-2">
                            {language === 'pl' ? 'Alternatywna godzina (opcjonalnie)' : 'Alternatief tijdstip (optioneel)'}
                          </label>
                          <input
                            type="text"
                            value={alternativeTime}
                            onChange={(e) => setAlternativeTime(e.target.value)}
                            className="w-full p-3 rounded-xl border border-red-200 text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent"
                            placeholder={language === 'pl' ? 'np. 19:00 lub 20:30' : 'bijv. 19:00 of 20:30'}
                          />
                        </div>
                        
                        <button
                          onClick={async () => {
                            const emailBody = generateRejectionEmailBody(selectedReservation, alternativeTime);
                            const subject = language === 'pl'
                              ? `Rezerwacja w Greek Irini - Prośba o kontakt`
                              : `Reservering bij Greek Irini - Verzoek tot contact`;
                            
                            // Open email client
                            openEmailClient(selectedReservation.customerEmail, subject, emailBody);
                            
                            // Update reservation status
                            await sendRejection(selectedReservation.id, alternativeTime || undefined);
                            setAlternativeTime('');
                            setSelectedReservation(null);
                          }}
                          className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {t.rejectReservation}
                        </button>
                      </>
                    )}
                    
                    {selectedReservation.status === 'confirmed' && (
                      <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-bold text-green-800">{t.reservationStatus.confirmed}</p>
                            {selectedReservation.confirmationSentAt && (
                              <p className="text-xs text-green-600">
                                {t.confirmationSentAt}: {new Date(selectedReservation.confirmationSentAt).toLocaleString(language === 'pl' ? 'pl-PL' : 'nl-NL')}
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedReservation.adminNotes && (
                          <p className="text-sm text-gray-700 bg-white rounded-xl p-3">
                            {selectedReservation.adminNotes}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={() => setSelectedReservation(null)}
                      className="w-full py-3 glass border border-gray-300 rounded-2xl text-gray-600 font-bold uppercase text-xs tracking-widest hover:border-gray-400 transition-all"
                    >
                      {t.close}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reservations for Selected Day - Shows when a day is clicked */}
            {selectedCalendarDay && (
              <div className="glass rounded-3xl p-6 border-2 border-blue-300 bg-blue-50/30 animate-reveal">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    {t.reservationsFor} {new Date(selectedCalendarDay).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setSelectedCalendarDay(null)}
                    className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                    aria-label="Zamknij"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {(() => {
                  const dayReservations = reservations
                    .filter(r => r.date === selectedCalendarDay && r.status !== 'cancelled')
                    .sort((a, b) => a.time.localeCompare(b.time));
                  
                  if (dayReservations.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">{t.noReservationsThisDay}</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {dayReservations.map(reservation => (
                        <div 
                          key={reservation.id}
                          onClick={() => setSelectedReservation(reservation)}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                            reservation.status === 'pending' 
                              ? 'bg-amber-50 border-amber-200 hover:border-amber-400' 
                              : 'bg-green-50 border-green-200 hover:border-green-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg ${
                                reservation.status === 'pending' ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'
                              }`}>
                                {reservation.time}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-lg">{reservation.customerName}</p>
                                <p className="text-sm text-gray-600">
                                  👥 {reservation.numberOfGuests} {t.persons} • 📞 {reservation.customerPhone}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                                reservation.status === 'pending' ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'
                              }`}>
                                {reservation.status === 'pending' ? `⏳ ${t.reservationStatus.pending}` : `✓ ${t.reservationStatus.confirmed}`}
                              </span>
                              {reservation.specialRequests && (
                                <p className="text-xs text-gray-500 mt-2 max-w-[200px] truncate">
                                  💬 {reservation.specialRequests}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Summary */}
                      <div className="mt-6 pt-4 border-t border-blue-200 flex items-center justify-between">
                        <div className="flex gap-4">
                          <span className="text-sm text-gray-600">
                            <span className="font-bold text-green-600">{dayReservations.filter(r => r.status === 'confirmed').length}</span> {t.confirmedRes}
                          </span>
                          <span className="text-sm text-gray-600">
                            <span className="font-bold text-amber-600">{dayReservations.filter(r => r.status === 'pending').length}</span> {t.pendingRes}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-800">
                          {t.totalGuests}: {dayReservations.reduce((sum, r) => sum + r.numberOfGuests, 0)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Menu Management Tab */}
        {activeTab === 'menu' && (
          <div className="max-w-7xl mx-auto space-y-12 animate-reveal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <h2 className="text-6xl font-serif font-bold text-gray-900 mb-2">{t.menuManagement}</h2>
                <p className="text-zinc-500 uppercase tracking-[0.4em] text-[10px] font-bold">
                  {menuItems.length} items • {menuItems.filter(m => m.isAvailable !== false).length} available
                </p>
              </div>
              <button
                onClick={() => {
                  // Initialize new menu item with empty multilingual fields
                  const newItem: MenuItem = {
                    id: 'temp-new',
                    category: 'mains',
                    price: 0,
                    image: '',
                    names: { nl: '', el: '', tr: '', ar: '', bg: '', pl: '' },
                    descriptions: { nl: '', el: '', tr: '', ar: '', bg: '', pl: '' },
                    isAvailable: true,
                    isPopular: false,
                    isNew: true,
                    isVegetarian: false,
                    isVegan: false,
                    isGlutenFree: false
                  };
                  setEditingMenuItem(newItem);
                  setIsAddingNewItem(true);
                }}
                className="px-8 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.3em] shadow-lg hover:scale-[1.02] transition-all flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add New Dish
              </button>
            </div>
            
            <div className="flex gap-4 w-full">
              <input 
                type="text" 
                placeholder="Search menu..." 
                value={menuSearchTerm}
                onChange={(e) => setMenuSearchTerm(e.target.value)}
                className="bg-white/70 border border-blue-300 rounded-2xl px-6 py-4 text-sm text-gray-900 outline-none focus:border-blue-500 transition-all placeholder:text-gray-400 flex-1"
              />
              <select
                value={menuCategoryFilter}
                title="Filter by category"
                onChange={(e) => setMenuCategoryFilter(e.target.value)}
                className="bg-white/70 border border-blue-300 rounded-2xl px-6 py-4 text-sm text-gray-900 outline-none focus:border-blue-500 transition-all"
              >
                <option value="all">All Categories</option>
                <option value="mains">Mains</option>
                <option value="starters_cold">Cold Starters</option>
                <option value="starters_warm">Warm Starters</option>
                <option value="salads">Salads</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {menuItems
                .filter(item => {
                  const matchesSearch = item.names[language].toLowerCase().includes(menuSearchTerm.toLowerCase());
                  const matchesCategory = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
                  return matchesSearch && matchesCategory;
                })
                .map(item => (
                  <div 
                    key={item.id}
                    className={`glass rounded-3xl border overflow-hidden transition-all ${
                      item.isAvailable !== false ? 'border-zinc-800 hover:border-gold-400/30' : 'border-red-500/20 opacity-60'
                    }`}
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img 
                        src={item.image} 
                        alt={item.names[language]}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        {item.isPopular && (
                          <span className="px-3 py-1 bg-gold-400 text-zinc-950 rounded-full text-[8px] font-bold uppercase">Popular</span>
                        )}
                        {item.isNew && (
                          <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-bold uppercase">New</span>
                        )}
                      </div>
                      <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase ${
                          item.isAvailable !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {item.isAvailable !== false ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-serif font-bold text-gray-900">{item.names[language]}</h3>
                          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{t.categories[item.category as keyof typeof t.categories]}</p>
                        </div>
                        <span className="text-2xl font-serif font-bold text-amber-500">€{item.price.toFixed(2)}</span>
                      </div>
                      <p className="text-zinc-500 text-sm line-clamp-2">{item.descriptions[language]}</p>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => toggleAvailability(item.id)}
                          className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            item.isAvailable !== false 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {item.isAvailable !== false ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={() => setEditingMenuItem(item)}
                          className="py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest glass border border-blue-300 text-gray-700 hover:text-gray-900 hover:border-blue-500 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="col-span-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Item
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Content Management Tab */}
        {activeTab === 'content' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-reveal">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-5xl font-serif font-bold text-gray-900 mb-2">
                  {language === 'pl' ? 'Zarządzanie Treścią' : 'Content Beheer'}
                </h2>
                <p className="text-zinc-500 uppercase tracking-[0.4em] text-[10px] font-bold">
                  {language === 'pl' ? 'Zdjęcia i opisy strony' : 'Afbeeldingen en teksten'}
                </p>
              </div>
              <button
                onClick={loadSiteContent}
                disabled={loadingContent}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loadingContent ? '...' : (language === 'pl' ? '🔄 Odśwież' : '🔄 Vernieuwen')}
              </button>
            </div>

            {/* Section Filter */}
            <div className="flex flex-wrap gap-2">
              {['all', 'home', 'about', 'about_story', 'about_philosophy', 'about_team', 'about_gallery'].map(section => (
                <button
                  key={section}
                  onClick={() => setContentSectionFilter(section)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    contentSectionFilter === section 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white/70 border border-blue-200 text-gray-700 hover:bg-blue-50'
                  }`}
                >
                  {section === 'all' ? (language === 'pl' ? 'Wszystko' : 'Alles') :
                   section === 'home' ? 'Home' :
                   section === 'about' ? 'O nas Hero' :
                   section === 'about_story' ? (language === 'pl' ? 'Historia' : 'Verhaal') :
                   section === 'about_philosophy' ? (language === 'pl' ? 'Filozofia' : 'Filosofie') :
                   section === 'about_team' ? (language === 'pl' ? 'Zespół' : 'Team') :
                   language === 'pl' ? 'Galeria' : 'Galerij'}
                </button>
              ))}
            </div>

            {loadingContent ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">{language === 'pl' ? 'Ładowanie...' : 'Laden...'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {siteContent
                  .filter(item => contentSectionFilter === 'all' || item.section === contentSectionFilter)
                  .map(item => (
                    <div key={item.id} className="glass rounded-2xl border border-blue-200 bg-white/80 p-6 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest text-blue-600 font-bold">{item.section}</span>
                          <h4 className="font-bold text-gray-900">{item.key.replace(/_/g, ' ')}</h4>
                        </div>
                        <button
                          onClick={() => setEditingContent(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>

                      {/* Image Preview */}
                      {item.value_image_url && (
                        <div className="rounded-xl overflow-hidden border border-blue-100">
                          <img 
                            src={item.value_image_url} 
                            alt={item.key}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      {/* Text Preview */}
                      {(item.value_text || item.value_text_nl || item.value_text_pl) && (
                        <div className="text-sm text-gray-600 line-clamp-3">
                          {item.value_text || item.value_text_nl || item.value_text_pl}
                        </div>
                      )}

                      {/* Language indicators */}
                      <div className="flex flex-wrap gap-1">
                        {item.value_text_nl && <span className="text-[8px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">🇳🇱 NL</span>}
                        {item.value_text_pl && <span className="text-[8px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">🇵🇱 PL</span>}
                        {item.value_text_el && <span className="text-[8px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">🇬🇷 EL</span>}
                        {item.value_text_tr && <span className="text-[8px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">🇹🇷 TR</span>}
                        {item.value_text_ar && <span className="text-[8px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">🇦🇪 AR</span>}
                        {item.value_text_bg && <span className="text-[8px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">🇧🇬 BG</span>}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Edit Content Modal */}
            {editingContent && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">{editingContent.section}</span>
                      <h3 className="text-2xl font-serif font-bold text-gray-900">{editingContent.key.replace(/_/g, ' ')}</h3>
                    </div>
                    <button
                      onClick={() => setEditingContent(null)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                      {language === 'pl' ? 'Zdjęcie' : 'Afbeelding'}
                    </label>
                    <div className="flex flex-col gap-3">
                      {/* Upload Button */}
                      <div className="flex gap-3">
                        <label className="flex-1 cursor-pointer">
                          <div className={`flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all ${
                            uploadingImage 
                              ? 'border-blue-400 bg-blue-50' 
                              : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                          }`}>
                            {uploadingImage ? (
                              <>
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-blue-600">{language === 'pl' ? 'Przesyłanie...' : 'Uploading...'}</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-700">{language === 'pl' ? 'Wybierz zdjęcie z komputera' : 'Kies afbeelding van computer'}</span>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSiteImageUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                      
                      {/* Or manual URL */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{language === 'pl' ? 'lub wklej URL:' : 'of plak URL:'}</span>
                        <input
                          type="text"
                          value={editingContent.value_image_url || ''}
                          onChange={(e) => setEditingContent({...editingContent, value_image_url: e.target.value})}
                          className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none"
                          placeholder="/image.png or https://..."
                        />
                      </div>

                      {/* Preview */}
                      {editingContent.value_image_url && (
                        <div className="flex items-start gap-4">
                          <div className="rounded-xl overflow-hidden border border-blue-200 w-32 h-24 flex-shrink-0">
                            <img 
                              src={editingContent.value_image_url} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingContent({...editingContent, value_image_url: ''})}
                            className="text-red-500 hover:text-red-700 text-xs underline"
                          >
                            {language === 'pl' ? 'Usuń zdjęcie' : 'Verwijder afbeelding'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Universal Text (if applicable) */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                      {language === 'pl' ? 'Tekst uniwersalny (EN)' : 'Universele tekst (EN)'}
                    </label>
                    <textarea
                      value={editingContent.value_text || ''}
                      onChange={(e) => setEditingContent({...editingContent, value_text: e.target.value})}
                      className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                      rows={2}
                      placeholder="English / universal text"
                    />
                  </div>

                  {/* Language-specific texts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇳🇱 Nederlands</label>
                      <textarea
                        value={editingContent.value_text_nl || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_nl: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                        placeholder="Nederlandse tekst..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇵🇱 Polski</label>
                      <textarea
                        value={editingContent.value_text_pl || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_pl: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                        placeholder="Tekst po polsku..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇬🇷 Ελληνικά</label>
                      <textarea
                        value={editingContent.value_text_el || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_el: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                        placeholder="Ελληνικό κείμενο..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇹🇷 Türkçe</label>
                      <textarea
                        value={editingContent.value_text_tr || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_tr: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                        placeholder="Türkçe metin..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇦🇪 العربية</label>
                      <textarea
                        value={editingContent.value_text_ar || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_ar: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none text-right"
                        rows={2}
                        dir="rtl"
                        placeholder="...النص العربي"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">🇧🇬 Български</label>
                      <textarea
                        value={editingContent.value_text_bg || ''}
                        onChange={(e) => setEditingContent({...editingContent, value_text_bg: e.target.value})}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                        placeholder="Български текст..."
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-4 pt-4 border-t border-blue-100">
                    <button
                      onClick={() => setEditingContent(null)}
                      className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      {language === 'pl' ? 'Anuluj' : 'Annuleren'}
                    </button>
                    <button
                      onClick={() => handleSaveContent(editingContent)}
                      disabled={savingContent}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {savingContent ? '...' : (language === 'pl' ? '💾 Zapisz zmiany' : '💾 Wijzigingen opslaan')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-reveal">
            <div>
              <h2 className="text-6xl font-serif font-bold text-gray-900 mb-2">Settings</h2>
              <p className="text-zinc-500 uppercase tracking-[0.4em] text-[10px] font-bold">Restaurant Configuration</p>
            </div>

            {/* Restaurant Info */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Restaurant Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Restaurant Name</label>
                  <input
                    type="text"
                    placeholder="Restaurant name"
                    value={settings.name}
                    onChange={(e) => updateSettings({ name: e.target.value })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Phone</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={settings.phone}
                    onChange={(e) => updateSettings({ phone: e.target.value })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={settings.email}
                    onChange={(e) => updateSettings({ email: e.target.value })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Address</label>
                  <input
                    type="text"
                    placeholder="Street address"
                    value={settings.address}
                    onChange={(e) => updateSettings({ address: e.target.value })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Opening Hours */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Opening Hours
              </h3>
              <div className="space-y-4">
                {Object.entries(settings.openingHours).map(([day, hoursData]) => {
                  const hours = hoursData as { open: string; close: string; closed?: boolean };
                  return (
                  <div key={day} className="flex items-center gap-6 p-4 bg-blue-50/50 rounded-2xl">
                    <span className="w-28 text-sm font-medium text-gray-900 capitalize">{day}</span>
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="time"
                        title="Opening time"
                        value={hours.open}
                        onChange={(e) => updateSettings({
                          openingHours: {
                            ...settings.openingHours,
                            [day]: { ...hours, open: e.target.value }
                          }
                        })}
                        className="bg-white border border-blue-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-blue-500 outline-none"
                      />
                      <span className="text-zinc-600">-</span>
                      <input
                        type="time"
                        title="Closing time"
                        value={hours.close}
                        onChange={(e) => updateSettings({
                          openingHours: {
                            ...settings.openingHours,
                            [day]: { ...hours, close: e.target.value }
                          }
                        })}
                        className="bg-white border border-blue-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => updateSettings({
                        openingHours: {
                          ...settings.openingHours,
                          [day]: { ...hours, closed: !hours.closed }
                        }
                      })}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                        hours.closed 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {hours.closed ? 'Closed' : 'Open'}
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Driver Management */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  Driver Management
                </h3>
                <button
                  onClick={() => setIsAddingNewDriver(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Dodaj kierowcę
                </button>
              </div>
              
              {/* Add New Driver Form */}
              {isAddingNewDriver && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
                  <h4 className="font-bold text-gray-900">Nowy kierowca</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-600 mb-2">Imię i nazwisko</label>
                      <input
                        type="text"
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                        placeholder="Jan Kowalski"
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-600 mb-2">Numer telefonu</label>
                      <input
                        type="tel"
                        value={newDriverPhone}
                        onChange={(e) => setNewDriverPhone(e.target.value)}
                        placeholder="+31612345678"
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (newDriverName && newDriverPhone) {
                          addDriver(newDriverName, newDriverPhone);
                          setNewDriverName('');
                          setNewDriverPhone('');
                          setIsAddingNewDriver(false);
                        }
                      }}
                      disabled={!newDriverName || !newDriverPhone}
                      className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✓ Zapisz
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingNewDriver(false);
                        setNewDriverName('');
                        setNewDriverPhone('');
                      }}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {drivers.map(driver => (
                  <div key={driver.id} className="bg-white border border-blue-200 rounded-2xl p-6">
                    {editingDriver?.id === driver.id ? (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-600 mb-2">Imię i nazwisko</label>
                            <input
                              type="text"
                              value={editingDriver.name}
                              onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                              className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none"
                              placeholder="Wpisz imię i nazwisko"
                              aria-label="Imię i nazwisko kierowcy"
                            />
                          </div>
                          <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-600 mb-2">Numer telefonu</label>
                            <input
                              type="tel"
                              value={editingDriver.phone}
                              onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                              className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none"
                              placeholder="Wpisz numer telefonu"
                              aria-label="Numer telefonu kierowcy"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              updateDriver(driver.id, { name: editingDriver.name, phone: editingDriver.phone });
                              setEditingDriver(null);
                            }}
                            className="px-5 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
                          >
                            ✓ Zapisz
                          </button>
                          <button
                            onClick={() => setEditingDriver(null)}
                            className="px-5 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                            driver.status === 'available' ? 'bg-green-500' : 
                            driver.status === 'busy' ? 'bg-amber-500' : 
                            'bg-gray-400'
                          }`}>
                            {driver.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{driver.name}</p>
                            <p className="text-sm text-gray-600">{driver.phone}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {driver.activeDeliveries > 0 ? `${driver.activeDeliveries} aktywnych dostaw` : 'Brak aktywnych dostaw'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <select
                            value={driver.status}
                            onChange={(e) => updateDriverStatus(driver.id, e.target.value as any)}
                            aria-label={`Zmień status kierowcy ${driver.name}`}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 outline-none transition-all ${
                              driver.status === 'available' ? 'bg-green-50 border-green-300 text-green-700' :
                              driver.status === 'busy' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                              'bg-gray-50 border-gray-300 text-gray-700'
                            }`}
                          >
                            <option value="available">✓ Dostępny</option>
                            <option value="busy">🚗 Zajęty</option>
                            <option value="offline">⏸ Offline</option>
                          </select>
                          
                          {/* Edit Button */}
                          <button
                            onClick={() => setEditingDriver({ id: driver.id, name: driver.name, phone: driver.phone })}
                            className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all"
                            title="Edytuj kierowcę"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (confirm(`Czy na pewno usunąć kierowcę ${driver.name}?`)) {
                                removeDriver(driver.id);
                              }
                            }}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all"
                            title="Usuń kierowcę"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {drivers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Brak kierowców. Dodaj pierwszego kierowcę.
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-blue-200">
                <p className="text-xs text-gray-500 mb-4">
                  💡 <strong>Wskazówka:</strong> Status "Zajęty" jest automatycznie ustawiany gdy kierowca ma przypisane dostawy. 
                  Status "Offline" ukrywa kierowcę z listy przypisań.
                </p>
              </div>
            </div>

            {/* Delivery Settings */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                Delivery Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Minimum Order (€)</label>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="15.00"
                    value={settings.deliveryZones.minOrder}
                    onChange={(e) => updateSettings({
                      deliveryZones: { ...settings.deliveryZones, minOrder: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Delivery Fee (€)</label>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="3.50"
                    value={settings.deliveryZones.fee}
                    onChange={(e) => updateSettings({
                      deliveryZones: { ...settings.deliveryZones, fee: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Free Delivery From (€)</label>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="35.00"
                    value={settings.deliveryZones.freeFrom}
                    onChange={(e) => updateSettings({
                      deliveryZones: { ...settings.deliveryZones, freeFrom: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-white/70 border border-blue-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Payment Methods
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'ideal' as const, label: 'iDEAL', icon: '🏦' },
                  { key: 'card' as const, label: 'Credit Card', icon: '💳' },
                  { key: 'cash' as const, label: 'Cash', icon: '💵' },
                  { key: 'bancontact' as const, label: 'Bancontact', icon: '🇧🇪' },
                ].map(method => (
                  <button
                    key={method.key}
                    onClick={() => updateSettings({
                      payments: { ...settings.payments, [method.key]: !settings.payments[method.key] }
                    })}
                    className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${
                      settings.payments[method.key]
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-gray-100 border-gray-300 text-zinc-500'
                    }`}
                  >
                    <span className="text-3xl">{method.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{method.label}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${
                      settings.payments[method.key] ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {settings.payments[method.key] ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="glass rounded-[3rem] border border-blue-200 bg-white/80 p-10 space-y-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-blue-50/50 rounded-2xl">
                  <div>
                    <p className="text-gray-900 font-medium">Sound Alerts</p>
                    <p className="text-zinc-500 text-sm">Play sound when new order arrives</p>
                  </div>
                  <button
                    onClick={() => {
                      setAudioAlertsEnabled(!audioAlertsEnabled);
                      updateSettings({
                        notifications: { ...settings.notifications, soundEnabled: !audioAlertsEnabled }
                      });
                    }}
                    aria-label="Toggle sound alerts"
                    title="Toggle sound alerts"
                    className={`w-14 h-8 rounded-full transition-all relative ${
                      audioAlertsEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                      audioAlertsEnabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-5 bg-blue-50/50 rounded-2xl">
                  <div>
                    <p className="text-gray-900 font-medium">Email Notifications</p>
                    <p className="text-zinc-500 text-sm">Receive email for new orders</p>
                  </div>
                  <button
                    onClick={() => updateSettings({
                      notifications: { ...settings.notifications, emailEnabled: !settings.notifications.emailEnabled }
                    })}
                    aria-label="Toggle email notifications"
                    title="Toggle email notifications"
                    className={`w-14 h-8 rounded-full transition-all relative ${
                      settings.notifications.emailEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                      settings.notifications.emailEnabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit/Add Menu Item Modal */}
      {(editingMenuItem || isAddingNewItem) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => {
            setEditingMenuItem(null);
            setIsAddingNewItem(false);
          }} />
          <div className="relative w-full max-w-4xl glass rounded-[3rem] border border-blue-400/20 shadow-3xl animate-reveal p-10 space-y-8 max-h-[90vh] overflow-y-auto bg-white/95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-4xl font-serif font-bold text-gray-900 mb-2">
                  {isAddingNewItem ? '➕ Add New Dish' : '✏️ Edit Menu Item'}
                </h3>
                {editingMenuItem && (
                  <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">ID: {editingMenuItem.id}</p>
                )}
              </div>
              <button 
                onClick={() => {
                  setEditingMenuItem(null);
                  setIsAddingNewItem(false);
                }} 
                title="Close" 
                aria-label="Close" 
                className="w-12 h-12 rounded-full glass border border-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-8">
              {/* Image Upload */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">📸 Dish Image</label>
                <div className="space-y-4">
                  {/* Image Preview */}
                  {editingMenuItem?.image && (
                    <div className="relative w-full h-64 rounded-2xl overflow-hidden border-2 border-gray-200">
                      <img 
                        src={editingMenuItem.image} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          if (editingMenuItem) {
                            setEditingMenuItem({ ...editingMenuItem, image: '' });
                          }
                        }}
                        aria-label="Remove image"
                        title="Remove image"
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-4">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      <div className={`w-full py-4 px-6 rounded-xl border-2 border-dashed transition-all text-center ${
                        uploadingImage 
                          ? 'border-gray-300 bg-gray-100 cursor-wait' 
                          : 'border-blue-400 bg-blue-50 hover:bg-blue-100 hover:border-blue-500'
                      }`}>
                        <div className="flex flex-col items-center gap-2">
                          {uploadingImage ? (
                            <>
                              <svg className="w-8 h-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-sm font-medium text-gray-600">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-sm font-bold text-blue-600">
                                {editingMenuItem?.image ? 'Change Image' : 'Upload Image'}
                              </span>
                              <span className="text-xs text-gray-500">Click to browse • Max 5MB</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>

                    {/* Or use URL */}
                    {!editingMenuItem?.image && (
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Or paste image URL"
                          value={editingMenuItem?.image || ''}
                          onChange={(e) => {
                            if (editingMenuItem) {
                              setEditingMenuItem({ ...editingMenuItem, image: e.target.value });
                            }
                          }}
                          className="w-full h-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="category-select" className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">📁 Category</label>
                  <select
                    id="category-select"
                    aria-label="Select category"
                    title="Select menu item category"
                    value={editingMenuItem?.category || 'mains'}
                    onChange={(e) => {
                      if (editingMenuItem) {
                        setEditingMenuItem({ ...editingMenuItem, category: e.target.value as any });
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="mains">Mains</option>
                    <option value="starters_cold">Cold Starters</option>
                    <option value="starters_warm">Warm Starters</option>
                    <option value="salads">Salads</option>
                    <option value="desserts">Desserts</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="price-input" className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">💰 Price (€)</label>
                  <input
                    id="price-input"
                    type="number"
                    step="0.50"
                    min="0"
                    aria-label="Price in euros"
                    title="Price in euros"
                    placeholder="0.00"
                    value={editingMenuItem?.price || 0}
                    onChange={(e) => {
                      if (editingMenuItem) {
                        setEditingMenuItem({ ...editingMenuItem, price: parseFloat(e.target.value) || 0 });
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:border-blue-500 outline-none transition-all text-2xl font-bold"
                  />
                </div>
              </div>

              {/* Multilingual Names */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">🌐 Names (All Languages)</label>
                <div className="grid grid-cols-2 gap-4">
                  {(['nl', 'el', 'tr', 'ar', 'bg', 'pl'] as Language[]).map(lang => (
                    <div key={lang}>
                      <label className="block text-[9px] text-gray-500 mb-1 uppercase">{lang === 'nl' ? '🇳🇱 Dutch' : lang === 'el' ? '🇬🇷 Greek' : lang === 'tr' ? '🇹🇷 Turkish' : lang === 'ar' ? '🇦🇪 Arabic' : lang === 'bg' ? '🇧🇬 Bulgarian' : '🇵🇱 Polish'}</label>
                      <input
                        type="text"
                        placeholder={`Name in ${lang}`}
                        value={editingMenuItem?.names?.[lang] || ''}
                        onChange={(e) => {
                          if (editingMenuItem) {
                            setEditingMenuItem({ 
                              ...editingMenuItem, 
                              names: { ...editingMenuItem.names, [lang]: e.target.value }
                            });
                          }
                        }}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-blue-400 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Multilingual Descriptions */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">📝 Descriptions (All Languages)</label>
                <div className="space-y-4">
                  {(['nl', 'el', 'tr', 'ar', 'bg', 'pl'] as Language[]).map(lang => (
                    <div key={lang}>
                      <label className="block text-[9px] text-gray-500 mb-1 uppercase">{lang === 'nl' ? '🇳🇱 Dutch' : lang === 'el' ? '🇬🇷 Greek' : lang === 'tr' ? '🇹🇷 Turkish' : lang === 'ar' ? '🇦🇪 Arabic' : lang === 'bg' ? '🇧🇬 Bulgarian' : '🇵🇱 Polish'}</label>
                      <textarea
                        placeholder={`Description in ${lang}`}
                        value={editingMenuItem?.descriptions?.[lang] || ''}
                        onChange={(e) => {
                          if (editingMenuItem) {
                            setEditingMenuItem({ 
                              ...editingMenuItem, 
                              descriptions: { ...editingMenuItem.descriptions, [lang]: e.target.value }
                            });
                          }
                        }}
                        rows={2}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-blue-400 outline-none transition-all resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Flags Grid */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-700 mb-3 font-bold">🏷️ Tags & Properties</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isPopular: !editingMenuItem.isPopular })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isPopular ? 'bg-amber-500/20 border-amber-500 text-amber-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    <span className="text-2xl">⭐</span>
                    <p className="text-[8px] font-bold uppercase mt-1">Popular</p>
                  </button>
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isNew: !editingMenuItem.isNew })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isNew ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    <span className="text-2xl">🆕</span>
                    <p className="text-[8px] font-bold uppercase mt-1">New</p>
                  </button>
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isVegetarian: !editingMenuItem.isVegetarian })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isVegetarian ? 'bg-green-500/20 border-green-500 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    <span className="text-2xl">🥬</span>
                    <p className="text-[8px] font-bold uppercase mt-1">Vegetarian</p>
                  </button>
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isVegan: !editingMenuItem.isVegan })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isVegan ? 'bg-green-600/20 border-green-600 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    <span className="text-2xl">🌱</span>
                    <p className="text-[8px] font-bold uppercase mt-1">Vegan</p>
                  </button>
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isGlutenFree: !editingMenuItem.isGlutenFree })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isGlutenFree ? 'bg-orange-500/20 border-orange-500 text-orange-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    <span className="text-2xl">🌾</span>
                    <p className="text-[8px] font-bold uppercase mt-1">GF</p>
                  </button>
                  <button
                    onClick={() => editingMenuItem && setEditingMenuItem({ ...editingMenuItem, isAvailable: editingMenuItem.isAvailable === false ? true : false })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      editingMenuItem?.isAvailable !== false ? 'bg-blue-500/20 border-blue-500 text-blue-700' : 'bg-red-500/20 border-red-500 text-red-700'
                    }`}
                  >
                    <span className="text-2xl">{editingMenuItem?.isAvailable !== false ? '✅' : '❌'}</span>
                    <p className="text-[8px] font-bold uppercase mt-1">{editingMenuItem?.isAvailable !== false ? 'Available' : 'Hidden'}</p>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setEditingMenuItem(null);
                    setIsAddingNewItem(false);
                  }}
                  className="flex-1 py-4 glass border-2 border-gray-300 rounded-2xl text-gray-600 font-bold uppercase text-[11px] tracking-widest hover:border-gray-400 hover:text-gray-900 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editingMenuItem) {
                      if (isAddingNewItem) {
                        // Generate new ID
                        const newId = `item-${Date.now()}`;
                        menuCtx.addMenuItem({ ...editingMenuItem, id: newId });
                      } else {
                        menuCtx.updateMenuItem(editingMenuItem.id, editingMenuItem);
                      }
                      setEditingMenuItem(null);
                      setIsAddingNewItem(false);
                    }
                  }}
                  className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-[0_8px_30px_-8px_rgba(0,102,204,0.6)] hover:scale-[1.02] transition-all"
                >
                  {isAddingNewItem ? '➕ Add Dish' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Business Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-2xl" onClick={() => setShowReport(false)} />
          <div className="relative w-full max-w-2xl glass rounded-[4rem] border border-gold-400/20 shadow-3xl overflow-hidden animate-reveal p-12 space-y-12">
             <div className="flex justify-between items-start">
                <div>
                   <h3 className="text-5xl font-serif font-bold text-white mb-2">Business Audit</h3>
                   <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] font-bold">Reporting Period: {reportRange}</p>
                </div>
                <button onClick={() => setShowReport(false)} title="Close" aria-label="Close" className="w-12 h-12 rounded-full glass border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>

             <div className="grid grid-cols-2 gap-8">
                <div className="glass p-8 rounded-3xl border border-zinc-900">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">Gross Revenue</p>
                    <p className="text-5xl font-serif font-bold text-white">€{stats.revenue.toFixed(2)}</p>
                </div>
                <div className="glass p-8 rounded-3xl border border-zinc-900">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">BTW Tax (9%)</p>
                    <p className="text-5xl font-serif font-bold text-amber-500">€{stats.btwAmount.toFixed(2)}</p>
                </div>
             </div>

             <div className="space-y-6">
                 <div className="flex justify-between text-sm py-4 border-b border-zinc-900">
                     <span className="text-zinc-400 font-medium">Net Sales (Excl. Tax)</span>
                     <span className="text-white font-bold">€{(stats.revenue - stats.btwAmount).toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-sm py-4 border-b border-zinc-900">
                     <span className="text-zinc-400 font-medium">Orders Completed</span>
                     <span className="text-white font-bold">{stats.orderCount}</span>
                 </div>
                 <div className="flex justify-between text-sm py-4">
                     <span className="text-zinc-500 font-bold uppercase tracking-widest">Final Net Result</span>
                     <span className="text-3xl font-serif font-bold blue-gradient">€{stats.netRevenue.toFixed(2)}</span>
                 </div>
             </div>

             <button 
               onClick={() => window.print()}
               className="w-full py-6 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold uppercase tracking-[0.3em] text-[10px] shadow-2xl transition-transform hover:scale-[1.02] active:scale-95"
             >
                Download Audit Report (PDF)
             </button>
          </div>
        </div>
      )}

      {/* Delivery Start Modal */}
      {showDeliveryModal && deliveryOrderId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl" onClick={() => setShowDeliveryModal(false)} />
          <div className="relative w-full max-w-md glass rounded-[3rem] border border-purple-500/30 overflow-hidden animate-reveal p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-3xl">🚗</span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-white">Start Delivery</h3>
              <p className="text-zinc-400 text-sm mt-2">Set the estimated delivery time for the customer</p>
            </div>
            
            <div className="space-y-4">
              <label className="block text-sm font-bold text-zinc-300 uppercase tracking-wider">
                Estimated Delivery Time (minutes)
              </label>
              <div className="flex items-center gap-4">
                {[15, 20, 25, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setEstimatedDeliveryMinutes(mins)}
                    className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      estimatedDeliveryMinutes === mins
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3 mt-4">
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={estimatedDeliveryMinutes}
                  onChange={(e) => setEstimatedDeliveryMinutes(parseInt(e.target.value) || 30)}
                  className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white text-center font-bold text-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-zinc-400 font-bold">minutes</span>
              </div>
              
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 mt-4">
                <p className="text-purple-300 text-sm text-center">
                  🕐 Estimated arrival: <span className="font-bold text-white">
                    {new Date(Date.now() + estimatedDeliveryMinutes * 60000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 py-4 bg-zinc-700 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-zinc-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  startDelivery(deliveryOrderId, estimatedDeliveryMinutes);
                  setShowDeliveryModal(false);
                  setDeliveryOrderId(null);
                }}
                className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                <span>🚗</span> Start Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Receipt Preview */}
      {printingOrder && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl" onClick={() => !isPrinting && setPrintingOrder(null)} />
          <div className="relative w-full max-w-lg glass rounded-[3.5rem] border border-white/10 overflow-hidden animate-reveal p-10 space-y-10">
            <h3 className="text-2xl font-serif font-bold text-white text-center">Receipt Confirmation</h3>
            <div className="relative">
               {isPrinting && (
                 <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm rounded-2xl">
                    <div className="w-16 h-16 border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
                    <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white">Processing Print Job...</p>
                 </div>
               )}
               <div className="bg-white p-10 rounded-2xl text-zinc-950 font-mono text-[11px] space-y-6 shadow-2xl">
                  <div className="text-center space-y-1">
                    <p className="font-bold text-2xl font-serif tracking-widest">GREEK IRINI</p>
                    <p>Weimarstraat 174, Den Haag</p>
                    <p className="text-[10px] opacity-60">BTW nr: NL123456789B01</p>
                  </div>
                  <div className="border-t border-zinc-200 pt-4 space-y-1">
                    <p className="font-bold">Customer: {printingOrder.customer.name}</p>
                    <p>Address: {printingOrder.customer.address}</p>
                    <p>Order Date: {new Date(printingOrder.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="space-y-2 py-4">
                    {printingOrder.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{i.quantity}x {i.name}</span>
                        <span>€{(i.price * i.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-zinc-950 pt-4 space-y-1">
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal (Excl. BTW)</span><span>€{(printingOrder.total * 0.91).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>BTW 9%</span><span>€{(printingOrder.total * 0.09).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl pt-2">
                      <span>TOTAL</span><span>€{printingOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-center pt-6 text-[10px] opacity-40 uppercase tracking-widest">Efcharistó - Thank You!</p>
               </div>
            </div>
            <div className="flex gap-4">
              <button disabled={isPrinting} onClick={() => setPrintingOrder(null)} className="flex-1 py-5 glass border border-zinc-800 rounded-2xl text-zinc-500 font-bold uppercase text-[10px]">Cancel</button>
              <button disabled={isPrinting} onClick={() => performActualPrint(printingOrder)} className="flex-[2] py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg">Confirm & Execute Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative glass rounded-[3rem] border-2 border-red-500/30 shadow-3xl animate-reveal p-10 space-y-6 max-w-md bg-white/95">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-3xl font-serif font-bold text-gray-900 mb-3">Delete Dish?</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-2">
                Are you sure you want to permanently delete this menu item?
              </p>
              <p className="text-red-600 text-xs font-bold uppercase tracking-wider">
                This action cannot be undone
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-4 glass border-2 border-gray-300 rounded-2xl text-gray-600 font-bold uppercase text-[10px] tracking-widest hover:border-gray-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmId) {
                    menuCtx.deleteMenuItem(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-[0_8px_30px_-8px_rgba(220,38,38,0.6)] hover:scale-[1.02] transition-all"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-8 right-8 z-[200] animate-reveal">
          <div className="glass border border-blue-400 rounded-2xl p-6 shadow-2xl max-w-md">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white mb-1">Nowe Zamówienie</p>
                <p className="text-xs text-zinc-300">{toastNotification.message}</p>
              </div>
              <button
                onClick={() => setToastNotification(null)}
                className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
                aria-label="Zamknij powiadomienie"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #18181b; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default AdminDashboard;
