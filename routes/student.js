const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET /api/student/dashboard?email=abc@example.com
router.get("/dashboard", async (req, res) => {
  try {
    const { email } = req.query;
    console.log(email)

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const student = await User.findOne({ email, role: "student" });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    console.log("Found student:", student);//to debug

    const dashboardData = {
      courses: student.dashboardData.courses || [],
      cgpa: student.dashboardData.cgpa || "N/A",
      lastGpa: student.dashboardData.lastGpa || "N/A",
      assignments: student.dashboardData.assignments || [],
      schedule: student.dashboardData.schedule || [],
      announcements: student.dashboardData.announcements || "No announcements",
      activity: student.dashboardData.activity || "No activity",
    };

    console.log(`Dashboard data for ${email} fetched successfully.`);//to debug
    console.log("Sending dashboardData:", dashboardData); //to debug

    res.status(200).json({
      email: student.email,
      name: student.name,
      dashboardData,
    });
  } catch (error) {
    console.error("Error fetching student dashboard:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;