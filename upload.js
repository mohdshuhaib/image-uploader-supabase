// Load environment variables from our .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and Key must be provided in the .env file.");
  process.exit(1);
}

// Initialize the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// --- CONFIGURATION ---
// The name of your storage bucket in Supabase
const BUCKET_NAME = 'student-images';
// The path to the folder on your computer containing the images
const IMAGES_FOLDER_PATH = path.join(__dirname, 'images-to-upload');
// ---------------------

async function uploadImages() {
  console.log('Starting image upload process...');

  try {
    // 1. Read all files from the local images folder
    const files = fs.readdirSync(IMAGES_FOLDER_PATH);
    console.log(`Found ${files.length} images to upload.`);

    for (const file of files) {
      const filePath = path.join(IMAGES_FOLDER_PATH, file);

      // 2. Extract the CIC number from the filename (e.g., "12345.jpg" -> "12345")
      const cic = path.parse(file).name;

      console.log(`\nProcessing student CIC: ${cic}`);

      // 3. Read the image file from your disk
      const fileBuffer = fs.readFileSync(filePath);

      // 4. Upload the image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(file, fileBuffer, {
          contentType: `image/${path.extname(file).substring(1)}`, // e.g., 'image/jpeg'
          upsert: true, // Overwrite if the file already exists
        });

      if (uploadError) {
        console.error(`  - Failed to upload ${file}:`, uploadError.message);
        continue; // Skip to the next file
      }
      console.log(`  - Successfully uploaded ${file} to Storage.`);

      // 5. Get the public URL of the uploaded image
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path);

      const imageUrl = urlData.publicUrl;
      console.log(`  - Public URL: ${imageUrl}`);

      // 6. Insert or update the record in the 'images' database table
      const { error: dbError } = await supabase
        .from('images')
        .upsert({
          cic: cic,
          image_link: imageUrl,
        });

      if (dbError) {
        console.error(`  - Failed to save link to database for CIC ${cic}:`, dbError.message);
      } else {
        console.log(`  - Successfully saved image link for CIC ${cic} in the database.`);
      }
    }
    console.log('\n✅ All images processed!');

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
  }
}

// Run the script
uploadImages();
