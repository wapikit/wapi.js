import { z } from "zod";
import { MessageStatusEnum } from "../../webhook/type";

export const ErrorSchemaType = z.object({
  title: z.string(),
  description: z.string(),
  errorCode: z.number(),
  errorSubCode: z.number().optional(),
});

export const MessageSuccessResponseSchemaType = z.object({
  messageId: z.string(),
  receiverPhoneNumber: z.string(),
  senderPhoneNumber: z.string(),
  status: z.nativeEnum(MessageStatusEnum),
});

export const MessageResponseSchemaType = z
  .object({
    status: z.literal("success"),
    data: MessageSuccessResponseSchemaType,
  })
  .or(
    z.object({
      status: z.literal("error"),
      error: ErrorSchemaType,
    }),
  );
