import Student from "../models/Student.js";

export const listStudents = async (req, res) => {
  try {
    const students = await Student.find().select("-password");
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const registerStudent = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const student = new Student({
      name,
      email,
      password,
      currentLevel: 1
    });

    await student.save();

    res.status(201).json({ message: "Student created", student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.password !== password) {
      return res.status(400).json({ message: "Wrong password" });
    }

    res.json({ message: "Login successful", student });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};