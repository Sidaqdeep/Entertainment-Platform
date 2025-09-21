import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";//ye db se baat karr rha hai
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens= async(userId) =>
{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        //database me store krna hai
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating tokens");
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    // Login logic here
    //1.req.body-> data
    //2.username or email
    //3.find the user
    //4.compare password
    //5.generate access and refresh token
    //6.send cookie
    //7.send response

    //1
    const { email,username, password } = req.body;

    //2
    if(!username && !email){
        throw new ApiError(400, "Username or email is required");
    }

    //3.find the user
    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    //4.compare password
    //here isPasswordCorrect is instance method of userSchema
    //jo user milaa hai uska password compare krrha hai
    //jo user milaa hai uska method call krrha hai
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    //5.generate access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    //6.send cookie

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken,options)
    .json(
        new ApiResponse(
            200, 
            { user: loggedInUser,accessToken,refreshToken

            },
            "User logged in successfully"
        )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,//ye req.user auth.middleware se aa rha hai
         { 
            $set: { 
                refreshToken: undefined 
            }
         },
         {
             new: true 
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200, 
            {},
            "User logged out successfully"
        )
    );


})


export { registerUser, loginUser, logoutUser };




