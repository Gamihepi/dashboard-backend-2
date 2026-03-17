import multer from "multer";

const upload = multer({ dest: "uploads/" });
import express from "express";
import {
  AddMod,
  getAllDownload,
  getAllMods,
  getDownloadById,
  getModByCategory,
  getModById,
  getModChangeTimeline,
  getModDownloadByModId,
  getModHistorySummary,
  updateMod,
  updateModDownload,
} from "../controller/modsController.js";
import db from "../db.js";  

const router = express.Router();

router.get("/secretebase", getAllMods);

router.get("/secretebase/filedownload" , getAllDownload)

// Get subcategories by category id
router.get("/secretebase/categories", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT category FROM snap_tech_modsforminecraft_modsData GROUP BY category",
      );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Subcategories route
router.get("/secretebase/subcategories/:category", (req, res) => {
  const category = req.params.category;

  const sql = `
    SELECT id, sub_category 
    FROM snap_tech_modsforminecraft_Category_subCategory 
    WHERE category = ?
  `;

  db.query(sql, [category], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result); // return empty array if no match
  });
});

router.get("/secretebase/category/:category", getModByCategory);

router.get("/secretebase/downloadmods/:id", getDownloadById)
  
router.get('/secretebase/mods/downloadmods/:mods_id', getModDownloadByModId)

router.put("/secretebase/downloadmods/:id", upload.single("file"), updateModDownload);


router.get("/secretebase/categories/count", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT category, sub_category, id, COUNT(*) AS total FROM snap_tech_modsforminecraft_Category_subCategory GROUP BY category",
      );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.post("/secretebase/addmod" , AddMod)

router.put("/secretebase/:id", updateMod);

router.get("/secretebase/history", getModHistorySummary);

router.get("/secretebase/mod_change_history/:mod_id", getModChangeTimeline);



// router.put("/downloadmods/:id" , updateModDownload)

router.get("/secretebase/:id", getModById);

export default router;
