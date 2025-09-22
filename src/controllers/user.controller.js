import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";//ye db se baat karr rha hai
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


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

const refreshAccessToken = asyncHandler(async (req, res) => {
    // Logic for refreshing access token
    // 1. Get refresh token from cookies
    // 2. Verify refresh token
    // 3. Check if refresh token is in database
    // 4. Generate new access token
    // 5. Send new access token in cookie and response

    // 1. Get refresh token from cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }
    try {
        // 2. Verify refresh token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user=await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401, "Inavlid refresh token - user not found");
        }
    
        if(user?.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Refresh token is expired or used or mismatched");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        };
        // 4. Generate new access token
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
        // 5. Send new access token in cookie and response
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed successfully"
            )
        );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isOldPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    );
});

const getCurrentUser= asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Current user fetched successfully"
    ));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    // Logic for updating account details
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "Full name and email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { 
                fullName,
                email
             },
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500, "Error while uploading avatar.");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: {
                 avatar: avatar.url
            }
         },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "User avatar updated successfully"
        )
    );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500, "Error while uploading cover image.");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: {
                 coverImage: coverImage.url
         }
         },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "User cover image updated successfully"
        )
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing");
    }
    //pipeline bna rahe hai
    const channel= await User.aggregate([
        {//user ko match krrha hai username se
            $match: { username: username?.toLowerCase()
            }
        },
        {//documents bna rahe no of subscribers ke
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {//documents bna rahe no of channels ke jisme user subscribed hai
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {//counting the no of subscribers and channels subscribed to
            $addFields: {
                subscribersCount: {
                     $size: "$subscribers"
              },
                channelsSubscribedToCount: { $size: "$subscribedTo"
                },
                isSubscribed: {//checking if user is subscribed to the channel
                    $cond: {
                        if: { 
                            $in: [ req.user?._id, "$subscribers.subscriber" ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {//projecting the required fields
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            channel[0],
            "User channel profile fetched successfully"
        )
    );
})

export { registerUser,
        loginUser, 
        logoutUser,
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateAccountDetails,
        updateUserAvatar,
        updateUserCoverImage,
        getUserChannelProfile
};
