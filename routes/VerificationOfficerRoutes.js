const express = require("express");
const router = express.Router();
const { auth, authorize } = require("../middleware/auth");
const UserModel = require("../models/User");
const ApplicationForm = require("../models/ApplicationForm");
const PaymentModel = require("../models/Payment");

router.get("/assigned-students", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const applications = await ApplicationForm.find({
      assignedOfficer: req.user.userId,
    }).populate("studentId", "_id name email registrationNumber verified verifiedBy");

    const assignedStudents = Array.from(
      new Map(
        applications
          .filter((app) => app.studentId)
          .map((app) => [app.studentId._id.toString(), app.studentId])
      ).values()
    );

    res.json(assignedStudents);
  } catch (error) {
    console.error("Error fetching assigned students:", error);
    res.status(500).json({
      message: "Failed to fetch assigned students",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.get("/assigned-applications", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const applications = await ApplicationForm.find({
      assignedOfficer: req.user.userId,
    })
      .populate({
        path: "studentId",
        select: "name email registrationNumber verified verifiedBy",
        populate: { path: "verifiedBy", select: "name role" },
      })
      .populate({
        path: "courseId",
        select: "title description",
      })
      .sort({ createdAt: -1 });

    const applicationsWithPayments = await Promise.all(
      applications.map(async (app) => {
        const payment = await PaymentModel.findOne({ applicationId: app._id }).select(
          "amount paymentMethod paymentDate status"
        );
        return {
          ...app.toObject(),
          payment: payment ? {
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate,
            status: payment.status,
          } : null,
        };
      })
    );

    res.json(applicationsWithPayments);
  } catch (error) {
    console.error("Error fetching officer applications:", error);
    res.status(500).json({
      message: "Failed to fetch assigned applications",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.put("/students/:studentId/verify", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({ message: "Verified status must be a boolean" });
    }

    const application = await ApplicationForm.findOne({
      studentId,
      assignedOfficer: req.user.userId,
    });

    if (!application) {
      return res.status(403).json({ message: "Not authorized to verify this student" });
    }

    const student = await UserModel.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.verified = verified;
    student.verifiedBy = verified ? req.user.userId : null;
    await student.save();

    res.json({ message: `Student ${verified ? "verified" : "unverified"} successfully`, student });
  } catch (error) {
    console.error("Error verifying student:", error);
    res.status(500).json({
      message: "Failed to verify student",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.get("/profile", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const officer = await UserModel.findById(req.user.userId).select("name");
    if (!officer) {
      return res.status(404).json({ message: "Officer not found" });
    }
    res.json({ name: officer.name });
  } catch (error) {
    console.error("Error fetching officer profile:", error);
    res.status(500).json({
      message: "Failed to fetch officer profile",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.post("/verify-application/:applicationId", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { verified, comments, fieldComments } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({ message: "Verified status must be a boolean" });
    }

    const application = await ApplicationForm.findById(applicationId).populate(
      "studentId",
      "name email verified verifiedBy"
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (!application.studentId) {
      return res.status(400).json({ message: "Invalid application: No student associated" });
    }

    if (application.assignedOfficer?.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to verify this application" });
    }

    if (verified) {
      const payment = await PaymentModel.findOne({ applicationId });
      if (!payment || payment.status !== "completed") {
        return res.status(400).json({ message: "Cannot verify application: No completed payment found" });
      }
    }

    application.formData.verificationStatus = verified ? "verified" : "rejected";
    application.formData.verificationComments = comments || "";
    application.verified = verified;
    application.verifiedBy = verified ? req.user.userId : null;
    application.status = verified ? "verified" : "rejected";
    if (fieldComments && typeof fieldComments === "object") {
      application.fieldComments = new Map(Object.entries(fieldComments));
      if (Object.keys(fieldComments).length > 0 || comments) {
        application.commentsRead = false;
      }
    }
    await application.save();

    application.studentId.verified = verified;
    application.studentId.verifiedBy = verified ? req.user.userId : null;
    await application.studentId.save();

    res.json({ message: `Application ${verified ? "verified" : "rejected"} successfully` });
  } catch (error) {
    console.error("Error verifying application:", error);
    res.status(500).json({
      message: "Failed to verify application",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.post("/save-application-comments/:applicationId", auth, authorize(["verification_officer"]), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { comments, fieldComments } = req.body;

    const application = await ApplicationForm.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.assignedOfficer?.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to modify this application" });
    }

    if (comments) {
      application.formData.verificationComments = comments;
    }
    if (fieldComments && typeof fieldComments === "object") {
      application.fieldComments = new Map(Object.entries(fieldComments));
    }
    if (comments || (fieldComments && Object.keys(fieldComments).length > 0)) {
      application.commentsRead = false;
    }
    await application.save();

    res.json({ message: "Comments saved successfully" });
  } catch (error) {
    console.error("Error saving application comments:", error);
    res.status(500).json({
      message: "Failed to save comments",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

module.exports = router;