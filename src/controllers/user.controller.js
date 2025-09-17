import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";//ye db se baat karr rha hai
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // Registration logic here
   const{fullName, email, password, username} = req.body;//1
   console.log("email:", email);

   if(
    [fullName, email, password, username].some((field) => //2
        field?.trim()==="") 
    ){
        throw new ApiError(400, "All fields are required");
    }
    //3
    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists with this email or username");
    }
    console.log("req.files:", req.files);
    //4

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    //5
    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Could not upload avatar. Please try again later.");
    }

    //6
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url,
        email,
        password,
        username: username.toLowerCase(),

    });
    //7
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    //8
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user.");
    }
    //9
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )

});

export { registerUser };
