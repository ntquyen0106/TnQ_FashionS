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
    const { token, user } = await auth.register({ email, password, name });
    res.cookie("token", token, cookieOpts);
    res.json({ user });
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
