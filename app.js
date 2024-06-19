const express = require("express");
const cors = require("cors");
const { mongoose } = require("mongoose");
const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

// Model
const User = require("./models/userModel");
const Note = require("./models/notesModel");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));

app.get("/", (req, res) => {
  res.send("hello");
});

// Create Account Api
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: true, message: "Name is Required" });
  }
  if (!email) {
    return res.status(400).json({ error: true, message: "Email is Required" });
  }
  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Password is Required" });
  }

  //User Already Exists
  const isUser = await User.findOne({ email });

  if (isUser) {
    return res.json({ error: true, message: "User Already Exists" });
  }

  const user = new User({ fullName, email, password });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "36000m",
  });

  return res.status(200).json({
    error: false,
    user,
    accessToken,
    message: "Registration Succesful",
  });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is Required" });
  }
  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Password is Required" });
  }
  const userInfo = await User.findOne({ email });
  if (!userInfo) {
    return res.status(400).json({ error: true, message: "User Not Found" });
  }

  if (userInfo.email === email && userInfo.password === password) {
    const user = { user: userInfo };
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "3600m",
    });
    return res
      .status(200)
      .json({ error: false, message: "Login Succeful", email, accessToken });
  } else {
    return res.status(400).json({
      error: true,
      message: "Invalid Credentials",
    });
  }
});

// Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  const isUser = await User.findOne({ _id: user._id });

  if (!user) {
    return res.status(401);
  }

  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "",
  });
});

//  Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title) {
    return res.status(400).json({ error: true, message: "Title is Required" });
  }
  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "Content is Required" });
  }

  try {
    const note = new Note({
      title: title,
      content: content,
      tags: tags || [],
      userId: user._id,
    });
    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note Added Succesfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

// Edit Note
app.put("/edit-note/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const { title, content, tags, isPinned } = req.body;

  const { user } = req.user;

  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, message: "No changes Provides" });
  }

  try {
    const note = await Note.findOne({ _id: id, userId: user._id });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note Not Found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note Updated",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
});

// Get All Notes
app.get("/get-all", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });

    return res.json({
      error: false,
      notes,
      message: "All Notes Retrived",
    });
  } catch (err) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

// Delete Note
app.delete("/delete-note/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: id, userId: user._id });
    if (!note) {
      return res.status(404).json({ error: true, message: "Note Not Found" });
    }

    await Note.deleteOne({ _id: id, userId: user._id });

    return res.json({ error: false, message: "Note Deleted Succesfully" });
  } catch (err) {
    es.status(500).json({ error: true, message: "Internal Server Error" });
  }
});

// Update IsPinned
app.put("/update-note-pinned/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const { isPinned } = req.body;

  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: id, userId: user._id });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note Not Found" });
    }

    note.isPinned = isPinned || false;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note Updated",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
});

// Search Notes
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;

  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ error: true, message: "Search Query is Required" });
  }
  try {
    const matchingNotes = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });

    return res.json({
      error: false,
      notes: matchingNotes,
      message: "Notes Matching the search Query retrived Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

mongoose.connect(process.env.MONGODB_URL).then(() => {
  console.log("Database Connected");
});

app.listen(8000);
