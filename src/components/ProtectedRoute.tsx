import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { isValidUserId } from '../types/user';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// 路由守卫：检查user参数有效性
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [searchParams] = useSearchParams();
  const user = searchParams.get('user');
  
  // 如果没有user参数或参数无效，重定向到角色选择页面
  if (!user || !isValidUserId(user)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}