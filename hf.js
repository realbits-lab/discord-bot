require("dotenv").config();
const fetch = require("node-fetch-commonjs");
const commandLineArgs = require("command-line-args");

const optionDefinitions = [
  { name: "list-model", alias: "l", type: Boolean },
  { name: "get-model", alias: "g", type: Boolean },
  { name: "get-space", alias: "s", type: Boolean },
  { name: "model", alias: "m", type: String },
  { name: "prompt", alias: "p", type: String },
];

async function hfAPIGETQuery(api) {
  try {
    const response = await fetch(`https://huggingface.co${api}`, {
      headers: { Authorization: `Bearer ${process.env.HF_API_TOKEN}` },
      method: "GET",
    });
    return response;
  } catch (error) {
    console.error(error);
  }
}

async function hfGetSpaceQuery(data) {
  try {
    const response = await fetch(
      "https://thomasjeon-dulls.hf.space/run/predict",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [data],
        }),
      }
    );
    return response;
  } catch (error) {
    console.error(error);
  }
}
exports.hfGetSpaceQuery = hfGetSpaceQuery;

async function hfGetModelQuery(model, data) {
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: { Authorization: `Bearer ${process.env.HF_API_TOKEN}` },
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response;
  } catch (error) {
    console.error(error);
  }
}

async function main() {
  // Get command arguments.
  let options;
  try {
    options = commandLineArgs(optionDefinitions);
    console.log("options: ", options);
  } catch (error) {
    console.error(error);
  }

  // Get model list.
  if (options["list-model"] === true) {
    const response = await hfAPIGETQuery("/api/models");
    console.log("response: ", response);
    const data = await response.json();
    console.log("data: ", data);
  }

  // Get model output.
  else if (options["get-model"] === true) {
    const prompt = options["prompt"];
    const model = options["model"];
    const response = await hfGetModelQuery(model, {
      input: { input: prompt },
    });
    console.log("response: ", response);
  }

  // Get space output.
  else if (options["get-space"] === true) {
    const prompt = options["prompt"];
    const response = await hfGetSpaceQuery(prompt);
    console.log("response: ", response);
    const json = await response.json();
    const data = json.data;
    const duration = json.duration;
    console.log("data: ", data);
    console.log("duration: ", duration);
  }
}

// main();
