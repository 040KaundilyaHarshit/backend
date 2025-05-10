const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { auth, authorize } = require("../middleware/auth");
const UserModel = require("../models/User");
const ApplicationForm = require("../models/ApplicationForm");
const CourseModel = require("../models/Course");

router.get("/users", auth, authorize(["verification_admin"]), async (req, res) => {
  try {
    const allUsers = await UserModel.find()
      .select("name email role verified verifiedBy verificationComment courses")
      .populate("verifiedBy", "name");
    res.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.get("/verification-officers", auth, authorize(["verification_admin"]), async (req, res) => {
  try {
    const officers = await UserModel.find({ role: "verification_officer" });
    res.json(officers);
  } catch (error) {
    console.error("Error fetching officers:", error);
    res.status(500).json({
      message: "Failed to fetch officers",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.get("/courses/:courseId/users", auth, authorize(["verification_admin"]), async (req, res) => {
  const { courseId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }
    console.log(`Querying users for courseId: ${courseId}`);
    const students = await UserModel.find({ courses: new mongoose.Types.ObjectId(courseId) })
      .select("name email verified verifiedBy verificationComment")
      .populate("verifiedBy", "name")
      .lean();
    console.log(`Found ${students.length} students for courseId: ${courseId}`, students.map(s => ({ _id: s._id, name: s.name, email: s.email })));
    res.json(students);
  } catch (error) {
    console.error("Error fetching students for course:", {
      courseId,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    res.status(500).json({
      message: "Failed to fetch students for course",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

router.get("/users/:id", auth, authorize(["verification_admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await UserModel.findById(id)
      .select("name email role verified verifiedBy verificationComment")
      .populate("verifiedBy", "name");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      message: "Failed to fetch user",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.put("/users/:id/verify", auth, authorize(["verification_admin"]), async (req, res) => {
  const { id } = req.params;
  const { verified, verificationComment } = req.body;
  try {
    if (typeof verified !== "boolean") {
      return res.status(400).json({ message: "Verified status must be a boolean" });
    }
    const user = await UserModel.findByIdAndUpdate(
      id,
      { 
        verified, 
        verifiedBy: verified ? req.user.userId : null,
        verificationComment: verified ? verificationComment || "" : ""
      },
      { new: true }
    )
      .select("name email role verified verifiedBy verificationComment")
      .populate("verifiedBy", "name");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Verification status updated", user });
  } catch (error) {
    console.error("Error updating verification status:", error);
    res.status(500).json({
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.put("/students/:studentId/assign", auth, authorize(["verification_admin"]), async (req, res) => {
  const { studentId } = req.params;
  const { officerId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(officerId)) {
      return res.status(400).json({ message: "Invalid officer ID" });
    }
    const officer = await UserModel.findById(officerId);
    if (!officer || officer.role !== "verification_officer") {
      return res.status(400).json({ message: "Invalid officer ID" });
    }
    const updatedApplication = await ApplicationForm.findOneAndUpdate(
      { studentId },
      { assignedOfficer: officerId },
      { new: true }
    )
      .select("studentId assignedOfficer")
      .populate("studentId", "name email");
    if (!updatedApplication) {
      return res.status(404).json({ message: "Application not found for student" });
    }
    res.json({ message: "Student assigned", updatedApplication });
  } catch (error) {
    console.error("Error assigning student:", error);
    res.status(500).json({
      message: "Error assigning student",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.get("/courses/:courseId/applications-count", auth, authorize(["verification_admin"]), async (req, res) => {
  const { courseId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const applications = await ApplicationForm.find({
      courseId: new mongoose.Types.ObjectId(courseId)
    }).populate({
      path: "studentId",
      select: "name email",
      match: { _id: { $exists: true } }
    });
    const stats = {
      total: applications.length,
      pending: applications.filter(app => app.status === "pending").length,
      verified: applications.filter(app => app.status === "verified").length,
      rejected: applications.filter(app => app.status === "rejected").length,
      validStudents: applications.filter(app => app.studentId).length,
      invalidStudents: applications.filter(app => !app.studentId).length
    };
    res.json({
      message: `Application statistics for course ${course.title}`,
      courseId,
      stats
    });
  } catch (error) {
    console.error("Error fetching application count:", error);
    res.status(500).json({
      message: "Failed to fetch application count",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.post("/courses/:courseId/assign-officers", auth, authorize(["verification_admin"]), async (req, res) => {
  const { courseId } = req.params;
  const { batchSize } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Check if course exists
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get all applications for this course (not just pending)
    const applications = await ApplicationForm.find({
      courseId: new mongoose.Types.ObjectId(courseId)
    }).populate({
      path: "studentId",
      select: "name email",
      match: { _id: { $exists: true } }
    });

    // Filter out applications with invalid studentId
    const validApplications = applications.filter(app => app.studentId);
    if (validApplications.length === 0) {
      return res.status(404).json({ message: "No valid applications found for this course" });
    }

    console.log(`Found ${validApplications.length} valid applications for course ${courseId}`, {
      applicationIds: validApplications.map(app => app._id),
      studentIds: validApplications.map(app => app.studentId._id),
      statuses: validApplications.map(app => app.status)
    });

    // Get verification officers assigned to this course
    const officers = await UserModel.find({ 
      role: "verification_officer",
      courses: new mongoose.Types.ObjectId(courseId)
    });
    if (officers.length === 0) {
      return res.status(400).json({ message: "No verification officers assigned to this course" });
    }

    // Distribute applications among officers
    let officerIndex = 0;
    const assignments = [];
    
    for (let i = 0; i < validApplications.length; i += batchSize) {
      const currentOfficer = officers[officerIndex % officers.length];
      const batch = validApplications.slice(i, i + batchSize);

      for (const app of batch) {
        const updatedApp = await ApplicationForm.findByIdAndUpdate(
          app._id,
          { assignedOfficer: currentOfficer._id },
          { new: true }
        );
        assignments.push({
          studentId: app.studentId._id,
          officerId: currentOfficer._id,
          officerName: currentOfficer.name,
          applicationStatus: app.status
        });
        console.log(`Assigned application ${app._id} (status: ${app.status}) to officer ${currentOfficer._id}`);
      }

      officerIndex++;
    }

    res.json({
      message: `Applications distributed successfully among ${officers.length} officers`,
      totalAssigned: assignments.length,
      assignments
    });
  } catch (error) {
    console.error("Error assigning officers:", {
      courseId,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
    res.status(500).json({
      message: "Failed to assign officers",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.post("/courses/:courseId/unassign-officers", auth, authorize(["verification_admin"]), async (req, res) => {
  const { courseId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Check if course exists
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Update all applications for this course to remove assignedOfficer
    const updateResult = await ApplicationForm.updateMany(
      { courseId: new mongoose.Types.ObjectId(courseId) },
      { $set: { assignedOfficer: null } }
    );

    console.log(`Unassigned officers for course ${courseId}`, {
      modifiedCount: updateResult.modifiedCount,
      matchedCount: updateResult.matchedCount
    });

    res.json({
      message: `Successfully unassigned officers for ${updateResult.matchedCount} applications`,
      totalUnassigned: updateResult.modifiedCount
    });
  } catch (error) {
    console.error("Error unassigning officers:", {
      courseId,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
    res.status(500).json({
      message: "Failed to unassign officers",
      error: process.env.NODE_ENV === "development" ? error : error.message,
    });
  }
});

router.get("/applications", auth, authorize(["verification_admin"]), async (req, res) => {
  try {
    const applications = await ApplicationForm.find({
      $and: [
        { studentId: { $exists: true, $ne: null } },
        { courseId: { $exists: true, $ne: null } },
      ],
    })
      .populate({
        path: "studentId",
        select: "name email registrationNumber verified verifiedBy verificationComment",
        match: { _id: { $exists: true } },
        populate: {
          path: "verifiedBy",
          select: "name role",
          options: { strictPopulate: false },
        },
      })
      .populate({
        path: "courseId",
        select: "title",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "assignedOfficer",
        select: "name role",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "verifiedBy",
        select: "name role",
        match: { _id: { $exists: true } },
      })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Fetched ${applications.length} applications`, {
      applicationIds: applications.map((app) => app._id),
    });

    const validApplications = applications.filter(
      (app) => app.studentId && app.courseId
    );

    const invalidApplications = applications.filter(
      (app) => !app.studentId || !app.courseId
    );
    if (invalidApplications.length > 0) {
      console.warn("Found invalid applications after population:", {
        count: invalidApplications.length,
        details: invalidApplications.map((app) => ({
          _id: app._id,
          studentId: app.studentId ? app.studentId._id : "missing",
          courseId: app.courseId ? app.courseId._id : "missing",
        })),
      });
    }

    if (validApplications.length === 0) {
      console.warn("No valid applications found in the database");
    }

    const applicationsWithStatus = validApplications.map((app) => ({
      ...app,
      status: app.status || "pending",
    }));

    res.json(applicationsWithStatus);
  } catch (error) {
    console.error("Error fetching applications:", {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      requestUser: req.user ? req.user.userId : "unknown",
    });
    res.status(500).json({
      message: "Failed to fetch applications",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

module.exports = router;