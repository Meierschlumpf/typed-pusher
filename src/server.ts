import { z } from "zod";
import { ChannelMessages, ChannelReturn, ChannelReturnWithInputSchema } from "./creator";
import {
  ChannelInput,
  ChannelInputSchema,
  MessageInput,
  MessageInputSchema,
  TriggerPayloadSchema,
  ZodInferIfDefined,
} from "./zod";

type TriggerProps<
  TChannelInput extends ChannelInput,
  TMessageInput extends MessageInput,
  TTriggerPayloadSchema extends TriggerPayloadSchema
> = {
  channelInput: TChannelInput;
  channelKey: string;
  messageInput: TMessageInput;
  messageKey: string;
  triggerPayloadSchema: TTriggerPayloadSchema;
};

type ConstructTriggerCallReturn<TTriggerPayloadSchema extends TriggerPayloadSchema> = (
  payload: z.infer<TTriggerPayloadSchema>
) => void;

const constructTriggerCall =
  <
    TChannelInput extends ChannelInput,
    TMessageInput extends MessageInput,
    TTriggerPayloadSchema extends TriggerPayloadSchema
  >(
    props: TriggerProps<TChannelInput, TMessageInput, TTriggerPayloadSchema>
  ) =>
  (payload: z.infer<TTriggerPayloadSchema>) => {
    // TODO: continue
    //props.triggerPayloadSchema.parse(payload);
    console.log(props, payload);
  };

type ConstructMessageCallProps<
  TChannelInput extends ChannelInput,
  TMessageInputSchema extends MessageInputSchema,
  TTriggerPayloadSchema extends TriggerPayloadSchema
> = {
  channelInput: TChannelInput;
  channelKey: string;
  messageInputSchema: TMessageInputSchema;
  triggerPayloadSchema: TTriggerPayloadSchema;
};

type MessageCallReturn<TTriggerPayloadSchema extends TriggerPayloadSchema> = {
  trigger: ConstructTriggerCallReturn<TTriggerPayloadSchema>;
};
type ConstructMessageCallReturn<
  TMessageInputSchema extends MessageInputSchema,
  TTriggerPayloadSchema extends TriggerPayloadSchema
> = TMessageInputSchema extends undefined
  ? MessageCallReturn<TTriggerPayloadSchema>
  : (input: ZodInferIfDefined<TMessageInputSchema>) => MessageCallReturn<TTriggerPayloadSchema>;

const constructMessageCall = <
  TChannelInput extends ChannelInput,
  TMessageInputSchema extends MessageInputSchema,
  TTriggerPayloadSchema extends TriggerPayloadSchema,
  TMessageKey extends string
>(
  props: ConstructMessageCallProps<TChannelInput, TMessageInputSchema, TTriggerPayloadSchema>,
  messageKey: TMessageKey
): ConstructMessageCallReturn<TMessageInputSchema, TTriggerPayloadSchema> => {
  if (props.messageInputSchema === undefined) {
    return {
      trigger: constructTriggerCall({
        channelInput: props.channelInput,
        channelKey: props.channelKey,
        messageInput: undefined,
        messageKey,
        triggerPayloadSchema: props.triggerPayloadSchema,
      }),
    } as ConstructMessageCallReturn<TMessageInputSchema, TTriggerPayloadSchema>;
  }

  return ((input: ZodInferIfDefined<TMessageInputSchema>) => {
    return {
      trigger: constructTriggerCall({
        channelInput: props.channelInput,
        channelKey: props.channelKey,
        messageInput: input,
        messageKey,
        triggerPayloadSchema: props.triggerPayloadSchema,
      }),
    };
  }) as ConstructMessageCallReturn<TMessageInputSchema, TTriggerPayloadSchema>;
};

type ChannelCallReturn<TMessages extends ChannelReturn<ChannelMessages>> = {
  [messageKey in keyof TMessages]: ConstructMessageCallReturn<
    TMessages[messageKey]["_messageInputSchema"],
    TMessages[messageKey]["_triggerInputSchema"]
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
          triggerPayloadSchema: message._triggerInputSchema,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_triggerInputSchema"]> }) as ConstructChannelCallReturn<
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
          triggerPayloadSchema: message._triggerInputSchema,
        },
        messageKey as string
      ) as any;

      return prev;
    }, {} as { [key in keyof TMessages]: ConstructMessageCallReturn<TMessages[key]["_messageInputSchema"], TMessages[key]["_triggerInputSchema"]> })) as ConstructChannelCallReturn<
    TMessages,
    TChannelInputSchema
  >;
};

type RootChannels = Record<
  string,
  ChannelReturnWithInputSchema<ChannelMessages, ChannelInputSchema>
>;
export type Server<TRootChannels extends RootChannels> = {
  [key in keyof TRootChannels]: ConstructChannelCallReturn<
    TRootChannels[key]["_inner"],
    TRootChannels[key]["_channelInputSchema"]
  >;
};

export const createPusherServer = <TRootChannels extends RootChannels>(root: TRootChannels) => {
  return genericObjectEntries(root).reduce((prev, [channelKey, channel]) => {
    prev[channelKey] = constructChannelCall(
      channelKey as string,
      channel._inner,
      channel._channelInputSchema
    ) as any;
    return prev;
  }, {} as Server<TRootChannels>) as Server<TRootChannels>;
};
