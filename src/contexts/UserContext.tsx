import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MockUser } from '../types/user';

// 用户Context类型定义
interface UserContextType {
  currentUser: MockUser | null;
  setCurrentUser: (user: MockUser) => void;
  updateUserChips: (chips: number) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
}

// 创建Context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provider组件
export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<MockUser | null>(null);

  const setCurrentUser = (user: MockUser) => {
    setCurrentUserState(user);
  };

  const updateUserChips = (chips: number) => {
    if (currentUser) {
      setCurrentUserState({
        ...currentUser,
        currentChips: chips
      });
    }
  };

  const joinRoom = (roomId: string) => {
    if (currentUser) {
      setCurrentUserState({
        ...currentUser,
        currentRoom: roomId
      });
    }
  };

  const leaveRoom = () => {
    if (currentUser) {
      setCurrentUserState({
        ...currentUser,
        currentRoom: undefined
      });
    }
  };

  const value: UserContextType = {
    currentUser,
    setCurrentUser,
    updateUserChips,
    joinRoom,
    leaveRoom
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// Hook for using UserContext
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}