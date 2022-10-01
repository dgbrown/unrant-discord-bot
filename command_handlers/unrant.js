import 'dotenv/config';
import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { DiscordRequest } from '../utils.js';

const handleUnrantRequest = (req, res) => {
    const { token: interactionToken, application_id: appId, data } = req.body;
    const commandingUserId = req.body.member.user.id;
    const messageId = data.target_id;
    const message = data.resolved.messages[messageId];
    const authorId = message.author.id;
    const channelId = message.channel_id;
  
    // make sure the commanding user is the author // TODO: OR has the manage messages permission
    if(commandingUserId !== authorId){
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
    DiscordRequest(`/channels/${channelId}/messages?after=${messageId}&limit=${100}`, {method: 'GET'})
      .then((res) => res.json())
      .then(async (channelMessages) => {
        // filter down to those of the same author
        var authorMessages = channelMessages.filter((message) => message.author.id === authorId)
        // add the command target message to the list
        // first message of the rant
        const messageIds = [messageId, ...authorMessages.map((x) => x.id)]
  
        // delete the messages
        if(messageIds.length < 2){
          await DiscordRequest(`/channels/${channelId}/messages/${messageId}`, {method: 'DELETE'})
        }else{
          await DiscordRequest(`/channels/${channelId}/messages/bulk-delete`, {method: 'POST', body: {messages: messageIds}})
        }
  
        // report success
        await DiscordRequest(`/webhooks/${appId}/${interactionToken}/messages/@original`, {method: 'PATCH', body: {
          content: 'I deleted your rant, you\'re welcome!'
        }})
      });
  
    // ack command, shows as "thinking" in client
    return res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL
      },
    });
  }

  export default handleUnrantRequest;