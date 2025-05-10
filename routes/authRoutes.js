const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const UserModel = require("../models/User");
require("dotenv").config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Register User
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const userRole = "student"; 

  try {
    const user = await UserModel.findOne({ email });
    if (user) return res.status(400).json("Already registered");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({ name, email, password: hashedPassword, role: userRole });

    const token = jwt.sign({ userId: newUser._id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: "1h" });

    // Send Welcome Email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to NIT Trichy Ecampus!",
      html: `<h2>Hi ${name},</h2><p>Welcome to NIT Trichy Ecampus! 🎉</p>`,
    };

    transporter.sendMail(mailOptions, (err, info) => err ? console.error("Email error:", err) : console.log("Email sent:", info.response));

    res.status(201).json({ userId: newUser._id, token, role: newUser.role });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login User
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(400).json({ message: "No user found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ token, userId: user._id, role: user.role });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

module.exports = router;
