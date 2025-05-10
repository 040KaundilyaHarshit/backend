const FormModel = require("../models/FormModel");

exports.createForm = async (req, res) => {
  try {
    const { courseId, createdBy, fields } = req.body;
    const newForm = new FormModel({ courseId, createdBy, fields });
    await newForm.save();
    res.status(201).json({ message: "Form created successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFormByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const form = await FormModel.findOne({ courseId });
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.status(200).json(form);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
