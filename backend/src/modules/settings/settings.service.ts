import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { appSettings } from '../../database/schema';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from './audit.service';
import {
  SECRET_ENV_VARS,
  SETTINGS,
  SETTINGS_BY_KEY,
  validateSetting,
  type SettingDef,
} from './settings.registry';

const VERSION_KEY = 'settings:version';
const POLL_MS = 10_000;

export interface SettingView extends Omit<
  SettingDef,
  'envDefault' | 'pattern'
> {
  value: unknown;
  defaultValue: unknown;
  source: 'db' | 'env';
  updatedBy?: string | null;
  updatedAt?: Date;
}

type ChangeHandler = (value: unknown) => void | Promise<void>;

/**
 * Runtime settings: DB overrides on top of .env defaults, held in an
 * in-memory snapshot so `get()` is synchronous and cheap on hot paths.
 * Writes bump a Redis version so every instance reloads within ~10 s.
 */
@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name);
  private snapshot = new Map<
    string,
    { value: unknown; updatedBy: string | null; updatedAt: Date }
  >();
  private version: string | null = null;
  private timer?: NodeJS.Timeout;
  private readonly handlers = new Map<string, ChangeHandler[]>();

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => void this.pollVersion(), POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Current value: DB override, else the env/default. */
  get<T>(key: string): T {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) throw new Error(`Unknown setting ${key}`);
    const row = this.snapshot.get(key);
    return (row ? row.value : def.envDefault()) as T;
  }

  /** Run `handler` whenever `key` changes (e.g. reschedule a cron). */
  onChange(key: string, handler: ChangeHandler): void {
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
  }

  list(): SettingView[] {
    return SETTINGS.map((def) => {
      const row = this.snapshot.get(def.key);
      const rest: Partial<SettingDef> = { ...def };
      delete rest.envDefault;
      delete rest.pattern;
      const { envDefault } = def;
      return {
        ...(rest as Omit<SettingDef, 'envDefault' | 'pattern'>),
        value: row ? row.value : envDefault(),
        defaultValue: envDefault(),
        source: row ? ('db' as const) : ('env' as const),
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt,
      };
    });
  }

  /** Which secrets are present in the environment (never their values). */
  secretsStatus(): Array<{ name: string; configured: boolean }> {
    return SECRET_ENV_VARS.map((name) => ({
      name,
      configured: !!process.env[name] && !/^your-/.test(process.env[name]),
    }));
  }

  async set(
    key: string,
    raw: unknown,
    adminEmail: string,
  ): Promise<SettingView> {
    const def = this.definition(key);
    let value: unknown;
    try {
      value = validateSetting(def, raw);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const previous = this.get(key);
    await this.db
      .getDb()
      .insert(appSettings)
      .values({ key, value, updatedBy: adminEmail, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: sql`excluded.value`,
          updatedBy: adminEmail,
          updatedAt: new Date(),
        },
      });
    await this.afterWrite(key, adminEmail, 'settings.update', {
      from: previous,
      to: value,
    });
    return this.list().find((s) => s.key === key)!;
  }

  async reset(key: string, adminEmail: string): Promise<SettingView> {
    this.definition(key);
    const previous = this.get(key);
    await this.db.getDb().delete(appSettings).where(eq(appSettings.key, key));
    await this.afterWrite(key, adminEmail, 'settings.reset', {
      from: previous,
    });
    return this.list().find((s) => s.key === key)!;
  }

  private definition(key: string): SettingDef {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) throw new NotFoundException(`Unknown setting ${key}`);
    return def;
  }

  private async afterWrite(
    key: string,
    adminEmail: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.reload();
    try {
      await this.redis.getClient().incr(VERSION_KEY);
    } catch (err) {
      this.logger.warn(
        `Could not bump settings version: ${(err as Error).message}`,
      );
    }
    await this.audit.record(adminEmail, action, key, details);
    await this.fire(key);
  }

  private async fire(key: string): Promise<void> {
    for (const handler of this.handlers.get(key) ?? []) {
      try {
        await handler(this.get(key));
      } catch (err) {
        this.logger.error(
          `Setting ${key} change handler failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Load all overrides from the DB into the snapshot. */
  async reload(): Promise<void> {
    try {
      const rows = await this.db.getDb().select().from(appSettings);
      this.snapshot = new Map(
        rows
          .filter((r) => SETTINGS_BY_KEY.has(r.key))
          .map((r) => [
            r.key,
            { value: r.value, updatedBy: r.updatedBy, updatedAt: r.updatedAt },
          ]),
      );
    } catch (err) {
      this.logger.error(`Could not load settings: ${(err as Error).message}`);
    }
  }

  /** Another instance changed something: reload and fire handlers for changed keys. */
  private async pollVersion(): Promise<void> {
    try {
      const version = await this.redis.get(VERSION_KEY);
      if (version === this.version) return;
      const first = this.version === null;
      this.version = version;
      if (first) return;
      const before = new Map(
        SETTINGS.map((d) => [d.key, JSON.stringify(this.get(d.key))]),
      );
      await this.reload();
      for (const d of SETTINGS) {
        if (JSON.stringify(this.get(d.key)) !== before.get(d.key))
          await this.fire(d.key);
      }
    } catch {
      // Redis hiccup: keep the current snapshot.
    }
  }
}
