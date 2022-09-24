import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { VerifyDiscordRequest, DiscordRequest } from './utils.js';
import {
  HasGuildCommands,
  UNRANT_COMMAND,
} from './commands.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, token: interactionToken, application_id: appId, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    if (name === UNRANT_COMMAND.name) {
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

      // fetch messages since this message
      DiscordRequest(`/channels/${channelId}/messages?after=${messageId}&limit=${100}`, {method: 'GET'})
        .then((res) => res.json())
        .then(async (channelMessages) => {
          // filter down to those of the same author
          var authorMessages = channelMessages.filter((message) => message.author.id === authorId)
          // add the command target message to the list
          const messageIds = [messageId, ...authorMessages.map((x) => x.id)]
          // delete the messages
          await DiscordRequest(`/channels/${channelId}/messages/bulk-delete`, {method: 'POST', body: { messages: messageIds}})
          // report success
          await DiscordRequest(`/webhooks/${appId}/${interactionToken}/messages/@original`, {method: 'PATCH', body: {
            content: 'I deleted your rant, you\'re welcome!'
          }})
        });

      // report success back to the commanding user
      return res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL
        },
      });
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);

  // Check if guild commands from commands.json are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    UNRANT_COMMAND
  ]);
});
