import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

interface SSEClient {
  id: string;
  response: Response;
  userId?: string;
}

@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);
  private clients: Map<string, SSEClient> = new Map();

  /**
   * Register a new SSE client
   */
  addClient(clientId: string, response: Response, userId?: string): void {
    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Store client
    this.clients.set(clientId, { id: clientId, response, userId });

    this.logger.log(
      `SSE client ${clientId} connected (total: ${this.clients.size})`,
    );

    // Send initial connection message
    this.sendEvent(clientId, 'connected', { clientId, timestamp: new Date() });

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Remove a disconnected client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.logger.log(
        `SSE client ${clientId} disconnected (remaining: ${this.clients.size})`,
      );
    }
  }

  /**
   * Send an event to a specific client
   */
  sendEvent(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      this.logger.warn(
        `Attempted to send event to non-existent client ${clientId}`,
      );
      return false;
    }

    try {
      const formattedData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.response.write(formattedData);
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending event to client ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send event to all clients of a specific user
   */
  sendEventToUser(userId: string, event: string, data: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.sendEvent(clientId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, data: any): number {
    let sentCount = 0;

    for (const clientId of this.clients.keys()) {
      if (this.sendEvent(clientId, event, data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send a job status update
   */
  sendJobUpdate(
    clientId: string,
    jobId: string,
    status: string,
    data?: any,
  ): boolean {
    return this.sendEvent(clientId, `job:${status}`, {
      jobId,
      status,
      timestamp: new Date(),
      ...data,
    });
  }

  /**
   * Send job progress update
   */
  sendJobProgress(
    clientId: string,
    jobId: string,
    progress: number,
    message?: string,
  ): boolean {
    return this.sendEvent(clientId, 'job:progress', {
      jobId,
      progress,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if a client is connected
   */
  isClientConnected(clientId: string): boolean {
    return this.clients.has(clientId);
  }
}
