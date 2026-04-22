import Teacher from "../models/Teacher.js";

// REGISTER
export const registerTeacher = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const teacher = new Teacher({ name, email, password });

    await teacher.save();

    res.json({ message: "Teacher created", teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN
export const loginTeacher = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    if (teacher.password !== password) {
      return res.status(400).json({ message: "Wrong password" });
    }

    res.json({ message: "Login successful", teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};