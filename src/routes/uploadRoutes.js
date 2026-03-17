import express from "express";
import multer from "multer";
import { connectSFTP } from "../ftp.js";
import fs from "fs";
import db from '../db.js'

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.put("/secretebase/:id", upload.single("file"), async (req, res) => {
  try {
    const { title, size } = req.body;
    const id = req.params.id;

    if (!title || !size) {
      return res.status(400).json({ error: "Missing required data" });
    }

    // 1️⃣ Fetch the existing record
    const oldData = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM snap_tech_modsforminecraft_modsDownloadData WHERE id=?",
        [id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result[0]);
        }
      );
    });

    if (!oldData) {
      return res.status(404).json({ error: "File not found in database" });
    }

    // 2️⃣ Only upload if a new file was provided
    if (req.file) {
      const sftp = await connectSFTP();

      // Always use OLD folder and OLD filename
      const remoteDir = `/public_html/snap_tech_modsforminecraft/upload/data/${oldData.file_format}/${oldData.title_for_path}`;
      await sftp.mkdir(remoteDir, true);

      const remoteFilePath = `${remoteDir}/${oldData.url}`; // overwrite old file
      console.log("Overwriting SFTP file:", remoteFilePath);

      await sftp.put(req.file.path, remoteFilePath); // replace
      await sftp.end();

      // remove temp local file
      fs.unlinkSync(req.file.path);
    }

    // 3️⃣ Update DB metadata (do NOT change url)
    const sql = `
      UPDATE snap_tech_modsforminecraft_modsDownloadData
      SET title=?, size=?
      WHERE id=?
    `;
    db.query(sql, [title, size, id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "File replaced on SFTP and metadata updated ✅" });
    });

  } catch (err) {
    console.error("PUT Error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/secretebase", upload.single("image"), async (req, res) => {

//     console.log("BODY:", req.body);
// console.log("FILE:", req.file);
  try {
    const { file_format, title_for_path } = req.body;

    if (!file_format || !title_for_path) {
      return res.status(400).json({ error: "Missing folder data" });
    }

    const sftp = await connectSFTP();

    // 1️⃣ Create folder if it doesn't exist
    const remoteDir = `/public_html/snap_tech_modsforminecraft/upload/data/${file_format}/${title_for_path}`;
    await sftp.mkdir(remoteDir, true); // 'true' = recursive creation

    // 2️⃣ Full remote file path including filename
    const remoteFile = `${remoteDir}/${req.file.originalname}`;
    await sftp.put(req.file.path, remoteFile);

    await sftp.end();

    // delete local temp file
    fs.unlinkSync(req.file.path);

    res.json({
      message: "File uploaded successfully",
      filename: req.file.originalname,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: err.message });
  }

});



router.post("/secretebase/file", upload.array("files"), async (req, res) => {
  try {
    const { type, mods_id } = req.body;

    if (!type || !mods_id) {
      return res.status(400).json({ error: "Missing required data" });
    }

    // 🔥 Fetch everything using mods_id
    const modData = await new Promise((resolve, reject) => {
      db.query(
        "SELECT category, sub_category, file_format, title_for_path FROM snap_tech_modsforminecraft_modsData WHERE post_id = ?",
        [mods_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result[0]);
        }
      );
    });

    if (!modData) {
      return res.status(400).json({ error: "Invalid mods_id" });
    }

    const { category, sub_category, file_format, title_for_path } = modData;

    const files = req.files || [];

    const titles = Array.isArray(req.body.titles)
      ? req.body.titles
      : [req.body.titles];

    const sftp = await connectSFTP();
    const remoteDir = `/public_html/snap_tech_modsforminecraft/upload/data/${file_format}/${title_for_path}`;
    await sftp.mkdir(remoteDir, true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = titles[i] || file.originalname;
      // const size = (file.size / (1024 * 1024)).toFixed(2) + "MB";

      let size;

      if (file.size >= 1024 * 1024) {
        // MB
        size = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      } else {
        // Always show KB (even if very small)
        const kbSize = file.size / 1024;
        size = (kbSize < 0.01 ? 0.01 : kbSize).toFixed(2) + " KB";
      }

      const remoteFilePath = `${remoteDir}/${file.originalname}`;
      await sftp.put(file.path, remoteFilePath);
      fs.unlinkSync(file.path);

      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO snap_tech_modsforminecraft_modsDownloadData (mods_id, url, title, size, file_format, category, sub_category, title_for_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [mods_id, file.originalname, title, size, file_format, category, sub_category, title_for_path],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }

    await sftp.end();

    res.json({ message: "Files uploaded successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
