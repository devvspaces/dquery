export class CreditStatsDto {
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  totalEarned: number; // bonuses + initial free credits
  lifetimeValue: number; // total purchased in USD (for future use)

  constructor(
    balance: number,
    totalPurchased: number,
    totalUsed: number,
    totalEarned: number = 0,
  ) {
    this.currentBalance = balance;
    this.totalPurchased = totalPurchased;
    this.totalUsed = totalUsed;
    this.totalEarned = totalEarned;
    this.lifetimeValue = 0; // Will be calculated from purchases table
  }
}
