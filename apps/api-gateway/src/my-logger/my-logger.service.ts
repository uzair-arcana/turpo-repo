import { Injectable, ConsoleLogger } from '@nestjs/common';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

@Injectable()
export class MyLoggerService extends ConsoleLogger {
  private readonly logsDir = path.join(process.cwd(), 'logs');
  private readonly logFile = path.join(this.logsDir, 'myLogFile.log');

  constructor() {
    super();
    this.ensureLogsDirectory();
  }

  private async ensureLogsDirectory() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        await fsPromises.mkdir(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  async logToFile(entry: string) {
    const timestamp = Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Chicago',
    }).format(new Date());

    const formattedEntry = `[${timestamp}] ${entry}\n`;

    try {
      await this.ensureLogsDirectory();
      await fsPromises.appendFile(this.logFile, formattedEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
      console.error('Error details:', error.message);
    }
  }

  log(message: string, context?: string) {
    const entry = context ? `[${context}] ${message}` : message;
    // Remove the file logging from here to avoid double logging
    super.log(entry);
  }

  error(message: string, context?: string) {
    const entry = context ? `[${context}] ${message}` : message;
    // Remove the file logging from here to avoid double logging
    super.error(entry);
  }
}
