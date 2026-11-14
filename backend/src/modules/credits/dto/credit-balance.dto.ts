export class CreditBalanceDto {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  currency: string;

  constructor(balance: number, totalPurchased: number, totalUsed: number) {
    this.balance = balance;
    this.totalPurchased = totalPurchased;
    this.totalUsed = totalUsed;
    this.currency = 'credits';
  }
}
