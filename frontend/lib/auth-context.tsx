"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: "google" | "facebook" | "twitter" | "github";
  credits: number;
  bookmarks: BookmarkedDomain[];
  savedSearches: SavedSearch[];
  purchases: Purchase[];
}

export interface BookmarkedDomain {
  id: string;
  domain: string;
  name: string;
  extension: string;
  bestPrice: number | null;
  available: boolean;
  savedAt: Date;
}

export interface SavedSearch {
  id: string;
  type: "generate" | "check";
  query: string;
  description?: string;
  tlds?: string[];
  resultCount: number;
  searchedAt: Date;
}

export interface Purchase {
  id: string;
  amount: number;
  credits: number;
  method: "stripe" | "usdc";
  status: "completed" | "pending" | "failed";
  date: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (provider: "google" | "facebook" | "twitter" | "github") => void;
  signOut: () => void;
  addCredits: (amount: number, credits: number, method: "stripe" | "usdc") => void;
  useCredits: (amount: number) => boolean;
  toggleBookmark: (domain: BookmarkedDomain) => void;
  isBookmarked: (domainName: string) => boolean;
  saveSearch: (search: Omit<SavedSearch, "id" | "searchedAt">) => void;
  removeBookmark: (domainName: string) => void;
  removeSavedSearch: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USER: User = {
  id: "usr_1",
  name: "Alex Morgan",
  email: "alex@example.com",
  avatar: "",
  provider: "google",
  credits: 25,
  bookmarks: [
    {
      id: "bk_1",
      domain: "swiftlaunch.io",
      name: "swiftlaunch",
      extension: ".io",
      bestPrice: 9.99,
      available: true,
      savedAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: "bk_2",
      domain: "nebulahq.com",
      name: "nebulahq",
      extension: ".com",
      bestPrice: 11.99,
      available: true,
      savedAt: new Date(Date.now() - 86400000),
    },
  ],
  savedSearches: [
    {
      id: "ss_1",
      type: "generate",
      query: "Swift Launch",
      description: "Fast project management tool",
      tlds: [".com", ".io", ".co"],
      resultCount: 18,
      searchedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: "ss_2",
      type: "check",
      query: "nebulahq.com",
      resultCount: 1,
      searchedAt: new Date(Date.now() - 86400000),
    },
  ],
  purchases: [
    {
      id: "pur_1",
      amount: 5,
      credits: 50,
      method: "stripe",
      status: "completed",
      date: new Date(Date.now() - 86400000 * 7),
    },
    {
      id: "pur_2",
      amount: 1,
      credits: 10,
      method: "usdc",
      status: "completed",
      date: new Date(Date.now() - 86400000 * 2),
    },
  ],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const signIn = useCallback((provider: "google" | "facebook" | "twitter" | "github") => {
    setUser({ ...MOCK_USER, provider });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  const addCredits = useCallback((amount: number, credits: number, method: "stripe" | "usdc") => {
    setUser((prev) => {
      if (!prev) return prev;
      const purchase: Purchase = {
        id: `pur_${Date.now()}`,
        amount,
        credits,
        method,
        status: "completed",
        date: new Date(),
      };
      return {
        ...prev,
        credits: prev.credits + credits,
        purchases: [purchase, ...prev.purchases],
      };
    });
  }, []);

  const useCredits = useCallback((amount: number) => {
    let success = false;
    setUser((prev) => {
      if (!prev || prev.credits < amount) return prev;
      success = true;
      return { ...prev, credits: prev.credits - amount };
    });
    return success;
  }, []);

  const toggleBookmark = useCallback((domain: BookmarkedDomain) => {
    setUser((prev) => {
      if (!prev) return prev;
      const exists = prev.bookmarks.find((b) => b.domain === domain.domain);
      if (exists) {
        return { ...prev, bookmarks: prev.bookmarks.filter((b) => b.domain !== domain.domain) };
      }
      return { ...prev, bookmarks: [{ ...domain, id: `bk_${Date.now()}`, savedAt: new Date() }, ...prev.bookmarks] };
    });
  }, []);

  const isBookmarked = useCallback((domainName: string) => {
    return user?.bookmarks.some((b) => b.domain === domainName) ?? false;
  }, [user?.bookmarks]);

  const removeBookmark = useCallback((domainName: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, bookmarks: prev.bookmarks.filter((b) => b.domain !== domainName) };
    });
  }, []);

  const saveSearch = useCallback((search: Omit<SavedSearch, "id" | "searchedAt">) => {
    setUser((prev) => {
      if (!prev) return prev;
      const saved: SavedSearch = { ...search, id: `ss_${Date.now()}`, searchedAt: new Date() };
      return { ...prev, savedSearches: [saved, ...prev.savedSearches] };
    });
  }, []);

  const removeSavedSearch = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, savedSearches: prev.savedSearches.filter((s) => s.id !== id) };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        signIn,
        signOut,
        addCredits,
        useCredits,
        toggleBookmark,
        isBookmarked,
        saveSearch,
        removeBookmark,
        removeSavedSearch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
