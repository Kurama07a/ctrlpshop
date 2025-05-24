const { createClient } = require("@supabase/supabase-js");
const fs = require("fs").promises;
const path = require("path");
const { SUPABASE_URL, SUPABASE_KEY, BUCKET_NAME, getFilePaths } = require("../../constants");

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      fetch: (url, options) => {
        options.duplex = "half";
        return fetch(url, options);
      },
    });
  }
  return supabase;
}

async function downloadFileFromSupabase(fileName) {
  const client = getSupabaseClient();
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .download(fileName);

  if (error) throw error;
  if (!data) throw new Error("No data received from Supabase");

  const { TEMP_DIR } = getFilePaths();
  const filePath = path.join(TEMP_DIR, fileName);
  await fs.writeFile(filePath, Buffer.from(await data.arrayBuffer()));
  
  console.log(`File downloaded to temp directory: ${fileName}`);
  return filePath;
}

module.exports = {
  getSupabaseClient,
  downloadFileFromSupabase
};