import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithPopup, signOut, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, User
} from "firebase/auth";
import { auth, isConfigured } from "../lib/firebase";
import { UserProfile, UserRole } from "../types";
import { fetchUserProfile, registerSupervisorProfile, deleteUserProfileDoc } from "../lib/dbManager";

interface AuthContextType {
  user: User | null;
  role: UserRole;
  groupId: string | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, role: UserRole, groupId: string | null) => Promise<void>;
  logout: () => Promise<void>;
  setSimulatedRole: (role: UserRole, supervisorId?: string) => void;
  isSimulating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("Guest");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isSimulating) {
        setLoading(false);
        return;
      }

      setLoading(true);
      if (firebaseUser) {
        try {
          const email = firebaseUser.email || undefined;
          let userProfile = await fetchUserProfile(firebaseUser.uid, email);
          
          if (userProfile && (userProfile as any).isTempProfile) {
            // Self-register / migrate from pre-registered email placeholder
            const migrated: UserProfile = {
              uid: firebaseUser.uid,
              email: email || "",
              name: userProfile.name,
              role: userProfile.role,
              groupId: userProfile.groupId,
              groupName: userProfile.groupName
            };
            await registerSupervisorProfile(firebaseUser.uid, migrated);
            if ((userProfile as any).tempDocId) {
              await deleteUserProfileDoc((userProfile as any).tempDocId);
            }
            userProfile = migrated;
          }

          if (!userProfile) {
            // Unregistered user! Sign them out immediately to block access
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setRole("Guest");
            setGroupId(null);
          } else {
            setUser(firebaseUser);
            setProfile(userProfile);
            setRole(userProfile.role);
            setGroupId(userProfile.groupId);
          }
        } catch (error) {
          console.error("Error loading user RBAC profile:", error);
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setRole("Guest");
          setGroupId(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole("Guest");
        setGroupId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSimulating]);

  const loginWithGoogle = async () => {
    if (!isConfigured || !auth) {
      throw new Error("السحابة ليست متصلة حالياً. جاري استخدام الذاكرة المحلية كبديل.");
    }
    const { googleProvider } = await import("../lib/firebase");
    setIsSimulating(false);
    
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    if (firebaseUser) {
      const email = firebaseUser.email || undefined;
      let userProfile = await fetchUserProfile(firebaseUser.uid, email);
      
      if (userProfile && (userProfile as any).isTempProfile) {
        const migrated: UserProfile = {
          uid: firebaseUser.uid,
          email: email || "",
          name: userProfile.name,
          role: userProfile.role,
          groupId: userProfile.groupId,
          groupName: userProfile.groupName
        };
        await registerSupervisorProfile(firebaseUser.uid, migrated);
        if ((userProfile as any).tempDocId) {
          await deleteUserProfileDoc((userProfile as any).tempDocId);
        }
        userProfile = migrated;
      }

      if (!userProfile) {
        await signOut(auth);
        throw new Error("🚨 عذراً، هذا الحساب غير مسجل كمعلم في المقرأة. يرجى طلب الإضافة أولاً من المشرف العام.");
      }
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!isConfigured || !auth) {
      throw new Error("السحابة ليست متصلة حالياً. جاري استخدام الذاكرة المحلية كبديل.");
    }
    setIsSimulating(false);
    
    const result = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = result.user;
    if (firebaseUser) {
      const uEmail = firebaseUser.email || undefined;
      let userProfile = await fetchUserProfile(firebaseUser.uid, uEmail);
      
      if (userProfile && (userProfile as any).isTempProfile) {
        const migrated: UserProfile = {
          uid: firebaseUser.uid,
          email: uEmail || "",
          name: userProfile.name,
          role: userProfile.role,
          groupId: userProfile.groupId,
          groupName: userProfile.groupName
        };
        await registerSupervisorProfile(firebaseUser.uid, migrated);
        if ((userProfile as any).tempDocId) {
          await deleteUserProfileDoc((userProfile as any).tempDocId);
        }
        userProfile = migrated;
      }

      if (!userProfile) {
        await signOut(auth);
        throw new Error("🚨 عذراً، هذا الحساب غير مسجل كمعلم في المقرأة. يرجى طلب الإضافة أولاً من المشرف العام.");
      }
    }
  };

  const signUpWithEmail = async (
    email: string, 
    password: string, 
    name: string, 
    assignedRole: UserRole, 
    assignedGroupId: string | null
  ) => {
    if (!isConfigured || !auth) {
      throw new Error("السحابة ليست متصلة حالياً. جاري استخدام الذاكرة المحلية كبديل.");
    }
    setIsSimulating(false);
    
    const uEmail = email.toLowerCase().trim();
    const isGeneral = uEmail === "ziad130512@gmail.com";
    
    // Guard: verify that the email is pre-registered
    let userProfile = await fetchUserProfile("temp_lookup", uEmail);
    if (!isGeneral && !userProfile) {
      throw new Error("🚨 حدث خطأ: هذا البريد الإلكتروني غير مسبق التسجيل من قبل المشرف العام كمعلم حلقة. يرجى التواصل مع الإدارة أولاً لتسجيل بريدك.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const registeredUser = userCredential.user;
    
    const finalRole = isGeneral ? "GeneralSupervisor" : (userProfile?.role || assignedRole);
    const finalGroupId = isGeneral ? null : (userProfile?.groupId || assignedGroupId);
    const finalGroupName = isGeneral ? "الإشراف العام" : (userProfile?.groupName || "حلقة جديدة");
    
    const newProfile: UserProfile = {
      uid: registeredUser.uid,
      email: uEmail,
      name: name || userProfile?.name || "معلم حلقة",
      role: finalRole,
      groupId: finalGroupId,
      groupName: finalGroupName
    };
    
    await registerSupervisorProfile(registeredUser.uid, newProfile);
    if (userProfile && (userProfile as any).isTempProfile) {
      if ((userProfile as any).tempDocId) {
        await deleteUserProfileDoc((userProfile as any).tempDocId);
      }
    }
    
    setUser(registeredUser);
    setProfile(newProfile);
    setRole(finalRole);
    setGroupId(finalGroupId);
  };

  const logout = async () => {
    setIsSimulating(false);
    if (isConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
    setRole("Guest");
    setGroupId(null);
  };

  const setSimulatedRole = (simulatedRole: UserRole, supervisorId?: string) => {
    // Left as legacy signature stub to avoid compilation errors but will not be visible in UI
    console.log("No-op switcher called.", simulatedRole, supervisorId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        groupId,
        profile,
        loading,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
        setSimulatedRole,
        isSimulating
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Reusable Higher-Order Wrapper Component for Route & Content Protection
export function ProtectedRoute({ 
  children, 
  allowedRoles,
  fallback = null
}: { 
  children: React.ReactNode; 
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-950 border-t-emerald-500 animate-spin"></div>
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    if (fallback) return <>{fallback}</>;
    
    // Default 403 Forbidden beautiful view
    return (
      <div className="bg-[#0f171e]/70 border border-red-950/40 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 shadow-2xl backdrop-blur-sm">
        <div className="w-16 h-16 bg-red-950/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-900/30">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6V9m12 3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">عذراً! المحتوى محمي بموجب الصلاحيات</h3>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
          تتطلب هذه الصفحة صلاحيات إضافية للدخول. لا يمكن لمرتبة <span className="text-red-400 font-bold font-sans">[{role}]</span> الوصول لهذا القسم. الرجاء تسجيل الدخول أو تأكيد حسابك من الشريط العلوي.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
