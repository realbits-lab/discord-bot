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
    .setDescription("Draw an picture.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("The prompt to draw an picture.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("negative_prompt")
        .setDescription("The negative prompt to draw an picture.")
        .setRequired(false)
    ),

  //* Command process.
  async execute(interaction) {
    console.log("call /draw command");

    //*-------------------------------------------------------------------------
    //* Define variables.
    //*-------------------------------------------------------------------------
    const TEXT2IMG_API_URL = "https://stablediffusionapi.com/api/v3/text2img";
    //* Seconds unit.
    const MAX_WAITING_COUNT = 25;
    const DOWNLOAD_DIRECTORY = "../download_files/";
    //* NFT minting page url address.
    const MINT_PAGE_URL = process.env.MINT_PAGE_URL;
    //* Image upload url address.
    const IMAGE_UPLOAD_API_URL = process.env.IMAGE_UPLOAD_API_URL;
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    // console.log("process.env.MINT_PAGE_URL: ", process.env.MINT_PAGE_URL);
    // console.log("process.env.IMAGE_UPLOAD_API_URL: ", process.env.IMAGE_UPLOAD_API_URL);

    let waiting_count = 0;
    let is_drawing_finished = false;
    await interaction.reply("Wait a moment for drawing ...");
    console.log("-- Send waiting message.");

    //*-------------------------------------------------------------------------
    //* Get the prompt input.
    //*-------------------------------------------------------------------------
    const prompt = interaction.options.getString("prompt");
    const negativePrompt = interaction.options.getString("negative_prompt");
    console.log("prompt: ", prompt);
    console.log("negativePrompt: ", negativePrompt);

    const jsonData = {
      key: process.env.STABLE_DIFFUSION_API_KEY,
      prompt: prompt,
      negative_prompt: negativePrompt,
      width: "512",
      height: "512",
      samples: "1",
      num_inference_steps: "20",
      safety_checker: "yes",
      enhance_prompt: "no",
      seed: null,
      guidance_scale: 7.5,
      webhook: null,
      track_id: null,
    };

    let jsonResponse;

    //*-------------------------------------------------------------------------
    //* Get the image with prompt.
    //*-------------------------------------------------------------------------
    fetch(TEXT2IMG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonData),
    })
      .then(async function (fetchResponse) {
        // console.log("fetchResponse: ", fetchResponse);
        jsonResponse = await fetchResponse.json();
        // console.log("jsonResponse: ", jsonResponse);

        //* TODO: Check error response.
        if (jsonResponse.status !== "success") {
          is_drawing_finished = true;
          await interaction.editReply(`Error: Image server is not connected.`);
          return;
        }

        //* Download image data from image generation server.
        const imageFetchResponse = await fetch(jsonResponse.output);

        //* Save image file.
        let filename = Date.now() + ".png";
        const downloadDirectory = path.join(__dirname, DOWNLOAD_DIRECTORY);
        if (!fs.existsSync(downloadDirectory)) {
          console.log(`${downloadDirectory} does not exist, so will make it.`);
          fs.mkdirSync(downloadDirectory);
        }
        const filePath = path.join(__dirname, DOWNLOAD_DIRECTORY + filename);
        const fileStream = fs.createWriteStream(filePath);
        await imageFetchResponse.body.pipe(fileStream);

        //* After download completed, close filestream.
        fileStream.on("finish", async function () {
          fileStream.close();

          //* Set drawing status finished.
          is_drawing_finished = true;

          //* Write message for waiting count.
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
          let description = "";
          if (negativePrompt) {
            description = `${prompt} (neg: ${negativePrompt})`;
          } else {
            description = prompt;
          }
          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Uploading image and prompt...")
            .setDescription(description)
            .setImage("attachment://image.png")
            .setFooter({
              text: "Image from realbits.",
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
            const imageUploadResponse = await fetch(IMAGE_UPLOAD_API_URL, {
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

            if (imageUploadResponse.status === 200) {
              const content = await imageUploadResponse.json();
              // console.log("content: ", content);
            } else {
              //* Handle post error case.
              console.error(`imageUploadResponse: ${imageUploadResponse}`);
              is_drawing_finished = true;
              await interaction.editReply(
                `Error: ${imageUploadResponse.statusText}`
              );
              return;
            }
          } catch (error) {
            //* Handle post error case.
            console.error(`Try catch error: ${error}`);
            is_drawing_finished = true;
            await interaction.editReply(`Error: ${error}`);
            return;
          } finally {
            //* Remove downloaded image file.
            fs.unlink(filePath, async function (error) {
              if (error) {
                console.log(error);
                is_drawing_finished = true;
                await interaction.editReply(
                  `Remove download file error: ${error}`
                );
                return;
              } else {
                console.log(`Deleted file success: ${filePath}`);
              }
            });
          }

          //* Write mint message title.
          const imageUrlEncodedString = encodeURIComponent(imageUrl);
          const promptEncodedString = encodeURIComponent(prompt);
          const mintUrlWithParams = `${MINT_PAGE_URL}/${promptEncodedString}/${imageUrlEncodedString}`;
          console.log("mintUrlWithParams: ", mintUrlWithParams);

          const mintEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Mint this image with encrypted prompt.")
            .setURL(mintUrlWithParams)
            .setDescription(description)
            .setImage("attachment://image.png")
            .setFooter({
              text: "Image from realbits.",
            })
            .setTimestamp();
          await interaction.editReply({
            embeds: [mintEmbed],
          });
          console.log("-- Send editReply with embed data.");

          is_drawing_finished = true;
        });
      })
      .catch(async function (error) {
        is_drawing_finished = true;
        await interaction.editReply(`Error: Fetching image can't work.`);
        return;
      });

    //* Start a function to wait a result while emitting message.
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
