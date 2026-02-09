import { scrapeAndStore, cleanupOldData } from './scraper.js';
import { handleRequest } from './api.js';

export interface Env {
  DB: D1Database;
}

export default {
  /**
   * Cron trigger: scrape pool data every 5 minutes, cleanup daily.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await scrapeAndStore(env.DB);
        } catch (err) {
          console.error('Scrape failed:', err);
        }

        // Run cleanup once a day (at midnight UTC, first cron of the hour 0)
        const hour = new Date(event.scheduledTime).getUTCHours();
        const minute = new Date(event.scheduledTime).getUTCMinutes();
        if (hour === 0 && minute < 5) {
          try {
            await cleanupOldData(env.DB);
          } catch (err) {
            console.error('Cleanup failed:', err);
          }
        }
      })(),
    );
  },

  /**
   * HTTP handler: serve JSON API with CORS.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env.DB);
  },
};
