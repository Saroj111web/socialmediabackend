const multer = require('multer')

const storage = multer.diskStorage({
      destination: (req, file, cb) => {
            cb(null, "uploads/posts")
      },
      filename: (req, file, cb) => {
            const timestamps = Date.now()
            const originalName = file.originalname
                  .replace(/\s+/g, '-')              // replace spaces with hyphen
                  .replace(/[^a-zA-Z0-9,-]/g, "")   // allow only letters, numbers, comma, hyphen

            cb(null, `${timestamps}-${originalName}`)
      }
})

const fileFilter = (req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "video/mp4", "video/mov"]

      if (allowedTypes.includes(file.mimetype)) {   // ✅ fixed mimetype
            cb(null, true)
      } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, GIF, MP4, MOV are allowed."), false)
      }
}

const postUpload = multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: { fileSize: 15 * 1024 * 1024 } // 15MB
})

module.exports = postUpload
