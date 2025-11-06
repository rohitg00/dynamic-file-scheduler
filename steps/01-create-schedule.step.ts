import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import type { FileSchedule } from "../types";
import { calculateNextRun } from "../utils/schedule-calculator";

export const config: ApiRouteConfig = {
  type: "api",
  name: "CreateSchedule",
  description: "API endpoint to create or update a customer file share schedule",
  method: "POST",
  path: "/api/schedules",
  emits: [],
  bodySchema: z.object({
    customerId: z.string().min(1),
    customerEmail: z.string().email(),
    scheduleType: z.enum([
      "daily",
      "weekly",
      "monthly-first-weekday",
      "monthly-last-weekday",
      "custom",
    ]),
    timezone: z.string().default("UTC"),
    fileType: z.string().default("products"),
    format: z.enum(["excel", "csv", "pdf"]).default("excel"),
    config: z.object({
      dayOfWeek: z
        .enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ])
        .optional(),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
      cronExpression: z.string().optional(),
      weekOfMonth: z.enum(["first", "last"]).optional(),
    }),
  }),
  responseSchema: {
    201: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.object({
        scheduleId: z.string(),
        nextRun: z.string(),
        schedule: z.any(),
      }),
    }),
  },
  flows: ["file-share-scheduler"],
};

export const handler: Handlers['CreateSchedule'] = async (req, { logger, state, traceId }) => {
  logger.info("Received schedule creation request", { body: req.body, traceId });

  try {
    // Access validated request body (already validated by bodySchema)
    const validatedInput = req.body;

    // Generate schedule ID
    const scheduleId = `schedule-${validatedInput.customerId}-${Date.now()}`;

    // Calculate next run time
    const nextRun = calculateNextRun(
      validatedInput.scheduleType,
      validatedInput.config,
      validatedInput.timezone
    );

    // Create schedule object
    const schedule: FileSchedule = {
      scheduleId,
      customerId: validatedInput.customerId,
      customerEmail: validatedInput.customerEmail,
      scheduleType: validatedInput.scheduleType,
      nextRun: nextRun.toISOString(),
      timezone: validatedInput.timezone,
      fileType: validatedInput.fileType,
      format: validatedInput.format,
      status: "active",
      config: validatedInput.config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
    };

    // Store schedule in state
    await state.set("file_schedules", scheduleId, schedule);

    logger.info("Schedule created successfully", {
      scheduleId,
      customerId: schedule.customerId,
      nextRun: schedule.nextRun,
      traceId,
    });

    // Return success response
    return {
      status: 201,
      body: {
        success: true,
        message: "Schedule created successfully",
        data: {
          scheduleId,
          nextRun: schedule.nextRun,
          schedule,
        },
      },
    };
  } catch (error) {
    logger.error("Failed to create schedule", {
      error: error instanceof Error ? error.message : String(error),
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        message: "Failed to create schedule",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

