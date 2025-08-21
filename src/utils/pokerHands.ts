import { Card, GamePlayer } from '../contexts/GameContext';

// 手牌类型枚举
export enum HandRank {
  HIGH_CARD = 1,
  PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10
}

// 手牌评估结果
export interface HandEvaluation {
  rank: HandRank;
  name: string;
  cards: Card[];
  kickers: number[];
  score: number;
}

// 获取牌的数值
const getCardValue = (rank: string): number => {
  switch (rank) {
    case 'A': return 14;
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    default: return parseInt(rank);
  }
};

// 获取牌的显示名称
const getCardName = (value: number): string => {
  switch (value) {
    case 14: return 'A';
    case 13: return 'K';
    case 12: return 'Q';
    case 11: return 'J';
    default: return value.toString();
  }
};

// 检查是否为同花
const isFlush = (cards: Card[]): boolean => {
  const suits = cards.map(card => card.suit);
  return suits.every(suit => suit === suits[0]);
};

// 检查是否为顺子
const isStraight = (values: number[]): boolean => {
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // 检查普通顺子
  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i] !== sortedValues[i - 1] + 1) {
      // 检查A-2-3-4-5的特殊顺子
      if (sortedValues.join(',') === '2,3,4,5,14') {
        return true;
      }
      return false;
    }
  }
  return true;
};

// 统计牌的数量
const countCards = (values: number[]): Map<number, number> => {
  const counts = new Map<number, number>();
  values.forEach(value => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return counts;
};

// 评估最佳5张牌
export const evaluateHand = (playerCards: Card[], communityCards: Card[]): HandEvaluation => {
  const allCards = [...playerCards, ...communityCards];
  const allCombinations = getCombinations(allCards, 5);
  
  let bestHand: HandEvaluation | null = null;
  
  for (const combination of allCombinations) {
    const evaluation = evaluateFiveCards(combination);
    if (!bestHand || evaluation.score > bestHand.score) {
      bestHand = evaluation;
    }
  }
  
  return bestHand!;
};

// 获取所有5张牌的组合
const getCombinations = (cards: Card[], k: number): Card[][] => {
  if (k === 1) return cards.map(card => [card]);
  if (k === cards.length) return [cards];
  
  const combinations: Card[][] = [];
  for (let i = 0; i <= cards.length - k; i++) {
    const head = cards[i];
    const tailCombinations = getCombinations(cards.slice(i + 1), k - 1);
    tailCombinations.forEach(tail => {
      combinations.push([head, ...tail]);
    });
  }
  
  return combinations;
};

// 评估5张牌的手牌
const evaluateFiveCards = (cards: Card[]): HandEvaluation => {
  const values = cards.map(card => getCardValue(card.rank));
  const sortedValues = [...values].sort((a, b) => b - a);
  const counts = countCards(values);
  const countValues = Array.from(counts.values()).sort((a, b) => b - a);
  
  const isFlushHand = isFlush(cards);
  const isStraightHand = isStraight(values);
  
  // 皇家同花顺
  if (isFlushHand && isStraightHand && sortedValues[0] === 14 && sortedValues[4] === 10) {
    return {
      rank: HandRank.ROYAL_FLUSH,
      name: '皇家同花顺',
      cards,
      kickers: [],
      score: HandRank.ROYAL_FLUSH * 1000000
    };
  }
  
  // 同花顺
  if (isFlushHand && isStraightHand) {
    const highCard = sortedValues.join(',') === '14,5,4,3,2' ? 5 : sortedValues[0];
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      name: '同花顺',
      cards,
      kickers: [highCard],
      score: HandRank.STRAIGHT_FLUSH * 1000000 + highCard
    };
  }
  
  // 四条
  if (countValues[0] === 4) {
    const fourKind = Array.from(counts.entries()).find(([_, count]) => count === 4)![0];
    const kicker = Array.from(counts.entries()).find(([_, count]) => count === 1)![0];
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      name: '四条',
      cards,
      kickers: [fourKind, kicker],
      score: HandRank.FOUR_OF_A_KIND * 1000000 + fourKind * 100 + kicker
    };
  }
  
  // 葫芦
  if (countValues[0] === 3 && countValues[1] === 2) {
    const threeKind = Array.from(counts.entries()).find(([_, count]) => count === 3)![0];
    const pair = Array.from(counts.entries()).find(([_, count]) => count === 2)![0];
    return {
      rank: HandRank.FULL_HOUSE,
      name: '葫芦',
      cards,
      kickers: [threeKind, pair],
      score: HandRank.FULL_HOUSE * 1000000 + threeKind * 100 + pair
    };
  }
  
  // 同花
  if (isFlushHand) {
    return {
      rank: HandRank.FLUSH,
      name: '同花',
      cards,
      kickers: sortedValues,
      score: HandRank.FLUSH * 1000000 + sortedValues.reduce((sum, val, i) => sum + val * Math.pow(100, 4 - i), 0)
    };
  }
  
  // 顺子
  if (isStraightHand) {
    const highCard = sortedValues.join(',') === '14,5,4,3,2' ? 5 : sortedValues[0];
    return {
      rank: HandRank.STRAIGHT,
      name: '顺子',
      cards,
      kickers: [highCard],
      score: HandRank.STRAIGHT * 1000000 + highCard
    };
  }
  
  // 三条
  if (countValues[0] === 3) {
    const threeKind = Array.from(counts.entries()).find(([_, count]) => count === 3)![0];
    const kickers = Array.from(counts.entries())
      .filter(([_, count]) => count === 1)
      .map(([value, _]) => value)
      .sort((a, b) => b - a);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      name: '三条',
      cards,
      kickers: [threeKind, ...kickers],
      score: HandRank.THREE_OF_A_KIND * 1000000 + threeKind * 10000 + kickers.reduce((sum, val, i) => sum + val * Math.pow(100, 1 - i), 0)
    };
  }
  
  // 两对
  if (countValues[0] === 2 && countValues[1] === 2) {
    const pairs = Array.from(counts.entries())
      .filter(([_, count]) => count === 2)
      .map(([value, _]) => value)
      .sort((a, b) => b - a);
    const kicker = Array.from(counts.entries()).find(([_, count]) => count === 1)![0];
    return {
      rank: HandRank.TWO_PAIR,
      name: '两对',
      cards,
      kickers: [...pairs, kicker],
      score: HandRank.TWO_PAIR * 1000000 + pairs[0] * 10000 + pairs[1] * 100 + kicker
    };
  }
  
  // 一对
  if (countValues[0] === 2) {
    const pair = Array.from(counts.entries()).find(([_, count]) => count === 2)![0];
    const kickers = Array.from(counts.entries())
      .filter(([_, count]) => count === 1)
      .map(([value, _]) => value)
      .sort((a, b) => b - a);
    return {
      rank: HandRank.PAIR,
      name: '一对',
      cards,
      kickers: [pair, ...kickers],
      score: HandRank.PAIR * 1000000 + pair * 1000000 + kickers.reduce((sum, val, i) => sum + val * Math.pow(100, 2 - i), 0)
    };
  }
  
  // 高牌
  return {
    rank: HandRank.HIGH_CARD,
    name: '高牌',
    cards,
    kickers: sortedValues,
    score: HandRank.HIGH_CARD * 1000000 + sortedValues.reduce((sum, val, i) => sum + val * Math.pow(100, 4 - i), 0)
  };
};

// 比较两个手牌
export const compareHands = (hand1: HandEvaluation, hand2: HandEvaluation): number => {
  return hand1.score - hand2.score;
};

// 获取手牌描述
export const getHandDescription = (evaluation: HandEvaluation): string => {
  const { name, kickers } = evaluation;
  
  if (kickers.length === 0) {
    return name;
  }
  
  const kickerNames = kickers.map(getCardName);
  
  switch (evaluation.rank) {
    case HandRank.FOUR_OF_A_KIND:
      return `${kickerNames[0]}的四条`;
    case HandRank.FULL_HOUSE:
      return `${kickerNames[0]}带${kickerNames[1]}的葫芦`;
    case HandRank.THREE_OF_A_KIND:
      return `${kickerNames[0]}的三条`;
    case HandRank.TWO_PAIR:
      return `${kickerNames[0]}和${kickerNames[1]}的两对`;
    case HandRank.PAIR:
      return `${kickerNames[0]}的一对`;
    case HandRank.STRAIGHT:
    case HandRank.STRAIGHT_FLUSH:
      return `${kickerNames[0]}高${name}`;
    default:
      return `${kickerNames[0]}高${name}`;
  }
};

// 结算游戏
export interface GameResult {
  winners: GamePlayer[];
  sidePots: {
    amount: number;
    eligiblePlayers: GamePlayer[];
    winners: GamePlayer[];
  }[];
  playerResults: {
    player: GamePlayer;
    handEvaluation: HandEvaluation;
    winnings: number;
  }[];
}

export const settleGame = (players: GamePlayer[], communityCards: Card[]): GameResult => {
  console.log('开始游戏结算，玩家状态:', players.map(p => ({
    id: p.id,
    name: p.name,
    chips: p.chips,
    totalBet: p.totalBet,
    isFolded: p.isFolded
  })));
  
  // 计算总底池
  const totalPot = players.reduce((sum, player) => sum + player.totalBet, 0);
  console.log('总底池:', totalPot);
  
  // 只考虑未弃牌的玩家
  const activePlayers = players.filter(player => !player.isFolded);
  console.log('活跃玩家数量:', activePlayers.length);
  
  // 如果只有一个玩家未弃牌，直接获胜
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    console.log('只有一个活跃玩家，直接获胜:', winner.name, '获得:', totalPot);
    
    // 为所有玩家创建结果，包括已弃牌的玩家
    const playerResults: GameResult['playerResults'] = players.map(player => {
      if (player.id === winner.id) {
        return {
          player: winner,
          handEvaluation: evaluateHand(winner.cards, communityCards),
          winnings: totalPot
        };
      } else {
        return {
          player,
          handEvaluation: player.isFolded ? 
            { rank: HandRank.HIGH_CARD, name: '已弃牌', cards: [], kickers: [], score: 0 } :
            evaluateHand(player.cards, communityCards),
          winnings: 0
        };
      }
    });
    
    return {
      winners: [winner],
      sidePots: [{
        amount: totalPot,
        eligiblePlayers: [winner],
        winners: [winner]
      }],
      playerResults
    };
  }
  
  // 评估所有活跃玩家的手牌
  const playerEvaluations = activePlayers.map(player => ({
    player,
    evaluation: evaluateHand(player.cards, communityCards)
  }));
  
  // 按手牌强度排序
  playerEvaluations.sort((a, b) => compareHands(b.evaluation, a.evaluation));
  console.log('玩家手牌评估结果:', playerEvaluations.map(pe => ({
    name: pe.player.name,
    handName: pe.evaluation.name,
    score: pe.evaluation.score
  })));
  
  // 计算边池
  const sidePots = calculateSidePots(players);
  console.log('边池计算结果:', sidePots);
  
  // 分配奖金
  const playerResults: GameResult['playerResults'] = [];
  const winners: GamePlayer[] = [];
  let totalWinnings = 0;
  
  for (const sidePot of sidePots) {
    const eligibleEvaluations = playerEvaluations.filter(pe => 
      sidePot.eligiblePlayers.some(ep => ep.id === pe.player.id)
    );
    
    if (eligibleEvaluations.length === 0) continue;
    
    // 找到最佳手牌
    const bestScore = eligibleEvaluations[0].evaluation.score;
    const potWinners = eligibleEvaluations
      .filter(pe => pe.evaluation.score === bestScore)
      .map(pe => pe.player);
    
    // 平分奖金
    const winningsPerPlayer = Math.floor(sidePot.amount / potWinners.length);
    console.log(`边池 ${sidePot.amount} 由 ${potWinners.length} 个玩家平分，每人获得:`, winningsPerPlayer);
    
    potWinners.forEach(winner => {
      if (!winners.some(w => w.id === winner.id)) {
        winners.push(winner);
      }
      
      const existingResult = playerResults.find(pr => pr.player.id === winner.id);
      if (existingResult) {
        existingResult.winnings += winningsPerPlayer;
      } else {
        const evaluation = playerEvaluations.find(pe => pe.player.id === winner.id)!.evaluation;
        playerResults.push({
          player: winner,
          handEvaluation: evaluation,
          winnings: winningsPerPlayer
        });
      }
      totalWinnings += winningsPerPlayer;
    });
    
    sidePot.winners = potWinners;
  }
  
  // 添加未获胜的活跃玩家的结果
  playerEvaluations.forEach(pe => {
    if (!playerResults.some(pr => pr.player.id === pe.player.id)) {
      playerResults.push({
        player: pe.player,
        handEvaluation: pe.evaluation,
        winnings: 0
      });
    }
  });
  
  // 添加已弃牌玩家的结果
  const foldedPlayers = players.filter(player => player.isFolded);
  foldedPlayers.forEach(player => {
    if (!playerResults.some(pr => pr.player.id === player.id)) {
      playerResults.push({
        player,
        handEvaluation: { rank: HandRank.HIGH_CARD, name: '已弃牌', cards: [], kickers: [], score: 0 },
        winnings: 0
      });
    }
  });
  
  // 验证总奖金计算
  const totalDistributedWinnings = playerResults.reduce((sum, pr) => sum + pr.winnings, 0);
  console.log('结算完成，总奖金分配:', totalDistributedWinnings, '总底池:', totalPot);
  
  if (totalDistributedWinnings !== totalPot) {
    console.error('奖金分配错误！分配总额与底池不符:', {
      totalPot,
      totalDistributedWinnings,
      difference: totalPot - totalDistributedWinnings
    });
    
    // 如果有剩余奖金，分配给第一个获胜者
    const remainder = totalPot - totalDistributedWinnings;
    if (remainder > 0 && winners.length > 0) {
      const firstWinner = playerResults.find(pr => pr.player.id === winners[0].id);
      if (firstWinner) {
        firstWinner.winnings += remainder;
        console.log(`将剩余奖金 ${remainder} 分配给第一个获胜者:`, firstWinner.player.name);
      }
    }
  }
  
  console.log('玩家结算结果:', playerResults.map(pr => ({
    name: pr.player.name,
    winnings: pr.winnings,
    handName: pr.handEvaluation.name
  })));
  
  return {
    winners,
    sidePots,
    playerResults
  };
};

// 计算边池
const calculateSidePots = (players: GamePlayer[]) => {
  const bets = players.map(player => ({
    playerId: player.id,
    player,
    amount: player.totalBet
  })).sort((a, b) => a.amount - b.amount);
  
  const sidePots: {
    amount: number;
    eligiblePlayers: GamePlayer[];
    winners: GamePlayer[];
  }[] = [];
  
  let previousAmount = 0;
  
  for (let i = 0; i < bets.length; i++) {
    const currentAmount = bets[i].amount;
    if (currentAmount > previousAmount) {
      const potAmount = (currentAmount - previousAmount) * (bets.length - i);
      const eligiblePlayers = bets.slice(i).map(bet => bet.player);
      
      sidePots.push({
        amount: potAmount,
        eligiblePlayers,
        winners: []
      });
      
      previousAmount = currentAmount;
    }
  }
  
  return sidePots;
};