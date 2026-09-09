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
import {
  fetchCompanies,
  fetchCompanyBySlug,
  fetchCompanyUsers,
  generateUuid,
  logAuditEvent,
  MOCK_COMPANIES,
  MOCK_COMPANY_USERS,
} from "./data";

export type SignUpCompanyParams = {
  companyName: string;
  companySlug: string;
  country?: string;
  currency?: string;
  taxRate?: number;
  address?: string;
  phone?: string;
  companyEmail?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
};

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
  id: "b0000000-0000-0000-0000-000000000001",
  companyId: DEFAULT_COMPANY.id,
  userId: "c0000000-0000-0000-0000-000000000001",
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
  setCurrentCompanyUser: (user: CompanyUser) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null; success?: boolean }>;
  setupFirstTimePassword: (email: string, newPassword: string) => Promise<{ error: string | null; success?: boolean }>;
  signUpCompany: (params: SignUpCompanyParams) => Promise<{ error: string | null; success?: boolean; company?: Company }>;
  loadCompanyBySlug: (slug: string) => Promise<Company | null>;
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
  const [currentCompanyUser, setCurrentCompanyUserState] = useState<CompanyUser>(() => {
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

  const setCurrentCompanyUser = (cu: CompanyUser) => {
    setCurrentCompanyUserState(cu);
    localStorage.setItem("cc_selected_role", JSON.stringify(cu));
  };

  // Resolve matching company user profile when user signs in
  const syncUserProfile = async (userEmail?: string) => {
    if (!userEmail) return;
    try {
      const allCompanies = await fetchCompanies();
      setCompanies(allCompanies);

      // Check all company users for matching email
      for (const comp of allCompanies) {
        const compUsers = await fetchCompanyUsers(comp.id);
        const match = compUsers.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
        if (match) {
          setCurrentCompany(comp);
          setCurrentCompanyUser(match);
          return;
        }
      }

      // Check mock users fallback
      const mockMatch = MOCK_COMPANY_USERS.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
      if (mockMatch) {
        const comp = MOCK_COMPANIES.find((c) => c.id === mockMatch.companyId) || DEFAULT_COMPANY;
        setCurrentCompany(comp);
        setCurrentCompanyUser(mockMatch);
      }
    } catch (e) {
      console.warn("Could not sync user profile", e);
    }
  };

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user?.email) {
        void syncUserProfile(currentSession.user.email);
      }
      setLoading(false);
    });

    // Listen for auth changes (including recovery & invite tokens)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user?.email) {
        void syncUserProfile(newSession.user.email);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Check if user exists in local mock list for demo / offline
      const mock = MOCK_COMPANY_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (mock && password.length >= 6) {
        const mockUser: User = {
          id: mock.userId,
          app_metadata: {},
          user_metadata: { full_name: mock.fullName },
          aud: "authenticated",
          created_at: mock.createdAt,
          email: mock.email,
          phone: "",
          role: "authenticated",
          updated_at: new Date().toISOString(),
        };
        setUser(mockUser);
        const comp = MOCK_COMPANIES.find((c) => c.id === mock.companyId) || DEFAULT_COMPANY;
        setCurrentCompany(comp);
        setCurrentCompanyUser(mock);
        return { error: null };
      }
      return { error: error.message };
    }

    if (data.user?.email) {
      await syncUserProfile(data.user.email);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    localStorage.removeItem("cc_selected_role");
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

  /**
   * First-time password setup for a new staff member or invited user.
   */
  const setupFirstTimePassword = async (email: string, newPassword: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      // 1. Check if user already has an active session from an invite / recovery token in URL
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updateErr) throw updateErr;
      } else {
        // 2. Try creating user account with their chosen password
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: newPassword,
        });

        if (signUpErr) {
          // If already registered, try sign-in or update
          if (signUpErr.message.toLowerCase().includes("already registered")) {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password: newPassword,
            });
            if (signInErr) {
              // Try updating user via password update
              const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
              if (updErr) throw new Error("Account already exists. If you forgot your password, please request a reset.");
            }
          } else {
            throw signUpErr;
          }
        }
      }

      // 3. Sync profile matching their corporate email
      await syncUserProfile(normalizedEmail);

      // 4. Log audit trail
      await logAuditEvent({
        companyId: currentCompany.id,
        action: "FIRST_TIME_PASSWORD_SET",
        entityType: "user_account",
        entityName: normalizedEmail,
        actorName: normalizedEmail,
        details: `User ${normalizedEmail} successfully established initial account password and activated account.`,
      });

      return { error: null, success: true };
    } catch (err) {
      // Fallback for mock/local testing:
      const mock = MOCK_COMPANY_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (mock) {
        const mockUser: User = {
          id: mock.userId,
          app_metadata: {},
          user_metadata: { full_name: mock.fullName },
          aud: "authenticated",
          created_at: mock.createdAt,
          email: mock.email,
          phone: "",
          role: "authenticated",
          updated_at: new Date().toISOString(),
        };
        setUser(mockUser);
        const comp = MOCK_COMPANIES.find((c) => c.id === mock.companyId) || DEFAULT_COMPANY;
        setCurrentCompany(comp);
        setCurrentCompanyUser(mock);
        return { error: null, success: true };
      }
      return { error: err instanceof Error ? err.message : "Could not set password" };
    }
  };

  /**
   * WordPress-style multi-tenant organization self-service signup.
   * Creates new company with unique URL slug, sets up super admin user,
   * and links initial company_users administrative credentials.
   */
  const signUpCompany = async (
    params: SignUpCompanyParams
  ): Promise<{ error: string | null; success?: boolean; company?: Company }> => {
    const {
      companyName,
      companySlug,
      country = "South Africa",
      currency = "ZAR",
      taxRate = 15.0,
      address = "",
      phone = "",
      companyEmail = "",
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
    } = params;

    const normalizedEmail = adminEmail.trim().toLowerCase();
    const cleanSlug = companySlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      return { error: "Please enter a valid organization slug." };
    }

    try {
      // 1. Verify slug uniqueness
      const existingCompany = await fetchCompanyBySlug(cleanSlug);
      if (existingCompany) {
        return {
          error: `The organization URL slug "${cleanSlug}" is already registered. Please choose another unique slug.`,
        };
      }

      // 2. Sign up or authenticate super admin user in Supabase Auth
      let authUserId: string | null = null;
      let authUserObject: User | null = null;

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: `${adminFirstName} ${adminLastName}`.trim(),
            role: "super_admin",
          },
        },
      });

      if (signUpErr) {
        // If already registered, attempt login
        if (signUpErr.message.toLowerCase().includes("already registered")) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: adminPassword,
          });
          if (signInErr) {
            return {
              error: `An account with ${normalizedEmail} already exists. Please sign in with that password or use a different email.`,
            };
          }
          authUserId = signInData.user?.id ?? null;
          authUserObject = signInData.user ?? null;
        } else {
          return { error: signUpErr.message };
        }
      } else {
        authUserId = signUpData.user?.id ?? null;
        authUserObject = signUpData.user ?? null;
      }

      if (!authUserId) {
        authUserId = generateUuid();
      }

      // 3. Upsert user in public.users
      try {
        await supabase.from("users").upsert(
          {
            id: authUserId,
            email: normalizedEmail,
            first_name: adminFirstName.trim(),
            last_name: adminLastName.trim(),
            role: "super_admin",
          },
          { onConflict: "email" }
        );
      } catch (err) {
        console.warn("Could not upsert into public.users", err);
      }

      // 4. Create new company in public.companies
      let createdCompanyId: string = generateUuid();
      try {
        const { data: compData, error: compErr } = await supabase
          .from("companies")
          .insert({
            name: companyName.trim(),
            slug: cleanSlug,
            address: address.trim(),
            phone: phone.trim(),
            email: companyEmail.trim() || normalizedEmail,
            tax_rate: taxRate,
            currency,
            default_due_day: 1,
            created_by: authUserId,
          })
          .select()
          .single();

        if (!compErr && compData) {
          createdCompanyId = compData.id;
        }
      } catch (compErr) {
        console.warn("Could not insert company into Supabase", compErr);
      }

      const newCompany: Company = {
        id: createdCompanyId,
        name: companyName.trim(),
        slug: cleanSlug,
        address: address.trim(),
        phone: phone.trim(),
        email: companyEmail.trim() || normalizedEmail,
        taxRate,
        currency,
        defaultDueDay: 1,
        createdAt: new Date().toISOString(),
      };

      // 5. Create super_admin company_user record
      let compUserId: string = generateUuid();
      const fullAdminPermissions = {
        all: true,
        manage_companies: true,
        manage_all_users: true,
        manage_properties: true,
        manage_finance: true,
        manage_maintenance: true,
        manage_hr: true,
        manage_audit: true,
        checkin_guests: true,
      };

      try {
        const { data: cuData, error: cuErr } = await supabase
          .from("company_users")
          .insert({
            company_id: createdCompanyId,
            user_id: authUserId,
            department: "admin",
            job_title: "Admin - Super Admin",
            role_level: "super_admin",
            permissions: fullAdminPermissions,
            is_active: true,
          })
          .select("id")
          .single();

        if (!cuErr && cuData) {
          compUserId = cuData.id;
        }
      } catch (cuErr) {
        console.warn("Could not insert company_user record", cuErr);
      }

      const newCompanyUser: CompanyUser = {
        id: compUserId,
        companyId: createdCompanyId,
        userId: authUserId,
        email: normalizedEmail,
        fullName: `${adminFirstName} ${adminLastName}`.trim(),
        department: "admin",
        jobTitle: "Admin - Super Admin",
        roleLevel: "super_admin",
        permissions: fullAdminPermissions,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // 6. Set active user & context
      if (authUserObject) {
        setUser(authUserObject);
      } else {
        const fallbackUser: User = {
          id: authUserId,
          app_metadata: {},
          user_metadata: { full_name: newCompanyUser.fullName },
          aud: "authenticated",
          created_at: newCompanyUser.createdAt,
          email: newCompanyUser.email,
          phone: "",
          role: "authenticated",
          updated_at: new Date().toISOString(),
        };
        setUser(fallbackUser);
      }

      MOCK_COMPANIES.unshift(newCompany);
      MOCK_COMPANY_USERS.unshift(newCompanyUser);

      setCurrentCompany(newCompany);
      setCurrentCompanyUser(newCompanyUser);
      setCompanies((prev) => [newCompany, ...prev.filter((c) => c.id !== newCompany.id)]);
      localStorage.setItem(`cc_company_country_${createdCompanyId}`, country);

      // 7. Audit log
      await logAuditEvent({
        companyId: createdCompanyId,
        action: "ORGANIZATION_CREATED",
        entityType: "company",
        entityId: createdCompanyId,
        entityName: newCompany.name,
        actorName: newCompanyUser.fullName,
        details: `Organization "${newCompany.name}" (Portal: /c/${cleanSlug}/login) successfully registered with Super Admin ${newCompanyUser.fullName} (${normalizedEmail}).`,
      });

      return { error: null, success: true, company: newCompany };
    } catch (err) {
      console.error("Signup failed", err);
      return { error: err instanceof Error ? err.message : "Failed to create organization" };
    }
  };

  const loadCompanyBySlug = async (slug: string): Promise<Company | null> => {
    try {
      const comp = await fetchCompanyBySlug(slug);
      if (comp) {
        return comp;
      }
    } catch (err) {
      console.warn("Could not load company by slug", err);
    }
    return null;
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
        setCurrentCompanyUser,
        signIn,
        signOut,
        changePassword,
        setupFirstTimePassword,
        signUpCompany,
        loadCompanyBySlug,
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
