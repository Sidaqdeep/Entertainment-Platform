import {v2 as cloudinary} from 'cloudinary';
import { response } from 'express';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if(!localFilePath) return null;
    //uploading file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file uploaded on cloudinary, so we can remove it from local file system
    console.log("File uploaded on Cloudinary ", response.url);
    return response;
    
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the locally saved temporary file as the upload operation failed
    return null;
  }
};

export { uploadOnCloudinary };
