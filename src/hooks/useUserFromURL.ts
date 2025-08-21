import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { getUserById, isValidUserId } from '../types/user';

// 自定义Hook：同步URL参数和用户状态
export function useUserFromURL() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, setCurrentUser } = useUser();
  
  useEffect(() => {
    const userParam = searchParams.get('user');
    
    if (userParam && isValidUserId(userParam)) {
      const user = getUserById(userParam);
      if (user && currentUser?.id !== userParam) {
        setCurrentUser(user);
      }
    }
  }, [searchParams, currentUser, setCurrentUser]);
  
  // 更新URL中的用户参数
  const updateUserParam = (userId: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('user', userId);
      return newParams;
    });
  };
  
  // 移除用户参数
  const removeUserParam = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('user');
      return newParams;
    });
  };
  
  // 获取当前URL中的用户参数
  const getCurrentUserParam = () => {
    return searchParams.get('user');
  };
  
  // 检查当前URL是否有有效的用户参数
  const hasValidUserParam = () => {
    const userParam = searchParams.get('user');
    return userParam ? isValidUserId(userParam) : false;
  };
  
  return {
    updateUserParam,
    removeUserParam,
    getCurrentUserParam,
    hasValidUserParam
  };
}