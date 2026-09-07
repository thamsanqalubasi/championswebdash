import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Company, CompanyUser, DepartmentType, RoleLevel } from "./types";

const DEFAULT_COMPANY: Company = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "Champions Court Hospitality & Properties",
  slug: "champions-court",
  address: "124 Main Boulevard, Johannesburg, South Africa",
  phone: "+27 11 987 6543",
  email: "admin@championscourt.co.za",
  taxRate: 15.0,
  currency: "ZAR",
  defaultDueDay: 1,
  paymentInstructions: "EFT to Standard Bank Acc #987654321, Branch #051001",
  createdAt: "2026-01-01T00:00:00Z",
};

const DEFAULT_COMPANY_USER: CompanyUser = {
  id: "u0000000-0000-0000-0000-000000000001",
  companyId: DEFAULT_COMPANY.id,
  userId: "admin-user-001",
  email: "admin@championscourt.co.za",
  fullName: "Thamsanqa Lubasi (Super Admin)",
  department: "admin",
  jobTitle: "Admin - Super Admin",
  roleLevel: "super_admin",
  permissions: {
    all: true,
    manage_companies: true,
    manage_all_users: true,
    manage_properties: true,
    manage_finance: true,
    manage_maintenance: true,
    manage_hr: true,
    manage_audit: true,
    checkin_guests: true,
  },
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
};

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentCompany: Company;
  companies: Company[];
  currentCompanyUser: CompanyUser;
  setCurrentCompany: (company: Company) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null; success?: boolean }>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canAccessDepartment: (dept: DepartmentType) => boolean;
  canManageDepartmentUsers: (dept: DepartmentType) => boolean;
  hasPermission: (perm: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentCompany, setCurrentCompanyState] = useState<Company>(() => {
    const saved = localStorage.getItem("cc_selected_company");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return DEFAULT_COMPANY;
  });
  const [companies, setCompanies] = useState<Company[]>([DEFAULT_COMPANY]);
  const [currentCompanyUser, setCurrentCompanyUser] = useState<CompanyUser>(() => {
    const saved = localStorage.getItem("cc_selected_role");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return DEFAULT_COMPANY_USER;
  });

  const setCurrentCompany = (comp: Company) => {
    setCurrentCompanyState(comp);
    localStorage.setItem("cc_selected_company", JSON.stringify(comp));
  };

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const changePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { error: error.message };
      }
      return { error: null, success: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Password update failed" };
    }
  };

  // Helper permission checks based on requirements
  const isSuperAdmin = currentCompanyUser.roleLevel === "super_admin" || currentCompanyUser.jobTitle === "Admin - Super Admin";
  const isAdmin = isSuperAdmin || currentCompanyUser.roleLevel === "admin" || currentCompanyUser.department === "admin";
  const isManager = currentCompanyUser.roleLevel === "manager" || currentCompanyUser.jobTitle.includes("Manager");

  const canAccessDepartment = (dept: DepartmentType): boolean => {
    if (isAdmin) return true;
    if (currentCompanyUser.department === dept) return true;
    // Front desk can view commercial properties and check-in
    if (currentCompanyUser.department === "front_desk" && (dept === "admin" || dept === "maintenance")) return true;
    // Audit department can access audit, invoices, finance logs
    if (currentCompanyUser.department === "audit") return true;
    return false;
  };

  const canManageDepartmentUsers = (dept: DepartmentType): boolean => {
    if (isAdmin) return true; // Admin can add all users across all depts
    if (isManager && currentCompanyUser.department === dept) return true; // Manager can add in own dept
    return false;
  };

  const hasPermission = (perm: string): boolean => {
    if (isAdmin) return true;
    if (currentCompanyUser.permissions?.[perm] === true) return true;
    if (currentCompanyUser.roleLevel === "all_rights") return true;
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        currentCompany,
        companies,
        currentCompanyUser,
        setCurrentCompany,
        signIn,
        signOut,
        changePassword,
        isSuperAdmin,
        isAdmin,
        isManager,
        canAccessDepartment,
        canManageDepartmentUsers,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
