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
    .setDescription("Draw command.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Draw image as prompt.")
        .setRequired(true)
    ),

  //* Command process.
  async execute(interaction) {
    console.log("call /draw");

    const MAX_WAITING_COUNT = 25;
    const DOWNLOAD_DIRECTORY = "../download_files/";
    const MINT_PAGE_URL = process.env.MINT_PAGE_URL;
    const API_POST_URL = process.env.API_POST_URL;
    console.log("MINT_PAGE_URL: ", MINT_PAGE_URL);
    console.log("API_POST_URL: ", API_POST_URL);

    let waiting_count = 0;
    let is_drawing_finished = false;
    await interaction.reply("Wait a moment for drawing ...");

    const prompt = interaction.options.getString("prompt");
    console.log("prompt: ", prompt);
    try {
      //* Call hugging space with prompt and get response.
      hfGetSpaceQuery(prompt).then(async (response) => {
        // console.log("response: ", response);
        console.log("response.status: ", response.status);
        console.log("response.statusText: ", response.statusText);

        //* Handle response error.
        if (response === undefined || response.status !== 200) {
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

        //* Write image attachment message.
        const file = new AttachmentBuilder(filePath);
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Mint this image with encrypted prompt.")
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

        //* Get image cdn url.
        const imageUrl = editReplyResult.attachments.first().url;
        console.log("imageUrl: ", imageUrl);

        //* Post imageUrl and prompt to prompt server.
        try {
          const fetchResponse = await fetch(API_POST_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: prompt, imageUrl: imageUrl }),
          });
          console.log("fetchResponse.status: ", fetchResponse.status);
          console.log("fetchResponse.statusText: ", fetchResponse.statusText);

          if (fetchResponse.status === 200) {
            const content = await fetchResponse.json();
            console.log("content: ", content);
          } else {
            //* Handle post error case.
            console.error(fetchResponse);
            is_drawing_finished = true;
            await interaction.editReply(`Error: ${fetchResponse.statusText}`);
            return;
          }
        } catch (error) {
          //* Handle post error case.
          console.error(error);
          is_drawing_finished = true;
          await interaction.editReply(`Error: ${error}`);
          return;
        }

        //* If uploading succeeded, remove downloaded image file.
        fs.unlink(filePath, (error) => {
          if (error) {
            console.log(error);
            is_drawing_finished = true;
            return;
          } else {
            console.log(`Deleted file: ${filePath}`);
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
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply(`Error: ${error}`);
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
    }
  },
};
