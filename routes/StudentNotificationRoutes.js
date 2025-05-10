const express = require("express");
const router = express.Router();
const { auth, authorize } = require("../middleware/auth");
const ApplicationForm = require("../models/ApplicationForm");

router.get("/student-notifications", auth, authorize(["student"]), async (req, res) => {
  try {
    const applications = await ApplicationForm.find({
      studentId: req.user.userId,
      $or: [
        { "formData.verificationComments": { $ne: "" } },
        { fieldComments: { $exists: true, $ne: {} } },
      ],
    })
      .populate({
        path: "courseId",
        select: "title",
      })
      .populate({
        path: "verifiedBy",
        select: "name",
      })
      .select("formData fieldComments commentsRead updatedAt")
      .lean();

    const notifications = applications
      .map((app) => {
        const fieldCommentsObj = {};
        for (const [key, value] of Object.entries(app.fieldComments || {})) {
          if (value) {
            // For document fields (e.g., document_0, document_1), include document type
            if (key.startsWith("document_")) {
              const index = parseInt(key.split("_")[1], 10);
              const doc = app.formData?.documents?.[index];
              if (doc && doc.type) {
                fieldCommentsObj[key] = {
                  comment: value,
                  documentType: doc.type,
                };
              } else {
                fieldCommentsObj[key] = { comment: value, documentType: "Unknown Document" };
              }
            } else {
              fieldCommentsObj[key] = { comment: value };
            }
          }
        }

        if (app.formData.verificationComments || Object.keys(fieldCommentsObj).length > 0) {
          return {
            applicationId: app._id.toString(),
            courseTitle: app.courseId?.title || "Unknown Course",
            officerName: app.verifiedBy?.name || "Verification Officer",
            generalComment: app.formData.verificationComments || "",
            fieldComments: fieldCommentsObj,
            read: app.commentsRead,
            updatedAt: app.updatedAt,
          };
        }
        return null;
      })
      .filter(notification => notification !== null);

    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error("Error fetching student notifications:", error);
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

router.post("/mark-comments-read/:applicationId", auth, authorize(["student"]), async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await ApplicationForm.findOne({
      _id: applicationId,
      studentId: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found or not authorized" });
    }

    application.commentsRead = true;
    await application.save();

    res.json({ message: "Comments marked as read" });
  } catch (error) {
    console.error("Error marking comments as read:", error);
    res.status(500).json({
      message: "Failed to mark comments as read",
      error: process.env.NODE_ENV === "development" ? error.stack : error.message,
    });
  }
});

module.exports = router;