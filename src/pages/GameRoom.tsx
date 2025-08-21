import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useUserFromURL } from '../hooks/useUserFromURL';
import { useGame, GameAction, Card, GamePlayer } from '../contexts/GameContext';
import { getHandDescription, evaluateHand } from '../utils/pokerHands';
import { useRoom } from '../contexts/RoomContext';
import { ArrowLeft, Crown, Users, DollarSign, Clock, Play, Square, Check, X } from 'lucide-react';

// 扑克牌花色符号和颜色
const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black'
};

const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { 
    gameState, 
    isLoading, 
    error, 
    clearError,
    performAction, 
    startGame: startGameAction,
    settleCurrentGame,
    getCurrentPlayer,
    getPlayerByUserId,
    canPerformAction
  } = useGame();
  const { 
    currentRoom, 
    roomPlayers, 
    joinRoom, 
    leaveRoom, 
    togglePlayerReady,
    socket
  } = useRoom();
  
  // 本地状态
  const [selectedAction, setSelectedAction] = useState('');
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showRaiseInput, setShowRaiseInput] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [roomPlayersLoaded, setRoomPlayersLoaded] = useState(false);
  
  // 从URL获取用户信息
  useUserFromURL();
  
  // 加入房间
  useEffect(() => {
    const joinRoomAsync = async () => {
      if (!currentUser || !roomId || currentRoom?.id === roomId) return;
      
      console.log('=== 准备加入房间 ===');
      console.log('currentUser:', currentUser);
      console.log('roomId:', roomId);
      console.log('currentRoom:', currentRoom);
      
      try {
        setIsLoadingRoom(true);
        await joinRoom({ roomId, playerId: currentUser.id });
        console.log('成功加入房间');
      } catch (err) {
        console.error('加入房间失败:', err);
        navigate('/lobby');
      } finally {
        setIsLoadingRoom(false);
      }
    };
    
    joinRoomAsync();
  }, [currentUser, roomId, currentRoom?.id, joinRoom, navigate]);
  
  // 监听roomPlayers变化，当有数据时设置加载完成
  useEffect(() => {
    console.log('=== roomPlayers状态变化 ===');
    console.log('roomPlayers:', roomPlayers);
    console.log('roomPlayers长度:', roomPlayers?.length || 0);
    
    if (roomPlayers && roomPlayers.length > 0) {
      console.log('roomPlayers已加载，设置roomPlayersLoaded为true');
      setRoomPlayersLoaded(true);
    } else {
      console.log('roomPlayers为空或未定义');
      setRoomPlayersLoaded(false);
    }
  }, [roomPlayers]);
  
  // 处理准备状态切换
  const handleToggleReady = async () => {
    if (!currentUser || !roomId) return;
    try {
      await togglePlayerReady(roomId, currentUser.id);
    } catch (err) {
      console.error('切换准备状态失败:', err);
    }
  };
  
  // 离开房间
  const handleLeaveRoom = async () => {
    if (!currentUser || !roomId) return;
    try {
      await leaveRoom(roomId, currentUser.id);
      navigate('/lobby');
    } catch (err) {
      console.error('离开房间失败:', err);
      navigate('/lobby');
    }
  };
  
  // 计算房间状态
  const currentPlayer = roomPlayers?.find(p => p.userId === currentUser?.id);
  const isHost = currentPlayer?.isHost || false;
  const allPlayersReady = roomPlayers && roomPlayers.length >= 2 && roomPlayers.every(p => p.isReady);
  const canStartGame = roomPlayersLoaded && isHost && allPlayersReady;
  
  // 开始游戏
  const startGame = async () => {
    if (!socket || !roomId || !canStartGame) return;
    try {
      socket.emit('startGame', roomId);
    } catch (err) {
      console.error('开始游戏失败:', err);
    }
  };
  
  // 如果没有用户信息或房间信息，显示加载状态
  if (!currentUser || isLoadingRoom || !roomPlayersLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">{!currentUser ? '加载用户信息...' : '加载房间信息...'}</p>
        </div>
      </div>
    );
  }
  
  // 如果没有游戏状态，显示房间等待界面
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900">
        {/* 顶部导航 */}
        <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <button
              onClick={() => navigate('/lobby')}
              className="flex items-center space-x-2 text-white hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回大厅</span>
            </button>
            
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>{roomPlayers?.length || 0}/{currentRoom?.maxPlayers || 0} 玩家</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>底池: $0</span>
              </div>
              <div className="bg-yellow-500/20 px-3 py-1 rounded-full">
                <span className="text-yellow-400 font-semibold">等待开始</span>
              </div>
            </div>
            
            {/* 当前用户标识 */}
            <div className="flex items-center space-x-2 bg-blue-500/20 px-3 py-2 rounded-lg border border-blue-400/30">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-2xl">{currentUser.avatar}</span>
              <span className="text-blue-300 font-semibold">{currentUser.name}</span>
            </div>
          </div>
        </div>

        {/* 房间内容 */}
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">{currentRoom?.name}</h1>
              <p className="text-white/70">房间 ID: {currentRoom?.id}</p>
            </div>
            
            {!roomPlayersLoaded ? (
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-lg">加载房间信息...</p>
              </div>
            ) : (
              <>
                {/* 玩家列表 */}
                <div className="max-w-4xl mx-auto mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roomPlayers?.map(player => (
                      <div
                        key={player.id}
                        className={`
                          relative bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 transition-all
                          ${
                            player.userId === currentUser?.id
                              ? 'border-blue-400 shadow-lg shadow-blue-400/20'
                              : player.isReady
                              ? 'border-green-400 shadow-lg shadow-green-400/20'
                              : 'border-white/20'
                          }
                        `}
                      >
                        {/* 房主标识 */}
                        {player.isHost && (
                          <div className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-full w-8 h-8 flex items-center justify-center">
                            <Crown className="w-4 h-4" />
                          </div>
                        )}
                        
                        {/* 准备状态标识 */}
                        <div className={`absolute -top-2 -left-2 rounded-full w-8 h-8 flex items-center justify-center ${
                          player.isReady ? 'bg-green-500' : 'bg-gray-500'
                        }`}>
                          {player.isReady ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <X className="w-4 h-4 text-white" />
                          )}
                        </div>
                        
                        {/* 玩家信息 */}
                        <div className="text-center">
                          <div className="text-4xl mb-3">{player.avatar}</div>
                          <div className="text-xl font-semibold text-white mb-2">{player.name}</div>
                          <div className="text-white/70 mb-3">
                            <div className="flex items-center justify-center space-x-1">
                              <DollarSign className="w-4 h-4" />
                              <span>{player.chips} 筹码</span>
                            </div>
                          </div>
                          
                          {/* 准备状态 */}
                          <div className={`text-sm font-semibold mb-3 ${
                            player.isReady ? 'text-green-400' : 'text-gray-400'
                          }`}>
                            {player.isReady ? '✓ 已准备' : '○ 未准备'}
                          </div>
                          
                          {/* 准备按钮 - 只有当前玩家可以操作 */}
                          {player.userId === currentUser?.id && (
                            <button
                              onClick={handleToggleReady}
                              disabled={isLoading}
                              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                                player.isReady
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              } disabled:bg-gray-600`}
                            >
                              {isLoading ? '处理中...' : (player.isReady ? '取消准备' : '准备')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* 空位占位符 */}
                    {Array.from({ length: Math.max(0, (currentRoom?.maxPlayers || 0) - (roomPlayers?.length || 0)) }).map((_, index) => (
                      <div
                        key={`empty-${index}`}
                        className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border-2 border-dashed border-white/20 flex items-center justify-center"
                      >
                        <div className="text-center text-white/50">
                          <Users className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">等待玩家加入</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 游戏控制区域 */}
                <div className="text-center">
                  {roomPlayers && roomPlayers.length < 2 ? (
                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4 max-w-md mx-auto">
                      <p className="text-yellow-400 font-semibold">至少需要2名玩家才能开始游戏</p>
                    </div>
                  ) : !allPlayersReady ? (
                    <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4 max-w-md mx-auto">
                      <p className="text-blue-400 font-semibold">等待所有玩家准备就绪</p>
                    </div>
                  ) : null}
                  
                  {isHost && (
                    <button
                      onClick={startGame}
                      disabled={isLoading || !canStartGame}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-4 px-8 rounded-lg text-lg transition-colors flex items-center space-x-2 mx-auto"
                    >
                      <Play className="w-5 h-5" />
                      <span>{isLoading ? '启动中...' : '开始游戏'}</span>
                    </button>
                  )}
                  
                  {!isHost && (
                    <p className="text-white/70">等待房主开始游戏</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 计算当前玩家相关变量
  const activePlayer = getCurrentPlayer();
  const currentPlayerData = getPlayerByUserId(currentUser?.id || '');
  const isCurrentPlayerTurn = activePlayer && currentPlayerData && activePlayer.id === currentPlayerData.id;

  // 处理游戏动作
  const handleGameAction = async (actionType: string, amount?: number) => {
    if (!currentUser || !gameState) return;
    
    try {
      let action: GameAction;
      
      switch (actionType) {
        case 'fold':
          action = { type: 'fold' };
          break;
        case 'check':
          action = { type: 'check' };
          break;
        case 'call':
          const callAmount = gameState.currentBet;
          action = { type: 'call', amount: callAmount };
          break;
        case 'raise':
          if (!amount) return;
          action = { type: 'raise', amount };
          break;
        case 'all_in':
          const currentPlayer = getPlayerByUserId(currentUser.id);
          if (!currentPlayer) return;
          action = { type: 'all_in', amount: currentPlayer.chips + currentPlayer.currentBet };
          break;
        default:
          return;
      }
      
      await performAction(action);
      setShowRaiseInput(false);
      setSelectedAction('');
      setRaiseAmount(0);
    } catch (err) {
      console.error('执行游戏动作失败:', err);
    }
  };

  // 渲染扑克牌
  const renderCard = (card: Card, isHidden = false) => {
    if (isHidden) {
      return (
        <div className="w-12 h-16 bg-blue-600 border border-blue-700 rounded-lg flex items-center justify-center">
          <div className="w-8 h-10 bg-blue-800 rounded"></div>
        </div>
      );
    }
    
    return (
      <div className="w-12 h-16 bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-center text-xs font-bold">
        <span className={SUIT_COLORS[card.suit]}>{card.rank}</span>
        <span className={SUIT_COLORS[card.suit]}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-green-800 text-white">
      {/* 游戏信息栏 */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/lobby')}
            className="flex items-center space-x-2 text-white hover:text-yellow-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回大厅</span>
          </button>
          
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>{gameState.players.filter(p => p.isActive && !p.isFolded).length} 玩家</span>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>底池: ${gameState.pot}</span>
            </div>
            <div className="bg-yellow-500/20 px-3 py-1 rounded-full">
              <span className="text-yellow-400 font-semibold">
                {gameState.phase === 'waiting' && '等待开始'}
                {gameState.phase === 'preflop' && '翻牌前'}
                {gameState.phase === 'flop' && '翻牌'}
                {gameState.phase === 'turn' && '转牌'}
                {gameState.phase === 'river' && '河牌'}
                {gameState.phase === 'showdown' && '摊牌'}
                {gameState.phase === 'finished' && '游戏结束'}
              </span>
            </div>
            {activePlayer && (
              <div className="text-yellow-400">
                当前玩家: {activePlayer.name}
              </div>
            )}
          </div>
          
          {/* 当前用户标识 */}
          <div className="flex items-center space-x-2 bg-blue-500/20 px-3 py-2 rounded-lg border border-blue-400/30">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-2xl">{currentUser.avatar}</span>
            <span className="text-blue-300 font-semibold">{currentUser.name}</span>
          </div>
        </div>
      </div>

      {/* 游戏区域 */}
      <div className="p-6">
        {/* 底池信息 */}
        <div className="text-center mb-6">
          <div className="inline-block bg-yellow-600 px-6 py-3 rounded-full">
            <div className="text-lg font-bold">底池: ${gameState.pot}</div>
            <div className="text-sm">当前下注: ${gameState.currentBet}</div>
          </div>
        </div>

        {/* 公共牌 */}
        <div className="flex justify-center space-x-2 mb-8">
          {gameState.communityCards.map((card, index) => (
            <div key={index}>{renderCard(card)}</div>
          ))}
          {/* 占位符 */}
          {Array.from({ length: 5 - gameState.communityCards.length }).map((_, index) => (
            <div key={`placeholder-${index}`} className="w-12 h-16 border-2 border-dashed border-green-600 rounded-lg"></div>
          ))}
        </div>

        {/* 玩家区域 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {gameState.players.map((player, index) => {
            // 检查是否为获胜玩家
            const isWinner = gameState.gameResult?.winners.some(winner => winner.id === player.id);
            
            return (
            <div
              key={player.id}
              className={`
                relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border-2 transition-all
                ${
                  isWinner
                    ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse'
                    : player.id === activePlayer?.id
                    ? 'border-yellow-400 shadow-lg shadow-yellow-400/20'
                    : 'border-white/20'
                }
                ${
                  player.isFolded
                    ? 'opacity-50 grayscale'
                    : ''
                }
                ${
                  isWinner
                    ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20'
                    : ''
                }
              `}
            >
              {/* 庄家标识 */}
              {index === gameState.dealerIndex && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  D
                </div>
              )}
              
              {/* 盲注标识 */}
              {index === gameState.smallBlindIndex && (
                <div className="absolute -top-2 -left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  SB
                </div>
              )}
              {index === gameState.bigBlindIndex && (
                <div className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  BB
                </div>
              )}
              
              {/* 获胜者标识 */}
              {isWinner && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold animate-bounce shadow-lg">
                    👑 WINNER 👑
                  </span>
                </div>
              )}
              
              {/* 玩家信息 */}
              <div className="text-center mb-3">
                <div className={`text-2xl mb-1 ${isWinner ? 'animate-bounce' : ''}`}>{player.avatar}</div>
                <div className={`font-semibold text-sm ${isWinner ? 'text-yellow-300' : ''}`}>{player.name}</div>
                <div className="text-xs text-white/70">${player.chips}</div>
              </div>
              
              {/* 手牌 */}
              <div className="flex justify-center space-x-1 mb-3">
                {player.cards && player.cards.length > 0 && (player.userId === currentUser.id || gameState.phase === 'showdown') ? (
                  player.cards.map((card, cardIndex) => (
                    <div
                      key={cardIndex}
                      className={`
                        w-8 h-12 bg-white rounded border flex items-center justify-center text-xs font-bold
                        ${SUIT_COLORS[card.suit]}
                      `}
                    >
                      {card.rank}{SUIT_SYMBOLS[card.suit]}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="w-8 h-12 bg-blue-900 rounded border border-white/20"></div>
                    <div className="w-8 h-12 bg-blue-900 rounded border border-white/20"></div>
                  </>
                )}
              </div>
              
              {/* 当前下注 */}
              {player.currentBet > 0 && (
                <div className="text-center">
                  <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">
                    ${player.currentBet}
                  </div>
                </div>
              )}
              
              {/* 最后动作 - 彩色标识徽章 */}
              {player.lastAction && (
                <div className="text-center mt-2">
                  <div className="inline-block px-2 py-1 rounded-full text-xs font-bold">
                    {player.lastAction.type === 'check' && (
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full">CHECK</span>
                    )}
                    {player.lastAction.type === 'call' && (
                      <span className="bg-blue-500 text-white px-2 py-1 rounded-full">CALL</span>
                    )}
                    {player.lastAction.type === 'raise' && (
                      <span className="bg-yellow-500 text-black px-2 py-1 rounded-full">RAISE</span>
                    )}
                    {player.lastAction.type === 'fold' && (
                      <span className="bg-red-500 text-white px-2 py-1 rounded-full">FOLD</span>
                    )}
                    {player.lastAction.type === 'all_in' && (
                      <span className="bg-purple-500 text-white px-2 py-1 rounded-full">ALL IN</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* 玩家状态标识 */}
              {player.isFolded && (
                <div className="absolute top-2 right-2">
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">FOLDED</span>
                </div>
              )}
              {player.isAllIn && !player.isFolded && (
                <div className="absolute top-2 right-2">
                  <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-bounce">ALL IN</span>
                </div>
              )}
            </div>
          )})}
        </div>

        {/* 操作按钮 */}
        {isCurrentPlayerTurn && currentPlayerData && gameState.isGameActive && (
          <div className="bg-black/20 backdrop-blur-sm border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto">
              {error && (
                <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-center">
                  <span className="text-red-200">{error}</span>
                  <button onClick={clearError} className="ml-2 text-red-200 hover:text-white">×</button>
                </div>
              )}
              
              <div className="flex flex-wrap gap-3 justify-center">
                {/* 弃牌 */}
                <button
                  onClick={() => handleGameAction('fold')}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  弃牌
                </button>
                
                {/* 过牌/跟注 */}
                {gameState.currentBet === currentPlayerData.currentBet ? (
                  <button
                    onClick={() => handleGameAction('check')}
                    disabled={isLoading || !canPerformAction({ type: 'check' })}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    过牌
                  </button>
                ) : (
                  <button
                    onClick={() => handleGameAction('call')}
                    disabled={isLoading || !canPerformAction({ type: 'call', amount: gameState.currentBet })}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    跟注 ${gameState.currentBet - currentPlayerData.currentBet}
                  </button>
                )}
                
                {/* 加注 */}
                {!showRaiseInput ? (
                  <button
                    onClick={() => setShowRaiseInput(true)}
                    disabled={isLoading || currentPlayerData.chips === 0}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    加注
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={raiseAmount}
                      onChange={(e) => setRaiseAmount(parseInt(e.target.value) || 0)}
                      min={Math.max(gameState.currentBet * 2, gameState.bigBlind)}
                      max={currentPlayerData.chips + currentPlayerData.currentBet}
                      className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-center"
                    />
                    <button
                      onClick={() => handleGameAction('raise', raiseAmount)}
                      disabled={isLoading || !canPerformAction({ type: 'raise', amount: raiseAmount })}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold transition-colors"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setShowRaiseInput(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                    >
                      取消
                    </button>
                  </div>
                )}
                
                {/* 全押 */}
                {currentPlayerData.chips > 0 && (
                  <button
                    onClick={() => handleGameAction('all_in')}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    全押 ${currentPlayerData.chips}
                  </button>
                )}
              </div>
              
              {isLoading && (
                <div className="text-center mt-4 text-yellow-400">
                  处理中...
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 游戏结果显示 */}
        {gameState.phase === 'showdown' && (
          <div className="bg-black/30 backdrop-blur-sm border-t border-white/10 p-6">
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">摊牌阶段</h3>
              <p className="text-white/80 mb-4">所有玩家亮出底牌，比较手牌大小</p>
              
              {/* 显示所有玩家的手牌评估 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {gameState.players.filter(p => !p.isFolded).map(player => {
                  const handEval = evaluateHand(player.cards, gameState.communityCards);
                  return (
                    <div key={player.id} className="bg-white/10 rounded-lg p-4">
                      <div className="text-lg font-semibold text-white mb-2">
                        {player.avatar} {player.name}
                      </div>
                      <div className="flex justify-center space-x-1 mb-2">
                        {player.cards.map((card, index) => (
                          <div
                            key={index}
                            className={`w-8 h-12 bg-white rounded border flex items-center justify-center text-xs font-bold ${
                              SUIT_COLORS[card.suit]
                            }`}
                          >
                            {card.rank}{SUIT_SYMBOLS[card.suit]}
                          </div>
                        ))}
                      </div>
                      <div className="text-yellow-400 font-semibold">
                        {handEval && handEval.kickers ? getHandDescription(handEval) : '手牌评估中...'}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <button
                onClick={settleCurrentGame}
                disabled={isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 px-8 rounded-lg transition-colors"
              >
                {isLoading ? '结算中...' : '结算游戏'}
              </button>
            </div>
          </div>
        )}
        
        {/* 游戏结果显示 */}
        {gameState.phase === 'finished' && gameState.gameResult && (
          <div className="bg-black/30 backdrop-blur-sm border-t border-white/10 p-6">
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-3xl font-bold text-yellow-400 mb-6">🎉 游戏结果 🎉</h3>
              
              {/* 获胜者 - 带动画效果 */}
              <div className="mb-6">
                <h4 className="text-xl font-semibold text-white mb-3">🏆 获胜者 🏆</h4>
                <div className="flex justify-center space-x-4">
                  {gameState.gameResult.winners.map(winner => (
                    <div key={winner.id} className="relative">
                      {/* 闪烁的金色边框 */}
                      <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 rounded-xl animate-pulse opacity-75"></div>
                      <div className="relative bg-gradient-to-br from-yellow-500/30 to-yellow-600/30 border-2 border-yellow-400 rounded-lg p-4 backdrop-blur-sm">
                        {/* WINNER 标识 */}
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-lg">
                            👑 WINNER 👑
                          </span>
                        </div>
                        <div className="text-3xl mb-2 animate-bounce">{winner.avatar}</div>
                        <div className="text-yellow-300 font-bold text-lg">{winner.name}</div>
                        {/* 闪烁效果 */}
                        <div className="absolute inset-0 bg-yellow-400/20 rounded-lg animate-ping"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 详细结果 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {gameState.gameResult.playerResults.map(result => (
                  <div key={result.player.id} className="bg-white/10 rounded-lg p-4">
                    <div className="text-lg font-semibold text-white mb-2">
                      {result.player.avatar} {result.player.name}
                    </div>
                    <div className="text-yellow-400 mb-2">
                      {result.handEvaluation && result.handEvaluation.kickers ? getHandDescription(result.handEvaluation) : '手牌评估中...'}
                    </div>
                    <div className="text-green-400 font-bold">
                      {result.winnings > 0 ? `+$${result.winnings}` : '$0'}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-white/60 text-sm">
                新一轮游戏将在几秒后自动开始...
              </div>
            </div>
          </div>
        )}
        
        {/* 等待其他玩家 */}
        {!isCurrentPlayerTurn && gameState.phase !== 'showdown' && gameState.phase !== 'finished' && (
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <span className="text-gray-400">等待其他玩家操作...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;