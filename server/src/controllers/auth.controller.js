import * as auth from "../services/auth.service.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 ngày
};

export const postLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await auth.login({ email, password });
    res.cookie("token", token, cookieOpts);
    res.json({ user });
  } catch (e) { next(e); }
};

//register user
export const postRegister = async (req, res, next) => {
    try {
    const { email, password, name } = req.body;
    const result = await auth.register({ email, password, name });
    res.json(result);
  } catch (e) { next(e); }
};

//verify otp
export const postVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp, password, name } = req.body;
    const result = await auth.verifyOtp({ email, otp, password, name });
    res.json(result);
  } catch (e) { next(e); }
};


//add address if address not exists
export const postAddAddress = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthenticated" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Unauthenticated" });

    const { address } = req.body;
    if (!address) return res.status(400).json({ message: "Address is required" });

    user.address = user.address || [];
    user.address.push(address);
    await user.save();

    res.json({ user: auth.sanitize(user) });
  } catch (e) { next(e); }
};

//Login bằng firebase
export const postFirebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "Missing idToken" });

    // Xác thực token với Firebase
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Lấy thông tin user từ Firebase
    const { email, name, uid, picture } = decoded;

    // Tìm hoặc tạo user trong MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name || "No Name",
        passwordHash: uid, // Có thể random hoặc để uid, vì không dùng password
        avatar: picture,
        role: "user",
        status: "active"
      });
    }

    // Tạo JWT cho client
    const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: 60 * 60 * 24 * 7
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.json({ user: sanitize(user) });
  } catch (e) {
    next(e);
  }
};

//Resend OTP
export const postResendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await auth.resendOtp({ email });
    res.json(result);
  } catch (e) { next(e); }
};

//Get My information
export const getMe = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const me = await User.findById(payload.sub);
    if (!me) return res.status(401).json({ message: "Unauthenticated" });
    res.json({ user: auth.sanitize(me) });
  } catch (e) { next(e); }
};

export const postLogout = async (req, res) => {
  res.clearCookie("token", { ...cookieOpts, maxAge: 0 });
  res.json({ message: "Logged out" });
};
