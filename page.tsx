
"use client";

import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import Link from 'next/link';
import Image from "next/image";
import { AreaChart, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Area, Scatter } from "recharts";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wallet, ChevronDown, Bitcoin, Minus, Plus, ArrowUp, ArrowDown, CandlestickChart as CandlestickIcon, AreaChart as AreaChartIcon, Copy, History, Shield, LogOut, User as UserIcon, Info, Phone, Euro, MessageSquare, AlertTriangle, CheckCircle, Banknote, Timer, Clock, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AppContext, Asset, CompletedTrade, Transaction, DataPoint, ActiveTrade } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ChartType = 'area' | 'candlestick';

const CustomCandle = (props: any) => {
    const { cx, cy, yAxis, payload } = props;
    if (cx === undefined || cy === undefined) return null;
    
    const { open, close, high, low } = payload;
    const isGrowing = close > open;
    const color = isGrowing ? 'hsl(var(--accent))' : 'hsl(var(--destructive))';
    
    const yOpen = yAxis.scale(open);
    const yClose = yAxis.scale(close);
    const yHigh = yAxis.scale(high);
    const yLow = yAxis.scale(low);

    const bodyHeight = Math.abs(yOpen - yClose);
    const bodyY = Math.min(yOpen, yClose);
    
    return (
        <g>
            <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
            <rect x={cx - 2} y={bodyY} width={4} height={bodyHeight > 0 ? bodyHeight : 1} fill={color} />
        </g>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isGrowing = data.close > data.open;
    const colorClass = isGrowing ? 'text-accent' : 'text-destructive';
    
    return (
      <div className="p-2 bg-card/80 border border-border rounded-md text-xs shadow-lg backdrop-blur-sm">
        <p className={colorClass}>O: <span className="font-mono">{data.open.toFixed(4)}</span></p>
        <p className={colorClass}>H: <span className="font-mono">{data.high.toFixed(4)}</span></p>
        <p className={colorClass}>L: <span className="font-mono">{data.low.toFixed(4)}</span></p>
        <p className={colorClass}>C: <span className="font-mono">{data.close.toFixed(4)}</span></p>
      </div>
    );
  }
  return null;
};

const CustomYAxisTick = ({ y, payload, x, width }: any) => {
  const fill = '#888';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={width - 10} y={0} dy={4} textAnchor="end" fill={fill} fontSize={12} fontWeight={'normal'}>
        {payload.value.toFixed(4)}
      </text>
    </g>
  );
};

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
};

const CurrentPriceLabel = ({viewBox, value, color}: any) => {
  const { y, width } = viewBox;
  return (
    <g>
      <foreignObject x={width} y={y - 12} width="80" height="24" style={{ overflow: 'visible' }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{
            backgroundColor: color,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'inline-block',
            transform: 'translateX(8px)',
          }}
        >
          {value.toFixed(4)}
        </div>
      </foreignObject>
    </g>
  );
};

const TradeAmountLabel = ({viewBox, value, tradeType, tradeAmount}: any) => {
  const { x, y, width } = viewBox;
  const color = tradeType === 'buy' ? 'hsl(var(--accent))' : 'hsl(var(--destructive))';
  return (
    <g>
      <foreignObject x={x + 10} y={y - 10} width="100" height="20" style={{ overflow: 'visible' }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{
            backgroundColor: 'hsl(var(--card))',
            color: color,
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
        >
          ₹{tradeAmount.toFixed(2)}
        </div>
      </foreignObject>
    </g>
  );
};

const timeframes = [
    { value: 1, label: "1s" },
    { value: 5, label: "5s" },
    { value: 15, label: "15s" },
    { value: 60, label: "1m" },
];

const MIN_POINTS_TO_SHOW = 20;
const MAX_POINTS_TO_SHOW = 150;
const INITIAL_POINTS_TO_SHOW = 70;

export default function TradePage() {
  const context = useContext(AppContext);
  if (!context) {
    return <div>Loading...</div>; 
  }

  const {
    currentUser,
    logout,
    demoBalance,
    transactions,
    tradeHistory,
    handleDepositRequest,
    handleWithdrawalRequest,
    setDemoBalance,
    getBadgeVariant,
    upiId: depositUpiId,
    depositInfo,
    assets,
    selectedAsset,
    setSelectedAsset,
    data,
    activeTrades,
    handleTrade,
    userBalances,
    minDeposit,
    maxDeposit,
    minWithdrawal,
    maxWithdrawal,
    isUpiDepositEnabled,
    chartTimeframe,
    setChartTimeframe,
  } = context;

  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [tradeAmount, setTradeAmount] = useState<number | string>(100);
  const [tradeTime, setTradeTime] = useState<number | string>(15);
  const [footerTimer, setFooterTimer] = useState(Number(tradeTime));
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  
  const [depositAmount, setDepositAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');

  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedWithdrawalAccount, setSelectedWithdrawalAccount] = useState('');

  const { toast } = useToast();
  
  const [pointsToShow, setPointsToShow] = useState(INITIAL_POINTS_TO_SHOW);
  const [dataWindow, setDataWindow] = useState({ start: 0, end: pointsToShow });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, start: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const realBalance = useMemo(() => {
    if (currentUser && userBalances && userBalances[currentUser.id]) {
      return userBalances[currentUser.id].real;
    }
    return 0;
  }, [userBalances, currentUser]);

  const balance = accountType === 'demo' ? demoBalance : realBalance;

  useEffect(() => {
      const start = Math.max(0, data.length - pointsToShow);
      setDataWindow({ start, end: start + pointsToShow });
  }, [data.length, selectedAsset, pointsToShow]);
  
  const chartData = useMemo(() => {
    return data.slice(dataWindow.start, dataWindow.end);
  }, [data, dataWindow]);

  const currentPrice = useMemo(() => data.length > 0 ? data[data.length - 1].close : 0, [data]);
  
  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    isPanning.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    panStart.current = { x: clientX, start: dataWindow.start };
    if (chartContainerRef.current) {
        chartContainerRef.current.style.cursor = 'grabbing';
    }
  };
  
  const handlePanMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isPanning.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dx = clientX - panStart.current.x;
      if (chartContainerRef.current) {
          const candlesToMove = Math.round(dx / (chartContainerRef.current.clientWidth / pointsToShow));
          
          let newStart = panStart.current.start - candlesToMove;
          if (newStart < 0) newStart = 0;
    
          const maxStart = data.length - pointsToShow;
          if (newStart > maxStart) newStart = maxStart;
    
          setDataWindow({ start: newStart, end: newStart + pointsToShow });
      }
  };

  const handlePanEnd = () => {
    isPanning.current = false;
    if (chartContainerRef.current) {
        chartContainerRef.current.style.cursor = 'grab';
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
      setPointsToShow(prev => {
          let newPoints = direction === 'in' ? Math.round(prev * 0.8) : Math.round(prev * 1.2);
          if (newPoints < MIN_POINTS_TO_SHOW) newPoints = MIN_POINTS_TO_SHOW;
          if (newPoints > MAX_POINTS_TO_SHOW) newPoints = MAX_POINTS_TO_SHOW;
          return newPoints;
      });
  };

  const verifiedBankAccounts = useMemo(() => {
    return currentUser?.bankAccounts?.filter(acc => acc.status === 'verified') || [];
  }, [currentUser?.bankAccounts]);


  useEffect(() => {
    const timerInterval = setInterval(() => {
      const tradesForCurrentAccount = activeTrades.filter(t => t.account === accountType);
      
      if (tradesForCurrentAccount.length > 0) {
        const now = Date.now();
        const soonestExpiry = Math.min(...tradesForCurrentAccount.map(t => t.expiryTime));
        const timeLeft = Math.round((soonestExpiry - now) / 1000);
        setFooterTimer(timeLeft > 0 ? timeLeft : 0);
      } else {
        setFooterTimer(Number(tradeTime) || 0);
      }
    }, 250);

    return () => clearInterval(timerInterval);
  }, [activeTrades, accountType, tradeTime]);


  const onTrade = (type: 'buy' | 'sell') => {
    const amount = Number(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Please enter a positive number to trade." });
      return;
    }
    
    const time = Number(tradeTime);
    if (isNaN(time) || time < 5) {
      toast({ variant: "destructive", title: "Invalid time", description: "Minimum trade time is 5 seconds." });
      return;
    }

    if (balance < amount) {
        toast({ variant: "destructive", title: "Insufficient funds", description: "You do not have enough balance to make this trade." });
        return;
    }
    
    const livePrice = data.length > 0 ? data[data.length - 1].close : 0;
    if (livePrice === 0) {
        toast({ variant: "destructive", title: "Price Error", description: "Could not get the current price. Please try again." });
        return;
    }

    handleTrade(type, amount, time, accountType, livePrice);
  }
  
  const earnings = (Number(tradeAmount) || 0) * (selectedAsset.payout / 100);
  const handleTimeChange = (increment: number) => setTradeTime(prevTime => Math.max(5, (Number(prevTime) || 0) + increment));
  const handleCustomTimeChange = (value: string) => setTradeTime(value.replace(/[^0-9]/g, ''));
  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setTradeAmount(value);
    }
  };
  const incrementAmount = (increment: number) => setTradeAmount(v => Math.max(0.01, (Number(v) || 0) + increment));
  
  const gradientStops = useMemo(() => {
    if (chartData.length < 2) return [];
    const stops = [];
    for (let i = 1; i < chartData.length; i++) {
        const prev = chartData[i-1];
        const curr = chartData[i];
        const color = curr.close >= prev.close ? 'hsl(var(--accent))' : 'hsl(var(--destructive))';
        stops.push(<stop key={`stop-prev-${i}`} offset={`${((i-1)/(chartData.length-1)) * 100}%`} stopColor={color} />);
        stops.push(<stop key={`stop-curr-${i}`} offset={`${(i/(chartData.length-1)) * 100}%`} stopColor={color} />);
    }
    return stops;
  }, [chartData]);

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    toast({ title: "Copied!", description: "The text has been copied to your clipboard." });
  };
  
  const handleDeposit = () => {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount to deposit.' });
        return;
      }
      if (amount < minDeposit) {
        toast({ variant: 'destructive', title: 'Deposit Too Low', description: `The minimum deposit amount is ₹${minDeposit}.` });
        return;
      }
      if (amount > maxDeposit) {
        toast({ variant: 'destructive', title: 'Deposit Too High', description: `The maximum deposit amount is ₹${maxDeposit}.` });
        return;
      }
      if (!utrNumber.trim()) {
        toast({ variant: 'destructive', title: 'UTR Required', description: 'Please enter the UTR number to confirm payment.' });
        return;
      }

      handleDepositRequest(amount, utrNumber);

      toast({
        title: 'Deposit Request Submitted',
        description: `Your request to deposit ₹${amount.toFixed(2)} is pending approval.`,
      });
      setDepositAmount('');
      setUtrNumber('');
  }

  const handleWithdrawal = () => {
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount to withdraw.' });
      return;
    }
    if (amount < minWithdrawal) {
      toast({ variant: 'destructive', title: 'Withdrawal Too Low', description: `The minimum withdrawal amount is ₹${minWithdrawal}.` });
      return;
    }
    if (amount > maxWithdrawal) {
      toast({ variant: 'destructive', title: 'Withdrawal Too High', description: `The maximum withdrawal amount is ₹${maxWithdrawal}.` });
      return;
    }
    if (amount > realBalance) {
      toast({ variant: 'destructive', title: 'Insufficient Funds', description: 'You cannot withdraw more than your available balance.' });
      return;
    }
    if (!selectedWithdrawalAccount) {
      toast({ variant: 'destructive', title: 'Account Not Selected', description: 'Please select a verified bank account for withdrawal.' });
      return;
    }
    
    handleWithdrawalRequest(amount, selectedWithdrawalAccount);

    toast({
      title: 'Withdrawal Request Submitted',
      description: `Your request to withdraw ₹${amount.toFixed(2)} is pending approval.`,
    });
    setWithdrawalAmount('');
    setSelectedWithdrawalAccount('');
  };
  
  const userTransactions = useMemo(() => {
    if (!currentUser) return [];
    return transactions.filter(t => t.userId === currentUser.id);
  }, [transactions, currentUser]);

  const userTradeHistory = useMemo(() => {
      if (!currentUser) return [];
      return tradeHistory.filter(t => t.userId === currentUser.id);
  }, [tradeHistory, currentUser]);
  
  const userActiveTrades = useMemo(() => {
    if (!currentUser) return [];
    return activeTrades.filter(t => t.userId === currentUser.id);
  }, [activeTrades, currentUser]);
  
  const combinedTradeHistory = useMemo(() => {
    const active = userActiveTrades.map(t => ({...t, isOpen: true}));
    const completed = userTradeHistory.map(t => ({...t, isOpen: false}));
    return [...active, ...completed].sort((a,b) => b.entryTime - a.entryTime);
  }, [userActiveTrades, userTradeHistory]);

  const replenishDemoAccount = () => {
    if (currentUser) {
        setDemoBalance(prev => prev + 10000);
        toast({
            title: "Demo Account Replenished",
            description: "₹10,000 has been added to your demo balance.",
            className: "bg-accent text-accent-foreground border-accent"
        });
    }
  };
  
  const renderChart = () => {
    const activeAccountTrades = activeTrades.filter(t => t.account === accountType && t.assetName === selectedAsset.name);

    const tradeLines = activeAccountTrades.map(trade => (
        <ReferenceLine 
            key={trade.id} 
            y={trade.entryPrice} 
            stroke={trade.type === 'buy' ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'}
            strokeDasharray="4 4" 
            ifOverflow="extendDomain" 
            label={<TradeAmountLabel tradeType={trade.type} tradeAmount={trade.amount} />}
        />
    ));

    const currentPricePoint = currentPrice;

    const currentPriceLine = currentPricePoint !== null && (
      <ReferenceLine 
        y={currentPricePoint} 
        stroke={selectedAsset.color} 
        strokeWidth={1}
        ifOverflow="extendDomain"
        label={<CurrentPriceLabel value={currentPricePoint} color={selectedAsset.color} />}
      />
    );
    
    const yDomain = useMemo(() => {
        if (!chartData || chartData.length === 0) return [0, 1];
        const visibleData = chartData;
        const prices = visibleData.flatMap(d => [d.high, d.low]);
        
        const activeTradePrices = activeTrades
            .filter(t => t.account === accountType && t.assetName === selectedAsset.name)
            .map(t => t.entryPrice);

        if (currentPricePoint !== null) {
          prices.push(currentPricePoint);
        }
        prices.push(...activeTradePrices);

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = (max - min) * 0.2;
        return [min - padding, max + padding];
    }, [chartData, activeTrades, accountType, currentPricePoint, selectedAsset.name]);


    switch (chartType) {
        case 'area':
            return (
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedAsset.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={selectedAsset.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 4" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <YAxis 
                    orientation="right" 
                    domain={yDomain}
                    tick={<CustomYAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <XAxis dataKey="time" hide />
                  <Area type="linear" dataKey="price" stroke={selectedAsset.color} strokeWidth={2} fill="url(#colorPrice)" dot={false} isAnimationActive={false} />
                  {currentPriceLine}
                  {tradeLines}
                </AreaChart>
            );
        case 'candlestick':
            return (
                <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="1 4" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                    <YAxis 
                        orientation="right" 
                        domain={yDomain}
                        tick={<CustomYAxisTick />}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        dataKey="close"
                    />
                    <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />

                    <Scatter dataKey="close" shape={<CustomCandle />} isAnimationActive={false} />

                    {currentPriceLine}
                    {tradeLines}
                </ComposedChart>
            );
        default:
            return null;
    }
  };


  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <header className="flex items-center justify-between p-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
            {currentUser?.role === 'admin' && (
                <Link href="/admin" passHref>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                    </Button>
                </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="text-center cursor-pointer">
                    <div className="text-xs text-muted-foreground flex items-center justify-center">
                      {accountType === 'demo' ? 'Demo account' : 'Real account'}
                      <ChevronDown size={14}/>
                    </div>
                    <div className="font-bold text-sm">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border text-popover-foreground">
                <DropdownMenuItem onSelect={() => setAccountType('demo')} className="hover:!bg-accent/50 focus:bg-accent/50">
                  Demo account
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAccountType('real')} className="hover:!bg-accent/50 focus:bg-accent/50">
                  Real account
                </DropdownMenuItem>
                {accountType === 'demo' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={replenishDemoAccount} className="hover:!bg-accent/50 focus:bg-accent/50">
                        Replenish
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Wallet className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] flex flex-col h-[90vh] sm:h-auto sm:max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Wallet</DialogTitle>
                  <DialogDescription>
                    Manage your funds. Deposits and withdrawals require admin approval.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="deposit" className="w-full flex-grow flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="deposit">Deposit</TabsTrigger>
                    <TabsTrigger value="withdrawal">Withdrawal</TabsTrigger>
                  </TabsList>
                  <TabsContent value="deposit" className="flex-grow flex flex-col overflow-hidden">
                    <ScrollArea className="flex-grow pr-6 -mr-6">
                      <div className="py-4 space-y-4">
                        {isUpiDepositEnabled && (
                            <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-2">Scan to Pay via UPI</p>
                                <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${depositUpiId}&pn=Skill24&am=${depositAmount || '1'}`} alt="UPI QR Code" width={150} height={150} />
                                <div className="mt-2 text-center">
                                    <p className="text-sm font-semibold">UPI ID: {depositUpiId}</p>
                                    <Button variant="link" size="sm" onClick={() => copyToClipboard(depositUpiId)} className="h-auto p-0">
                                        <Copy className="mr-1 h-3 w-3" /> Copy ID
                                    </Button>
                                </div>
                            </div>
                        )}

                        {depositInfo && (
                          <Card className="bg-muted/50">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                <Info className="h-4 w-4" />
                                Other Payment Options
                              </div>
                              <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{depositInfo}</pre>
                              <Button variant="link" size="sm" onClick={() => copyToClipboard(depositInfo)} className="h-auto p-0 text-xs">
                                <Copy className="mr-1 h-3 w-3" /> Copy Details
                              </Button>
                            </CardContent>
                          </Card>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="deposit-amount">Amount (INR)</Label>
                            <Input id="deposit-amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={`Min: ₹${minDeposit}, Max: ₹${maxDeposit}`} className="bg-input" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="utr-number">UTR / Transaction ID</Label>
                            <Input id="utr-number" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} placeholder="12-digit transaction reference" className="bg-input"/>
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter className="mt-auto pt-4 border-t flex-shrink-0">
                      <Button onClick={handleDeposit} className="w-full">Submit Deposit Request</Button>
                    </DialogFooter>
                  </TabsContent>
                  <TabsContent value="withdrawal" className="flex-grow flex flex-col overflow-hidden">
                    <ScrollArea className="flex-grow pr-6 -mr-6">
                      <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">Your real balance: ₹{realBalance.toFixed(2)}</p>
                        <div className="space-y-2">
                            <Label htmlFor="withdrawal-amount">Amount (INR)</Label>
                            <Input id="withdrawal-amount" value={withdrawalAmount} onChange={(e) => setWithdrawalAmount(e.target.value)} placeholder={`Min: ₹${minWithdrawal}, Max: ₹${maxWithdrawal}`} className="bg-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="withdrawal-account">Withdrawal Account</Label>
                          {verifiedBankAccounts.length > 0 ? (
                            <Select value={selectedWithdrawalAccount} onValueChange={setSelectedWithdrawalAccount}>
                              <SelectTrigger id="withdrawal-account" className="w-full bg-input">
                                <SelectValue placeholder="Select a verified account" />
                              </SelectTrigger>
                              <SelectContent>
                                {verifiedBankAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    <div className="flex items-center gap-2">
                                      <Banknote className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <span>{account.accountHolderName}</span>
                                        {account.accountType === 'bank' && account.accountNumber && (
                                          <span className="text-xs text-muted-foreground ml-2">...{account.accountNumber.slice(-4)}</span>
                                        )}
                                        {account.accountType === 'upi' && account.upiId && (
                                          <span className="text-xs text-muted-foreground ml-2">{account.upiId}</span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-center text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                                <p>No verified withdrawal accounts found.</p>
                                <Link href="/profile" passHref>
                                  <Button variant="link" className="mt-1 h-auto p-0">Add an account</Button>
                                </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter className="mt-auto pt-4 border-t flex-shrink-0">
                      <Button onClick={handleWithdrawal} className="w-full" disabled={verifiedBankAccounts.length === 0}>Submit Withdrawal Request</Button>
                    </DialogFooter>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <History className="h-6 w-6" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>History</DialogTitle>
                        <DialogDescription>
                            Review your past trades and transactions.
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="trade-history">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="trade-history">Trade History</TabsTrigger>
                            <TabsTrigger value="transaction-history">Transactions</TabsTrigger>
                        </TabsList>
                        <TabsContent value="trade-history">
                           <ScrollArea className="h-[60vh] max-h-[50vh]">
                                <div className="space-y-4 p-1">
                                    {combinedTradeHistory.length > 0 ? (
                                        combinedTradeHistory.map((trade, index) => {
                                            const isCompleted = 'outcome' in trade;
                                            return (
                                                <div key={`${trade.id}-${index}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 p-3 bg-muted/50 rounded-lg text-sm">
                                                    
                                                    {trade.type === 'buy' ? <ArrowUp className="h-5 w-5 text-accent row-span-2" /> : <ArrowDown className="h-5 w-5 text-destructive row-span-2" />}

                                                    <div className="col-start-2">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold truncate">{trade.assetName}</p>
                                                            <Badge variant={trade.account === 'demo' ? 'secondary' : 'default'} className="h-5 text-xs px-1.5">{trade.account === 'demo' ? 'Demo' : 'Real'}</Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{new Date(trade.entryTime).toLocaleString()}</p>
                                                    </div>

                                                    <div className="col-start-3 row-start-1 row-span-2 text-right">
                                                        {isCompleted ? (
                                                            <>
                                                                <p className={`font-bold ${trade.outcome === 'win' ? 'text-accent' : trade.outcome === 'loss' ? 'text-destructive' : ''}`}>
                                                                    {trade.outcome === 'win' ? '+' : ''}₹{trade.profit.toFixed(2)}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground font-mono">
                                                                    {trade.entryPrice.toFixed(4)} → {trade.closePrice.toFixed(4)}
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Badge variant="secondary">Pending</Badge>
                                                                <p className="text-xs text-muted-foreground mt-1 font-mono">
                                                                    Entry: {trade.entryPrice.toFixed(4)}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-center text-muted-foreground py-10">No trade history yet.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="transaction-history">
                            <ScrollArea className="h-[60vh] max-h-[50vh]">
                              {userTransactions.length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                  {userTransactions.map((t: Transaction) => (
                                    <AccordionItem value={`item-${t.id}`} key={t.id}>
                                      <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full">
                                            <div className="text-left">
                                                <p className="font-bold capitalize">{t.type} Request</p>
                                                <p className="text-sm text-muted-foreground">₹{t.amount.toFixed(2)}</p>
                                            </div>
                                            <Badge variant={getBadgeVariant(t.status)} className="ml-4 flex-shrink-0">{t.status}</Badge>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="space-y-4 px-1">
                                          <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Date:</span>
                                            <span>{new Date(t.date).toLocaleString()}</span>
                                          </div>
                                          {t.utr && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-muted-foreground">UTR:</span>
                                              <span className="font-mono">{t.utr}</span>
                                            </div>
                                          )}
                                          {t.accountNumber && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-muted-foreground">Account No:</span>
                                              <span className="font-mono">{t.accountNumber}</span>
                                            </div>
                                          )}
                                           {t.ifscCode && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-muted-foreground">IFSC:</span>
                                              <span className="font-mono">{t.ifscCode}</span>
                                            </div>
                                          )}
                                          {t.upiId && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-muted-foreground">UPI ID:</span>
                                              <span className="font-mono">{t.upiId}</span>
                                            </div>
                                          )}
                                          <Separator />
                                          <div className="flex justify-between text-sm font-bold">
                                            <span className="text-muted-foreground">Total:</span>
                                            <span>₹{t.amount.toFixed(2)}</span>
                                          </div>
                                           {t.status === 'Approved' && (
                                            <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-md text-accent text-sm flex items-start gap-3">
                                               <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                               <p>Transaction completed successfully.</p>
                                            </div>
                                          )}
                                          {t.status === 'Rejected' && t.rejectionReason && (
                                            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-start gap-3">
                                               <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                               <p>{t.rejectionReason}</p>
                                            </div>
                                          )}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              ) : (
                                <p className="text-center text-muted-foreground py-10">No transactions yet.</p>
                              )}
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            <h1 className="text-xl font-bold font-headline">Skill24</h1>
        </div>
        <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer">
                  <AvatarImage src={`https://i.pravatar.cc/150?u=${currentUser?.id}`} alt={currentUser?.name} />
                  <AvatarFallback>{currentUser?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                    <UserIcon className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                  <Link href="/contact" className="flex items-center gap-2 cursor-pointer">
                    <Phone className="h-4 w-4" />
                    Contact Us
                  </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                  <Link href="/support" className="flex items-center gap-2 cursor-pointer">
                    <MessageSquare className="h-4 w-4" />
                    Support
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="flex items-center gap-2 cursor-pointer">
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>

      <main className="flex-grow flex flex-col relative">
        <div className="p-2 flex-shrink-0 flex items-center justify-between">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg px-3 py-1 h-auto disabled:opacity-50">
                        
                        {React.createElement(selectedAsset.icon, { size: 20, className: "text-primary" })}
                        <span className="font-semibold">{selectedAsset.name}</span>
                        <span className="text-accent">{selectedAsset.payout}%</span>
                        <ChevronDown size={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover border-border text-popover-foreground">
                    {assets.map(asset => (
                        <DropdownMenuItem key={asset.name} onSelect={() => setSelectedAsset(asset)} className="hover:!bg-accent/50 focus:bg-accent/50">
                            <div className="flex items-center gap-2">
                               {React.createElement(asset.icon, { size: 20, className: "text-primary" })}
                               <span>{asset.name}</span>
                               <span className="text-accent ml-auto">{asset.payout}%</span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-1">
                 <div className="h-6 w-px bg-border mx-1"></div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                            <Clock className="mr-2 h-4 w-4" />
                            {timeframes.find(tf => tf.value === chartTimeframe)?.label}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {timeframes.map(tf => (
                            <DropdownMenuItem key={tf.value} onSelect={() => setChartTimeframe(tf.value)}>
                                {tf.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <div className="h-6 w-px bg-border mx-1"></div>
                <Button variant="ghost" size="icon" className={`h-8 w-8 ${chartType === 'area' ? 'bg-secondary' : 'hover:bg-secondary/80'}`} onClick={() => setChartType('area')}>
                    <AreaChartIcon size={20} />
                </Button>
                <Button variant="ghost" size="icon" className={`h-8 w-8 ${chartType === 'candlestick' ? 'bg-secondary' : 'hover:bg-secondary/80'}`} onClick={() => setChartType('candlestick')}>
                    <CandlestickIcon size={20} />
                </Button>
            </div>
        </div>

        <div className="flex-grow relative cursor-grab"
            ref={chartContainerRef}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onTouchStart={handlePanStart}
            onTouchMove={handlePanMove}
            onTouchEnd={handlePanEnd}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
           <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom('in')} disabled={pointsToShow <= MIN_POINTS_TO_SHOW}>
                    <ZoomIn size={18} />
                </Button>
                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom('out')} disabled={pointsToShow >= MAX_POINTS_TO_SHOW}>
                    <ZoomOut size={18} />
                </Button>
            </div>
        </div>
        
      </main>

      <footer className="bg-card p-3 rounded-t-lg flex-shrink-0 border-t border-border">
         <div className="flex justify-around items-center mb-3">
             <div className="flex items-center gap-2">
                 {React.createElement(selectedAsset.icon, { size: 16, className: "text-primary" })}
                <span className="text-xs font-semibold">{selectedAsset.name}</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="bg-secondary text-white text-xs px-2 py-0.5 rounded">{formatTime(footerTimer)}</div>
             </div>
             <div className="text-center">
                <div className="text-xs text-muted-foreground">Payout</div>
                <div className="text-sm font-bold text-accent">{selectedAsset.payout}%</div>
            </div>
         </div>

        <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground text-center block mb-1">Time</label>
              <div className="flex items-center justify-center bg-input rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTimeChange(-5)}><Minus/></Button>
                <Input
                    type="text"
                    value={tradeTime}
                    onChange={(e) => handleCustomTimeChange(e.target.value)}
                    onBlur={(e) => { if (Number(e.target.value) < 5) setTradeTime(5); }}
                    className="font-bold text-lg w-16 text-center bg-transparent border-0 h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTimeChange(5)}><Plus/></Button>
              </div>
            </div>
             <div>
              <label className="text-xs text-muted-foreground text-center block mb-1">Amount</label>
               <div className="flex items-center justify-center bg-input rounded-lg p-1 relative">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => incrementAmount(-50)}><Minus/></Button>
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-lg pointer-events-none text-muted-foreground">₹</span>
                  <Input
                    type="text"
                    value={tradeAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="font-bold text-lg w-full text-center bg-transparent border-0 h-8 focus-visible:ring-0 focus-visible:ring-offset-0 pl-6"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => incrementAmount(50)}><Plus/></Button>
              </div>
            </div>
        </div>
        <div className="text-center text-sm text-muted-foreground mt-2">
            Earnings +{selectedAsset.payout}% <span className="font-bold text-white">₹{earnings.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <Button onClick={() => onTrade('buy')} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12">
            <ArrowUp size={24}/>
          </Button>
          <Button onClick={() => onTrade('sell')} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-lg h-12">
            <ArrowDown size={24}/>
          </Button>
        </div>
      </footer>
    </div>
  );
}
