export class JobStatusDto {
  jobId: string;
  status:
    | 'completed'
    | 'failed'
    | 'delayed'
    | 'active'
    | 'waiting'
    | 'waiting-children'
    | 'unknown';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class BatchStatusDto {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  active: number;
  waiting: number;
  progress: number;
  results?: any[];
}
