export class CreditTransactionDto {
  id: string;
  amount: number;
  type: 'purchase' | 'deduction' | 'refund' | 'bonus';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata: any;
  createdAt: Date;

  constructor(transaction: any) {
    this.id = transaction.id;
    this.amount = parseFloat(transaction.amount);
    this.type = transaction.type;
    this.description = transaction.description;
    this.balanceBefore = parseFloat(transaction.balanceBefore);
    this.balanceAfter = parseFloat(transaction.balanceAfter);
    this.metadata = transaction.metadata
      ? JSON.parse(transaction.metadata)
      : null;
    this.createdAt = transaction.createdAt;
  }
}
