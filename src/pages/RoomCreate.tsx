import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useRoom } from '../contexts/RoomContext';
import { useUserFromURL } from '../hooks/useUserFromURL';
import { ArrowLeft, Users, DollarSign, Eye, EyeOff, Settings, Lock } from 'lucide-react';

interface RoomSettings {
  name: string;
  smallBlind: number;
  bigBlind: number;
  initialChips: number;
  maxPlayers: number;
  password: string;
}

interface RoomSettingsErrors {
  name?: string;
  smallBlind?: string;
  bigBlind?: string;
  initialChips?: string;
  maxPlayers?: string;
  password?: string;
}

export function RoomCreate() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { createRoom, isLoading, error, clearError } = useRoom();
  const { getCurrentUserParam } = useUserFromURL();
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [settings, setSettings] = useState<RoomSettings>({
    name: `${currentUser?.name || ''}的房间`,
    smallBlind: 10,
    bigBlind: 20,
    initialChips: 1000,
    maxPlayers: 6,
    password: ''
  });

  const [errors, setErrors] = useState<RoomSettingsErrors>({});

  const handleBack = () => {
    navigate('/lobby');
  };

  const validateForm = (): boolean => {
    const newErrors: RoomSettingsErrors = {};
    
    if (!settings.name.trim()) {
      newErrors.name = '房间名称不能为空';
    }
    
    if (settings.maxPlayers < 2 || settings.maxPlayers > 10) {
      newErrors.maxPlayers = '玩家数量必须在2-10之间';
    }
    
    if (settings.smallBlind <= 0) {
      newErrors.smallBlind = '小盲注必须大于0';
    }
    
    if (settings.bigBlind <= settings.smallBlind) {
      newErrors.bigBlind = '大盲注必须大于小盲注';
    }
    
    if (settings.initialChips <= settings.bigBlind * 10) {
      newErrors.initialChips = '初始筹码至少应为大盲注的10倍';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateRoom = async () => {
    if (!currentUser) return;
    
    if (!validateForm()) {
      return;
    }
    
    setIsCreating(true);
    clearError();
    
    try {
      const room = await createRoom({
        name: settings.name.trim(),
        maxPlayers: settings.maxPlayers,
        smallBlind: settings.smallBlind,
        bigBlind: settings.bigBlind,
        initialChips: settings.initialChips,
        password: settings.password.trim() || undefined,
        hostId: currentUser.id,
        hostName: currentUser.name
      });
      
      // 创建成功，跳转到房间
      navigate(`/room/${room.id}?user=${currentUser.id}`);
    } catch (err) {
      console.error('创建房间失败:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const updateSetting = (key: keyof RoomSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // 清除对应字段的错误
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900">
      {/* 顶部导航栏 */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="text-white hover:text-green-300 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Settings size={24} />
              <span>创建房间</span>
            </h1>
          </div>
          {currentUser && (
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-4 py-2">
              <span className="text-2xl">{currentUser.avatar}</span>
              <div>
                <div className="text-white font-semibold">{currentUser.name}</div>
                <div className="text-yellow-400 text-sm">💰 {currentUser.currentChips.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          <div className="bg-white/5 px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">房间设置</h2>
            <p className="text-green-100 text-sm mt-1">配置你的德州扑克房间参数</p>
          </div>
          
          <div className="p-6 space-y-6">
            {/* 房间名称 */}
            <div>
              <label className="block text-white font-semibold mb-2">房间名称</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => updateSetting('name', e.target.value)}
                className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 ${
                  errors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/20 focus:ring-yellow-500'
                }`}
                placeholder="输入房间名称"
              />
              {errors.name && <p className="mt-1 text-sm text-red-300">{errors.name}</p>}
            </div>

            {/* 盲注设置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center space-x-2">
                  <DollarSign size={16} />
                  <span>小盲注</span>
                </label>
                <input
                  type="number"
                  value={settings.smallBlind}
                  onChange={(e) => updateSetting('smallBlind', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 ${
                    errors.smallBlind 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/20 focus:ring-yellow-500'
                  }`}
                  min="1"
                />
                {errors.smallBlind && <p className="mt-1 text-sm text-red-300">{errors.smallBlind}</p>}
              </div>
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center space-x-2">
                  <DollarSign size={16} />
                  <span>大盲注</span>
                </label>
                <input
                  type="number"
                  value={settings.bigBlind}
                  onChange={(e) => updateSetting('bigBlind', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 ${
                    errors.bigBlind 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/20 focus:ring-yellow-500'
                  }`}
                  min={settings.smallBlind + 1}
                />
                {errors.bigBlind && <p className="mt-1 text-sm text-red-300">{errors.bigBlind}</p>}
              </div>
            </div>

            {/* 筹码和玩家数设置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2">初始筹码</label>
                <input
                  type="number"
                  value={settings.initialChips}
                  onChange={(e) => updateSetting('initialChips', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 ${
                    errors.initialChips 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/20 focus:ring-yellow-500'
                  }`}
                  min={settings.bigBlind * 10}
                  step="100"
                />
                {errors.initialChips && <p className="mt-1 text-sm text-red-300">{errors.initialChips}</p>}
              </div>
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center space-x-2">
                  <Users size={16} />
                  <span>最大玩家数</span>
                </label>
                <select
                  value={settings.maxPlayers}
                  onChange={(e) => updateSetting('maxPlayers', parseInt(e.target.value))}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                    errors.maxPlayers 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/20 focus:ring-yellow-500'
                  }`}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num} className="bg-green-800">{num}人</option>
                  ))}
                </select>
                {errors.maxPlayers && <p className="mt-1 text-sm text-red-300">{errors.maxPlayers}</p>}
              </div>
            </div>

            {/* 房间密码 */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center space-x-2">
                <Lock size={16} />
                <span>房间密码（可选）</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.password}
                  onChange={(e) => updateSetting('password', e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="留空表示公开房间"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 设置预览 */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3">设置预览</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-green-100">
                  <span className="block">盲注比例: {settings.smallBlind}:{settings.bigBlind}</span>
                  <span className="block">筹码倍数: {Math.floor(settings.initialChips / settings.bigBlind)}BB</span>
                </div>
                <div className="text-green-100">
                  <span className="block">房间类型: {settings.password ? '私密房间' : '公开房间'}</span>
                  <span className="block">容量: {settings.maxPlayers}人</span>
                </div>
              </div>
            </div>

            {/* 显示验证错误 */}
            {Object.keys(errors).length > 0 && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-200 font-semibold mb-2">请修正以下错误：</h4>
                <ul className="text-red-200 text-sm space-y-1">
                  {Object.entries(errors).map(([key, message]) => (
                    <li key={key}>• {message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 显示API错误 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-red-200">{error}</span>
                  <button onClick={clearError} className="text-red-200 hover:text-white">
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex space-x-4 pt-4">
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || isLoading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {isCreating ? '创建中...' : '创建房间'}
              </button>
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}