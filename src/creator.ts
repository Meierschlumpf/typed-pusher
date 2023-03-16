import { z } from "zod";
import { ChannelInputSchema, MessageInputSchema, TriggerPayloadSchema } from "./zod";

export type MessageReturn = ReturnType<typeof message>;
export type InputReturn = ReturnType<MessageReturn["input"]>;
export type ChannelMessages = Record<string, InputReturn>;

type InputReturnType<
  TTriggerPayloadSchema extends TriggerPayloadSchema,
  TMessageInputSchema extends MessageInputSchema = undefined
> = TMessageInputSchema extends undefined
  ? {
      _messageInputSchema: undefined;
      _triggerInputSchema: TTriggerPayloadSchema;
    }
  : {
      _messageInputSchema: TMessageInputSchema;
      _triggerInputSchema: TTriggerPayloadSchema;
    };

export const message = <TMessageInputSchema extends MessageInputSchema = undefined>(
  messageInputSchema?: TMessageInputSchema
) => {
  const input = <TTriggerPayloadSchema extends TriggerPayloadSchema>(
    triggerInputSchema: TTriggerPayloadSchema
  ) => {
    return () =>
      ({
        _messageInputSchema: messageInputSchema,
        _triggerInputSchema: triggerInputSchema,
      } as InputReturnType<TTriggerPayloadSchema, TMessageInputSchema>);
  };

  return {
    input,
  };
};

export type ChannelReturn<TMessages extends Record<string, InputReturn>> = {
  [key in keyof TMessages]: InputReturnType<
    ReturnType<TMessages[key]>["_triggerInputSchema"],
    ReturnType<TMessages[key]>["_messageInputSchema"]
  >;
};
export type ChannelReturnWithInputSchema<
  TMessages extends Record<string, InputReturn>,
  TChannelInputSchema extends ChannelInputSchema
> = {
  _inner: ChannelReturn<TMessages>;
  _channelInputSchema: TChannelInputSchema;
};

export const channel = <
  TMessages extends ChannelMessages,
  TChannelInputSchema extends ChannelInputSchema = undefined
>(
  messages: TMessages,
  channelInputSchema?: TChannelInputSchema
) => {
  const value = {} as ChannelReturnWithInputSchema<TMessages, TChannelInputSchema>;

  value._inner = genericObjectEntries(messages).reduce((prev, [messageKey, messageReturn]) => {
    prev[messageKey] = messageReturn() as any;
    return prev;
  }, {} as ChannelReturn<TMessages>);

  if (channelInputSchema !== undefined) {
    value["_channelInputSchema"] = channelInputSchema;
  }

  return value;
};
