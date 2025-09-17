import {v2 as cloudinary} from 'cloudinary';
import { response } from 'express';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
   
  try {
    
    if(!localFilePath) return null;
   if (!fs.existsSync(localFilePath)) {
      console.log("File does not exist:", localFilePath);
      return null;
    }
    //uploading file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log(response);
    //file uploaded on cloudinary, so we can remove it from local file system
    // console.log("File uploaded on Cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    // console.log("Local file deleted ", localFilePath);
    return response;

  } catch (error) {
  console.error("Cloudinary upload error:", error);
  if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }
  return null;
}
}

export { uploadOnCloudinary }
