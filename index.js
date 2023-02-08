const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

//* Register bot commands to server.
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));
// console.log("commandFiles:", commandFiles);

for (const file of commandFiles) {
  // console.log("file: ", file);
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  //* Set a new item in the Collection with the key as the command name and the value as the exported module.
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

//* Register bot events to server.
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));
// console.log("eventFiles:", eventFiles);

for (const file of eventFiles) {
  // console.log("file: ", file);
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  // console.log("event: ", event);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
