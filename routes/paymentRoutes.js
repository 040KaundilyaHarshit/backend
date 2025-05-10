const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const UserModel = require("../models/User");
const PaymentModel = require("../models/Payment");
const ApplicationForm = require("../models/ApplicationForm");

// Fetch all application forms for a student
router.get("/applied-courses", auth, async (req, res) => {
  try {
    const studentId = req.user.userId;
    if (!studentId) {
      return res.status(401).json({ message: "User ID not found in request. Please log in again." });
    }

    // Verify user exists
    const user = await UserModel.findById(studentId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Fetch all application forms for the student
    const applications = await ApplicationForm.find({ studentId })
      .populate({
        path: "courseId",
        select: "title fee",
      })
      .lean(); // Use lean() for better performance by returning plain JS objects

    // Filter and map applications to include only those with valid course data
    const courses = [];
    const invalidApplications = [];

    applications.forEach(app => {
      const courseData = app.courseId;
      if (courseData && courseData._id && courseData.title) {
        // Valid course data
        courses.push({
          applicationId: app._id,
          courseId: courseData._id,
          courseName: courseData.title,
          amount: courseData.fee || 50000, // Default fee if not specified
          lastDate: "March 31, 2025", // Fixed for now
          status: app.status || "pending", // Include status with default
        });
      } else {
        // Log invalid application for debugging
        invalidApplications.push({
          applicationId: app._id,
          courseId: app.courseId ? app.courseId._id : null,
          reason: !courseData ? "Missing course data" : !courseData.title ? "Missing course title" : "Invalid course ID",
        });
      }
    });

    // Log the results for debugging
    console.log("Fetched applied courses for student", studentId, ":", courses);
    if (invalidApplications.length > 0) {
      console.warn("Invalid applications found:", invalidApplications);
    }

    if (courses.length === 0 && invalidApplications.length > 0) {
      return res.status(404).json({ 
        message: "No valid applications found. Some applications have invalid course references.",
        invalidApplications 
      });
    }

    res.json(courses);
  } catch (error) {
    console.error("Error fetching applied courses:", {
      message: error.message,
      stack: error.stack,
      studentId: req.user?.userId,
    });
    res.status(500).json({ message: "Error fetching applied courses", error: error.message });
  }
});

// Process payment for a specific application form
router.post("/process", auth, async (req, res) => {
  try {
    const { applicationId, courseId, courseName, amount, paymentMethod, lastDate } = req.body;
    const userId = req.user.userId;

    if (!applicationId || !courseId || !courseName || !amount || !paymentMethod || !lastDate) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if payment already exists for this application
    const existingPayment = await PaymentModel.findOne({ userId, applicationId });
    if (existingPayment) {
      return res.status(400).json({ message: "Payment already processed for this application." });
    }

    // Verify the application exists
    const application = await ApplicationForm.findOne({ 
      _id: applicationId, 
      studentId: userId 
    });
    if (!application) {
      return res.status(404).json({ message: "Application not found." });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const payment = new PaymentModel({
      userId,
      name: user.name,
      email: user.email,
      applicationId,
      courseId,
      courseName,
      amount,
      paymentMethod,
      lastDate,
      status: "completed",
    });

    await payment.save();

    // Update user's payment history
    user.payments.push(payment._id);
    await user.save();

    res.status(201).json({ message: "Payment processed successfully", payment });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
});

// Fetch payment history for a user
router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const payments = await PaymentModel.find({ userId }).populate("courseId");
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Error fetching payment history", error });
  }
});

// Fetch user details (name and email)
router.get("/user-details", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await UserModel.findById(userId).select("name email");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ name: user.name, email: user.email });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error });
  }
});

module.exports = router;