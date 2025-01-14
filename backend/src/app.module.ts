import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './services/prisma.service';
import { VectorService } from './services/vector.service';
import { AIService } from './services/ai.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
    private syncInterval: NodeJS.Timeout | null = null;
    constructor(private vectorService: VectorService) { }

    async onModuleInit() {
        try {
            console.log('[AppService] Starting initial message sync...');

            // Sync messages from the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            await this.vectorService.syncMessagesFromPostgres({
                startDate: thirtyDaysAgo,
                batchSize: 100 // Process in smaller batches to avoid memory issues
            });

            console.log('[AppService] Initial message sync completed');

            // Set up periodic sync every 5 minutes
            this.setupPeriodicSync();
        } catch (error) {
            console.error('[AppService] Error during initial message sync:', error);
            // Don't throw the error - we want the app to start even if sync fails
        }
    }

    private setupPeriodicSync() {
        // Clear any existing interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Sync every 5 minutes
        this.syncInterval = setInterval(async () => {
            try {
                console.log('[AppService] Starting periodic message sync...');

                // Only sync messages from the last 10 minutes to catch any new ones
                const tenMinutesAgo = new Date();
                tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

                await this.vectorService.syncMessagesFromPostgres({
                    startDate: tenMinutesAgo,
                    batchSize: 50 // Smaller batch size for incremental updates
                });

                console.log('[AppService] Periodic message sync completed');
            } catch (error) {
                console.error('[AppService] Error during periodic message sync:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
    }

    onModuleDestroy() {
        // Clean up the interval when the app shuts down
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
    ],
    providers: [
        PrismaService,
        VectorService,
        AIService,
        AppService,
    ],
})
export class AppModule { } 