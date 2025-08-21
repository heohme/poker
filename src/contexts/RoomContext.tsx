import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Room, RoomPlayer, CreateRoomRequest, JoinRoomRequest } from '../types/room';
import { useUser } from './UserContext';

interface RoomContextType {
  rooms: Room[];
  currentRoom: Room | null;
  roomPlayers: RoomPlayer[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  socket: Socket | null;
  
  // 房间操作
  createRoom: (roomData: CreateRoomRequest) => Promise<Room>;
  joinRoom: (joinData: JoinRoomRequest) => Promise<boolean>;
  leaveRoom: (roomId: string, playerId: string) => Promise<boolean>;
  getRooms: () => Promise<Room[]>;
  getRoomById: (roomId: string) => Promise<Room | null>;
  getRoomPlayers: (roomId: string) => Promise<RoomPlayer[]>;
  
  // 房间状态管理
  setCurrentRoom: (room: Room | null) => void;
  updateRoomStatus: (roomId: string, status: Room['status']) => void;
  togglePlayerReady: (roomId: string, playerId: string) => Promise<boolean>;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

interface RoomProviderProps {
  children: ReactNode;
}

export const RoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { currentUser } = useUser();

  // 初始化Socket连接
  useEffect(() => {
    const newSocket = io('http://127.0.0.1:4000', {
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: true
    });
    setSocket(newSocket);

    // 连接事件
    newSocket.on('connect', () => {
      console.log('Socket连接成功:', newSocket.id);
      setIsConnected(true);
      setError(null);
      // 连接成功后获取房间列表
      newSocket.emit('getRooms');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket连接断开');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
      setError('连接服务器失败');
      setIsConnected(false);
    });

    // 房间相关事件监听
    newSocket.on('roomsUpdated', (updatedRooms: Room[]) => {
      console.log('房间列表更新:', updatedRooms);
      setRooms(updatedRooms);
    });

    newSocket.on('roomCreated', (data: { room: Room; players: RoomPlayer[] }) => {
      console.log('房间创建成功:', data);
      setCurrentRoom(data.room);
      setRoomPlayers(data.players);
      setIsLoading(false);
    });

    newSocket.on('roomDetails', (data: { room: Room; players: RoomPlayer[] }) => {
      console.log('=== 收到roomDetails事件 ===');
      console.log('房间详情:', data);
      console.log('房间信息:', data.room);
      console.log('玩家列表:', data.players);
      console.log('玩家数量:', data.players?.length || 0);
      setCurrentRoom(data.room);
      setRoomPlayers(data.players);
      console.log('已更新roomPlayers状态');
      console.log('========================');
    });

    newSocket.on('playerJoined', (data: { player: RoomPlayer; players: RoomPlayer[] }) => {
      console.log('玩家加入:', data);
      setRoomPlayers(data.players);
      // 更新房间玩家数量
      if (currentRoom) {
        setCurrentRoom({ ...currentRoom, currentPlayers: data.players.length });
      }
    });

    newSocket.on('playerLeft', (data: { playerId: string; players: RoomPlayer[] }) => {
      console.log('玩家离开:', data);
      setRoomPlayers(data.players);
      // 更新房间玩家数量
      if (currentRoom) {
        setCurrentRoom({ ...currentRoom, currentPlayers: data.players.length });
      }
    });

    newSocket.on('playerReadyChanged', (data: { playerId: string; isReady: boolean; players: RoomPlayer[] }) => {
      console.log('=== 玩家准备状态变更 ===');
      console.log('事件数据:', data);
      console.log('更新前的roomPlayers:', roomPlayers);
      setRoomPlayers(data.players);
      console.log('更新后的roomPlayers:', data.players);
      console.log('========================');
    });

    newSocket.on('gameStarted', (data: { roomId: string; players: RoomPlayer[]; room: Room }) => {
      console.log('游戏开始:', data);
      setCurrentRoom(data.room);
      setRoomPlayers(data.players);
      setIsLoading(false);
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket错误:', data.message);
      setError(data.message);
      setIsLoading(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // 当前房间变化时，获取房间详情
  useEffect(() => {
    if (socket && currentRoom) {
      socket.emit('getRoomDetails', currentRoom.id);
    }
  }, [socket, currentRoom?.id]);

  const createRoom = async (roomData: CreateRoomRequest): Promise<Room> => {
    if (!socket || !isConnected) {
      throw new Error('未连接到服务器');
    }

    if (!currentUser) {
      throw new Error('用户未登录');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const roomCreateData = {
        ...roomData,
        id: `room-${Date.now()}`,
        hostId: currentUser.id,
        hostName: currentUser.name,
        hostAvatar: currentUser.avatar
      };

      socket.emit('createRoom', roomCreateData);
      
      // 等待房间创建完成
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('创建房间超时'));
        }, 10000);

        const handleRoomCreated = (data: { room: Room; players: RoomPlayer[] }) => {
          clearTimeout(timeout);
          socket.off('roomCreated', handleRoomCreated);
          socket.off('error', handleError);
          resolve(data.room);
        };

        const handleError = (data: { message: string }) => {
          clearTimeout(timeout);
          socket.off('roomCreated', handleRoomCreated);
          socket.off('error', handleError);
          reject(new Error(data.message));
        };

        socket.on('roomCreated', handleRoomCreated);
        socket.on('error', handleError);
      });
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : '创建房间失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const joinRoom = async (joinData: JoinRoomRequest): Promise<boolean> => {
    console.log('=== 客户端joinRoom开始 ===');
    console.log('joinData:', JSON.stringify(joinData, null, 2));
    console.log('currentUser:', JSON.stringify(currentUser, null, 2));
    console.log('socket连接状态:', { connected: isConnected, socketId: socket?.id });
    
    if (!socket || !isConnected) {
      console.error('Socket未连接');
      throw new Error('未连接到服务器');
    }

    if (!currentUser) {
      console.error('用户未登录');
      throw new Error('用户未登录');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const joinRequestData = {
        roomId: joinData.roomId,
        player: {
          id: socket.id, // 使用Socket.IO的连接ID
          userId: currentUser.id, // 保留用户ID用于业务逻辑
          name: currentUser.name,
          avatar: currentUser.avatar,
          chips: 1000
        }
      };
      
      console.log('发送joinRoom请求:', JSON.stringify(joinRequestData, null, 2));
      socket.emit('joinRoom', joinRequestData);
      
      // 等待加入房间完成
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('加入房间超时'));
        }, 10000);

        const handlePlayerJoined = (data: { player: RoomPlayer; players: RoomPlayer[] }) => {
          console.log('=== 收到playerJoined事件 ===');
          console.log('事件数据:', JSON.stringify(data, null, 2));
          console.log('目标房间ID:', joinData.roomId);
          
          clearTimeout(timeout);
          socket.off('playerJoined', handlePlayerJoined);
          socket.off('error', handleError);
          setIsLoading(false);
          
          // 设置当前房间
          const room = rooms.find(r => r.id === joinData.roomId);
          console.log('在rooms中找到的房间:', room ? JSON.stringify(room, null, 2) : 'null');
          
          if (room) {
            const updatedRoom = { ...room, currentPlayers: data.players.length };
            console.log('设置当前房间:', JSON.stringify(updatedRoom, null, 2));
            setCurrentRoom(updatedRoom);
          }
          
          console.log('joinRoom成功完成');
          console.log('========================');
          resolve(true);
        };

        const handleError = (data: { message: string }) => {
          clearTimeout(timeout);
          socket.off('playerJoined', handlePlayerJoined);
          socket.off('error', handleError);
          setIsLoading(false);
          reject(new Error(data.message));
        };

        socket.on('playerJoined', handlePlayerJoined);
        socket.on('error', handleError);
      });
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : '加入房间失败';
      setError(errorMessage);
      return false;
    }
  };

  const leaveRoom = async (roomId: string, playerId: string): Promise<boolean> => {
    if (!socket || !isConnected) {
      throw new Error('未连接到服务器');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socket.emit('leaveRoom', roomId);
      
      // 清除当前房间状态
      setCurrentRoom(null);
      setRoomPlayers([]);
      setIsLoading(false);
      
      return true;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : '离开房间失败';
      setError(errorMessage);
      return false;
    }
  };

  const getRooms = async (): Promise<Room[]> => {
    if (!socket || !isConnected) {
      return rooms; // 返回当前缓存的房间列表
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socket.emit('getRooms');
      setIsLoading(false);
      return rooms;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = '获取房间列表失败';
      setError(errorMessage);
      return [];
    }
  };

  const getRoomById = async (roomId: string): Promise<Room | null> => {
    if (!socket || !isConnected) {
      return rooms.find(r => r.id === roomId) || null;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socket.emit('getRoomDetails', roomId);
      setIsLoading(false);
      return rooms.find(r => r.id === roomId) || null;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = '获取房间信息失败';
      setError(errorMessage);
      return null;
    }
  };

  const getRoomPlayers = async (roomId: string): Promise<RoomPlayer[]> => {
    if (!socket || !isConnected) {
      return roomPlayers;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socket.emit('getRoomDetails', roomId);
      setIsLoading(false);
      return roomPlayers;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = '获取房间玩家失败';
      setError(errorMessage);
      return [];
    }
  };

  const updateRoomStatus = (roomId: string, status: Room['status']) => {
    setRooms(prev => prev.map(r => 
      r.id === roomId ? { ...r, status } : r
    ));
    
    if (currentRoom && currentRoom.id === roomId) {
      setCurrentRoom({ ...currentRoom, status });
    }
  };

  const togglePlayerReady = async (roomId: string, playerId: string): Promise<boolean> => {
    if (!socket || !isConnected) {
      throw new Error('未连接到服务器');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socket.emit('toggleReady', roomId);
      setIsLoading(false);
      return true;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = '切换准备状态失败';
      setError(errorMessage);
      return false;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: RoomContextType = {
    rooms,
    currentRoom,
    roomPlayers,
    isLoading,
    error,
    isConnected,
    socket,
    createRoom,
    joinRoom,
    leaveRoom,
    getRooms,
    getRoomById,
    getRoomPlayers,
    setCurrentRoom,
    updateRoomStatus,
    togglePlayerReady,
    clearError
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};