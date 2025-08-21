import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useRoom } from '../contexts/RoomContext';
import { useUserFromURL } from '../hooks/useUserFromURL';
import { Plus, Users, Lock, Crown, DollarSign, RefreshCw } from 'lucide-react';
import { Room } from '../types/room';

export function Lobby() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { rooms, isLoading, error, getRooms, joinRoom, clearError } = useRoom();
  const { updateUserParam } = useUserFromURL();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // 加载房间列表
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      await getRooms();
    } catch (err) {
      console.error('加载房间列表失败:', err);
    }
  };

  const handleCreateRoom = () => {
    navigate(`/room/create?user=${currentUser?.id}`);
  };

  const handleJoinRoom = (room: Room) => {
    console.log('=== Lobby handleJoinRoom ===');
    console.log('选择的房间:', JSON.stringify(room, null, 2));
    console.log('房间ID:', room.id);
    console.log('房间是否有密码:', room.hasPassword);
    
    if (room.hasPassword) {
      console.log('房间有密码，显示密码输入框');
      setSelectedRoom(room);
      setShowPasswordModal(true);
      setPassword('');
      setPasswordError('');
    } else {
      console.log('房间无密码，直接加入');
      joinRoomDirectly(room);
    }
    console.log('========================');
  };

  const joinRoomDirectly = async (room: Room) => {
    console.log('=== joinRoomDirectly开始 ===');
    console.log('房间信息:', JSON.stringify(room, null, 2));
    console.log('当前用户:', JSON.stringify(currentUser, null, 2));
    
    if (!currentUser) {
      console.error('当前用户不存在');
      return;
    }
    
    setIsJoining(true);
    try {
      const joinData = {
        roomId: room.id,
        playerId: currentUser.id
      };
      console.log('调用joinRoom，参数:', JSON.stringify(joinData, null, 2));
      
      const success = await joinRoom(joinData);
      console.log('joinRoom结果:', success);
      
      if (success) {
        const targetUrl = `/room/${room.id}?user=${currentUser.id}`;
        console.log('导航到:', targetUrl);
        navigate(targetUrl);
      } else {
        console.error('joinRoom返回false');
      }
    } catch (err) {
      console.error('加入房间失败:', err);
    } finally {
      setIsJoining(false);
      console.log('========================');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setPasswordError('请输入密码');
      return;
    }
    
    if (!selectedRoom || !currentUser) return;
    
    setIsJoining(true);
    try {
      const success = await joinRoom({
        roomId: selectedRoom.id,
        playerId: currentUser.id,
        password: password
      });
      
      if (success) {
        setShowPasswordModal(false);
        navigate(`/room/${selectedRoom.id}?user=${currentUser.id}`);
      } else {
        setPasswordError('密码错误或加入失败');
      }
    } catch (err) {
      setPasswordError('加入房间失败');
    } finally {
      setIsJoining(false);
    }
  };

  const canJoinRoom = (room: Room) => {
    return room.status === 'waiting' && room.currentPlayers < room.maxPlayers;
  };

  const getStatusText = (room: Room) => {
    switch (room.status) {
      case 'waiting': return '等待中';
      case 'playing': return '游戏中';
      case 'finished': return '已结束';
      default: return '未知';
    }
  };

  const getStatusColor = (room: Room) => {
    switch (room.status) {
      case 'waiting': return 'text-green-600 bg-green-100';
      case 'playing': return 'text-yellow-600 bg-yellow-100';
      case 'finished': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-800">德州扑克大厅</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="text-2xl">{currentUser.avatar}</span>
                <span className="font-medium">{currentUser.name}</span>
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-4 h-4" />
                  <span>{currentUser.currentChips}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadRooms}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
              
              <button
                onClick={handleCreateRoom}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>创建房间</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-500 hover:text-red-700">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 房间列表 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">可用房间</h2>
            <span className="text-sm text-gray-600">{rooms.length} 个房间</span>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">暂无可用房间</p>
              <button
                onClick={handleCreateRoom}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建第一个房间
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div key={room.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{room.name}</h3>
                    <div className="flex items-center space-x-2">
                      {room.hasPassword && <Lock className="w-4 h-4 text-gray-500" />}
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(room)}`}>
                        {getStatusText(room)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">房主:</span>
                      <div className="flex items-center space-x-1">
                        <Crown className="w-3 h-3 text-yellow-500" />
                        <span className="font-medium">{room.hostName}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">玩家:</span>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{room.currentPlayers}/{room.maxPlayers}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">盲注:</span>
                      <span className="font-medium">${room.smallBlind}/${room.bigBlind}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">初始筹码:</span>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3" />
                        <span className="font-medium">{room.initialChips}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleJoinRoom(room)}
                    disabled={!canJoinRoom(room) || isJoining}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      canJoinRoom(room) && !isJoining
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isJoining ? '加入中...' : canJoinRoom(room) ? '加入房间' : '无法加入'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 密码输入模态框 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">输入房间密码</h3>
            {passwordError && (
              <div className="text-red-600 text-sm mb-3">{passwordError}</div>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex space-x-3">
              <button
                onClick={handlePasswordSubmit}
                disabled={isJoining}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                {isJoining ? '加入中...' : '加入房间'}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setPasswordError('');
                  setSelectedRoom(null);
                }}
                disabled={isJoining}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}