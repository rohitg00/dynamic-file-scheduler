import { CronConfig, Handlers } from "motia";
import type { FileSchedule } from "../types";
import { calculateNextRun } from "../utils/schedule-calculator";

export const config: CronConfig = {
  type: "cron",
  name: "ScheduleChecker",
  description:
    "Periodically checks for file share schedules that are due and triggers file generation",
  cron: "0 * * * *", // Run every hour (customize as needed: */5 * * * * for every 5 minutes)
  emits: ["file.generate"],
  flows: ["file-share-scheduler"],
};

export const handler: Handlers["ScheduleChecker"] = async (
  _,
  { logger, state, emit, traceId }
) => {
  logger.info("Starting schedule check", { traceId });

  try {
    // Get all file schedules from state
    const allSchedules = await state.getGroup<FileSchedule>("file_schedules");

    if (!allSchedules || allSchedules.length === 0) {
      logger.info("No schedules found", { traceId });
      return;
    }

    const currentTime = new Date();
    let checkedCount = 0;
    let triggeredCount = 0;

    logger.info(`Found ${allSchedules.length} schedules to check`, {
      count: allSchedules.length,
      traceId,
    });

    // Check each schedule
    for (const schedule of allSchedules) {
      try {
        checkedCount++;

        // Skip inactive schedules
        if (schedule.status !== "active") {
        logger.info("Skipping non-active schedule", {
          scheduleId: schedule.scheduleId,
          status: schedule.status,
          traceId,
        });
          continue;
        }

        const scheduledTime = new Date(schedule.nextRun);

        logger.info("Checking schedule", {
          scheduleId: schedule.scheduleId,
          customerId: schedule.customerId,
          nextRun: schedule.nextRun,
          currentTime: currentTime.toISOString(),
          isDue: currentTime >= scheduledTime,
          traceId,
        });

        // Check if schedule is due
        if (currentTime >= scheduledTime) {
          logger.info("Schedule is due, triggering file generation", {
            scheduleId: schedule.scheduleId,
            customerId: schedule.customerId,
            fileType: schedule.fileType,
            traceId,
          });

          // Emit file generation event
          await emit({
            topic: "file.generate",
            data: {
              scheduleId: schedule.scheduleId,
              customerId: schedule.customerId,
              customerEmail: schedule.customerEmail,
              fileType: schedule.fileType,
              format: schedule.format,
            },
          });

          // Calculate next run time
          const nextRun = calculateNextRun(
            schedule.scheduleType,
            schedule.config,
            schedule.timezone
          );

          // Update schedule with next run time
          schedule.lastRun = currentTime.toISOString();
          schedule.nextRun = nextRun.toISOString();
          schedule.executionCount = (schedule.executionCount || 0) + 1;
          schedule.updatedAt = currentTime.toISOString();

          await state.set("file_schedules", schedule.scheduleId, schedule);

          triggeredCount++;

          logger.info("Schedule executed successfully", {
            scheduleId: schedule.scheduleId,
            lastRun: schedule.lastRun,
            nextRun: schedule.nextRun,
            executionCount: schedule.executionCount,
            traceId,
          });
        } else {
          const minutesUntilDue = Math.round(
            (scheduledTime.getTime() - currentTime.getTime()) / 1000 / 60
          );
          logger.info("Schedule not due yet", {
            scheduleId: schedule.scheduleId,
            minutesUntilDue,
            traceId,
          });
        }
      } catch (scheduleError) {
        logger.error("Error processing schedule", {
          scheduleId: schedule.scheduleId,
          error:
            scheduleError instanceof Error
              ? scheduleError.message
              : String(scheduleError),
          traceId,
        });

        // Mark schedule as failed
        schedule.status = "failed";
        schedule.lastError =
          scheduleError instanceof Error
            ? scheduleError.message
            : String(scheduleError);
        schedule.updatedAt = new Date().toISOString();
        await state.set("file_schedules", schedule.scheduleId, schedule);
      }
    }

    logger.info("Schedule check completed", {
      totalChecked: checkedCount,
      schedulesTriggered: triggeredCount,
      nextCheckIn: "1 hour",
      traceId,
    });

    // Clean up old completed schedules (optional)
    await cleanupOldSchedules(state, logger);
  } catch (error) {
    logger.error("Schedule checker failed", {
      error: error instanceof Error ? error.message : String(error),
      traceId,
    });
  }
};

async function cleanupOldSchedules(state: any, logger: any) {
  try {
    const allSchedules = await state.getGroup<FileSchedule>("file_schedules");
    const currentTime = new Date();
    const thirtyDaysAgo = new Date(
      currentTime.getTime() - 30 * 24 * 60 * 60 * 1000
    );

    let cleanedCount = 0;

    for (const schedule of allSchedules) {
      // Clean up failed schedules older than 30 days
      if (schedule.status === "failed" && schedule.updatedAt) {
        const updatedTime = new Date(schedule.updatedAt);

        if (updatedTime < thirtyDaysAgo) {
          await state.delete("file_schedules", schedule.scheduleId);
          cleanedCount++;

          logger.info("Cleaned up old failed schedule", {
            scheduleId: schedule.scheduleId,
            status: schedule.status,
            updatedAt: schedule.updatedAt,
          });
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old schedules`);
    }
  } catch (error) {
    logger.warn("Error during cleanup", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

