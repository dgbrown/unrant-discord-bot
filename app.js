import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  MessageComponentTypes
} from 'discord-interactions';
import { VerifyDiscordRequest } from './utils.js';
import {
  HasGuildCommands,
  UNRANT_COMMAND,
} from './commands.js';
import { handleCancelUnrantButtonClickedRequest, handleConfirmUnrantButtonClickedRequest, handleUnrantMessageCommandRequest } from './command_handlers/unrant.js';

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
  try {
    // Interaction type and data
    const { type, data } = req.body;

    // Handle verification requests
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    // Handle slash command requests
    // See https://discord.com/developers/docs/interactions/application-commands#slash-commands
    if (type === InteractionType.APPLICATION_COMMAND) {
      if (data.name === UNRANT_COMMAND.name) {
        return handleUnrantMessageCommandRequest(req, res);
      }
    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
      if (data.component_type === MessageComponentTypes.BUTTON) {
        if (data.custom_id.startsWith('unrant_confirm_')) {
          return handleConfirmUnrantButtonClickedRequest(req, res);
        } else if (data.custom_id.startsWith("unrant_cancel")) {
          return handleCancelUnrantButtonClickedRequest(req, res);
        }
      }
    }
  }
  catch (error) {
    console.error('Failed to process /interactions request', error);
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);

  // Check if guild commands from commands.json are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    UNRANT_COMMAND
  ]);
});
