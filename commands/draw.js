const fs = require("node:fs");
const fetch = require("node-fetch-commonjs");
const path = require("node:path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { hfGetSpaceQuery } = require("../hf.js");

module.exports = {
  //* Command data.
  data: new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Draw an picture with a prompt command.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("The prompt to draw an picture.")
        .setRequired(true)
    ),

  //* Command process.
  async execute(interaction) {
    console.log("call /draw command");

    const MAX_WAITING_COUNT = 25;
    const DOWNLOAD_DIRECTORY = "../download_files/";
    const MINT_PAGE_URL = process.env.MINT_PAGE_URL;
    const API_POST_URL = process.env.API_POST_URL;
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    console.log("process.env.MINT_PAGE_URL: ", process.env.MINT_PAGE_URL);
    console.log("process.env.API_POST_URL: ", process.env.API_POST_URL);

    let waiting_count = 0;
    let is_drawing_finished = false;
    await interaction.reply("Wait a moment for drawing ...");
    console.log("-- Send waiting message.");

    const prompt = interaction.options.getString("prompt");
    console.log("prompt: ", prompt);
    try {
      //* Call hugging space with prompt and get response.
      hfGetSpaceQuery(prompt).then(async (response) => {
        // console.log("response: ", response);
        console.log("hfGetSpaceQuery response.status: ", response.status);
        console.log(
          "hfGetSpaceQuery response.statusText: ",
          response.statusText
        );

        //* Handle response error.
        if (response === undefined || response.status !== 200) {
          console.log("response is undefined or response.status is not 200");
          is_drawing_finished = true;
          await interaction.editReply(
            `Sorry for that server error(${response.statusText}) happened. Please try later.`
          );
          return;
        }

        const json = await response.json();
        const data = json.data[0];
        const duration = json.duration;
        // console.log("data: ", data);
        // console.log("json: ", json);
        // console.log("duration: ", duration);

        // const data_array = data.split(",");
        // const data_header = data.split(",")[0];
        const data_body = data.split(",")[1];

        //* Save image file.
        let filename = Date.now() + ".jpeg";
        const downloadDirectory = path.join(__dirname, DOWNLOAD_DIRECTORY);
        if (!fs.existsSync(downloadDirectory)) {
          console.log(`${downloadDirectory} does not exist, so will make it.`);
          fs.mkdirSync(downloadDirectory);
        }
        const filePath = path.join(__dirname, DOWNLOAD_DIRECTORY + filename);
        fs.writeFileSync(filePath, data_body, { encoding: "base64" });

        is_drawing_finished = true;

        //* Write message for maximum waiting.
        let message;
        if (waiting_count >= MAX_WAITING_COUNT) {
          message = `It took over ${MAX_WAITING_COUNT} seconds. Thanks to wait for drawing.`;
        } else {
          message = `It took ${waiting_count} seconds. Thanks to wait for drawing.`;
        }
        await interaction.editReply(message);
        console.log("-- Send wait counting message.");

        //* Write image attachment message.
        const file = new AttachmentBuilder(filePath);
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Uploading image and prompt...")
          .setDescription(prompt)
          .setImage("attachment://image.jpeg")
          .setFooter({
            text: "Image from hugging face.",
          })
          .setTimestamp();
        const editReplyResult = await interaction.editReply({
          embeds: [embed],
          files: [file],
        });
        // console.log("editReplyResult: ", editReplyResult);
        console.log("-- Send editReply with file attachment.");

        //* Get image cdn url.
        const imageUrl = editReplyResult.attachments.first().url;
        console.log("imageUrl: ", imageUrl);

        //* Post imageUrl and prompt to prompt server.
        try {
          const imageFetchResponse = await fetch(API_POST_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: prompt,
              imageUrl: imageUrl,
              discordBotToken: DISCORD_BOT_TOKEN,
            }),
          });
          console.log("imageFetchResponse: ", imageFetchResponse);
          console.log("imageFetchResponse.status: ", imageFetchResponse.status);
          console.log(
            "imageFetchResponse.statusText: ",
            imageFetchResponse.statusText
          );

          if (imageFetchResponse.status === 200) {
            const content = await imageFetchResponse.json();
            // console.log("content: ", content);
          } else {
            //* Handle post error case.
            console.error(`imageFetchResponse: ${imageFetchResponse}`);
            is_drawing_finished = true;
            await interaction.editReply(
              `Error: ${imageFetchResponse.statusText}`
            );
            return;
          }
        } catch (error) {
          //* Handle post error case.
          console.error(`Try catch error: ${error}`);
          is_drawing_finished = true;
          await interaction.editReply(`Error: ${error}`);
          return;
        }

        //* If uploading succeeded, remove downloaded image file.
        fs.unlink(filePath, async function (error) {
          if (error) {
            console.log(error);
            is_drawing_finished = true;
            await interaction.editReply(`Remove download file error: ${error}`);
            return;
          } else {
            console.log(`Deleted file success: ${filePath}`);
          }
        });

        //* Write mint message title.
        const imageUrlEncodedString = encodeURIComponent(imageUrl);
        const promptEncodedString = encodeURIComponent(prompt);
        const mintUrlWithParams = `${MINT_PAGE_URL}/${promptEncodedString}/${imageUrlEncodedString}`;
        console.log("mintUrlWithParams: ", mintUrlWithParams);

        const mintEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Mint this image with encrypted prompt.")
          .setURL(mintUrlWithParams)
          .setDescription(prompt)
          .setImage("attachment://image.jpeg")
          .setFooter({
            text: "Image from hugging face.",
          })
          .setTimestamp();
        await interaction.editReply({
          embeds: [mintEmbed],
        });
        console.log("-- Send editReply with embed data.");
      });
    } catch (error) {
      console.error(`hfGetSpaceQuery error: ${error}`);
      await interaction.editReply(`Call hfGetSpaceQuery error: ${error}`);
      is_drawing_finished = true;
      return;
    }

    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    //* Calculate the waiting count.
    while (waiting_count < MAX_WAITING_COUNT && is_drawing_finished === false) {
      await interaction.editReply(
        `Waiting for ${waiting_count} seconds (~${MAX_WAITING_COUNT} seconds)`
      );
      await sleep(1000);
      waiting_count++;
    }

    //* Write the wait message.
    if (is_drawing_finished === false) {
      await interaction.editReply(
        `It's too long to wait (maybe over ${MAX_WAITING_COUNT} seconds). Server may update image later. Sorry for late response.`
      );
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Prompt")
        .setDescription(prompt)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log("-- Send editReply with embed data.");
      return;
    }
  },
};
