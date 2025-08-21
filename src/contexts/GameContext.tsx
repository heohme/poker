import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useUser } from './UserContext';
import { useRoom } from './RoomContext';
import { Room, RoomPlayer } from '../types/room';
import { settleGame, GameResult, evaluateHand, getHandDescription } from '../utils/pokerHands';

// 扑克牌相关类型
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  id: string;
}

// 玩家状态
export interface GamePlayer {
  id: string;
  userId: string; // 用户业务ID，用于区分用户身份
  name: string;
  avatar: string;
  chips: number;
  cards: Card[];
  currentBet: number;
  totalBet: number;
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  position: number;
  lastAction?: GameAction;
}

// 游戏动作类型
export type GameAction = 
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'all_in'; amount: number };

// 游戏阶段
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished';

// 游戏状态
export interface GameState {
  id: string;
  phase: GamePhase;
  players: GamePlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  activePlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  smallBlind: number;
  bigBlind: number;
  round: number;
  isGameActive: boolean;
  // 行动轮次跟踪
  roundStartPlayerIndex: number; // 当前回合开始的玩家索引
  playersActedThisRound: boolean[]; // 每个玩家在当前回合是否已行动
  lastRaisePlayerIndex: number; // 最后一次加注的玩家索引
  winner?: {
    playerId: string;
    hand: string;
    winAmount: number;
  };
  gameResult?: GameResult;
}

// 游戏上下文类型
interface GameContextType {
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  
  // 游戏控制
  startGame: () => Promise<void>;
  endGame: () => Promise<void>;
  resetGame: () => Promise<void>;
  
  // 玩家动作
  performAction: (action: GameAction) => Promise<void>;
  
  // 游戏结算
  settleCurrentGame: () => Promise<void>;
  
  // 游戏状态查询
  getCurrentPlayer: () => GamePlayer | null;
  getPlayerByUserId: (userId: string) => GamePlayer | null;
  canPerformAction: (action: GameAction) => boolean;
  
  // 错误处理
  clearError: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// 扑克牌工具函数
const createDeck = (): Card[] => {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];
  
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`
      });
    });
  });
  
  return shuffleDeck(deck);
};

const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 游戏逻辑工具函数
const getNextActivePlayerIndex = (players: GamePlayer[], currentIndex: number): number => {
  let nextIndex = (currentIndex + 1) % players.length;
  let attempts = 0;
  
  while (attempts < players.length) {
    const player = players[nextIndex];
    if (player.isActive && !player.isFolded && !player.isAllIn) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    attempts++;
  }
  
  // 如果没有找到可以行动的玩家，返回-1表示需要进入下一阶段
  return -1;
};

const calculateMinRaise = (currentBet: number, bigBlind: number): number => {
  return Math.max(currentBet * 2, bigBlind);
};

const isRoundComplete = (
  players: GamePlayer[], 
  currentBet: number, 
  phase: GamePhase,
  playersActedThisRound: boolean[],
  roundStartPlayerIndex: number,
  lastRaisePlayerIndex: number,
  bigBlindIndex: number
): boolean => {
  const activePlayers = players.filter(p => p.isActive && !p.isFolded);
  
  console.log('=== 回合完成检查 ===');
  console.log('阶段:', phase);
  console.log('活跃玩家数量:', activePlayers.length);
  console.log('当前最高下注:', currentBet);
  console.log('玩家行动状态:', playersActedThisRound);
  console.log('回合开始玩家索引:', roundStartPlayerIndex);
  console.log('最后加注玩家索引:', lastRaisePlayerIndex);
  console.log('大盲位索引:', bigBlindIndex);
  
  // 如果只有1个或更少活跃玩家，回合结束
  if (activePlayers.length <= 1) {
    console.log('回合完成：活跃玩家不足');
    return true;
  }
  
  // 检查所有活跃玩家的下注是否相等（或全押）
  const allBetsEqual = activePlayers.every(player => 
    player.isAllIn || player.currentBet === currentBet
  );
  
  if (!allBetsEqual) {
    console.log('回合未完成：下注不相等');
    return false;
  }
  
  // 在preflop阶段，特殊处理大盲位
  if (phase === 'preflop') {
    const bigBlindPlayer = players[bigBlindIndex];
    
    // 如果大盲位还活跃且未弃牌且未全押
    if (bigBlindPlayer.isActive && !bigBlindPlayer.isFolded && !bigBlindPlayer.isAllIn) {
      // 如果大盲位还没有行动过，回合未完成
      if (!playersActedThisRound[bigBlindIndex]) {
        console.log('回合未完成：preflop阶段大盲位未行动');
        return false;
      }
      
      // 如果有人加注且大盲位不是最后加注者，大盲位需要再次行动
      if (lastRaisePlayerIndex !== -1 && lastRaisePlayerIndex !== bigBlindIndex && currentBet > players[bigBlindIndex].currentBet) {
        console.log('回合未完成：preflop阶段大盲位需要对加注做出反应');
        return false;
      }
    }
  }
  
  // 检查所有活跃玩家是否都已行动
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.isActive && !player.isFolded && !player.isAllIn) {
      // 如果玩家还没有行动过，回合未完成
      if (!playersActedThisRound[i]) {
        console.log(`回合未完成：玩家${i}(${player.name})未行动`);
        return false;
      }
      
      // 如果有人加注，检查其他玩家是否需要对加注做出反应
      if (lastRaisePlayerIndex !== -1 && lastRaisePlayerIndex !== i) {
        // 如果玩家的下注少于当前最高下注，说明需要跟注或加注
        if (player.currentBet < currentBet) {
          console.log(`回合未完成：玩家${i}(${player.name})需要对加注做出反应，当前下注${player.currentBet}，需要跟注到${currentBet}`);
          return false;
        }
      }
    }
  }
  
  // 特殊情况：如果没有人加注，确保至少有一轮完整的行动
  if (lastRaisePlayerIndex === -1) {
    // 检查是否所有活跃玩家都至少行动过一次
    const activePlayerIndices = [];
    for (let i = 0; i < players.length; i++) {
      if (players[i].isActive && !players[i].isFolded && !players[i].isAllIn) {
        activePlayerIndices.push(i);
      }
    }
    
    // 确保所有活跃玩家都已行动
    for (const playerIndex of activePlayerIndices) {
      if (!playersActedThisRound[playerIndex]) {
        console.log(`回合未完成：玩家${playerIndex}(${players[playerIndex].name})在无加注情况下未行动`);
        return false;
      }
    }
  }
  
  // 最终检查：确保所有活跃玩家的下注都相等且都已行动
  const finalCheck = activePlayers.every(player => {
    const playerIndex = players.findIndex(p => p.id === player.id);
    return player.isAllIn || 
           (player.currentBet === currentBet && playersActedThisRound[playerIndex]);
  });
  
  if (!finalCheck) {
    console.log('回合未完成：最终检查失败');
    return false;
  }
  
  console.log('回合完成：所有条件满足');
  return true;
};

interface GameProviderProps {
  children: React.ReactNode;
  currentRoom?: Room | null;
  roomPlayers?: RoomPlayer[];
}

export const GameProvider: React.FC<GameProviderProps> = ({ children, currentRoom, roomPlayers }) => {
  const { currentUser } = useUser();
  const { socket, isConnected } = useRoom();
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 初始化游戏状态
  const initializeGame = useCallback((preserveChips: boolean = false, previousPlayers?: GamePlayer[]) => {
    console.log('=== 初始化游戏调试信息 ===');
    console.log('当前房间:', currentRoom);
    console.log('房间玩家:', roomPlayers);
    console.log('保持筹码:', preserveChips);
    console.log('上一局玩家:', previousPlayers);
    
    if (!currentRoom || !roomPlayers || roomPlayers.length < 2) {
      console.error('初始化游戏失败：');
      console.error('- 当前房间存在:', !!currentRoom);
      console.error('- 房间玩家存在:', !!roomPlayers);
      console.error('- 玩家数量:', roomPlayers?.length || 0);
      return null;
    }
    
    const gamePlayers: GamePlayer[] = roomPlayers.map((player, index) => {
      // 如果需要保持筹码且存在上一局玩家数据，则使用上一局的筹码
      let playerChips = currentRoom.initialChips;
      if (preserveChips && previousPlayers) {
        const previousPlayer = previousPlayers.find(p => p.userId === player.userId);
        if (previousPlayer) {
          playerChips = previousPlayer.chips;
          console.log(`玩家 ${player.name} 保持上一局筹码: ${playerChips}`);
        }
      }
      
      return {
        id: player.id,
        userId: player.userId, // 使用房间玩家的userId
        name: player.name,
        avatar: player.avatar,
        chips: playerChips,
        cards: [],
        currentBet: 0,
        totalBet: 0,
        isActive: playerChips > 0, // 只有有筹码的玩家才是活跃的
        isFolded: false,
        isAllIn: false,
        position: index
      };
    });
    
    console.log('创建的游戏玩家:', gamePlayers);
    
    const dealerIndex = 0;
    const smallBlindIndex = (dealerIndex + 1) % gamePlayers.length;
    const bigBlindIndex = (dealerIndex + 2) % gamePlayers.length;
    
    const initialState = {
      id: currentRoom.id,
      phase: 'waiting' as GamePhase,
      players: gamePlayers,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      activePlayerIndex: 0,
      dealerIndex,
      smallBlindIndex,
      bigBlindIndex,
      smallBlind: currentRoom.smallBlind,
      bigBlind: currentRoom.bigBlind,
      round: 1,
      isGameActive: false,
      // 初始化行动轮次跟踪
      roundStartPlayerIndex: 0,
      playersActedThisRound: new Array(gamePlayers.length).fill(false),
      lastRaisePlayerIndex: -1
    };
    
    console.log('初始化游戏状态完成:', initialState);
    console.log('=== 初始化游戏调试信息结束 ===');
    
    return initialState;
  }, [currentRoom, roomPlayers]);
  
  // 开始游戏
  const startGame = useCallback(async () => {
    if (!socket || !isConnected) {
      setError('未连接到服务器');
      return;
    }

    if (!currentRoom) {
      setError('房间信息不存在');
      return;
    }

    if (!currentUser) {
      setError('用户未登录');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('发送游戏开始请求:', currentRoom.id);
      
      // 通过Socket.IO发送开始游戏事件
      socket.emit('startGame', {
        roomId: currentRoom.id,
        isAutoStart: false
      });
      
    } catch (err) {
      console.error('开始游戏失败:', err);
      setError(err instanceof Error ? err.message : '开始游戏失败');
      setIsLoading(false);
    }
  }, [socket, isConnected, currentRoom, currentUser]);
  
  // 执行玩家动作
  const performAction = useCallback(async (action: GameAction) => {
    if (!gameState || !currentUser) {
      setError('游戏状态无效');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const currentPlayer = gameState.players[gameState.activePlayerIndex];
      if (currentPlayer.userId !== currentUser.id) {
        throw new Error('不是您的回合');
      }
      
      const updatedPlayers = [...gameState.players];
      const playerIndex = gameState.activePlayerIndex;
      
      switch (action.type) {
        case 'fold':
          updatedPlayers[playerIndex] = {
            ...currentPlayer,
            isFolded: true,
            lastAction: action
          };
          break;
          
        case 'check':
          if (gameState.currentBet > currentPlayer.currentBet) {
            throw new Error('无法过牌：需要跟注或加注');
          }
          updatedPlayers[playerIndex] = {
            ...currentPlayer,
            lastAction: action
          };
          break;
          
        case 'call':
          const callAmount = Math.min(
            gameState.currentBet - currentPlayer.currentBet,
            currentPlayer.chips
          );
          updatedPlayers[playerIndex] = {
            ...currentPlayer,
            currentBet: currentPlayer.currentBet + callAmount,
            totalBet: currentPlayer.totalBet + callAmount,
            chips: currentPlayer.chips - callAmount,
            isAllIn: currentPlayer.chips === callAmount,
            lastAction: action
          };
          break;
          
        case 'raise':
          if (action.amount < calculateMinRaise(gameState.currentBet, gameState.bigBlind)) {
            throw new Error('加注金额不足');
          }
          if (action.amount > currentPlayer.chips + currentPlayer.currentBet) {
            throw new Error('筹码不足');
          }
          const raiseAmount = action.amount - currentPlayer.currentBet;
          updatedPlayers[playerIndex] = {
            ...currentPlayer,
            currentBet: action.amount,
            totalBet: currentPlayer.totalBet + raiseAmount,
            chips: currentPlayer.chips - raiseAmount,
            isAllIn: currentPlayer.chips === raiseAmount,
            lastAction: action
          };
          break;
          
        case 'all_in':
          const allInAmount = currentPlayer.chips + currentPlayer.currentBet;
          updatedPlayers[playerIndex] = {
            ...currentPlayer,
            currentBet: allInAmount,
            totalBet: currentPlayer.totalBet + currentPlayer.chips,
            chips: 0,
            isAllIn: true,
            lastAction: action
          };
          break;
      }
      
      console.log('=== 玩家行动调试 ===');
      console.log('玩家索引:', playerIndex);
      console.log('玩家名称:', currentPlayer.name);
      console.log('行动类型:', action.type);
      console.log('行动前状态:', {
        currentBet: currentPlayer.currentBet,
        chips: currentPlayer.chips,
        playersActedThisRound: gameState.playersActedThisRound
      });
      
      // 更新行动轮次跟踪
      const newPlayersActedThisRound = [...gameState.playersActedThisRound];
      newPlayersActedThisRound[playerIndex] = true;
      
      // 更新最后加注玩家索引
      let newLastRaisePlayerIndex = gameState.lastRaisePlayerIndex;
      if (action.type === 'raise' || action.type === 'all_in') {
        newLastRaisePlayerIndex = playerIndex;
        console.log('检测到加注/全押，重置其他玩家行动状态');
        // 如果有加注，重置其他玩家的行动状态（他们需要对加注做出反应）
        for (let i = 0; i < newPlayersActedThisRound.length; i++) {
          if (i !== playerIndex) {
            const player = updatedPlayers[i];
            if (player.isActive && !player.isFolded && !player.isAllIn) {
              newPlayersActedThisRound[i] = false;
              console.log(`重置玩家${i}(${player.name})的行动状态`);
            }
          }
        }
      }
      
      console.log('行动后跟踪状态:', {
        playersActedThisRound: newPlayersActedThisRound,
        lastRaisePlayerIndex: newLastRaisePlayerIndex
      });
      
      // 计算新的底池和当前最高下注
      let newPot = updatedPlayers.reduce((sum, player) => sum + player.totalBet, 0);
      let newCurrentBet = Math.max(...updatedPlayers.map(p => p.currentBet));
      
      // 确定下一个活跃玩家
      const nextPlayerIndex = getNextActivePlayerIndex(updatedPlayers, playerIndex);
      
      // 检查是否需要进入下一阶段
      let newPhase = gameState.phase;
      let newCommunityCards = [...gameState.communityCards];
      let newActivePlayerIndex = nextPlayerIndex !== -1 ? nextPlayerIndex : playerIndex;
      let newRoundStartPlayerIndex = gameState.roundStartPlayerIndex;
      let finalPlayersActedThisRound = newPlayersActedThisRound;
      let finalLastRaisePlayerIndex = newLastRaisePlayerIndex;
      let newGameResult = gameState.gameResult; // 保持原有的游戏结果
      
      // 如果找不到下一个可以行动的玩家，强制检查回合是否完成
      const forceRoundComplete = nextPlayerIndex === -1;
      
      console.log('=== 下一个玩家确定 ===');
      console.log('原始下一个玩家索引:', nextPlayerIndex);
      console.log('强制回合完成:', forceRoundComplete);
      console.log('最终活跃玩家索引:', newActivePlayerIndex);
      
      // 检查活跃玩家数量（未弃牌且仍有筹码的玩家）
      const activePlayers = updatedPlayers.filter(p => p.isActive && !p.isFolded);
      console.log('当前活跃玩家数量:', activePlayers.length);
      console.log('活跃玩家:', activePlayers.map(p => p.name));
      
      // 如果只剩一个活跃玩家，游戏直接结束
      if (activePlayers.length <= 1) {
        console.log('=== 游戏结束：只剩一个活跃玩家 ===');
        newPhase = 'finished';
        
        let gameResult = null;
        
        // 将底池奖励给最后的活跃玩家
        if (activePlayers.length === 1) {
          const winner = activePlayers[0];
          const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
          const winnings = newPot - winner.totalBet; // 获得底池，减去自己的投注
          updatedPlayers[winnerIndex] = {
            ...winner,
            chips: winner.chips + winnings
          };
          console.log(`玩家 ${winner.name} 获胜，获得底池 ${newPot}`);
          
          // 创建游戏结果，标识获胜者
          gameResult = {
            winners: [winner],
            sidePots: [{
              amount: newPot,
              eligiblePlayers: [winner],
              winners: [winner]
            }],
            playerResults: [{
              player: winner,
              handEvaluation: {
                rank: 10, // 最高等级，因为其他人都弃牌了
                name: '其他玩家弃牌获胜',
                score: 999999,
                cards: winner.cards || [],
                kickers: [] // 添加kickers属性，避免getHandDescription报错
              },
              winnings
            }]
          };
        }
        
        // 重置所有玩家的状态
        updatedPlayers.forEach(player => {
          player.currentBet = 0;
          player.totalBet = 0;
          player.isFolded = false;
          player.isAllIn = false;
          player.lastAction = undefined;
        });
        
        // 检查有筹码的玩家数量，决定游戏是否可以继续
        const playersWithChips = updatedPlayers.filter(player => player.chips > 0);
        console.log('当前有筹码的玩家:', playersWithChips.map(p => `${p.name}: ${p.chips}`));
        
        newPot = 0;
        newCurrentBet = 0;
        
        // 设置游戏结果到新游戏状态中
        newGameResult = gameResult;
      } else if (forceRoundComplete || isRoundComplete(
        updatedPlayers, 
        newCurrentBet, 
        gameState.phase,
        newPlayersActedThisRound,
        gameState.roundStartPlayerIndex,
        newLastRaisePlayerIndex,
        gameState.bigBlindIndex
      )) {
        // 重置当前下注
        updatedPlayers.forEach(player => {
          player.currentBet = 0;
        });
        
        // 进入下一阶段时，从庄家后第一个活跃玩家开始
        const nextActiveFromDealer = getNextActivePlayerIndex(updatedPlayers, gameState.dealerIndex);
        newActivePlayerIndex = nextActiveFromDealer !== -1 ? nextActiveFromDealer : gameState.dealerIndex;
        newRoundStartPlayerIndex = newActivePlayerIndex;
        
        // 重置当前最高下注为0（新阶段开始）
        newCurrentBet = 0;
        
        // 重置行动轮次跟踪（新阶段开始，所有玩家都未行动）
        finalPlayersActedThisRound = new Array(updatedPlayers.length).fill(false);
        finalLastRaisePlayerIndex = -1;
        
        // 进入下一阶段
        switch (gameState.phase) {
          case 'preflop':
            newPhase = 'flop';
            // 发3张公共牌
            const deck = createDeck();
            newCommunityCards = deck.slice(0, 3);
            break;
          case 'flop':
            newPhase = 'turn';
            // 发第4张公共牌
            newCommunityCards.push(createDeck()[0]);
            break;
          case 'turn':
            newPhase = 'river';
            // 发第5张公共牌
            newCommunityCards.push(createDeck()[0]);
            break;
          case 'river':
            newPhase = 'showdown';
            // 摊牌阶段，等待手动结算或自动结算
            break;
        }
        
        console.log(`=== 阶段推进: ${gameState.phase} -> ${newPhase} ===`);
        console.log('新的活跃玩家索引:', newActivePlayerIndex);
        console.log('新的活跃玩家:', updatedPlayers[newActivePlayerIndex]);
        console.log('重置行动轮次跟踪');
      }
      
      // 检查游戏是否应该保持活跃状态
      let shouldGameBeActive = newPhase !== 'finished';
      if (newPhase === 'finished') {
        // 如果游戏结束，检查是否有多个玩家还有筹码
        const playersWithChips = updatedPlayers.filter(player => player.chips > 0);
        shouldGameBeActive = playersWithChips.length > 1;
      }
      
      const newGameState: GameState = {
        ...gameState,
        phase: newPhase,
        players: updatedPlayers,
        communityCards: newCommunityCards,
        pot: newPot,
        currentBet: newCurrentBet,
        activePlayerIndex: newActivePlayerIndex,
        roundStartPlayerIndex: newRoundStartPlayerIndex,
        playersActedThisRound: finalPlayersActedThisRound,
        lastRaisePlayerIndex: finalLastRaisePlayerIndex,
        isGameActive: shouldGameBeActive,
        gameResult: newGameResult
      };
      
      console.log('=== 更新游戏状态 ===');
      console.log('新游戏状态:', newGameState);
      console.log('当前活跃玩家:', newGameState.players[newGameState.activePlayerIndex]);
      console.log('==================');
      
      // 发送游戏状态更新事件到服务器
      if (socket && isConnected && currentRoom) {
        console.log('发送游戏动作事件:', {
          roomId: currentRoom.id,
          playerId: currentUser.id,
          action,
          gameState: newGameState
        });
        
        socket.emit('gameAction', {
          roomId: currentRoom.id,
          playerId: currentUser.id,
          action,
          gameState: newGameState
        });
      }
      
      setGameState(newGameState);
      
      // 如果游戏结束但可以继续，5秒后自动开始新一局
      if (newPhase === 'finished' && shouldGameBeActive) {
        console.log('游戏本局结束，5秒后自动开始新一局');
        setTimeout(() => {
          if (socket && isConnected && currentRoom) {
            console.log('自动开始新一局游戏');
            socket.emit('startGame', {
              roomId: currentRoom.id,
              isAutoStart: true,
              isNewRound: true
            });
          }
        }, 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行动作失败');
    } finally {
      setIsLoading(false);
    }
  }, [gameState, currentUser]);
  
  // 结束游戏
  const endGame = useCallback(async () => {
    console.log('=== 结束游戏 ===');
    
    // 发送游戏结束事件到服务器
    if (socket && isConnected && currentRoom) {
      console.log('发送游戏结束事件到服务器:', currentRoom.id);
      socket.emit('gameEnd', {
        roomId: currentRoom.id
      });
    }
    
    setGameState(null);
    console.log('游戏状态已清空');
    console.log('================');
  }, [socket, isConnected, currentRoom]);
  
  // 重置游戏
  const resetGame = useCallback(async () => {
    // 重置游戏时保持当前玩家的筹码
    const shouldPreserveChips = !!(gameState && gameState.players);
    const previousPlayers = shouldPreserveChips ? gameState.players : undefined;
    
    const initialState = initializeGame(shouldPreserveChips, previousPlayers);
    setGameState(initialState);
  }, [initializeGame, gameState]);
  
  // 结算当前游戏
  const settleCurrentGame = useCallback(async () => {
    if (!gameState || gameState.phase !== 'showdown') {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 计算游戏结果
      const gameResult = settleGame(gameState.players, gameState.communityCards);
      
      // 更新玩家筹码
      console.log('开始更新玩家筹码，游戏结果:', gameResult.playerResults.map(pr => ({
        name: pr.player.name,
        winnings: pr.winnings
      })));
      
      const updatedPlayers = gameState.players.map(player => {
        const result = gameResult.playerResults.find(pr => pr.player.id === player.id);
        
        if (!result) {
          console.error('未找到玩家结算结果:', player.name, player.id);
          // 如果没有找到结果，保持原有筹码但重置其他状态
          return {
            ...player,
            currentBet: 0,
            totalBet: 0,
            lastAction: undefined,
            isFolded: false,
            isAllIn: false
          };
        }
        
        const newChips = player.chips - player.totalBet + result.winnings;
        console.log(`玩家 ${player.name}: 原筹码 ${player.chips} - 下注 ${player.totalBet} + 奖金 ${result.winnings} = 新筹码 ${newChips}`);
        
        return {
          ...player,
          chips: newChips,
          currentBet: 0,
          totalBet: 0,
          lastAction: undefined,
          isFolded: false,
          isAllIn: false
        };
      });
      
      // 检查有筹码的玩家数量
      const playersWithChips = updatedPlayers.filter(player => player.chips > 0);
      console.log('结算后有筹码的玩家:', playersWithChips.map(p => `${p.name}: ${p.chips}`));
      
      // 更新游戏状态
      const settledGameState: GameState = {
        ...gameState,
        phase: 'finished',
        players: updatedPlayers,
        pot: 0,
        currentBet: 0,
        gameResult,
        isGameActive: playersWithChips.length > 1
      };
      
      setGameState(settledGameState);
      
      // 发送游戏结束事件到服务器
      if (socket && isConnected && currentRoom) {
        console.log('游戏结算完成，发送游戏结束事件到服务器:', currentRoom.id);
        socket.emit('gameEnd', {
          roomId: currentRoom.id,
          gameResult,
          canContinue: playersWithChips.length > 1
        });
      }
      
      // 根据玩家筹码情况决定下一步
      if (playersWithChips.length <= 1) {
        console.log('游戏结束：只有一个或没有玩家有筹码');
        // 游戏彻底结束，不自动重置
      } else {
        console.log('游戏可以继续，5秒后开始新一局');
        // 5秒后开始新一局
        setTimeout(() => {
          if (socket && isConnected && currentRoom) {
            console.log('自动开始新一局游戏');
            socket.emit('startGame', {
              roomId: currentRoom.id,
              isAutoStart: true,
              isNewRound: true
            });
          }
        }, 5000);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '结算失败');
    } finally {
      setIsLoading(false);
    }
  }, [gameState, socket, isConnected, currentRoom]);
  
  // 获取当前玩家
  const getCurrentPlayer = useCallback(() => {
    if (!gameState) return null;
    return gameState.players[gameState.activePlayerIndex] || null;
  }, [gameState]);
  
  // 根据用户ID获取玩家
  const getPlayerByUserId = useCallback((userId: string) => {
    if (!gameState) return null;
    return gameState.players.find(player => player.userId === userId) || null;
  }, [gameState]);
  
  // 检查是否可以执行动作
  const canPerformAction = useCallback((action: GameAction) => {
    if (!gameState || !currentUser) return false;
    
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || currentPlayer.userId !== currentUser.id) return false;
    if (currentPlayer.isFolded || currentPlayer.isAllIn) return false;
    
    switch (action.type) {
      case 'fold':
        return true;
      case 'check':
        return gameState.currentBet === currentPlayer.currentBet;
      case 'call':
        return gameState.currentBet > currentPlayer.currentBet;
      case 'raise':
        return currentPlayer.chips > 0 && action.amount >= calculateMinRaise(gameState.currentBet, gameState.bigBlind);
      case 'all_in':
        return currentPlayer.chips > 0;
      default:
        return false;
    }
  }, [gameState, currentUser, getCurrentPlayer]);
  
  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // 监听房间变化，清空游戏状态
  useEffect(() => {
    console.log('房间变化检测:', currentRoom?.id);
    // 当房间变化时，清空游戏状态以避免脏数据
    setGameState(null);
    setError(null);
    setIsLoading(false);
  }, [currentRoom?.id]);
  
  // 移除自动初始化游戏的useEffect，确保只有在收到gameStarted事件时才初始化游戏

  // 监听游戏开始事件
  useEffect(() => {
    if (!socket) return;

    const handleGameStarted = (data: { roomId: string; players: RoomPlayer[]; room: Room; isNewRound?: boolean }) => {
      console.log('收到游戏开始事件:', data);
      
      try {
        setIsLoading(true);
        setError(null);
        
        // 如果是新一轮游戏且当前有游戏状态，保持上一局的筹码
        const shouldPreserveChips = !!(data.isNewRound && gameState && gameState.players);
        const previousPlayers = shouldPreserveChips ? gameState.players : undefined;
        
        console.log('是否保持筹码:', shouldPreserveChips);
        
        // 初始化游戏状态
        const initialState = initializeGame(shouldPreserveChips, previousPlayers);
        if (!initialState) {
          throw new Error('无法初始化游戏状态');
        }
        
        // 创建新牌组并发牌
        const deck = createDeck();
        let cardIndex = 0;
        
        // 给每个玩家发2张牌
        const updatedPlayers = initialState.players.map(player => ({
          ...player,
          cards: [deck[cardIndex++], deck[cardIndex++]]
        }));
        
        // 设置盲注
        updatedPlayers[initialState.smallBlindIndex].currentBet = initialState.smallBlind;
        updatedPlayers[initialState.smallBlindIndex].chips -= initialState.smallBlind;
        updatedPlayers[initialState.bigBlindIndex].currentBet = initialState.bigBlind;
        updatedPlayers[initialState.bigBlindIndex].chips -= initialState.bigBlind;
        
        // 设置preflop阶段的行动轮次跟踪
        const preflopStartPlayerIndex = (initialState.bigBlindIndex + 1) % updatedPlayers.length;
        const preflopPlayersActedThisRound = new Array(updatedPlayers.length).fill(false);
        
        const newGameState: GameState = {
          ...initialState,
          phase: 'preflop',
          players: updatedPlayers,
          pot: initialState.smallBlind + initialState.bigBlind,
          currentBet: initialState.bigBlind,
          activePlayerIndex: preflopStartPlayerIndex,
          roundStartPlayerIndex: preflopStartPlayerIndex,
          playersActedThisRound: preflopPlayersActedThisRound,
          lastRaisePlayerIndex: initialState.bigBlindIndex, // 大盲位算作初始加注者
          isGameActive: true
        };
        
        console.log('游戏状态初始化完成:', newGameState);
        setGameState(newGameState);
      } catch (err) {
        console.error('初始化游戏状态失败:', err);
        setError(err instanceof Error ? err.message : '初始化游戏状态失败');
      } finally {
        setIsLoading(false);
      }
    };

    socket.on('gameStarted', handleGameStarted);

    return () => {
      socket.off('gameStarted', handleGameStarted);
    };
  }, [socket, initializeGame]);

  // 监听游戏状态更新事件
  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdated = (data: { roomId: string; playerId: string; action: GameAction; gameState: GameState }) => {
      console.log('收到游戏状态更新事件:', data);
      
      // 只有当不是当前用户的操作时才更新状态（避免重复更新）
      if (currentUser && data.playerId !== currentUser.id) {
        console.log('更新其他玩家的游戏状态:', data.gameState);
        setGameState(data.gameState);
      } else {
        console.log('忽略自己的操作事件');
      }
    };

    socket.on('gameStateUpdated', handleGameStateUpdated);

    return () => {
      socket.off('gameStateUpdated', handleGameStateUpdated);
    };
  }, [socket, currentUser]);

  // 监听游戏结束事件
  useEffect(() => {
    if (!socket) return;

    const handleGameRoundEnded = (data: { roomId: string; canContinue: boolean; winner?: any }) => {
      console.log('收到游戏本局结束事件:', data);
      // 游戏本局结束但可以继续，这里可以添加UI提示或其他逻辑
    };

    const handleGameEnded = (data: { roomId: string; canContinue: boolean }) => {
      console.log('收到游戏彻底结束事件:', data);
      // 游戏彻底结束，清空游戏状态
      if (!data.canContinue) {
        setGameState(null);
        setError(null);
        setIsLoading(false);
      }
    };

    socket.on('gameRoundEnded', handleGameRoundEnded);
    socket.on('gameEnded', handleGameEnded);

    return () => {
      socket.off('gameRoundEnded', handleGameRoundEnded);
      socket.off('gameEnded', handleGameEnded);
    };
  }, [socket]);
  
  const value: GameContextType = {
    gameState,
    isLoading,
    error,
    startGame,
    endGame,
    resetGame,
    performAction,
    settleCurrentGame,
    getCurrentPlayer,
    getPlayerByUserId,
    canPerformAction,
    clearError
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};