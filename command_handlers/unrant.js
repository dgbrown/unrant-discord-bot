import 'dotenv/config';
import {
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes
} from 'discord-interactions';
import { DiscordRequest } from '../utils.js';

export const handleUnrantMessageCommandRequest = (req, res) => {
  const { token: interactionToken, application_id: appId, data } = req.body;
  const commandingUserId = req.body.member.user.id;
  const messageId = data.target_id;
  const message = data.resolved.messages[messageId];
  const authorId = message.author.id;
  const channelId = message.channel_id;

  // make sure the commanding user is the author // TODO: OR has the manage messages permission
  if (commandingUserId !== authorId) {
    console.log('User attempted UNRANT on a message that was not their own', data)
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL,
        content: "⚠️ Sorry, I can't let you delete someone else's messages"
      },
    });
  }

  // fetch messages in channel since this message
  DiscordRequest(`/channels/${channelId}/messages?after=${messageId}&limit=${100}`, { method: 'GET' })
    .then((res) => res.json())
    .then(async (channelMessages) => {
      // filter down to those of the same author
      var authorMessages = channelMessages.filter((message) => message.author.id === authorId)
      // add the command target message to the list
      // first message of the rant
      const messageIds = [messageId, ...authorMessages.map((x) => x.id)]

      await DiscordRequest(`/webhooks/${appId}/${interactionToken}/messages/@original`, {
        method: 'PATCH', body: {
          content: `Are you sure you want to delete ${messageIds.length} messages?`,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  style: ButtonStyleTypes.DANGER,
                  label: "Yes",
                  custom_id: `unrant_confirm_${messageId}_${messageIds.length}`,
                },
                {
                  type: MessageComponentTypes.BUTTON,
                  style: ButtonStyleTypes.SECONDARY,
                  label: "No",
                  custom_id: "unrant_cancel",
                },
              ]
            }
          ]
        }
      })
    });

  // ack command, shows as "thinking" in client
  return res.send({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.EPHEMERAL
    },
  });
}

export const handleConfirmUnrantButtonClickedRequest = (req, res) => {
  const { data, token, channel_id: channelId, member, application_id: appId } = req.body;

  const [firstMessageId, numberToDelete] = data.custom_id.replace("unrant_confirm_", "").split("_");

  // fetch messages in channel since this message
  DiscordRequest(`/channels/${channelId}/messages?after=${firstMessageId}&limit=${100}`, { method: 'GET' })
    .then((res) => res.json())
    .then(async (channelMessages) => {
      // filter down to those of the same author
      var authorMessages = channelMessages.filter((message) => message.author.id === member.user.id);

      var messageIds = [firstMessageId, ...authorMessages.map((x) => x.id)];
      messageIds.length = numberToDelete;

      // delete the messages
      if (messageIds.length < 2) {
        await DiscordRequest(`/channels/${channelId}/messages/${firstMessageId}`, { method: 'DELETE' })
      } else {
        await DiscordRequest(`/channels/${channelId}/messages/bulk-delete`, { method: 'POST', body: { messages: messageIds } })
      }

      // report success through edit
      await DiscordRequest(`/webhooks/${appId}/${token}/messages/@original`, {
        method: 'PATCH', body: {
          content: 'Ok, I deleted your rant. You\'re welcome!',
          components: []
        }
      })
    })

  // ack command while processing happens
  return res.send({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
  });
}

export const handleCancelUnrantButtonClickedRequest = (_, res) => {
  return res.send({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: "You cancelled the request. No worries, I'll leave those messages alone.",
      components: [],
    }
  });
}