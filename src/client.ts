import { z } from "zod";
import { ChannelMessages, ChannelReturn, ChannelReturnWithInputSchema } from "./creator";
import {
  ChannelInput,
  ChannelInputSchema,
  MessageInput,
  MessageInputSchema,
  SubscribePayloadSchema,
  ZodInferIfDefined,
} from "./zod";

type SubscribeProps<
  TChannelInput extends ChannelInput,
  TMessageInput extends MessageInput,
  TSubscribePayloadSchema extends SubscribePayloadSchema
> = {
  channelInput: TChannelInput;
  channelKey: string;
  messageInput: TMessageInput;
  messageKey: string;
  subscribePayloadSchema: TSubscribePayloadSchema;
};

type ConstructSubscribeCallReturn<TSubscribePayloadSchema extends SubscribePayloadSchema> = (
  callback: (input: z.infer<TSubscribePayloadSchema>) => void | Promise<void>
) => void;

const constructSubscribeCall =
  <
    TChannelInput extends ChannelInput,
    TMessageInput extends MessageInput,
    TSubscribePayloadSchema extends SubscribePayloadSchema
  >(
    props: SubscribeProps<TChannelInput, TMessageInput, TSubscribePayloadSchema>
  ) =>
  (callback: (input: z.infer<TSubscribePayloadSchema>) => void | Promise<void>) => {
    // TODO: continue
    callback({});
  };

type ConstructMessageCallProps<
  TChannelInput extends ChannelInput,
  TMessageInputSchema extends MessageInputSchema,
  TSubscribePayloadSchema extends SubscribePayloadSchema
> = {
  channelInput: TChannelInput;
  channelKey: string;
  messageInputSchema: TMessageInputSchema;
  subscribePayloadSchema: TSubscribePayloadSchema;
};

type MessageCallReturn<TSubscribePayloadSchema extends SubscribePayloadSchema> = {
  subscribe: ConstructSubscribeCallReturn<TSubscribePayloadSchema>;
};
type ConstructMessageCallReturn<
  TMessageInputSchema extends MessageInputSchema,
  TSubscribePayloadSchema extends SubscribePayloadSchema
> = TMessageInputSchema extends undefined
  ? MessageCallReturn<TSubscribePayloadSchema>
  : (input: ZodInferIfDefined<TMessageInputSchema>) => MessageCallReturn<TSubscribePayloadSchema>;

const constructMessageCall = <
  TChannelInput extends ChannelInput,
  TMessageInputSchema extends MessageInputSchema,
  TSubscribePayloadSchema extends SubscribePayloadSchema,
  TMessageKey extends string
>(
  props: ConstructMessageCallProps<TChannelInput, TMessageInputSchema, TSubscribePayloadSchema>,
  messageKey: TMessageKey
): ConstructMessageCallReturn<TMessageInputSchema, TSubscribePayloadSchema> => {
  if (props.messageInputSchema === undefined) {
    return {
      subscribe: constructSubscribeCall({
        channelInput: props.channelInput,
        channelKey: props.channelKey,
        messageInput: undefined,
        messageKey,
        subscribePayloadSchema: props.subscribePayloadSchema,
      }),
    } as ConstructMessageCallReturn<TMessageInputSchema, TSubscribePayloadSchema>;
  }

  return ((input: ZodInferIfDefined<TMessageInputSchema>) => {
    return {
      subscribe: constructSubscribeCall({
        channelInput: props.channelInput,
        channelKey: props.channelKey,
        messageInput: input,
        messageKey,
        subscribePayloadSchema: props.subscribePayloadSchema,
      }),
    };
  }) as ConstructMessageCallReturn<TMessageInputSchema, TSubscribePayloadSchema>;
};

type ChannelCallReturn<TMessages extends ChannelReturn<ChannelMessages>> = {
  [messageKey in keyof TMessages]: ConstructMessageCallReturn<
    TMessages[messageKey]["_messageInputSchema"],
    TMessages[messageKey]["_subscriptionInputSchema"]
  >;
};

type ConstructChannelCallReturn<
  TMessages extends ChannelReturn<ChannelMessages>,
  TChannelInputSchema extends ChannelInputSchema
> = TChannelInputSchema extends undefined
  ? ChannelCallReturn<TMessages>
  : (input: ZodInferIfDefined<TChannelInputSchema>) => ChannelCallReturn<TMessages>;

const constructChannelCall = <
  TChannelKey extends string,
  TMessages extends ChannelReturn<ChannelMessages>,
  TChannelInputSchema extends ChannelInputSchema
>(
  channelKey: TChannelKey,
  messages: TMessages,
  channelInputSchema: TChannelInputSchema
): ConstructChannelCallReturn<TMessages, TChannelInputSchema> => {
  if (channelInputSchema === undefined) {
    return genericObjectEntries(messages).reduce((prev, [messageKey, message]) => {
      prev[messageKey] = constructMessageCall(
        {
          channelInput: undefined,
          channelKey,
          messageInputSchema: message._messageInputSchema,
          subscribePayloadSchema: message._subscriptionInputSchema,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_subscriptionInputSchema"]> }) as ConstructChannelCallReturn<
      TMessages,
      TChannelInputSchema
    >;
  }

  return ((input: ZodInferIfDefined<TChannelInputSchema>) =>
    genericObjectEntries(messages).reduce((prev, [messageKey, message]) => {
      // TODO: validate input

      prev[messageKey] = constructMessageCall(
        {
          channelInput: input,
          channelKey,
          messageInputSchema: message._messageInputSchema,
          subscribePayloadSchema: message._subscriptionInputSchema,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_subscriptionInputSchema"]> })) as ConstructChannelCallReturn<
    TMessages,
    TChannelInputSchema
  >;
};

type RootChannels = Record<
  string,
  ChannelReturnWithInputSchema<ChannelMessages, ChannelInputSchema>
>;
export type Client<TRootChannels extends RootChannels> = {
  [key in keyof TRootChannels]: ConstructChannelCallReturn<
    TRootChannels[key]["_inner"],
    TRootChannels[key]["_channelInputSchema"]
  >;
};

export const createPusherClient = <TRootChannels extends RootChannels>(root: TRootChannels) => {
  return genericObjectEntries(root).reduce((prev, [channelKey, channel]) => {
    prev[channelKey] = constructChannelCall(
      channelKey as string,
      channel._inner,
      channel._channelInputSchema
    ) as any;
    return prev;
  }, {} as Client<TRootChannels>) as Client<TRootChannels>;
};
