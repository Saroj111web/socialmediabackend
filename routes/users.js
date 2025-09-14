const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const User = require('../models/users')
const auth = require("../middleware/auth");
const sendSMTPEmail = require('../config/smtp');
const router = express.Router()

// ================= REGISTER =================
router.post("/", async (req, res) => {
      const { username, email, password } = req.body

      if (!email || !password || !username) {
            return res.status(400).json({ message: "Missing required from fields!", success: false })
      }

      const user = await User.findOne({
            $or: [{ username: username }, { email: email }]
      })
      if (user) {
            return res.status(400).json({
                  message: user.username === username ? "Username already taken!" : "Email is already registered!",
                  success: false
            })
      }

      const hashedPass = await bcrypt.hash(password, 10)

      const newUser = new User({
            username,
            email,
            password: hashedPass,
      })

      await newUser.save()

      const token = generateToken({
            _id: newUser._id,
            username: newUser.username
      })

      res.status(201).json(token)
})

// ================= LOGIN =================
router.post("/login", async (req, res) => {
      const { username, password } = req.body
      if (!username || !password) {
            return res.status(400).json({ success: false, message: "Please provide username and password !" })
      }

      const user = await User.findOne({ username })
      if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials !" })
      }

      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
            return res.status(401).json({ success: false, message: "Invalid credentials !" })
      }

      const token = generateToken({
            _id: user._id,
            username: user.username
      })
      res.status(201).json(token);
})

// ================= GET CURRENT USER =================
router.get("/", auth, async (req, res) => {
      const user = await User.findById(req.user._id).select("-password")
      if (!user) {
            return res.status(404).json({ success: false, message: "User not found !" })
      }
      res.json(user)
})

// ================= REQUEST PASSWORD RESET =================
router.post('/request-password-reset', async (req, res) => {
      const { email } = req.body
      let user = await User.findOne({ email: email })
      if (!user) return res.status(404).json({ success: false, message: "This email is not registered yet !" })

      const resetToken = jwt.sign({ _id: user._id }, process.env.JWT_KEY, { expiresIn: "1h" })

      user.resetToken = resetToken
      user.resetTokenExpires = Date.now() + 60 * 60 * 1000
      await user.save()

      const subject = "Password reset request for your social media account";
      const text = `Click this link to reset your password: https://socialmedia.com/reset-password?resetToken=${resetToken}`;
      sendSMTPEmail(user.email, subject, text);

      res.json({ message: "Password reset link sent to email", resetToken: resetToken })
})

// ================= RESET PASSWORD =================
router.post("/reset-password", async (req, res) => {
      const { resetToken, newPassword } = req.body

      const decodedUser = jwt.verify(resetToken, process.env.JWT_KEY)
      let user = await User.findById(decodedUser._id)
      if (!user || user.resetToken !== resetToken || user.resetTokenExpires <= Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or Expired token !" })
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetToken = null;
      user.resetTokenExpires = null;
      await user.save();

      res.json({ message: "Password reset successfully !" })
})

// ================= FOLLOW =================
router.post("/:userId/follow", auth, async (req, res) => {
      const userId = req.params.userId
      const currentuserId = req.user._id.toString()

      if (userId === currentuserId) return res.status(400).json({ message: "You can't follow yourself !" })

      const usertoFollow = await User.findById(userId)
      if (!usertoFollow) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (usertoFollow.isPrivate) {
            if (usertoFollow.followRequests.some(id => id.toString() === currentuserId)) {
                  return res.status(400).json({ message: "Follow request already sent!" })
            }
            else {
                  usertoFollow.followRequests.push(currentuserId)
                  await usertoFollow.save()
                  return res.json({ message: "Follow Request sent.." })
            }
      }
      else {
            if (usertoFollow.followers.some(id => id.toString() === currentuserId)) {
                  return res.status(400).json({ message: "Already following the user!" })
            }
            else {
                  usertoFollow.followers.push(currentuserId)
                  curruser.following.push(userId)
                  await usertoFollow.save()
                  await curruser.save()
                  return res.json({ message: "User followed successfully" })
            }
      }
})

// ================= REJECT REQUEST =================
router.post("/reject-request/:requesterId", auth, async (req, res) => {
      const requesterId = req.params.requesterId
      const currentuserId = req.user._id.toString()

      if (requesterId === currentuserId) return res.status(400).json({ message: "You can't follow yourself !" })

      const requesteruser = await User.findById(requesterId)
      if (!requesteruser) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (!curruser.followRequests.some(id => id.toString() === requesterId)) {
            return res.status(400).json({ message: "No follow request found !" })
      }

      curruser.followRequests = curruser.followRequests.filter((id) => id.toString() !== requesterId)
      await curruser.save()

      res.json({ message: "Follow request rejected !" })
})

// ================= ACCEPT REQUEST =================
router.post("/accept-request/:requesterId", auth, async (req, res) => {
      const requesterId = req.params.requesterId
      const currentuserId = req.user._id.toString()

      if (requesterId === currentuserId) return res.status(400).json({ message: "You can't follow yourself !" })

      const requesteruser = await User.findById(requesterId)
      if (!requesteruser) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (!curruser.followRequests.some(id => id.toString() === requesterId)) {
            return res.status(400).json({ message: "No follow request found !" })
      }

      curruser.followRequests = curruser.followRequests.filter((id) => id.toString() !== requesterId)
      curruser.followers.push(requesterId)
      requesteruser.following.push(currentuserId)

      await curruser.save()
      await requesteruser.save()

      res.json({ message: "Follow request accepted !" })
})

// ================= GET FOLLOWERS =================
router.get("/:userId/followers", auth, async (req, res) => {
      const userId = req.params.userId
      const currentuserId = req.user._id.toString()

      const user = await User.findById(userId).populate("followers", "_id username")
      if (!user) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (user.followers.some(id => id._id.toString() === currentuserId) || !user.isPrivate) {
            const uniqueFollowers = user.followers.filter(
                  (v, i, a) => a.findIndex(t => t._id.toString() === v._id.toString()) === i
            )
            return res.json(uniqueFollowers)
      } else {
            return res.status(400).json({ message: "Can't get followers list account is private.." })
      }
})

router.get("/:userId/following", auth, async (req, res) => {
      const userId = req.params.userId
      const currentuserId = req.user._id.toString()

      const user = await User.findById(userId).populate("following", "_id username")
      if (!user) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (user.following.some(id => id._id.toString() === currentuserId) || !user.isPrivate) {
            const uniqueFollowing = user.following.filter(
                  (v, i, a) => a.findIndex(t => t._id.toString() === v._id.toString()) === i
            )
            return res.json(uniqueFollowing)
      } else {
            return res.status(400).json({ message: "Can't get following list account is private.." })
      }
})

// ================= UNFOLLOW =================
router.post("/:userId/unfollow", auth, async (req, res) => {
      const userId = req.params.userId
      const currentuserId = req.user._id.toString()

      const userToUnfollow = await User.findById(userId)
      if (!userToUnfollow) return res.status(404).json({ message: "user not found!" })

      const curruser = await User.findById(currentuserId)
      if (!curruser) return res.status(404).json({ message: "user not found!" })

      if (!userToUnfollow.followers.includes(currentuserId)) {
            return res.status(400).json({ message: "User is not available in the followers" })
      }

      userToUnfollow.followers = userToUnfollow.followers.filter((id) => id.toString() !== currentuserId)
      curruser.following = curruser.following.filter((id) => id.toString() !== userId)

      await userToUnfollow.save()
      await curruser.save()

      res.json({ message: "user unfollowed successfully !" })
})

// ================= TOKEN =================
const generateToken = (data) => {
      return jwt.sign(data, process.env.JWT_KEY)
}

module.exports = router
