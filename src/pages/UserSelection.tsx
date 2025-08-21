import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useUserFromURL } from '../hooks/useUserFromURL';
import { MOCK_USERS, MockUser } from '../types/user';

export function UserSelection() {
  const navigate = useNavigate();
  const { setCurrentUser } = useUser();
  const { hasValidUserParam, updateUserParam } = useUserFromURL();

  // 如果URL中已有有效用户参数，直接跳转到大厅
  useEffect(() => {
    if (hasValidUserParam()) {
      navigate('/lobby', { replace: true });
    }
  }, [hasValidUserParam, navigate]);

  const handleUserSelect = (user: MockUser) => {
    setCurrentUser(user);
    updateUserParam(user.id);
    navigate(`/lobby?user=${user.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">德州扑克工具</h1>
          <p className="text-xl text-green-100">选择你的角色开始游戏</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.values(MOCK_USERS).map((user) => (
            <div
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:bg-white/20 border border-white/20"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">{user.avatar}</div>
                <h3 className="text-2xl font-bold text-white mb-2">{user.name}</h3>
                <p className="text-green-100 mb-4">{user.personality}</p>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-yellow-400 font-semibold">💰</span>
                  <span className="text-yellow-400 font-bold">{user.initialChips.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-8">
          <p className="text-green-200 text-sm">
            选择角色后，你的身份将在所有页面中保持一致
          </p>
        </div>
      </div>
    </div>
  );
}