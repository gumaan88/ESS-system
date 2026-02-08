import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { getEmployeeData } from '../services/firebaseService';
import { Employee } from '../types';

interface AuthContextType {
  user: User | null;
  employeeData: Employee | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const empData = await getEmployeeData(currentUser.uid);
          setEmployeeData(empData);
        } catch (error) {
          console.error("Failed to fetch employee data:", error);
          setEmployeeData(null);
          // Optional: sign out user if their employee data doesn't exist
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
        setEmployeeData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const logout = async () => {
    await signOut(auth);
  };


  return (
    <AuthContext.Provider value={{ user, employeeData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};