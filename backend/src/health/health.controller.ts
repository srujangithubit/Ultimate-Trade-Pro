import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
    DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@Controller()
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
        private disk: DiskHealthIndicator,
        private prisma: PrismaHealthIndicator,
    ) { }

    /**
     * Liveness probe — indicates the process is running and not deadlocked.
     * Kubernetes restarts the pod if this fails.
     */
    @Get('health')
    @HealthCheck()
    liveness() {
        return this.health.check([
            // Heap should not exceed 500MB
            () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
        ]);
    }

    /**
     * Readiness probe — indicates the app can serve traffic.
     * Kubernetes removes the pod from the service if this fails.
     */
    @Get('ready')
    @HealthCheck()
    readiness() {
        return this.health.check([
            // Database connectivity
            () => this.prisma.isHealthy('database'),
            // Memory RSS should not exceed 800MB
            () => this.memory.checkRSS('memory_rss', 800 * 1024 * 1024),
            // Disk should have at least 10% free space
            () =>
                this.disk.checkStorage('disk', {
                    thresholdPercent: 0.9,
                    path: '/',
                }),
        ]);
    }
}
