import { Command, Option } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class CreditsCommand {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Command({
    command: 'credits:add',
    describe: 'Add credits to a user account',
  })
  async add(
    @Option({
      name: 'email',
      describe: 'The user email address or UUID',
      type: 'string',
      required: true,
    })
    email: string,
    @Option({
      name: 'amount',
      describe: 'Amount of credits to add',
      type: 'number',
      required: true,
    })
    amount: number,
  ) {
    const db = this.databaseService.getDb();
    let userResult;
    const isEmail = email.includes('@');

    if (isEmail) {
      userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    } else {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (uuidRegex.test(email)) {
        userResult = await db
          .select()
          .from(users)
          .where(eq(users.id, email))
          .limit(1);
      } else {
        userResult = [];
      }
    }

    if (!userResult.length) {
      console.error(`❌ Error: User matching "${email}" not found.`);
      return;
    }

    const user = userResult[0];
    const parsedAmount = parseFloat(amount as any);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error(
        `❌ Error: Invalid credits amount: "${amount}". Must be a positive number.`,
      );
      return;
    }

    console.log(
      `Adding ${parsedAmount} credits to user: ${user.name} (${user.email})...`,
    );

    try {
      const newBalance = await this.creditsService.addCredits(
        user.id,
        parsedAmount,
        'bonus',
        `Credited via CLI management command`,
        { source: 'cli' },
      );
      console.log(`✅ Success! New Balance: ${newBalance} credits.`);
    } catch (err) {
      console.error(`❌ Failed to award credits: ${err.message}`);
    }
  }
}
