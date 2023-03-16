import PusherJs from "pusher-js";
import * as PusherTypes from "pusher-js";
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
import { genericObjectEntries } from "./helpers";
import { generateKey } from "./keys";

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
  pusher: PusherJs;
};

type ConstructSubscribeCallReturn<TSubscribePayloadSchema extends SubscribePayloadSchema> = (
  callback: (input: z.infer<TSubscribePayloadSchema>) => void | Promise<void>
) => () => void;

const constructSubscribeCall =
  <
    TChannelInput extends ChannelInput,
    TMessageInput extends MessageInput,
    TSubscribePayloadSchema extends SubscribePayloadSchema
  >(
    props: SubscribeProps<TChannelInput, TMessageInput, TSubscribePayloadSchema>
  ): ConstructSubscribeCallReturn<TSubscribePayloadSchema> =>
  (callback: (input: z.infer<TSubscribePayloadSchema>) => void | Promise<void>) => {
    // TODO: continue
    const channel = createOrGetChannel(props.channelKey, props.pusher);

    channel.bind(generateKey(props.messageKey, props.messageInput), callback);

    return () => {
      channel.unbind(generateKey(props.messageKey, props.messageInput), callback);
      channel.unsubscribe();
      removeChannel(props.channelKey);
    };
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
  pusher: PusherJs;
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
        pusher: props.pusher,
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
        pusher: props.pusher,
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

const channelMap = new Map<
  string,
  {
    count: number;
    channel: PusherTypes.Channel;
  }
>();

const createOrGetChannel = (key: string, pusher: PusherJs) => {
  if (channelMap.has(key)) {
    console.log(`getting channel ${key}`);
    const { channel, count } = channelMap.get(key)!;
    channelMap.set(key, {
      count: count + 1,
      channel,
    });
    return channel;
  }

  console.log(`creating channel ${key}`);

  const channel = pusher.subscribe(key);
  channelMap.set(key, { channel, count: 1 });

  return channel;
};

const removeChannel = (key: string) => {
  console.log(`removing channel ${key}`);
  const { count, channel } = channelMap.get(key)!;
  if (count <= 1) {
    return channelMap.delete(key);
  }

  channelMap.set(key, {
    count: count - 1,
    channel,
  });
};

const constructChannelCall = <
  TChannelKey extends string,
  TMessages extends ChannelReturn<ChannelMessages>,
  TChannelInputSchema extends ChannelInputSchema
>(
  channelKey: TChannelKey,
  messages: TMessages,
  channelInputSchema: TChannelInputSchema,
  pusher: PusherJs
): ConstructChannelCallReturn<TMessages, TChannelInputSchema> => {
  if (channelInputSchema === undefined) {
    return genericObjectEntries(messages).reduce((prev, [messageKey, message]) => {
      prev[messageKey] = constructMessageCall(
        {
          channelInput: undefined,
          channelKey,
          messageInputSchema: message._messageInputSchema,
          subscribePayloadSchema: message._subscriptionInputSchema,
          pusher,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_subscriptionInputSchema"]> }) as ConstructChannelCallReturn<
      TMessages,
      TChannelInputSchema
    >;
  }

  return ((input: ZodInferIfDefined<TChannelInputSchema>) => {
    return genericObjectEntries(messages).reduce((prev, [messageKey, message]) => {
      // TODO: validate input

      prev[messageKey] = constructMessageCall(
        {
          channelInput: input,
          channelKey,
          messageInputSchema: message._messageInputSchema,
          subscribePayloadSchema: message._subscriptionInputSchema,
          pusher,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_subscriptionInputSchema"]> });
  }) as ConstructChannelCallReturn<TMessages, TChannelInputSchema>;
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

export const createPusherClient = <TRootChannels extends RootChannels>(
  root: TRootChannels,
  pusher: PusherJs
) => {
  console.log(pusher);
  return genericObjectEntries(root).reduce((prev, [channelKey, channel]) => {
    prev[channelKey] = constructChannelCall(
      channelKey as string,
      channel._inner,
      channel._channelInputSchema,
      pusher
    ) as any;
    return prev;
  }, {} as Client<TRootChannels>) as Client<TRootChannels>;
};
