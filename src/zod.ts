import { z, ZodSchema } from "zod";

export type ZodInferIfDefined<TInfer extends ZodSchema | undefined> = TInfer extends undefined
  ? void
  : z.infer<Exclude<TInfer, undefined>>;

export type ChannelInputSchema = ZodSchema | undefined;
export type ChannelInput = ZodInferIfDefined<ChannelInputSchema>;
export type MessageInputSchema = ZodSchema | undefined;
export type MessageInput = ZodInferIfDefined<MessageInputSchema>;
export type TriggerPayloadSchema = ZodSchema;
export type SubscribePayloadSchema = TriggerPayloadSchema;
