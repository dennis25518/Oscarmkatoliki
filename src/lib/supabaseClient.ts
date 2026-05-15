import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase URL or Anon Key in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Automatically detect OAuth tokens in URL hash
  },
});

// Types for database tables
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  profile_picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  total: number;
  status: "pending" | "completed" | "cancelled";
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentMethod {
  id?: string;
  user_id: string;
  network_name: string;
  network_number: string | null;
  is_preferred?: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string | null;
  file_url: string;
  created_at: string;
  updated_at: string;
}

export interface Maswali {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
}

// Authentication helper functions
export const auth = {
  async signup(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        },
      },
    });
    return { data, error };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signInWithGoogle() {
    const isProd =
      window.location.hostname !== "localhost" &&
      !window.location.hostname.includes("127.0.0.1");
    const redirectUrl = isProd
      ? "https://www.oscarmkatoliki.co.tz/"
      : `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { data, error };
  },

  onAuthStateChange(callback: (user: any) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
    return data?.subscription || { unsubscribe: () => {} };
  },
};

// User profile helper functions
export const profiles = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return { data, error };
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    return { data, error };
  },

  async createProfile(profile: Omit<UserProfile, "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("profiles")
      .insert([profile])
      .select()
      .single();
    return { data, error };
  },
};

// Orders helper functions
export const orders = {
  async getOrders(userId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data, error };
  },

  async createOrder(order: Omit<Order, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("orders")
      .insert([order])
      .select()
      .single();
    return { data, error };
  },

  async updateOrder(orderId: string, updates: Partial<Order>) {
    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .select()
      .single();
    return { data, error };
  },
};

// Products helper functions
export const products = {
  async getAllProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    return { data, error };
  },

  async getProduct(productId: number) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    return { data, error };
  },

  async createProduct(
    product: Omit<Product, "id" | "created_at" | "updated_at">,
  ) {
    const { data, error } = await supabase
      .from("products")
      .insert([product])
      .select()
      .single();
    return { data, error };
  },

  async deleteProduct(productId: number) {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);
    return { error };
  },
};

// Payment methods helper functions
export const paymentMethods = {
  async getPaymentMethods(userId: string) {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("is_preferred", { ascending: false });
    return { data, error };
  },

  async addPaymentMethod(method: Omit<PaymentMethod, "id">) {
    // Check if this is the first method – auto-set as preferred
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", method.user_id);

    const isFirst = !existing || existing.length === 0;

    const { data, error } = await supabase
      .from("payment_methods")
      .insert([{ ...method, is_preferred: isFirst }])
      .select()
      .single();
    return { data, error };
  },

  async setPreferredPaymentMethod(methodId: string, userId: string) {
    // Unset all preferred for this user first
    const { error: unsetError } = await supabase
      .from("payment_methods")
      .update({ is_preferred: false })
      .eq("user_id", userId);

    if (unsetError) return { error: unsetError };

    // Set the chosen one as preferred
    const { data, error } = await supabase
      .from("payment_methods")
      .update({ is_preferred: true })
      .eq("id", methodId)
      .select()
      .single();
    return { data, error };
  },

  async deletePaymentMethod(methodId: string) {
    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", methodId);
    return { error };
  },
};

// Maswali (Messages) helper functions
export const maswali = {
  async createMessage(message: Omit<Maswali, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("maswali")
      .insert([message])
      .select()
      .single();
    return { data, error };
  },

  async getMessages() {
    const { data, error } = await supabase
      .from("maswali")
      .select("*")
      .order("created_at", { ascending: false });
    return { data, error };
  },

  async deleteMessage(messageId: string) {
    const { error } = await supabase
      .from("maswali")
      .delete()
      .eq("id", messageId);
    return { error };
  },
};

// Storage helper functions for profile pictures and ebooks
export const storage = {
  async uploadProfilePicture(userId: string, file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `user_profiles/${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("Mkatoliki_products")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage
      .from("Mkatoliki_products")
      .getPublicUrl(fileName);

    return { url: data.publicUrl, error: null };
  },

  async getProfilePictureUrl(userId: string) {
    const { data } = supabase.storage
      .from("Mkatoliki_products")
      .getPublicUrl(`user_profiles/${userId}`);
    return data.publicUrl;
  },

  async uploadEbook(file: File, productName: string) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${productName}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("ebooks")
      .upload(fileName, file);

    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage.from("ebooks").getPublicUrl(fileName);

    return { url: data.publicUrl, error: null };
  },

  getEbookDownloadUrl(filePath: string) {
    const { data } = supabase.storage.from("ebooks").getPublicUrl(filePath);
    return data.publicUrl;
  },

  async downloadEbook(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("ebooks")
      .download(filePath);

    if (error) return { error };

    // Create a blob URL and trigger download
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { error: null };
  },

  async uploadProductImage(file: File, productName: string) {
    const fileExt = file.name.split(".").pop();
    const fileName = `product_images/${productName}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("Mkatoliki_products")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage
      .from("Mkatoliki_products")
      .getPublicUrl(fileName);

    return { url: data.publicUrl, error: null };
  },

  getProductImageUrl(filePath: string) {
    const { data } = supabase.storage
      .from("Mkatoliki_products")
      .getPublicUrl(filePath);
    return data.publicUrl;
  },

  async uploadCommentProof(userId: string, file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `comment_proofs/${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("Mkatoliki_products")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage
      .from("Mkatoliki_products")
      .getPublicUrl(fileName);

    return { url: data.publicUrl, error: null };
  },
};

// ProductComment type
export interface ProductComment {
  id: string;
  product_id: number;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  body: string;
  proof_image_url: string | null;
  created_at: string;
}

// Comments helper functions
export const comments = {
  async getComments(productId: number) {
    const { data, error } = await supabase
      .from("product_comments")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    return { data, error };
  },

  async createComment(comment: Omit<ProductComment, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("product_comments")
      .insert([comment])
      .select()
      .single();
    return { data, error };
  },

  async deleteComment(commentId: string) {
    const { error } = await supabase
      .from("product_comments")
      .delete()
      .eq("id", commentId);
    return { error };
  },
};

// Sadaka (Donations) type
export interface SadakaRecord {
  id?: string;
  user_id: string | null;
  donor_name?: string | null;
  amount: number;
  currency?: string;
  network_name: string;
  phone_number: string;
  order_reference: string;
  message?: string | null;
  status?: "pending" | "completed" | "failed";
  created_at?: string;
}

// Sadaka helper functions
export const sadaka = {
  async createDonation(record: Omit<SadakaRecord, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("sadaka")
      .insert([record])
      .select()
      .single();
    return { data, error };
  },

  async getDonations(userId: string) {
    const { data, error } = await supabase
      .from("sadaka")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data, error };
  },
};
