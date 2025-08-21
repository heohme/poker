/**
 * local server entry file, for local development
 */
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 4000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5175", "http://127.0.0.1:5175", "http://localhost:5176", "http://127.0.0.1:5176"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 房间数据存储
const rooms = new Map();
const roomPlayers = new Map();

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 创建房间
  socket.on('createRoom', (roomData) => {
    console.log('=== 收到创建房间请求 ===');
    console.log('房间数据:', JSON.stringify(roomData, null, 2));
    
    const room = {
      ...roomData,
      id: roomData.id,
      status: 'waiting',
      currentPlayers: 1,
      createdAt: new Date().toISOString()
    };
    
    console.log('创建的房间对象:', JSON.stringify(room, null, 2));
    console.log('房间状态初始化为:', room.status);
    
    rooms.set(room.id, room);
    console.log('房间已存储到rooms Map，当前房间总数:', rooms.size);
    
    // 创建房主玩家
    const hostPlayer = {
      id: socket.id,
      userId: roomData.hostId, // 添加userId字段
      name: roomData.hostName,
      avatar: roomData.hostAvatar || '/default-avatar.png',
      chips: 1000,
      isReady: false,
      isHost: true
    };
    
    console.log('创建的房主玩家:', JSON.stringify(hostPlayer, null, 2));
    console.log('房主准备状态初始化为:', hostPlayer.isReady);
    
    if (!roomPlayers.has(room.id)) {
      roomPlayers.set(room.id, new Map());
    }
    roomPlayers.get(room.id).set(socket.id, hostPlayer);
    
    socket.join(room.id);
    console.log('Socket已加入房间:', room.id);
    
    // 广播房间列表更新
    io.emit('roomsUpdated', Array.from(rooms.values()));
    console.log('已广播房间列表更新');
    
    socket.emit('roomCreated', { room, players: [hostPlayer] });
    console.log('房间创建成功:', room.id, '状态:', room.status);
    console.log('========================');
  });

  // 加入房间
  socket.on('joinRoom', (data) => {
    console.log('=== 收到joinRoom请求 ===');
    console.log('请求数据:', JSON.stringify(data, null, 2));
    console.log('Socket ID:', socket.id);
    
    const { roomId, player } = data;
    console.log('解析的roomId:', roomId);
    console.log('解析的player:', JSON.stringify(player, null, 2));
    console.log('当前所有房间ID:', Array.from(rooms.keys()));
    
    const room = rooms.get(roomId);
    console.log('找到的房间:', room ? JSON.stringify(room, null, 2) : 'null');
    
    if (!room) {
      console.log('房间不存在，发送错误');
      socket.emit('error', { message: '房间不存在' });
      return;
    }
    
    if (!roomPlayers.has(roomId)) {
      roomPlayers.set(roomId, new Map());
    }
    
    const roomPlayerMap = roomPlayers.get(roomId);
    
    // 检查玩家是否已经在房间中（通过userId检查）
    console.log('检查玩家是否已在房间中...');
    console.log('房间玩家列表:', Array.from(roomPlayerMap.values()).map((p: any) => ({ id: p.id, userId: p.userId, name: p.name })));
    
    const existingPlayer = Array.from(roomPlayerMap.values()).find((p: any) => p.userId === player.userId) as any;
    console.log('找到的现有玩家:', existingPlayer ? JSON.stringify(existingPlayer, null, 2) : 'null');
    
    if (existingPlayer) {
      console.log('玩家已在房间中，更新Socket ID:', player.name, '房间:', roomId);
      console.log('旧Socket ID:', existingPlayer.id, '新Socket ID:', socket.id);
      
      // 更新现有玩家的socket ID
      roomPlayerMap.delete(existingPlayer.id);
      existingPlayer.id = socket.id;
      roomPlayerMap.set(socket.id, existingPlayer);
      socket.join(roomId);
      
      const players = Array.from(roomPlayerMap.values());
      console.log('发送playerJoined事件给现有玩家');
      socket.emit('playerJoined', { player: existingPlayer, players });
      console.log('========================');
      return;
    }
    
    if (roomPlayerMap.size >= room.maxPlayers) {
      socket.emit('error', { message: '房间已满' });
      return;
    }
    
    console.log('创建新玩家对象...');
    const newPlayer = {
      ...player,
      id: socket.id,
      isReady: false,
      isHost: false
    };
    console.log('新玩家对象:', JSON.stringify(newPlayer, null, 2));
    
    roomPlayerMap.set(socket.id, newPlayer);
    socket.join(roomId);
    console.log('玩家已加入Socket.IO房间:', roomId);
    
    // 更新房间玩家数量
    room.currentPlayers = roomPlayerMap.size;
    rooms.set(roomId, room);
    console.log('更新房间玩家数量:', room.currentPlayers);
    
    // 通知房间内所有玩家
    const players = Array.from(roomPlayerMap.values());
    console.log('通知房间内所有玩家，玩家列表:', players.map((p: any) => ({ id: p.id, userId: p.userId, name: p.name })));
    io.to(roomId).emit('playerJoined', { player: newPlayer, players });
    
    // 广播房间列表更新
    io.emit('roomsUpdated', Array.from(rooms.values()));
    
    console.log('玩家成功加入房间:', player.name, '房间:', roomId);
    console.log('========================');
  });

  // 离开房间
  socket.on('leaveRoom', (roomId) => {
    if (roomPlayers.has(roomId)) {
      const roomPlayerMap = roomPlayers.get(roomId);
      const player = roomPlayerMap.get(socket.id);
      
      if (player) {
        roomPlayerMap.delete(socket.id);
        socket.leave(roomId);
        
        // 如果是房主离开且还有其他玩家，转移房主
        if (player.isHost && roomPlayerMap.size > 0) {
          const newHost = roomPlayerMap.values().next().value;
          newHost.isHost = true;
          roomPlayerMap.set(newHost.id, newHost);
        }
        
        // 如果房间没有玩家了，删除房间
        if (roomPlayerMap.size === 0) {
          rooms.delete(roomId);
          roomPlayers.delete(roomId);
          io.emit('roomsUpdated', Array.from(rooms.values()));
        } else {
          const players = Array.from(roomPlayerMap.values());
          io.to(roomId).emit('playerLeft', { playerId: socket.id, players });
        }
        
        console.log('玩家离开房间:', player.name, '房间:', roomId);
      }
    }
  });

  // 切换准备状态
  socket.on('toggleReady', (roomId) => {
    if (roomPlayers.has(roomId)) {
      const roomPlayerMap = roomPlayers.get(roomId);
      const player = roomPlayerMap.get(socket.id);
      
      if (player) {
        player.isReady = !player.isReady;
        roomPlayerMap.set(socket.id, player);
        
        const players = Array.from(roomPlayerMap.values());
        io.to(roomId).emit('playerReadyChanged', { playerId: socket.id, isReady: player.isReady, players });
        
        console.log('玩家准备状态变更:', player.name, player.isReady);
      }
    }
  });

  // 获取房间列表
  socket.on('getRooms', () => {
    socket.emit('roomsUpdated', Array.from(rooms.values()));
  });

  // 获取房间详情
  socket.on('getRoomDetails', (roomId) => {
    console.log('=== 收到getRoomDetails请求 ===');
    console.log('请求的房间ID:', roomId);
    console.log('当前所有房间:', Array.from(rooms.keys()));
    
    const room = rooms.get(roomId);
    const players = roomPlayers.has(roomId) ? Array.from(roomPlayers.get(roomId).values()) : [];
    
    console.log('找到的房间:', room);
    console.log('房间玩家:', players);
    console.log('玩家数量:', players.length);
    
    if (room) {
      console.log('发送roomDetails事件');
      socket.emit('roomDetails', { room, players });
    } else {
      console.log('房间不存在，发送错误');
      socket.emit('error', { message: '房间不存在' });
    }
    console.log('========================');
  });

  // 开始游戏
  socket.on('startGame', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const isAutoStart = typeof data === 'object' && data.isAutoStart;
    
    console.log('=== 收到开始游戏请求 ===');
    console.log('房间ID:', roomId);
    console.log('是否自动开始:', isAutoStart);
    
    if (!roomPlayers.has(roomId)) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    const roomPlayerMap = roomPlayers.get(roomId);
    const player = roomPlayerMap.get(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '您不在此房间中' });
      return;
    }

    if (!player.isHost && !isAutoStart) {
      socket.emit('error', { message: '只有房主可以开始游戏' });
      return;
    }

    const players = Array.from(roomPlayerMap.values());
    
    if (players.length < 2) {
      socket.emit('error', { message: '至少需要2名玩家才能开始游戏' });
      return;
    }

    // 如果是自动开始（游戏继续），自动设置所有玩家为准备状态
    if (isAutoStart) {
      console.log('自动开始游戏，设置所有玩家为准备状态');
      for (const [socketId, p] of roomPlayerMap.entries()) {
        p.isReady = true;
        roomPlayerMap.set(socketId, p);
      }
    } else {
      // 手动开始游戏，检查所有玩家是否准备就绪
      const allReady = players.every((p: any) => p.isReady);
      if (!allReady) {
        socket.emit('error', { message: '所有玩家必须准备就绪才能开始游戏' });
        return;
      }
    }

    // 更新房间状态为游戏中
    const room = rooms.get(roomId);
    if (room) {
      room.status = 'playing';
      rooms.set(roomId, room);
    }

    // 广播游戏开始事件给房间内所有玩家
    const updatedPlayers = Array.from(roomPlayerMap.values());
    io.to(roomId).emit('gameStarted', { 
      roomId, 
      players: updatedPlayers,
      room 
    });
    
    // 广播房间列表更新
    io.emit('roomsUpdated', Array.from(rooms.values()));
    
    console.log('游戏开始:', roomId, '玩家数量:', updatedPlayers.length, '自动开始:', isAutoStart);
    console.log('========================');
  });

  // 处理游戏动作
  socket.on('gameAction', (data) => {
    const { roomId, playerId, action, gameState } = data;
    
    console.log('=== 收到游戏动作 ===');
    console.log('房间ID:', roomId);
    console.log('玩家ID:', playerId);
    console.log('动作:', action);
    console.log('游戏状态:', gameState);
    
    if (!roomPlayers.has(roomId)) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    const roomPlayerMap = roomPlayers.get(roomId);
    const player = roomPlayerMap.get(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '您不在此房间中' });
      return;
    }

    // 验证是否是该玩家的回合
    if (player.userId !== playerId) {
      socket.emit('error', { message: '玩家ID不匹配' });
      return;
    }

    // 广播游戏状态更新给房间内所有玩家
    io.to(roomId).emit('gameStateUpdated', {
      roomId,
      playerId,
      action,
      gameState
    });
    
    console.log('游戏状态已广播给房间:', roomId);
    console.log('==================');
  });

  // 处理游戏结束
  socket.on('gameEnd', (data) => {
    const { roomId, canContinue } = data;
    
    console.log('=== 收到游戏结束事件 ===');
    console.log('房间ID:', roomId);
    console.log('是否可以继续:', canContinue);
    
    if (!roomPlayers.has(roomId)) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    const roomPlayerMap = roomPlayers.get(roomId);
    const room = rooms.get(roomId);
    
    if (room) {
      if (canContinue) {
        // 游戏可以继续，保持房间状态为playing，不重置玩家准备状态
        console.log('游戏本局结束但可以继续，保持房间状态和玩家准备状态');
        
        // 广播游戏本局结束事件
        const players = Array.from(roomPlayerMap.values());
        io.to(roomId).emit('gameRoundEnded', { 
          roomId, 
          room,
          players,
          canContinue: true
        });
      } else {
        // 游戏彻底结束，重置房间状态为等待中
        room.status = 'waiting';
        rooms.set(roomId, room);
        console.log('游戏彻底结束，房间状态已重置为waiting:', roomId);
        
        // 重置所有玩家的准备状态
        for (const [socketId, player] of roomPlayerMap.entries()) {
          player.isReady = false;
          roomPlayerMap.set(socketId, player);
        }
        console.log('所有玩家准备状态已重置为false');
        
        // 广播房间状态更新
        const players = Array.from(roomPlayerMap.values());
        io.to(roomId).emit('gameEnded', { 
          roomId, 
          room,
          players,
          canContinue: false
        });
        
        // 广播房间列表更新
        io.emit('roomsUpdated', Array.from(rooms.values()));
      }
      
      console.log('游戏结束事件已处理完成:', roomId);
    }
    
    console.log('========================');
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    
    // 从所有房间中移除该玩家
    for (const [roomId, roomPlayerMap] of roomPlayers.entries()) {
      const player = roomPlayerMap.get(socket.id);
      if (player) {
        roomPlayerMap.delete(socket.id);
        
        // 更新房间玩家数量
        const room = rooms.get(roomId);
        if (room) {
          room.currentPlayers = roomPlayerMap.size;
          rooms.set(roomId, room);
        }
        
        // 如果是房主离开且还有其他玩家，转移房主
        if (player.isHost && roomPlayerMap.size > 0) {
          const newHost = roomPlayerMap.values().next().value;
          newHost.isHost = true;
          roomPlayerMap.set(newHost.id, newHost);
        }
        
        // 如果房间没有玩家了，删除房间
        if (roomPlayerMap.size === 0) {
          rooms.delete(roomId);
          roomPlayers.delete(roomId);
        }
        
        // 广播房间列表更新
        io.emit('roomsUpdated', Array.from(rooms.values()));
        
        if (roomPlayerMap.size > 0) {
          const players = Array.from(roomPlayerMap.values());
          io.to(roomId).emit('playerLeft', { playerId: socket.id, players });
        }
        
        console.log('玩家从房间中移除:', player.name, '房间:', roomId);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// 不导出任何内容，因为这是服务器启动文件