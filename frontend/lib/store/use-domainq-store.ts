import { create } from "zustand";
import { API_BASE_URL } from "@/lib/config";
import type { CreditPricing, CreditPromo } from "@/lib/pricing";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: string;
  credits?: number;
}

export interface BookmarkedDomain {
  id: string;
  domain: string;
  extension: string;
  pricesSnapshot?: string;
  createdAt: string;
}

export interface SavedSearchRecord {
  id: string;
  businessName: string;
  description?: string;
  tlds: string; // JSON string array
  resultsCount: number;
  createdAt: string;
}

interface DomainQState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  
  // UI Dialog States
  authOpen: boolean;
  creditsOpen: boolean;
  accountOpen: boolean;
  
  // Real DB Data
  bookmarks: BookmarkedDomain[];
  savedSearches: SavedSearchRecord[];

  // Public pricing info (no auth needed)
  pricing: CreditPricing | null;
  promo: CreditPromo | null;
  fetchPricing: () => Promise<void>;
  fetchPromo: () => Promise<void>;

  // Action methods
  setAuthOpen: (open: boolean) => void;
  setCreditsOpen: (open: boolean) => void;
  setAccountOpen: (open: boolean) => void;
  setToken: (token: string | null) => void;
  initializeAuth: () => Promise<void>;
  logout: () => void;
  
  // DB Fetching Actions
  fetchProfile: () => Promise<void>;
  fetchBookmarks: () => Promise<void>;
  fetchSavedSearches: () => Promise<void>;
  toggleBookmark: (domainName: string, extension: string, pricesSnapshot?: any) => Promise<void>;
  isBookmarked: (domainName: string) => boolean;
}

const BACKEND_URL = API_BASE_URL;

export const useDomainQStore = create<DomainQState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  
  authOpen: false,
  creditsOpen: false,
  accountOpen: false,
  
  bookmarks: [],
  savedSearches: [],

  pricing: null,
  promo: null,

  fetchPricing: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/credits/pricing`);
      if (res.ok) set({ pricing: (await res.json()) as CreditPricing });
    } catch (err) {
      console.error("Failed to load credit pricing:", err);
    }
  },

  fetchPromo: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/credits/promo`);
      if (res.ok) set({ promo: (await res.json()) as CreditPromo });
    } catch (err) {
      console.error("Failed to load sign-up promo:", err);
    }
  },

  setAuthOpen: (open) => set({ authOpen: open }),
  setCreditsOpen: (open) => set({ creditsOpen: open }),
  setAccountOpen: (open) => set({ accountOpen: open }),

  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
      set({ token, isAuthenticated: true });
      get().fetchProfile();
      get().fetchBookmarks();
      get().fetchSavedSearches();
    } else {
      localStorage.removeItem("token");
      set({ token: null, isAuthenticated: false, user: null, bookmarks: [], savedSearches: [] });
    }
  },

  initializeAuth: async () => {
    if (typeof window === "undefined") return;
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      set({ token: storedToken, isAuthenticated: true });
      try {
        await get().fetchProfile();
        await get().fetchBookmarks();
        await get().fetchSavedSearches();
      } catch (err) {
        console.error("Auth initialization failed:", err);
        get().logout();
      }
    }
    set({ isInitialized: true });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      bookmarks: [],
      savedSearches: [],
      accountOpen: false,
    });
  },

  fetchProfile: async () => {
    const { token } = get();
    if (!token) return;

    try {
      // 1. Fetch User profile details
      const userRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userRes.ok) throw new Error("Failed to fetch profile");
      const userProfile = await userRes.json();

      // 2. Fetch User Credit balance
      const creditRes = await fetch(`${BACKEND_URL}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let credits = 0;
      if (creditRes.ok) {
        const creditBalance = await creditRes.json();
        // The API returns decimal for balance, parse it
        credits = parseFloat(creditBalance.balance) || 0;
      }

      set({
        user: {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
          avatar: userProfile.avatar || "",
          provider: userProfile.provider,
          credits,
        },
      });
    } catch (error) {
      console.error("Error fetching profile details:", error);
      throw error;
    }
  },

  fetchBookmarks: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/domains/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ bookmarks: data });
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    }
  },

  fetchSavedSearches: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/domains/searches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ savedSearches: data });
      }
    } catch (error) {
      console.error("Failed to fetch saved searches:", error);
    }
  },

  toggleBookmark: async (domainName, extension, pricesSnapshot) => {
    const { token, bookmarks: currentBookmarks } = get();
    if (!token) {
      set({ authOpen: true });
      return;
    }

    const isExisting = currentBookmarks.some((b) => b.domain === domainName);

    try {
      if (isExisting) {
        // Delete
        const res = await fetch(`${BACKEND_URL}/api/domains/bookmarks/${domainName}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          set({
            bookmarks: currentBookmarks.filter((b) => b.domain !== domainName),
          });
        }
      } else {
        // Add
        const res = await fetch(`${BACKEND_URL}/api/domains/bookmarks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            domain: domainName,
            extension,
            pricesSnapshot,
          }),
        });
        if (res.ok) {
          const newBookmark = await res.json();
          set({
            bookmarks: [newBookmark, ...currentBookmarks],
          });
        }
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  },

  isBookmarked: (domainName) => {
    return get().bookmarks.some((b) => b.domain === domainName);
  },
}));
