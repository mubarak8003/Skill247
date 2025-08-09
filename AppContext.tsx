
"use client";

import React, { createContext, useState, ReactNode, useCallback, useEffect, useRef, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { Bitcoin, CandlestickChart as CandlestickIcon, LucideIcon, Euro } from 'lucide-react';

// Initial hardcoded users, will be stored in localStorage
const initialUsers = [
  { id: 1, email: 'user@example.com', password: 'password', role: 'user', name: 'Test User', isOnline: false, isBlocked: false },
  { id: 2, email: 'admin@example.com', password: 'Madani786@', role: 'admin', name: 'Test Admin', isOnline: false, isBlocked: false },
];

// TYPE DEFINITIONS
export type WithdrawalAccount = {
    id: string;
    accountType: 'bank' | 'upi';
    accountHolderName: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    status: 'pending' | 'awaiting_verification' | 'verified' | 'rejected';
    rejectionReason?: string;
    verificationAmount?: number;
    verificationAttempts: number;
};

export type User = {
    id: number;
    email: string;
    password?: string; // Not ideal, but for simulation
    role: 'user' | 'admin';
    name: string;
    referralCode?: string;
    referrerId?: number;
    isOnline?: boolean;
    isBlocked?: boolean;
    bankAccounts?: WithdrawalAccount[];
};

export type DataPoint = {
  time: number;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Asset = {
    name: string;
    icon: React.ComponentType<{ size: number, className?: string }>;
    iconName: string;
    initialPrice: number;
    payout: number;
    color: string;
    volatility: number;
};

export type ActiveTrade = {
  id: string;
  assetName: string;
  entryPrice: number;
  entryTime: number;
  expiryTime: number;
  type: 'buy' | 'sell';
  amount: number;
  account: 'demo' | 'real';
  userId: number;
};

export type CompletedTrade = ActiveTrade & {
  closeTime: number;
  closePrice: number;
  outcome: 'win' | 'loss' | 'tie';
  profit: number;
};

export type Transaction = {
    id: number;
    userId: number;
    type: 'deposit' | 'withdrawal';
    amount: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    date: number;
    utr?: string; // For deposits
    accountNumber?: string; // For withdrawals
    ifscCode?: string; // For withdrawals
    upiId?: string; // For withdrawals (optional)
    rejectionReason?: string;
    withdrawalAccountId?: string; // For withdrawals to saved accounts
};

type UserBalances = {
    [userId: number]: {
        real: number;
        demo: number;
    }
}

export type ChatMessage = {
    id: string;
    senderId: number;
    text: string;
    timestamp: number;
    fileName?: string;
    fileURL?: string;
    fileType?: string;
};

export type SupportThreads = {
    [userId: number]: ChatMessage[];
}

type ToastInfo = {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
    className?: string;
};

const iconMap: { [key: string]: LucideIcon } = {
  Bitcoin: Bitcoin,
  CandlestickIcon: CandlestickIcon,
  Euro: Euro,
};

const initialAssets: Asset[] = [
    { name: "BTC/USD", icon: Bitcoin, iconName: "Bitcoin", initialPrice: 68420.55, payout: 95, color: "hsl(45, 93%, 47%)", volatility: 50.5 },
    { name: "Crypto", icon: Bitcoin, iconName: "Bitcoin", initialPrice: 641.86, payout: 85, color: "hsl(var(--primary))", volatility: 0.1 },
    { name: "EUR/USD (OTC)", icon: Euro, iconName: "Euro", initialPrice: 1.07, payout: 88, color: "hsl(120, 70%, 50%)", volatility: 0.005 },
    { name: "Stocks", icon: CandlestickIcon, iconName: "CandlestickIcon", initialPrice: 175.2, payout: 80, color: "hsl(150, 80%, 50%)", volatility: 0.5 },
    { name: "USD/JPY (OTC)", icon: CandlestickIcon, iconName: "CandlestickIcon", initialPrice: 157.5, payout: 90, color: "hsl(200, 80%, 50%)", volatility: 0.1 },
    { name: "CAD/CHF (OTC)", icon: CandlestickIcon, iconName: "CandlestickIcon", initialPrice: 0.65, payout: 82, color: "hsl(300, 80%, 50%)", volatility: 0.002 },
    { name: "USD/CAD (OTC)", icon: CandlestickIcon, iconName: "CandlestickIcon", initialPrice: 1.37, payout: 87, color: "hsl(240, 80%, 60%)", volatility: 0.003 },
    { name: "GBP/NZD (OTC)", icon: CandlestickIcon, iconName: "CandlestickIcon", initialPrice: 2.08, payout: 86, color: "hsl(330, 80%, 60%)", volatility: 0.004 },
];

const rehydrateAsset = (asset: any): Asset => {
  return { ...asset, icon: iconMap[asset.iconName] || Bitcoin };
};

const POINTS_TO_STORE = 400;
const MAX_GRANULAR_TICKS = 400;

const generateDataPoints = (count: number, endTime: number, initialPrice: number, volatility: number): DataPoint[] => {
  const data: DataPoint[] = [];
  let price = initialPrice;
  const startTime = endTime - (count -1) * 1000;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * 1000;
    const open = price;
    let close = open + (Math.random() - 0.5) * volatility;
    if (close === open) {
        close += volatility * 0.01;
    }
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    data.push({ time, price: open, open, high, low, close });
    price = close;
  }
  return data;
};

const generateInitialData = (initialPrice: number, volatility: number): DataPoint[] => {
    return generateDataPoints(POINTS_TO_STORE, Date.now(), initialPrice, volatility);
}


type AppContextType = {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => User | null;
  signup: (name: string, email: string, password: string, referralCode?: string) => { success: boolean; user: User | null; message: string; };
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
  forgotPassword: (email: string) => string | null;
  giveReward: (userId: number, amount: number) => void;
  deductBalance: (userId: number, amount: number) => void;
  adminUpdateUser: (userId: number, updates: Partial<User>) => { success: boolean, message: string };
  toggleUserBlockStatus: (userId: number) => void;
  demoBalance: number;
  setDemoBalance: React.Dispatch<React.SetStateAction<number>>;
  transactions: Transaction[];
  tradeHistory: CompletedTrade[];
  addTradeToHistory: (trade: CompletedTrade) => void;
  handleDepositRequest: (amount: number, utr: string) => void;
  handleWithdrawalRequest: (amount: number, withdrawalAccountId: string) => void;
  handleTransactionApproval: (transactionId: number, newStatus: 'Approved' | 'Rejected') => void;
  getBadgeVariant: (status: Transaction['status']) => "default" | "secondary" | "destructive" | "outline";
  upiId: string;
  setUpiId: (id: string) => void;
  isUpiDepositEnabled: boolean;
  toggleUpiDeposit: () => void;
  depositInfo: string;
  setDepositInfo: (info: string) => void;
  contactEmail: string;
  setContactEmail: (email: string) => void;
  contactInfo: string;
  setContactInfo: (info: string) => void;
  referralPercentage: number;
  setReferralPercentage: (percentage: number) => void;
  termsAndConditions: string;
  setTermsAndConditions: (text: string) => void;
  policy: string;
  setPolicy: (text: string) => void;
  userBalances: UserBalances;
  minDeposit: number;
  setMinDeposit: (amount: number) => void;
  maxDeposit: number;
  setMaxDeposit: (amount: number) => void;
  minWithdrawal: number;
  setMinWithdrawal: (amount: number) => void;
  maxWithdrawal: number;
  setMaxWithdrawal: (amount: number) => void;
  supportThreads: SupportThreads;
  sendMessage: (receiverId: number, text: string, file?: File) => void;
  addWithdrawalAccount: (account: Omit<WithdrawalAccount, 'id' | 'status' | 'rejectionReason' | 'verificationAmount' | 'verificationAttempts'>) => { success: boolean, message: string };
  removeWithdrawalAccount: (accountId: string) => void;
  handleBankAccountVerification: (userId: number, accountId: string, status: 'verified' | 'rejected') => { success: boolean, message: string };
  adminInitiateVerification: (userId: number, accountId: string, amount: number) => { success: boolean, message: string };
  userSubmitVerificationAmount: (accountId: string, amount: number) => { success: boolean, message: string };

  // Trading state and functions
  assets: Asset[];
  updateAsset: (assetName: string, newPayout: number) => void;
  selectedAsset: Asset;
  setSelectedAsset: React.Dispatch<React.SetStateAction<Asset>>;
  data: DataPoint[]; // Aggregated data based on timeframe
  chartTimeframe: number;
  setChartTimeframe: (seconds: number) => void;
  activeTrades: ActiveTrade[];
  handleTrade: (type: 'buy' | 'sell', amount: number, time: number, accountType: 'demo' | 'real', currentPrice: number) => void;
};

export const AppContext = createContext<AppContextType | null>(null);

const getLocalStorageItem = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    const storedValue = localStorage.getItem(key);
    try {
        return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const setLocalStorageItem = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value, (key, value) => {
            if (key === 'icon') return undefined; // Don't store the icon component
            return value;
        }));
    } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            console.error(`Error: LocalStorage quota exceeded when setting key "${key}".`);
        } else {
            console.error(`Error setting localStorage key "${key}":`, e);
        }
    }
}

const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tradeHistory, setTradeHistory] = useState<CompletedTrade[]>([]);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [allActiveTrades, setAllActiveTrades] = useState<ActiveTrade[]>([]);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(initialAssets.map(rehydrateAsset)[0]);
  
  const [allGranularData, setAllGranularData] = useState<{[assetName: string]: DataPoint[]}>({});
  const [data, setData] = useState<DataPoint[]>([]); // This will be the aggregated data
  const [chartTimeframe, setChartTimeframe] = useState<number>(1);
  
  const [lastToast, setLastToast] = useState<ToastInfo | null>(null);
  const [upiId, setUpiIdState] = useState<string>('');
  const [isUpiDepositEnabled, setIsUpiDepositEnabled] = useState<boolean>(true);
  const [depositInfo, setDepositInfoState] = useState<string>('');
  const [contactEmail, setContactEmailState] = useState<string>('');
  const [contactInfo, setContactInfoState] = useState<string>('');
  const [referralPercentage, setReferralPercentageState] = useState<number>(1);
  const [termsAndConditions, setTermsAndConditionsState] = useState<string>('');
  const [policy, setPolicyState] = useState<string>('');
  const [userBalances, setUserBalances] = useState<UserBalances>({});

  const [minDeposit, setMinDepositState] = useState<number>(100);
  const [maxDeposit, setMaxDepositState] = useState<number>(50000);
  const [minWithdrawal, setMinWithdrawalState] = useState<number>(500);
  const [maxWithdrawal, setMaxWithdrawalState] = useState<number>(25000);
  const [supportThreads, setSupportThreads] = useState<SupportThreads>({});


  const { toast } = useToast();
  const router = useRouter();

  const allGranularDataRef = useRef(allGranularData);
  
  useEffect(() => { allGranularDataRef.current = allGranularData; }, [allGranularData]);
  
  // Initial mount effect to load all data from localStorage
  useEffect(() => {
    const storedUsers = getLocalStorageItem('users', []);
    
    const userMap = new Map(storedUsers.map((u: User) => [u.id, u]));
    
    initialUsers.forEach(initialUser => {
        if (!userMap.has(initialUser.id)) {
            userMap.set(initialUser.id, initialUser);
        } else {
            const storedUser = userMap.get(initialUser.id)!;
            const updatedUser = { ...storedUser, ...initialUser };
            userMap.set(initialUser.id, updatedUser);
        }
    });

    const finalUsers = Array.from(userMap.values()).map((user:User) => ({
      ...user,
      isOnline: getLocalStorageItem(`userOnline_${user.id}`, false),
      referralCode: user.referralCode || generateReferralCode(),
      isBlocked: user.isBlocked || false,
      bankAccounts: user.bankAccounts?.map(ba => ({ ...ba, verificationAttempts: ba.verificationAttempts || 0 })) || [],
    }));
    setUsers(finalUsers);
    
    const allBalances: UserBalances = {};
    finalUsers.forEach(user => {
      allBalances[user.id] = {
        real: getLocalStorageItem(`realBalance_${user.id}`, 0),
        demo: getLocalStorageItem(`demoBalance_${user.id}`, 10000)
      }
    });
    setUserBalances(allBalances);

    setTransactions(getLocalStorageItem('transactions', []));
    setTradeHistory(getLocalStorageItem('tradeHistory', []));
    setAllActiveTrades(getLocalStorageItem('allActiveTrades', []));
    setSupportThreads(getLocalStorageItem('supportThreads', {}));
    
    setUpiIdState(getLocalStorageItem('upiId', '7458038680@upi'));
    setIsUpiDepositEnabled(getLocalStorageItem('isUpiDepositEnabled', true));
    setDepositInfoState(getLocalStorageItem('depositInfo', ''));
    setContactEmailState(getLocalStorageItem('contactEmail', 'support@example.com'));
    setContactInfoState(getLocalStorageItem('contactInfo', ''));
    setReferralPercentageState(getLocalStorageItem('referralPercentage', 1));
    setTermsAndConditionsState(getLocalStorageItem('termsAndConditions', 'Welcome to our platform! By using our service, you agree to these terms. Please trade responsibly.'));
    setPolicyState(getLocalStorageItem('policy', 'Your privacy is important to us. This policy explains what information we collect and how we use it.'));

    setMinDepositState(getLocalStorageItem('minDeposit', 100));
    setMaxDepositState(getLocalStorageItem('maxDeposit', 50000));
    setMinWithdrawalState(getLocalStorageItem('minWithdrawal', 500));
    setMaxWithdrawalState(getLocalStorageItem('maxWithdrawal', 25000));

    const storedAssets = getLocalStorageItem('assets', initialAssets);
    const rehydratedAssets = storedAssets.map(rehydrateAsset);
    setAssets(rehydratedAssets);
    
    const storedAsset = getLocalStorageItem('selectedAsset', null);
    if (storedAsset) {
      const rehydratedAsset = rehydrateAsset(storedAsset);
      const validAsset = rehydratedAssets.find((a: Asset) => a.name === rehydratedAsset.name) || rehydratedAssets[0];
      setSelectedAsset(validAsset);
    } else {
      setSelectedAsset(rehydratedAssets[0]);
    }
    
    const initialData: {[assetName: string]: DataPoint[]} = {};
    rehydratedAssets.forEach((asset: Asset) => {
        initialData[asset.name] = getLocalStorageItem(`data_${asset.name}`, generateInitialData(asset.initialPrice, asset.volatility));
    });
    setAllGranularData(initialData);
    
    const storedUser = getLocalStorageItem('currentUser', null);
    if(storedUser) {
        const fullUser = finalUsers.find(u => u.id === storedUser.id);
        setCurrentUser(fullUser || storedUser);
    }
    setIsMounted(true);
  }, []);

  const setUpiId = (id: string) => {
    setUpiIdState(id);
    setLocalStorageItem('upiId', id);
  };
  
  const toggleUpiDeposit = () => {
    setIsUpiDepositEnabled(prev => {
        const newState = !prev;
        setLocalStorageItem('isUpiDepositEnabled', newState);
        return newState;
    });
  };

  const setDepositInfo = (info: string) => {
    setDepositInfoState(info);
    setLocalStorageItem('depositInfo', info);
  };

  const setContactEmail = (email: string) => {
    setContactEmailState(email);
    setLocalStorageItem('contactEmail', email);
  }

  const setContactInfo = (info: string) => {
    setContactInfoState(info);
    setLocalStorageItem('contactInfo', info);
  }

  const setReferralPercentage = (percentage: number) => {
    setReferralPercentageState(percentage);
    setLocalStorageItem('referralPercentage', percentage);
  }
  
  const setTermsAndConditions = (text: string) => {
    setTermsAndConditionsState(text);
    setLocalStorageItem('termsAndConditions', text);
  }
  
  const setPolicy = (text: string) => {
    setPolicyState(text);
    setLocalStorageItem('policy', text);
  };

  const setMinDeposit = (amount: number) => {
    setMinDepositState(amount);
    setLocalStorageItem('minDeposit', amount);
  }
  const setMaxDeposit = (amount: number) => {
    setMaxDepositState(amount);
    setLocalStorageItem('maxDeposit', amount);
  }
  const setMinWithdrawal = (amount: number) => {
    setMinWithdrawalState(amount);
    setLocalStorageItem('minWithdrawal', amount);
  }
  const setMaxWithdrawal = (amount: number) => {
    setMaxWithdrawalState(amount);
    setLocalStorageItem('maxWithdrawal', amount);
  }

  const demoBalance = useMemo(() => {
    if (currentUser && userBalances && userBalances[currentUser.id]) {
        return userBalances[currentUser.id].demo;
    }
    return 0;
  }, [currentUser, userBalances]);

  const setDemoBalance = (value: number | ((prev: number) => number)) => {
      if (!currentUser) return;
      setUserBalances(prev => {
          const currentDemo = prev[currentUser.id]?.demo ?? 10000;
          const newDemo = typeof value === 'function' ? value(currentDemo) : value;
          const updatedBalances = {
              ...prev,
              [currentUser.id]: {
                  ...(prev[currentUser.id] || { real: 0 }),
                  demo: newDemo
              }
          };
          setLocalStorageItem(`demoBalance_${currentUser.id}`, newDemo);
          return updatedBalances;
      })
  }

  useEffect(() => {
    if (isMounted) {
      setLocalStorageItem('users', users);
    }
  }, [users, isMounted]);
  useEffect(() => { if(isMounted) setLocalStorageItem('currentUser', currentUser); }, [currentUser, isMounted]);
  useEffect(() => { if(isMounted) setLocalStorageItem('transactions', transactions); }, [transactions, isMounted]);
  useEffect(() => { if(isMounted) setLocalStorageItem('tradeHistory', tradeHistory); }, [tradeHistory, isMounted]);
  useEffect(() => { if(isMounted) setLocalStorageItem('selectedAsset', selectedAsset); }, [selectedAsset, isMounted]);
  useEffect(() => { if (isMounted) setLocalStorageItem('assets', assets); }, [assets, isMounted]);
  useEffect(() => { if (isMounted) setLocalStorageItem('allActiveTrades', allActiveTrades); }, [allActiveTrades, isMounted]);
  useEffect(() => { if (isMounted) setLocalStorageItem('supportThreads', supportThreads); }, [supportThreads, isMounted]);
  useEffect(() => { if (isMounted) setLocalStorageItem('isUpiDepositEnabled', isUpiDepositEnabled); }, [isUpiDepositEnabled, isMounted]);
  useEffect(() => {
    if (isMounted) {
        Object.keys(allGranularData).forEach(assetName => {
            setLocalStorageItem(`data_${assetName}`, allGranularData[assetName]);
        });
    }
  }, [allGranularData, isMounted]);

  useEffect(() => {
    if (lastToast) {
        toast(lastToast);
        setLastToast(null);
    }
  }, [lastToast, toast]);
  
  const setUserOnlineStatus = (userId: number, isOnline: boolean) => {
    setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, isOnline } : u));
    setLocalStorageItem(`userOnline_${userId}`, isOnline);
  };

  const login = (email: string, password: string): User | null => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (user) {
      if (user.isBlocked) {
        toast({ variant: 'destructive', title: 'Account Blocked', description: 'Your account has been blocked by an administrator.' });
        return null;
      }
      const userWithStatus = { ...user, isOnline: true };
      setCurrentUser(userWithStatus);
      setUserOnlineStatus(user.id, true);
      return userWithStatus;
    }
    return null;
  };
  
  const signup = (name: string, email: string, password: string, referralCode?: string): { success: boolean; user: User | null; message: string; } => {
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
          return { success: false, user: null, message: 'An account with this email already exists.' };
      }

      let referrer: User | undefined;
      if (referralCode) {
          referrer = users.find(u => u.referralCode === referralCode.trim());
          if (!referrer) {
              return { success: false, user: null, message: 'Invalid referral code.' };
          }
      }

      const newUser: User = {
          id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : initialUsers.length + 1,
          name,
          email,
          password,
          role: 'user',
          referralCode: generateReferralCode(),
          referrerId: referrer?.id,
          isOnline: true,
          isBlocked: false,
          bankAccounts: [],
      };

      setUsers(prev => [...prev, newUser]);
      setUserOnlineStatus(newUser.id, true);


      // Set initial balance for the new user
      setUserBalances(prev => {
        const updatedBalances = {
          ...prev,
          [newUser.id]: { real: 0, demo: 10000 }
        };
        setLocalStorageItem(`realBalance_${newUser.id}`, 0);
        setLocalStorageItem(`demoBalance_${newUser.id}`, 10000);
        return updatedBalances;
      });

      const { password: _, ...userWithoutPassword } = newUser;
      setCurrentUser(newUser);
      return { success: true, user: userWithoutPassword, message: "Signup successful" };
  };

  const logout = () => {
    if (currentUser) {
        setUserOnlineStatus(currentUser.id, false);
        setCurrentUser(null);
    }
    router.push('/');
  };

  const updateUser = (updatedUserData: Partial<User>) => {
    if (!currentUser) return;

    const fullUpdate = (user: User) => ({ ...user, ...updatedUserData });

    setUsers(prevUsers => 
        prevUsers.map(user => 
            user.id === currentUser.id ? fullUpdate(user) : user
        )
    );

    setCurrentUser(prevCurrentUser => {
        if (!prevCurrentUser) return null;
        const updatedUser = fullUpdate(prevCurrentUser);
        if (typeof updatedUser.name === 'undefined') {
            updatedUser.name = '';
        }
        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword as User;
    });
  };

  const addWithdrawalAccount = (accountDetails: Omit<WithdrawalAccount, 'id' | 'status' | 'rejectionReason' | 'verificationAmount' | 'verificationAttempts'>): { success: boolean, message: string } => {
    if (!currentUser) return { success: false, message: "No user logged in." };
    
    const newAccount: WithdrawalAccount = {
        ...accountDetails,
        id: `${Date.now()}-${Math.random()}`,
        status: 'pending',
        verificationAttempts: 0,
    };

    updateUser({
        bankAccounts: [...(currentUser.bankAccounts || []), newAccount]
    });
    
    return { success: true, message: "Withdrawal account submitted. Admin will initiate verification process." };
  };

  const removeWithdrawalAccount = (accountId: string) => {
    if (!currentUser) return;
    
    const updatedBankAccounts = (currentUser.bankAccounts || []).filter(
      (account) => account.id !== accountId
    );

    updateUser({ bankAccounts: updatedBankAccounts });
  };

  const handleBankAccountVerification = (userId: number, accountId: string, status: 'verified' | 'rejected'): { success: boolean, message: string } => {
      let message = '';
      setUsers(prevUsers => prevUsers.map(user => {
          if (user.id === userId) {
              const updatedAccounts = (user.bankAccounts || []).map(acc => {
                  if (acc.id === accountId) {
                      if (status === 'verified') {
                          message = 'Account manually approved.';
                          return { ...acc, status: 'verified', rejectionReason: undefined };
                      } else {
                          message = 'Account has been rejected.';
                          return { ...acc, status: 'rejected', rejectionReason: 'Account was rejected by admin.' };
                      }
                  }
                  return acc;
              });
              return { ...user, bankAccounts: updatedAccounts };
          }
          return user;
      }));
      return { success: true, message };
  };

  const adminInitiateVerification = (userId: number, accountId: string, amount: number): { success: boolean, message: string } => {
    let success = false;
    let message = 'User or account not found.';

    setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === userId) {
            const updatedAccounts = (user.bankAccounts || []).map(acc => {
                if (acc.id === accountId && acc.status === 'pending') {
                    success = true;
                    message = `Verification initiated. User must now confirm ₹${amount.toFixed(2)}.`;
                    return { ...acc, status: 'awaiting_verification', verificationAmount: amount, verificationAttempts: 0 };
                }
                return acc;
            });
            return { ...user, bankAccounts: updatedAccounts };
        }
        return user;
    }));

    return { success, message };
  };

  const userSubmitVerificationAmount = (accountId: string, amount: number): { success: boolean, message: string } => {
    if (!currentUser) return { success: false, message: "No user logged in." };

    let success = false;
    let message = 'Verification failed. Please try again.';

    const userAccount = currentUser.bankAccounts?.find(acc => acc.id === accountId);

    if (!userAccount || userAccount.status !== 'awaiting_verification' || !userAccount.verificationAmount) {
        return { success: false, message: 'This account is not awaiting verification.' };
    }

    if (userAccount.verificationAmount === amount) {
        success = true;
        message = 'Bank account successfully verified!';
        updateUser({
            bankAccounts: currentUser.bankAccounts?.map(acc => 
                acc.id === accountId ? { ...acc, status: 'verified', rejectionReason: undefined } : acc
            )
        });
    } else {
        const newAttempts = (userAccount.verificationAttempts || 0) + 1;
        message = `Incorrect amount. You have ${3 - newAttempts} attempt(s) left.`;

        if (newAttempts >= 3) {
            message = 'Too many incorrect attempts. Your bank account has been rejected. Please add it again or contact support.';
            updateUser({
                bankAccounts: currentUser.bankAccounts?.map(acc => 
                    acc.id === accountId ? { ...acc, status: 'rejected', rejectionReason: 'Too many incorrect verification attempts.' } : acc
                )
            });
        } else {
             updateUser({
                bankAccounts: currentUser.bankAccounts?.map(acc => 
                    acc.id === accountId ? { ...acc, verificationAttempts: newAttempts } : acc
                )
            });
        }
    }

    return { success, message };
  };

  const forgotPassword = (email: string): string | null => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user?.password || null;
  };

  const addTradeToHistory = useCallback((trade: CompletedTrade) => {
    setTradeHistory(currentHistory => {
        const allHistory = [trade, ...currentHistory];
        const uniqueHistoryMap = new Map<string, CompletedTrade>();
        allHistory.forEach(t => {
            if (!uniqueHistoryMap.has(t.id)) {
                uniqueHistoryMap.set(t.id, t);
            }
        });
        const newHistory = Array.from(uniqueHistoryMap.values()).sort((a,b) => b.closeTime - a.closeTime);
        setLocalStorageItem('tradeHistory', newHistory);
        return newHistory;
    });
  }, []);
  
  const updateUserBalance = useCallback((userId: number, amount: number, accountType: 'real' | 'demo') => {
    const balanceKey = accountType === 'real' ? `realBalance_${userId}` : `demoBalance_${userId}`;

    setUserBalances(prev => {
        const currentBalance = prev[userId]?.[accountType] ?? (accountType === 'real' ? 0 : 10000);
        const newBalance = currentBalance + amount;
        
        setLocalStorageItem(balanceKey, newBalance);

        return {
            ...prev,
            [userId]: {
                ...(prev[userId] || { real: 0, demo: 0 }),
                [accountType]: newBalance
            }
        };
    });
  }, []);

  const giveReward = (userId: number, amount: number) => {
    if (amount <= 0) return;
    updateUserBalance(userId, amount, 'real');
  };

  const deductBalance = (userId: number, amount: number) => {
    if (amount <= 0) return;
    const currentBalance = userBalances[userId]?.real ?? 0;

    if (amount > currentBalance) {
        console.error("Cannot deduct more than the current balance.");
        return;
    }
    updateUserBalance(userId, -amount, 'real');
  };

  const adminUpdateUser = (userId: number, updates: Partial<User>): { success: boolean; message: string } => {
    if (updates.email) {
      const emailLower = updates.email.toLowerCase();
      const emailExists = users.some(u => u.email.toLowerCase() === emailLower && u.id !== userId);
      if (emailExists) {
        return { success: false, message: 'Email is already in use by another account.' };
      }
    }

    setUsers(prevUsers =>
      prevUsers.map(user => {
        if (user.id === userId) {
          const updatedUser = { ...user, ...updates };
          if (updates.password === '') {
            delete updatedUser.password;
          }
          return updatedUser;
        }
        return user;
      })
    );

    if (currentUser && currentUser.id === userId) {
        setCurrentUser(prev => {
            if (!prev) return null;
            const updatedSelf = { ...prev, ...updates };
            const { password, ...userWithoutPassword } = updatedSelf;
            return userWithoutPassword as User;
        })
    }
    
    return { success: true, message: 'User updated successfully.' };
  };

  const toggleUserBlockStatus = (userId: number) => {
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId ? { ...user, isBlocked: !user.isBlocked } : user
      )
    );
  };

  const updateAsset = (assetName: string, newPayout: number) => {
    setAssets(prevAssets =>
      prevAssets.map(asset =>
        asset.name === assetName ? { ...asset, payout: newPayout } : asset
      )
    );
    if (selectedAsset.name === assetName) {
        setSelectedAsset(prev => ({...prev, payout: newPayout}));
    }
  };


  const handleDepositRequest = (amount: number, utr: string) => {
    if (!currentUser) return;
    const newTransaction: Transaction = {
        id: Date.now() + Math.random(),
        userId: currentUser.id,
        type: 'deposit',
        amount,
        status: 'Pending',
        date: Date.now(),
        utr: utr
    };
    setTransactions(prev => [newTransaction, ...prev].sort((a,b) => b.date - a.date));
  };

  const handleWithdrawalRequest = (amount: number, withdrawalAccountId: string) => {
    if (!currentUser) return;
    const realBalance = userBalances[currentUser.id]?.real ?? 0;
  
    if (realBalance < amount) {
        toast({
            variant: "destructive",
            title: "Insufficient Funds",
            description: "You cannot withdraw more than your available real balance.",
        });
        return;
    }
  
    const account = currentUser.bankAccounts?.find(acc => acc.id === withdrawalAccountId);
    if (!account || account.status !== 'verified') {
        toast({
            variant: "destructive",
            title: "Invalid Account",
            description: "Please select a valid, verified withdrawal account.",
        });
        return;
    }
  
    const newTransaction: Transaction = {
        id: Date.now() + Math.random(),
        userId: currentUser.id,
        type: 'withdrawal',
        amount,
        status: 'Pending',
        date: Date.now(),
        withdrawalAccountId: withdrawalAccountId,
        accountNumber: account.accountNumber,
        ifscCode: account.ifscCode,
        upiId: account.upiId,
    };
    setTransactions(prev => [newTransaction, ...prev].sort((a, b) => b.date - a.date));
  };
  
  const handleTransactionApproval = (transactionId: number, newStatus: 'Approved' | 'Rejected') => {
    let transaction = transactions.find(t => t.id === transactionId);
    if (!transaction || transaction.status !== 'Pending') return;
  
    let rejectionReason: string | undefined = undefined;
    let finalStatus = newStatus;

    if (finalStatus === 'Approved' && transaction.type === 'deposit' && transaction.utr) {
        const isDuplicateUtr = transactions.some(
            t => t.id !== transaction.id && t.type === 'deposit' && t.status === 'Approved' && t.utr && t.utr === transaction.utr
        );

        if (isDuplicateUtr) {
            finalStatus = 'Rejected';
            rejectionReason = "Duplicate UTR code. This transaction ID has already been used for a previous deposit.";
            toast({ variant: 'destructive', title: 'Action Failed', description: rejectionReason });
        }
    }

    if (finalStatus === 'Approved') {
        const currentBalance = userBalances[transaction.userId]?.real ?? 0;

        if (transaction.type === 'deposit') {
            updateUserBalance(transaction.userId, transaction.amount, 'real');
            
            const depositor = users.find(u => u.id === transaction.userId);
            if (depositor && depositor.referrerId) {
                const commission = transaction.amount * (referralPercentage / 100); 
                updateUserBalance(depositor.referrerId, commission, 'real');
                if (currentUser?.id === depositor.referrerId) {
                     toast({
                        title: "Referral Bonus!",
                        description: `You earned ₹${commission.toFixed(2)} from ${depositor.name}'s deposit!`,
                        className: "bg-accent text-accent-foreground border-accent"
                    });
                }
            }

        } else { // Withdrawal
            if (currentBalance >= transaction.amount) {
                updateUserBalance(transaction.userId, -transaction.amount, 'real');
            } else {
                finalStatus = 'Rejected';
                rejectionReason = "User has insufficient funds for this withdrawal.";
                toast({ variant: 'destructive', title: 'Action Failed', description: rejectionReason });
            }
        }
    } else if (finalStatus === 'Rejected' && !rejectionReason) {
        rejectionReason = "Something went wrong, please try again later. If the error repeats, please contact the payment provider or our support service.";
    }
    
    setTransactions(prev => 
        prev.map(t => t.id === transactionId ? { ...t, status: finalStatus, rejectionReason } : t)
          .sort((a, b) => b.date - a.date)
    );

    if (finalStatus === 'Rejected' && transaction.userId === currentUser?.id && currentUser?.role !== 'admin') {
        toast({
            variant: "destructive",
            title: `Transaction Rejected`,
            description: rejectionReason,
        });
    }
};


  const getBadgeVariant = (status: Transaction['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Approved':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  const closeTrade = useCallback((tradeToClose: ActiveTrade) => {
    const tradeAsset = assets.find((a: Asset) => a.name === tradeToClose.assetName);
    if (!tradeAsset) return;

    const granularData = allGranularDataRef.current[tradeToClose.assetName];
    if (!granularData || granularData.length === 0) return;

    const price = granularData[granularData.length - 1]?.close;
    if (price === undefined) return;

    const outcomePrice = price;
    let profit = 0;
    let outcome: CompletedTrade['outcome'] = 'tie';

    if (tradeToClose.type === 'buy' && outcomePrice > tradeToClose.entryPrice) {
        outcome = 'win';
        profit = tradeToClose.amount * (tradeAsset.payout / 100);
    } else if (tradeToClose.type === 'sell' && outcomePrice < tradeToClose.entryPrice) {
        outcome = 'win';
        profit = tradeToClose.amount * (tradeAsset.payout / 100);
    } else if (Math.abs(outcomePrice - tradeToClose.entryPrice) > 0.00001) {
        outcome = 'loss';
        profit = -tradeToClose.amount;
    }

    // Refund original amount + profit
    updateUserBalance(tradeToClose.userId, tradeToClose.amount + profit, tradeToClose.account);

    if (currentUser?.id === tradeToClose.userId) {
        let toastInfo: ToastInfo | null = null;
        if (outcome === 'win') {
            toastInfo = { title: "Trade Won", description: `You won ₹${profit.toFixed(2)}`, className: "bg-accent text-accent-foreground border-accent" };
        } else if (outcome === 'loss') {
            toastInfo = { variant: "destructive", title: "Trade Lost", description: `You lost ₹${tradeToClose.amount.toFixed(2)}` };
        } else {
            toastInfo = { title: "Trade Tie", description: `Your amount of ₹${tradeToClose.amount.toFixed(2)} was refunded.` };
        }
        if (toastInfo) setLastToast(toastInfo);
    }

    const completedTrade: CompletedTrade = { ...tradeToClose, closeTime: Date.now(), closePrice: outcomePrice, outcome, profit: profit };
    addTradeToHistory(completedTrade);

    setAllActiveTrades(prev => prev.filter(t => t.id !== tradeToClose.id));
    
  }, [currentUser, assets, addTradeToHistory, updateUserBalance, toast]);

  const handleTrade = (type: 'buy' | 'sell', amount: number, time: number, accountType: 'demo' | 'real', currentPrice: number) => {
    if (!currentUser) return;
    
    // Deduct amount for the trade
    updateUserBalance(currentUser.id, -amount, accountType);

    const newTrade: ActiveTrade = {
        id: `${Date.now()}-${Math.random()}`,
        assetName: selectedAsset.name,
        entryPrice: currentPrice,
        entryTime: Date.now(),
        expiryTime: Date.now() + time * 1000,
        type,
        amount,
        account: accountType,
        userId: currentUser.id,
    };

    setAllActiveTrades(prev => [...prev, newTrade]);
  };

  const sendMessage = (receiverId: number, text: string, file?: File) => {
      if (!currentUser) return;

      const message: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          senderId: currentUser.id,
          text: text,
          timestamp: Date.now(),
      };

      if (file) {
          message.fileName = file.name;
          message.fileType = file.type;
          message.fileURL = URL.createObjectURL(file);
      }

      const threadId = currentUser.role === 'admin' ? receiverId : currentUser.id;
      
      setSupportThreads(prev => {
          const newThreads = { ...prev };
          if (!newThreads[threadId]) {
              newThreads[threadId] = [];
          }
          newThreads[threadId].push(message);
          return newThreads;
      });
  };
  
  // Effect for handling chart data simulation
  useEffect(() => {
    if (!isMounted) return;
  
    const dataInterval = setInterval(() => {
      setAllGranularData(prevAllData => {
        const newAllData = {...prevAllData};
        
        assets.forEach(asset => {
            const prevData = newAllData[asset.name] || [];
            if (prevData.length === 0) return;

            const lastPoint = prevData[prevData.length - 1];
            const newPrice = lastPoint.close + (Math.random() - 0.5) * asset.volatility;
    
            const newDataPoint: DataPoint = {
              time: Date.now(),
              price: lastPoint.close,
              open: lastPoint.close,
              high: Math.max(lastPoint.close, newPrice),
              low: Math.min(lastPoint.close, newPrice),
              close: newPrice,
            };
            
            const newDataArray = [...prevData, newDataPoint];
            if (newDataArray.length > MAX_GRANULAR_TICKS) {
                newAllData[asset.name] = newDataArray.slice(newDataArray.length - MAX_GRANULAR_TICKS);
            } else {
                newAllData[asset.name] = newDataArray;
            }
        });
        
        return newAllData;
      });
    }, 250);
  
    return () => clearInterval(dataInterval);
  }, [isMounted, assets]);

  // Effect for aggregating data based on timeframe
  useEffect(() => {
    const granularData = allGranularData[selectedAsset.name];
    if (!granularData || granularData.length === 0) {
        setData([]);
        return;
    };

    const timeframeMs = chartTimeframe * 1000;
    const lastPoint = granularData[granularData.length - 1];
    if (!lastPoint) return;

    const endTime = lastPoint.time;
    const startTime = endTime - (POINTS_TO_STORE * timeframeMs) * 1.5; // Look back further

    const relevantData = granularData.filter(p => p.time >= startTime);
    
    const candleMap = new Map<number, DataPoint[]>();
    for (const point of relevantData) {
        const candleTime = Math.floor(point.time / timeframeMs) * timeframeMs;
        if (!candleMap.has(candleTime)) {
            candleMap.set(candleTime, []);
        }
        candleMap.get(candleTime)!.push(point);
    }

    const candles: DataPoint[] = [];
    candleMap.forEach((points, time) => {
        if (points.length > 0) {
            const candle = {
                time: time,
                open: points[0].open,
                high: Math.max(...points.map(p => p.high)),
                low: Math.min(...points.map(p => p.low)),
                close: points[points.length - 1].close,
                price: points[0].open, // for area chart compatibility
            };
            candles.push(candle);
        }
    });

    candles.sort((a, b) => a.time - b.time);
    
    if (candles.length > 0) {
        const liveCandleIndex = candles.length - 1;
        const liveCandle = candles[liveCandleIndex];
        const livePoints = candleMap.get(liveCandle.time) || [];

        if (livePoints.length > 0) {
            candles[liveCandleIndex] = {
                ...liveCandle,
                high: Math.max(...livePoints.map(p => p.high), lastPoint.high),
                low: Math.min(...livePoints.map(p => p.low), lastPoint.low),
                close: lastPoint.close,
            };
        }
    }
    
    const finalCandles = candles.slice(-POINTS_TO_STORE);
    
    setData(finalCandles);

  }, [allGranularData, selectedAsset, chartTimeframe]);


  // Effect for handling trade closures
  useEffect(() => {
    if (!isMounted) return;
  
    const tradeCheckInterval = setInterval(() => {
      const now = Date.now();
      const tradesToClose = allActiveTrades.filter((trade: ActiveTrade) => now >= trade.expiryTime);
      
      if (tradesToClose.length > 0) {
        tradesToClose.forEach((trade: ActiveTrade) => {
          closeTrade(trade);
        });
      }
    }, 500);
  
    return () => clearInterval(tradeCheckInterval);
  }, [isMounted, allActiveTrades, closeTrade]);


  const value: AppContextType = {
    currentUser,
    users,
    login,
    signup,
    logout,
    updateUser,
    forgotPassword,
    giveReward,
    deductBalance,
    adminUpdateUser,
    toggleUserBlockStatus,
    demoBalance,
    setDemoBalance,
    transactions,
    tradeHistory,
    addTradeToHistory,
    handleDepositRequest,
    handleWithdrawalRequest,
    handleTransactionApproval,
    getBadgeVariant,
    upiId,
    setUpiId,
    isUpiDepositEnabled,
    toggleUpiDeposit,
    depositInfo,
    setDepositInfo,
    contactEmail,
    setContactEmail,
    contactInfo,
    setContactInfo,
    referralPercentage,
    setReferralPercentage,
    termsAndConditions,
    setTermsAndConditions,
    policy,
    setPolicy,
    assets,
    updateAsset,
    selectedAsset,
    setSelectedAsset,
    data,
    chartTimeframe,
    setChartTimeframe,
    activeTrades: allActiveTrades,
    handleTrade,
    userBalances,
    minDeposit,
    setMinDeposit,
    maxDeposit,
    setMaxDeposit,
    minWithdrawal,
    setMinWithdrawal,
    maxWithdrawal,
    setMaxWithdrawal,
    supportThreads,
    sendMessage,
    addWithdrawalAccount,
    removeWithdrawalAccount,
    handleBankAccountVerification,
    adminInitiateVerification,
    userSubmitVerificationAmount,
  };

  if (!isMounted) {
    return null;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

    
    