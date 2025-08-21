export interface Room {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  currentPlayers: number;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  initialChips: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string;
}

export interface CreateRoomRequest {
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  initialChips: number;
  password?: string;
  hostId: string;
  hostName: string;
}

export interface JoinRoomRequest {
  roomId: string;
  playerId: string;
  password?: string;
}

export interface RoomPlayer {
  id: string; // Socket.IO连接ID
  userId?: string; // 用户业务ID
  name: string;
  avatar: string;
  chips: number;
  isHost: boolean;
  isReady: boolean;
  joinedAt?: string;
}

// 模拟房间数据
export const MOCK_ROOMS: Room[] = [
  {
    id: 'room-001',
    name: '新手房间',
    hostId: 'alice',
    hostName: 'Alice',
    currentPlayers: 2,
    maxPlayers: 6,
    smallBlind: 5,
    bigBlind: 10,
    initialChips: 1000,
    hasPassword: false,
    status: 'waiting',
    createdAt: new Date().toISOString()
  },
  {
    id: 'room-002',
    name: '高级房间',
    hostId: 'bob',
    hostName: 'Bob',
    currentPlayers: 4,
    maxPlayers: 8,
    smallBlind: 25,
    bigBlind: 50,
    initialChips: 5000,
    hasPassword: true,
    status: 'playing',
    createdAt: new Date().toISOString()
  },
  {
    id: 'room-003',
    name: '快速游戏',
    hostId: 'charlie',
    hostName: 'Charlie',
    currentPlayers: 1,
    maxPlayers: 4,
    smallBlind: 10,
    bigBlind: 20,
    initialChips: 2000,
    hasPassword: false,
    status: 'waiting',
    createdAt: new Date().toISOString()
  }
];

// 房间管理工具函数
export const isRoomFull = (room: Room): boolean => {
  return room.currentPlayers >= room.maxPlayers;
};

export const canJoinRoom = (room: Room): boolean => {
  return room.status === 'waiting' && !isRoomFull(room);
};

export const getRoomById = (roomId: string): Room | undefined => {
  return MOCK_ROOMS.find(room => room.id === roomId);
};

export const getAvailableRooms = (): Room[] => {
  return MOCK_ROOMS.filter(room => canJoinRoom(room));
};