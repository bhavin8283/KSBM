import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { StaffProfile } from '../types';
import { useStore } from './StoreContext';

interface LoginResult {
  success: boolean;
  user?: StaffProfile;
  error?: string;
}

interface AuthContextValue {
  currentUser: StaffProfile | null;
  isAuthenticated: boolean;
  staffProfiles: StaffProfile[];
  loginWithPin: (pin: string) => LoginResult;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { staffList } = useStore();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const found = staffList.find((member) => member.id === currentUserId);
    if (!found || !found.active) return null;
    return found;
  }, [currentUserId, staffList]);

  const loginWithPin = (pin: string): LoginResult => {
    const normalizedPin = pin.trim();
    const matched = staffList.find((profile) => profile.pin === normalizedPin);

    if (!matched) {
      return {
        success: false,
        error: 'Invalid 4-digit staff PIN. Check your PIN or select an active profile.',
      };
    }

    if (!matched.active) {
      return {
        success: false,
        error: `${matched.name}'s account is currently inactive. Contact Store Admin.`,
      };
    }

    setCurrentUserId(matched.id);
    return { success: true, user: matched };
  };

  const logout = () => {
    setCurrentUserId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: currentUser !== null,
        staffProfiles: staffList,
        loginWithPin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
