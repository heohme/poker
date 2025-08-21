// Mock用户角色类型定义
export interface MockUser {
  id: string;
  name: string;
  avatar: string;
  initialChips: number;
  personality: string;
  currentChips: number;
  currentRoom?: string;
}

// 预设角色数据
export const MOCK_USERS: Record<string, MockUser> = {
  bob: {
    id: 'bob',
    name: 'Bob',
    avatar: '🧑‍💼',
    initialChips: 1000,
    personality: '稳重型玩家，偏保守策略',
    currentChips: 1000
  },
  alice: {
    id: 'alice',
    name: 'Alice',
    avatar: '👩‍💻',
    initialChips: 1200,
    personality: '激进型玩家，喜欢加注',
    currentChips: 1200
  },
  charlie: {
    id: 'charlie',
    name: 'Charlie',
    avatar: '👨‍🎨',
    initialChips: 800,
    personality: '新手玩家，操作较慢',
    currentChips: 800
  },
  david: {
    id: 'david',
    name: 'David',
    avatar: '👨‍🔬',
    initialChips: 1500,
    personality: '专业玩家，计算精准',
    currentChips: 1500
  },
  eva: {
    id: 'eva',
    name: 'Eva',
    avatar: '👩‍🚀',
    initialChips: 1000,
    personality: '随机型玩家，难以预测',
    currentChips: 1000
  },
  frank: {
    id: 'frank',
    name: 'Frank',
    avatar: '👨‍🍳',
    initialChips: 900,
    personality: '谨慎型玩家，很少诈唬',
    currentChips: 900
  }
};

// 有效用户ID列表
export const VALID_USER_IDS = Object.keys(MOCK_USERS);

// 检查用户ID是否有效
export function isValidUserId(userId: string): boolean {
  return VALID_USER_IDS.includes(userId);
}

// 根据ID获取用户信息
export function getUserById(userId: string): MockUser | null {
  return MOCK_USERS[userId] || null;
}