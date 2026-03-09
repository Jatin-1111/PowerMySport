/**
 * Load Testing Script for Scheduled Reminders
 *
 * This script creates 1000+ test reminders and benchmarks the performance
 * of the reminder processing system.
 *
 * Usage:
 *   npx tsx scripts/load-test-reminders.ts [options]
 *
 * Options:
 *   --count <number>     Number of reminders to create (default: 1000)
 *   --batch-size <number> Batch size for processing (default: 100)
 *   --cleanup            Clean up test data after completion
 *   --skip-create        Skip reminder creation (use existing test data)
 */

import mongoose from "mongoose";
import { ScheduledNotification } from "../src/models/ScheduledNotification";
import { ScheduledNotificationService } from "../src/services/ScheduledNotificationService";
import { ReminderMonitoringService } from "../src/services/ReminderMonitoringService";
// Import models to register them with Mongoose
import "../src/models/User";
import "../src/models/Booking";

// Configuration
const DEFAULT_REMINDER_COUNT = 1000;
const DEFAULT_BATCH_SIZE = 100;

interface LoadTestConfig {
  reminderCount: number;
  batchSize: number;
  cleanup: boolean;
  skipCreate: boolean;
}

interface LoadTestResults {
  setup: {
    remindersCreated: number;
    creationTimeMs: number;
    creationRate: number; // reminders/second
  };
  processing: {
    totalReminders: number;
    batchSize: number;
    processingTimeMs: number;
    throughput: number; // reminders/second
    successCount: number;
    failureCount: number;
    failureRate: number; // percentage
  };
  performance: {
    peakMemoryMB: number;
    avgMemoryMB: number;
    memoryDeltaMB: number;
  };
  database: {
    queryTimeMs: number;
    indexUsed: boolean;
  };
}

// Parse command line arguments
function parseArgs(): LoadTestConfig {
  const args = process.argv.slice(2);
  const config: LoadTestConfig = {
    reminderCount: DEFAULT_REMINDER_COUNT,
    batchSize: DEFAULT_BATCH_SIZE,
    cleanup: false,
    skipCreate: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--count":
        config.reminderCount = parseInt(args[++i], 10);
        break;
      case "--batch-size":
        config.batchSize = parseInt(args[++i], 10);
        break;
      case "--cleanup":
        config.cleanup = true;
        break;
      case "--skip-create":
        config.skipCreate = true;
        break;
    }
  }

  return config;
}

// Format bytes to MB
function bytesToMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

// Get current memory usage
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: bytesToMB(usage.heapUsed),
    heapTotalMB: bytesToMB(usage.heapTotal),
    rssMB: bytesToMB(usage.rss),
  };
}

// Create test reminder data
async function createTestReminders(
  count: number,
): Promise<{ created: number; timeMs: number }> {
  console.log(`\n📝 Creating ${count} test reminders...`);
  const startTime = Date.now();

  // Generate test user IDs, booking IDs
  const testUserIds = Array.from(
    { length: Math.min(count / 10, 100) },
    (_, i) => new mongoose.Types.ObjectId(),
  );
  const testBookingIds = Array.from(
    { length: count },
    () => new mongoose.Types.ObjectId(),
  );

  // Create reminders in batches of 500 to avoid memory issues
  const CREATION_BATCH_SIZE = 500;
  let created = 0;

  for (let i = 0; i < count; i += CREATION_BATCH_SIZE) {
    const batchSize = Math.min(CREATION_BATCH_SIZE, count - i);
    const reminders = [];

    for (let j = 0; j < batchSize; j++) {
      const idx = i + j;
      const userId = testUserIds[idx % testUserIds.length];
      const bookingId = testBookingIds[idx];

      // Distribute across different reminder intervals
      const intervals: Array<"24_HOURS" | "1_HOUR" | "15_MINUTES"> = [
        "24_HOURS",
        "1_HOUR",
        "15_MINUTES",
      ];
      const interval = intervals[idx % intervals.length];

      // Set scheduledFor to now (so they're immediately processable)
      const scheduledFor = new Date();

      const venueName = `Test Venue ${idx % 50}`;
      const sport = ["Football", "Basketball", "Tennis", "Cricket"][idx % 4];

      // Generate title and body based on interval
      let title = "";
      let body = "";
      if (interval === "24_HOURS") {
        title = "Booking Tomorrow";
        body = `Don't forget! Your ${sport} session at ${venueName} is tomorrow at 10:00.`;
      } else if (interval === "1_HOUR") {
        title = "Booking in 1 Hour";
        body = `Reminder: Your ${sport} session at ${venueName} starts in 1 hour at 10:00.`;
      } else {
        title = "Booking in 15 Minutes";
        body = `Your ${sport} session at ${venueName} is starting soon at 10:00!`;
      }

      reminders.push({
        userId,
        bookingId,
        reminderType: "BOOKING",
        interval,
        scheduledFor,
        status: "PENDING",
        title,
        body,
        channels: {
          inApp: true,
          push: true,
          email: true,
        },
        metadata: {
          venueName,
          sport,
          bookingDate: new Date(Date.now() + 86400000), // Tomorrow
          startTime: "10:00",
          endTime: "11:00",
        },
      });
    }

    await ScheduledNotification.insertMany(reminders);
    created += batchSize;
    process.stdout.write(`\r  Created: ${created}/${count} reminders`);
  }

  const timeMs = Date.now() - startTime;
  console.log(`\n✅ Created ${created} reminders in ${timeMs}ms`);

  return { created, timeMs };
}

// Run load test for processing reminders
async function runProcessingLoadTest(batchSize: number): Promise<{
  processingTimeMs: number;
  successCount: number;
  failureCount: number;
  memoryStats: {
    peak: number;
    average: number;
    delta: number;
  };
}> {
  console.log(
    `\n🚀 Starting reminder processing (batch size: ${batchSize})...`,
  );

  // Track memory usage
  const memorySnapshots: number[] = [];
  const initialMemory = getMemoryUsage();
  memorySnapshots.push(initialMemory.heapUsedMB);

  // Memory monitoring interval
  const memoryInterval = setInterval(() => {
    const current = getMemoryUsage();
    memorySnapshots.push(current.heapUsedMB);
  }, 100); // Sample every 100ms

  const startTime = Date.now();

  try {
    // Process all pending reminders
    const stats =
      await ScheduledNotificationService.processPendingReminders(batchSize);

    const processingTimeMs = Date.now() - startTime;

    clearInterval(memoryInterval);

    // Calculate memory stats
    const finalMemory = getMemoryUsage();
    const peakMemory = Math.max(...memorySnapshots);
    const avgMemory =
      memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
    const memoryDelta = finalMemory.heapUsedMB - initialMemory.heapUsedMB;

    console.log(`✅ Processing complete in ${processingTimeMs}ms`);
    console.log(`  Sent: ${stats.sent}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Processed: ${stats.processed}`);

    return {
      processingTimeMs,
      successCount: stats.sent,
      failureCount: stats.failed,
      memoryStats: {
        peak: peakMemory,
        average: avgMemory,
        delta: memoryDelta,
      },
    };
  } catch (error) {
    clearInterval(memoryInterval);
    throw error;
  }
}

// Benchmark database query performance
async function benchmarkDatabaseQuery(): Promise<{
  queryTimeMs: number;
  indexUsed: boolean;
}> {
  console.log(`\n🔍 Benchmarking database query performance...`);

  const startTime = Date.now();

  // Create query for explain (will be executed once)
  const explainQuery = ScheduledNotification.find({
    status: "PENDING",
    scheduledFor: { $lte: new Date() },
  })
    .sort({ scheduledFor: 1 })
    .limit(100);

  // Use explain to check if index is used
  const explainResult = await explainQuery.explain("executionStats");

  // Create a separate query for actual execution
  const reminders = await ScheduledNotification.find({
    status: "PENDING",
    scheduledFor: { $lte: new Date() },
  })
    .sort({ scheduledFor: 1 })
    .limit(100)
    .lean();

  const queryTimeMs = Date.now() - startTime;

  // Check if index was used
  const executionStats = (explainResult as any).executionStats;
  const indexUsed =
    executionStats.executionStages?.stage === "IXSCAN" ||
    executionStats.executionStages?.inputStage?.stage === "IXSCAN";

  console.log(`  Query time: ${queryTimeMs}ms`);
  console.log(`  Index used: ${indexUsed ? "✅ Yes" : "❌ No"}`);
  console.log(`  Documents examined: ${executionStats.totalDocsExamined}`);
  console.log(`  Documents returned: ${reminders.length}`);

  return { queryTimeMs, indexUsed };
}

// Clean up test data
async function cleanupTestData(): Promise<number> {
  console.log(`\n🧹 Cleaning up test reminders...`);

  // Delete all test reminders (those with test venue names)
  const result = await ScheduledNotification.deleteMany({
    "metadata.venueName": { $regex: /^Test Venue/ },
  });

  console.log(`  Deleted ${result.deletedCount} test reminders`);
  return result.deletedCount || 0;
}

// Print formatted results
function printResults(results: LoadTestResults): void {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         LOAD TEST RESULTS - SCHEDULED REMINDERS          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  console.log("\n📊 SETUP PHASE:");
  console.log(`  Reminders Created:    ${results.setup.remindersCreated}`);
  console.log(`  Creation Time:        ${results.setup.creationTimeMs}ms`);
  console.log(
    `  Creation Rate:        ${results.setup.creationRate.toFixed(2)} reminders/sec`,
  );

  console.log("\n⚡ PROCESSING PHASE:");
  console.log(`  Total Reminders:      ${results.processing.totalReminders}`);
  console.log(`  Batch Size:           ${results.processing.batchSize}`);
  console.log(
    `  Processing Time:      ${results.processing.processingTimeMs}ms`,
  );
  console.log(
    `  Throughput:           ${results.processing.throughput.toFixed(2)} reminders/sec`,
  );
  console.log(`  Success Count:        ${results.processing.successCount}`);
  console.log(`  Failure Count:        ${results.processing.failureCount}`);
  console.log(
    `  Failure Rate:         ${results.processing.failureRate.toFixed(2)}%`,
  );

  console.log("\n💾 PERFORMANCE METRICS:");
  console.log(
    `  Peak Memory:          ${results.performance.peakMemoryMB.toFixed(2)} MB`,
  );
  console.log(
    `  Avg Memory:           ${results.performance.avgMemoryMB.toFixed(2)} MB`,
  );
  console.log(
    `  Memory Delta:         ${results.performance.memoryDeltaMB > 0 ? "+" : ""}${results.performance.memoryDeltaMB.toFixed(2)} MB`,
  );

  console.log("\n🗄️  DATABASE PERFORMANCE:");
  console.log(`  Query Time:           ${results.database.queryTimeMs}ms`);
  console.log(
    `  Index Used:           ${results.database.indexUsed ? "✅ Yes" : "❌ No"}`,
  );

  // Performance assessment
  console.log("\n📈 PERFORMANCE ASSESSMENT:");

  const throughput = results.processing.throughput;
  if (throughput >= 100) {
    console.log("  ✅ Excellent - Processing >100 reminders/sec");
  } else if (throughput >= 50) {
    console.log("  ✅ Good - Processing >50 reminders/sec");
  } else if (throughput >= 20) {
    console.log("  ⚠️  Fair - Processing >20 reminders/sec");
  } else {
    console.log("  ❌ Poor - Processing <20 reminders/sec");
  }

  if (results.processing.failureRate === 0) {
    console.log("  ✅ No failures - Perfect delivery rate");
  } else if (results.processing.failureRate < 1) {
    console.log("  ✅ Low failure rate - <1% failures");
  } else if (results.processing.failureRate < 5) {
    console.log("  ⚠️  Moderate failure rate - <5% failures");
  } else {
    console.log(
      `  ❌ High failure rate - ${results.processing.failureRate.toFixed(2)}% failures`,
    );
  }

  if (!results.database.indexUsed) {
    console.log(
      "  ⚠️  WARNING: Database index not used - Performance may degrade!",
    );
  }

  console.log("\n");
}

// Main function
async function main() {
  const config = parseArgs();

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║     SCHEDULED REMINDERS LOAD TESTING SCRIPT              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`\nConfiguration:`);
  console.log(`  Reminder Count:  ${config.reminderCount}`);
  console.log(`  Batch Size:      ${config.batchSize}`);
  console.log(`  Cleanup:         ${config.cleanup ? "Yes" : "No"}`);
  console.log(`  Skip Creation:   ${config.skipCreate ? "Yes" : "No"}`);

  try {
    // Connect to database (use same env variable as main app)
    const dbUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";
    console.log(`\n🔌 Connecting to database...`);
    await mongoose.connect(dbUri);
    console.log(`✅ Connected to MongoDB`);

    // Initialize results
    const results: LoadTestResults = {
      setup: {
        remindersCreated: 0,
        creationTimeMs: 0,
        creationRate: 0,
      },
      processing: {
        totalReminders: 0,
        batchSize: config.batchSize,
        processingTimeMs: 0,
        throughput: 0,
        successCount: 0,
        failureCount: 0,
        failureRate: 0,
      },
      performance: {
        peakMemoryMB: 0,
        avgMemoryMB: 0,
        memoryDeltaMB: 0,
      },
      database: {
        queryTimeMs: 0,
        indexUsed: false,
      },
    };

    // Step 1: Create test reminders (if not skipped)
    if (!config.skipCreate) {
      const setupResult = await createTestReminders(config.reminderCount);
      results.setup.remindersCreated = setupResult.created;
      results.setup.creationTimeMs = setupResult.timeMs;
      results.setup.creationRate =
        (setupResult.created / setupResult.timeMs) * 1000;
    } else {
      console.log(`\n⏭️  Skipping reminder creation (--skip-create)`);
      const count = await ScheduledNotification.countDocuments({
        status: "PENDING",
      });
      console.log(`  Found ${count} existing pending reminders`);
      results.setup.remindersCreated = count;
    }

    // Step 2: Benchmark database query
    const dbBench = await benchmarkDatabaseQuery();
    results.database = dbBench;

    // Step 3: Process reminders and measure performance
    const processingResult = await runProcessingLoadTest(config.batchSize);
    results.processing.totalReminders = results.setup.remindersCreated;
    results.processing.processingTimeMs = processingResult.processingTimeMs;
    results.processing.successCount = processingResult.successCount;
    results.processing.failureCount = processingResult.failureCount;
    results.processing.throughput =
      (results.processing.totalReminders /
        results.processing.processingTimeMs) *
      1000;
    results.processing.failureRate =
      results.processing.totalReminders > 0
        ? (results.processing.failureCount /
            results.processing.totalReminders) *
          100
        : 0;

    results.performance.peakMemoryMB = processingResult.memoryStats.peak;
    results.performance.avgMemoryMB = processingResult.memoryStats.average;
    results.performance.memoryDeltaMB = processingResult.memoryStats.delta;

    // Print results
    printResults(results);

    // Step 4: Get monitoring statistics
    console.log("📊 Fetching monitoring statistics...");
    const monitoringStats =
      await ReminderMonitoringService.getMonitoringStats();
    const healthStatus = await ReminderMonitoringService.checkSchedulerHealth();

    console.log("\n🔍 CURRENT SYSTEM STATUS:");
    console.log(`  Total Processed (24h):  ${monitoringStats.total}`);
    console.log(`  Sent (24h):             ${monitoringStats.sent}`);
    console.log(`  Failed (24h):           ${monitoringStats.failed}`);
    console.log(
      `  Failure Rate (24h):     ${monitoringStats.failureRate.toFixed(2)}%`,
    );
    console.log(
      `  Health Status:          ${healthStatus.isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`,
    );

    if (!healthStatus.isHealthy && healthStatus.issues.length > 0) {
      console.log(`  Issues:`);
      healthStatus.issues.forEach((issue: string) => {
        console.log(`    - ${issue}`);
      });
    }

    // Step 5: Cleanup (if requested)
    if (config.cleanup) {
      await cleanupTestData();
    } else {
      console.log(
        `\n💡 Tip: Run with --cleanup flag to remove test data automatically`,
      );
    }

    console.log("\n✅ Load test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Load test failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main, LoadTestConfig, LoadTestResults };
