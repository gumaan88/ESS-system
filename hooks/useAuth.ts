
import { useContext } from 'react';
import { AuthProvider, useAuth as useAuthContext } from '../context/AuthContext';

// This is just a re-export for convenience
export const useAuth = useAuthContext;
