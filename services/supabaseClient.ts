import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (update these based on your schema)
export interface Reservation {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  date: string;
  time: string;
  guests: number;
  special_requests?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  name_nl: string;
  name_el?: string;
  name_tr?: string;
  name_ar?: string;
  name_bg?: string;
  name_pl?: string;
  description_nl?: string;
  description_el?: string;
  description_tr?: string;
  description_ar?: string;
  description_bg?: string;
  description_pl?: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  is_popular?: boolean;
  is_new?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spicy_level?: number;
  allergens?: string[];
  preparation_time?: number;
  calories?: number;
  created_at: string;
  updated_at: string;
}

// Reservation functions
export const reservationService = {
  // Get all reservations
  async getAll() {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Reservation[];
  },

  // Get reservations by status
  async getByStatus(status: 'pending' | 'confirmed' | 'rejected' | 'cancelled') {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', status)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (error) throw error;
    return data as Reservation[];
  },

  // Get reservations for a specific date
  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: true });
    
    if (error) throw error;
    return data as Reservation[];
  },

  // Create new reservation
  async create(reservation: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    date: string;
    time: string;
    number_of_guests: number;
    special_requests?: string;
    status?: string;
  }) {
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select()
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  // Update reservation status
  async updateStatus(id: string, status: 'pending' | 'confirmed' | 'rejected' | 'cancelled') {
    const { data, error } = await supabase
      .from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  // Update reservation with admin notes and confirmation
  async confirm(id: string, adminNotes?: string) {
    const { data, error } = await supabase
      .from('reservations')
      .update({ 
        status: 'confirmed', 
        admin_notes: adminNotes,
        confirmation_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  // Reject reservation
  async reject(id: string) {
    const { data, error } = await supabase
      .from('reservations')
      .update({ 
        status: 'rejected', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  // Update admin notes
  async updateAdminNotes(id: string, adminNotes: string) {
    const { data, error } = await supabase
      .from('reservations')
      .update({ 
        admin_notes: adminNotes,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  // Delete reservation
  async delete(id: string) {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Subscribe to real-time reservation changes
  subscribeToReservations(callback: (reservation: Reservation) => void) {
    return supabase
      .channel('reservations-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            callback(payload.new as Reservation);
          }
        }
      )
      .subscribe();
  },

  // Unsubscribe
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
};

// Storage functions for menu images
export const storageService = {
  // Upload menu image to Supabase Storage
  async uploadMenuImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `dishes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  // Upload base64 image (from file input)
  async uploadBase64Image(base64: string, mimeType: string = 'image/jpeg'): Promise<string> {
    // Convert base64 to blob
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Create file from blob
    const ext = mimeType.split('/')[1] || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
    const filePath = `dishes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  // Delete menu image
  async deleteMenuImage(imageUrl: string): Promise<void> {
    // Extract file path from URL
    const urlParts = imageUrl.split('/menu-images/');
    if (urlParts.length < 2) return;
    
    const filePath = urlParts[1];
    const { error } = await supabase.storage
      .from('menu-images')
      .remove([filePath]);

    if (error) throw error;
  },

  // Upload site content image (for Home/About pages)
  async uploadSiteImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `site/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};

// Menu functions
export const menuService = {
  // Get all menu items
  async getAll() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name_nl', { ascending: true });
    
    if (error) throw error;
    return data as MenuItem[];
  },

  // Get available menu items
  async getAvailable() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true })
      .order('name_nl', { ascending: true });
    
    if (error) throw error;
    return data as MenuItem[];
  },

  // Get menu items by category
  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('category', category)
      .eq('available', true)
      .order('name_nl', { ascending: true });
    
    if (error) throw error;
    return data as MenuItem[];
  },

  // Create menu item
  async create(item: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('menu_items')
      .insert([item])
      .select()
      .single();
    
    if (error) throw error;
    return data as MenuItem;
  },

  // Update menu item
  async update(id: string, item: Partial<MenuItem>) {
    const { data, error } = await supabase
      .from('menu_items')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as MenuItem;
  },

  // Delete menu item
  async delete(id: string) {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// ============================================
// ORDERS SERVICE - Orders Management
// ============================================

export interface OrderItem {
  id?: string;
  order_id?: string;
  menu_item_id?: string;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  special_instructions?: string;
}

export interface StaffNote {
  id?: string;
  order_id?: string;
  text: string;
  author: string;
  created_at?: string;
}

export interface DbOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_postal_code?: string;
  customer_city?: string;
  customer_notes?: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivery' | 'completed' | 'cancelled';
  payment_method: 'ideal' | 'card' | 'bancontact' | 'cash';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  payment_transaction_id?: string;
  paid_at?: string;
  payment_amount?: number;
  delivery_type: 'delivery' | 'pickup';
  estimated_ready_time?: string;
  assigned_driver_id?: string;
  delivery_departed_at?: string;
  estimated_delivery_time?: string;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  staff_notes?: StaffNote[];
}

export const ordersService = {
  // Get all orders
  async getAll(): Promise<DbOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        staff_notes (*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as DbOrder[];
  },

  // Get orders by status
  async getByStatus(status: string): Promise<DbOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        staff_notes (*)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as DbOrder[];
  },

  // Get active orders (pending, preparing, ready, delivery)
  async getActive(): Promise<DbOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        staff_notes (*)
      `)
      .in('status', ['pending', 'preparing', 'ready', 'delivery'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as DbOrder[];
  },

  // Create new order with items
  async create(order: Omit<DbOrder, 'id' | 'created_at' | 'updated_at' | 'order_items' | 'staff_notes'>, items: Omit<OrderItem, 'id' | 'order_id'>[]): Promise<DbOrder> {
    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // Insert order items
    if (items.length > 0) {
      const orderItems = items.map(item => ({
        ...item,
        order_id: orderData.id
      }));
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;
    }
    
    // Return complete order with items
    return this.getById(orderData.id);
  },

  // Get order by ID
  async getById(id: string): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        staff_notes (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as DbOrder;
  },

  // Update order status
  async updateStatus(id: string, status: DbOrder['status']): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbOrder;
  },

  // Update payment status
  async updatePaymentStatus(id: string, payment_status: DbOrder['payment_status'], transaction_id?: string): Promise<DbOrder> {
    const updateData: any = { 
      payment_status, 
      updated_at: new Date().toISOString() 
    };
    
    if (payment_status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }
    if (transaction_id) {
      updateData.payment_transaction_id = transaction_id;
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbOrder;
  },

  // Assign driver to order
  async assignDriver(id: string, driver_id: string | null): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        assigned_driver_id: driver_id, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbOrder;
  },

  // Start delivery - mark as departed with estimated arrival time
  async startDelivery(id: string, estimatedMinutes: number): Promise<DbOrder> {
    const now = new Date();
    const estimatedDeliveryTime = new Date(now.getTime() + estimatedMinutes * 60000);
    
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'delivery',
        delivery_departed_at: now.toISOString(),
        estimated_delivery_time: estimatedDeliveryTime.toISOString(),
        updated_at: now.toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbOrder;
  },

  // Add staff note
  async addStaffNote(order_id: string, text: string, author: string): Promise<StaffNote> {
    const { data, error } = await supabase
      .from('staff_notes')
      .insert([{ order_id, text, author }])
      .select()
      .single();
    
    if (error) throw error;
    return data as StaffNote;
  },

  // Subscribe to real-time order changes
  subscribeToOrders(callback: (order: DbOrder) => void) {
    return supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const fullOrder = await this.getById(payload.new.id as string);
            callback(fullOrder);
          }
        }
      )
      .subscribe();
  },

  // Unsubscribe from real-time changes
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
};

// ============================================
// AUTH SERVICE - Supabase Authentication
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export const authService = {
  // Sign in with email and password
  async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'admin'
        },
        error: null
      };
    }

    return { user: null, error: 'Unknown error occurred' };
  },

  // Sign out
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  // Get current session
  async getSession(): Promise<AuthUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email || '',
        role: session.user.user_metadata?.role || 'admin'
      };
    }
    
    return null;
  },

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email || '',
          role: session.user.user_metadata?.role || 'admin'
        });
      } else {
        callback(null);
      }
    });
    
    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }
  
  // NOTE: Admin users are created manually via Supabase Dashboard for security
  // Go to: Authentication > Users > Add user
};

// Contact message type
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

// Contact messages service
export const contactService = {
  // Submit a contact message (for public users)
  async submit(message: { name: string; email: string; message: string }) {
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([{
        name: message.name,
        email: message.email,
        message: message.message,
        status: 'unread'
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as ContactMessage;
  },

  // Get all messages (admin only)
  async getAll() {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as ContactMessage[];
  },

  // Get unread messages count (admin only)
  async getUnreadCount() {
    const { count, error } = await supabase
      .from('contact_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');
    
    if (error) throw error;
    return count || 0;
  },

  // Update message status (admin only)
  async updateStatus(id: string, status: 'unread' | 'read' | 'replied' | 'archived') {
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as ContactMessage;
  },

  // Add admin notes (admin only)
  async addNotes(id: string, notes: string) {
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ admin_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as ContactMessage;
  },

  // Delete message (admin only)
  async delete(id: string) {
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Driver type for database
export interface DbDriver {
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  active_deliveries: number;
  created_at: string;
  updated_at: string;
}

// Drivers service
export const driversService = {
  // Get all drivers
  async getAll() {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data as DbDriver[];
  },

  // Get available drivers (not offline)
  async getAvailable() {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .neq('status', 'offline')
      .order('active_deliveries', { ascending: true });
    
    if (error) throw error;
    return data as DbDriver[];
  },

  // Create a new driver
  async create(driver: { name: string; phone: string }) {
    const { data, error } = await supabase
      .from('drivers')
      .insert([{
        name: driver.name,
        phone: driver.phone,
        status: 'available',
        active_deliveries: 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as DbDriver;
  },

  // Update driver info (name, phone)
  async update(id: string, updates: { name?: string; phone?: string }) {
    const { data, error } = await supabase
      .from('drivers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbDriver;
  },

  // Update driver status
  async updateStatus(id: string, status: 'available' | 'busy' | 'offline') {
    const { data, error } = await supabase
      .from('drivers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbDriver;
  },

  // Update active deliveries count
  async updateActiveDeliveries(id: string, count: number) {
    const { data, error } = await supabase
      .from('drivers')
      .update({ 
        active_deliveries: count,
        status: count > 0 ? 'busy' : 'available',
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DbDriver;
  },

  // Delete a driver
  async delete(id: string) {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Subscribe to driver updates (real-time)
  subscribeToDrivers(callback: (driver: DbDriver) => void) {
    const channel = supabase
      .channel('drivers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          if (payload.new) {
            callback(payload.new as DbDriver);
          }
        }
      )
      .subscribe();
    
    return channel;
  },

  // Unsubscribe from channel
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  }
};

// Settings types for database
export interface DbSettingRow {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Settings service - stores all restaurant settings in Supabase
export const settingsService = {
  // Get all settings as a combined object
  async getAll(): Promise<Record<string, Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('*');
    
    if (error) throw error;
    
    // Convert array of rows to key-value object
    const settings: Record<string, Record<string, unknown>> = {};
    (data as DbSettingRow[]).forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    return settings;
  },

  // Get a specific setting by key
  async get(key: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return data?.setting_value || null;
  },

  // Update or create a setting
  async upsert(key: string, value: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .upsert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' })
      .select()
      .single();
    
    if (error) throw error;
    return data as DbSettingRow;
  },

  // Update general settings (name, address, phone, email, etc.)
  async updateGeneral(settings: {
    name?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    email?: string;
  }) {
    const current = await this.get('general') || {};
    return this.upsert('general', { ...current, ...settings });
  },

  // Update delivery configuration
  async updateDeliveryConfig(config: {
    deliveryFee?: number;
    minOrderAmount?: number;
    freeDeliveryFrom?: number;
    estimatedPickupMinutes?: number;
    estimatedDeliveryMinutes?: number;
  }) {
    const current = await this.get('delivery_config') || {};
    return this.upsert('delivery_config', { ...current, ...config });
  },

  // Update opening hours
  async updateOpeningHours(hours: Record<string, { open: string; close: string; closed?: boolean }>) {
    return this.upsert('opening_hours', hours);
  },

  // Update delivery zones
  async updateDeliveryZones(zones: {
    postalCodes?: string[];
    fee?: number;
    minOrder?: number;
    freeFrom?: number;
  }) {
    const current = await this.get('delivery_zones') || {};
    return this.upsert('delivery_zones', { ...current, ...zones });
  },

  // Update notification settings
  async updateNotifications(notifications: {
    soundEnabled?: boolean;
    emailEnabled?: boolean;
    emailAddress?: string;
  }) {
    const current = await this.get('notifications') || {};
    return this.upsert('notifications', { ...current, ...notifications });
  },

  // Update payment methods
  async updatePayments(payments: {
    ideal?: boolean;
    card?: boolean;
    cash?: boolean;
    bancontact?: boolean;
  }) {
    const current = await this.get('payments') || {};
    return this.upsert('payments', { ...current, ...payments });
  },

  // Subscribe to settings changes (real-time)
  subscribeToSettings(callback: (key: string, value: Record<string, unknown>) => void) {
    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_settings' },
        (payload) => {
          if (payload.new) {
            const row = payload.new as DbSettingRow;
            callback(row.setting_key, row.setting_value);
          }
        }
      )
      .subscribe();
    
    return channel;
  },

  // Unsubscribe from channel
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  }
};

// Site Content interface
export interface SiteContent {
  id: string;
  section: string;
  key: string;
  value_text?: string;
  value_text_pl?: string;
  value_text_nl?: string;
  value_text_el?: string;
  value_text_tr?: string;
  value_text_ar?: string;
  value_text_bg?: string;
  value_image_url?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Site Content Service - for managing images and texts on Home/About pages
export const siteContentService = {
  // Get all content for a section
  async getBySection(section: string): Promise<SiteContent[]> {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('section', section)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data as SiteContent[];
  },

  // Get all content (for admin panel)
  async getAll(): Promise<SiteContent[]> {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .order('section', { ascending: true })
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data as SiteContent[];
  },

  // Get single content item
  async get(section: string, key: string): Promise<SiteContent | null> {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('section', section)
      .eq('key', key)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as SiteContent | null;
  },

  // Update content item
  async update(id: string, updates: Partial<Pick<SiteContent, 'value_text' | 'value_text_pl' | 'value_text_nl' | 'value_text_el' | 'value_text_tr' | 'value_text_ar' | 'value_text_bg' | 'value_image_url'>>): Promise<SiteContent> {
    const { data, error } = await supabase
      .from('site_content')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SiteContent;
  },

  // Upsert content item (create or update)
  async upsert(section: string, key: string, values: Partial<Pick<SiteContent, 'value_text' | 'value_text_pl' | 'value_text_nl' | 'value_text_el' | 'value_text_tr' | 'value_text_ar' | 'value_text_bg' | 'value_image_url' | 'sort_order'>>): Promise<SiteContent> {
    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        section,
        key,
        ...values,
        updated_at: new Date().toISOString()
      }, { onConflict: 'section,key' })
      .select()
      .single();
    
    if (error) throw error;
    return data as SiteContent;
  },

  // Delete content item
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('site_content')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get content as key-value map for easier access
  async getSectionAsMap(section: string): Promise<Record<string, SiteContent>> {
    const items = await this.getBySection(section);
    return items.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {} as Record<string, SiteContent>);
  }
};