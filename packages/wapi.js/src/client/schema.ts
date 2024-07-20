import { z } from "zod";

/**
 * The response body structure received on a successful message request.
 */
export const CloudApiMessageRequestSuccessResponseSchemaType = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
    }),
  ),
  messaging_product: z.literal("whatsapp"),
  contacts: z.array(
    z.object({
      input: z.string(),
      wa_id: z.string(),
    }),
  ),
});

/**
 * The response body structure received on a successful media delete request.
 */
export const CloudApiMediaDeleteRequestSuccessResponseSchemaType = z.object({
  success: z.literal(true),
});

/**
 * The response body structure received on a successful media upload request.
 */
export const CloudApiMediaUploadRequestSuccessResponseSchemaType = z.object({
  id: z.string(),
});

/**
 * The response body structure received on a successful get media url request.
 */
export const CloudApiGetMediaUrlRequestSuccessResponseSchemaType = z.object({
  url: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  file_size: z.number(),
  id: z.string(),
  messaging_product: z.literal("whatsapp"),
});

/**
 * The response body structure received on a successful media request.
 */
export const RequesterMediaRequestsSuccessResponseBodySchemaType =
  CloudApiMediaDeleteRequestSuccessResponseSchemaType.or(
    CloudApiMediaUploadRequestSuccessResponseSchemaType,
  ).or(CloudApiGetMediaUrlRequestSuccessResponseSchemaType);

/**
 * The Cloud API error response body structure.
 */
export const CloudApiErrorResponseSchemaType = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    code: z.number(),
    error_data: z.object({
      messaging_product: z.string(),
      details: z.string(),
    }).nullish(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export const CloudApiResponseSchemaType =
  CloudApiMessageRequestSuccessResponseSchemaType.or(
    CloudApiErrorResponseSchemaType,
  );

export enum CloudApiRequestResourceType {
  Message = "message",
  Media = "media",
  Phone = "phone",
}

export type CloudApiRequesterResourceTypeToResponseTypeMap = {
  [CloudApiRequestResourceType.Media]: z.infer<
    | typeof RequesterMediaRequestsSuccessResponseBodySchemaType
    | typeof CloudApiErrorResponseSchemaType
  >;
  [CloudApiRequestResourceType.Message]: z.infer<
    | typeof CloudApiMessageRequestSuccessResponseSchemaType
    | typeof CloudApiErrorResponseSchemaType
  >;
};
