
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDirectory = path.resolve("uploads", "cottages");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp"
    }[file.mimetype];

    cb(null, crypto.randomUUID() + extension);
  }
});

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

export const uploadCottagePhotos = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  },

  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WebP images are allowed"));
    }

    cb(null, true);
  }
}).array("photos", 10);
