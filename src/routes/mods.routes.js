import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { insertModFieldHistory } from "../services/priceHistoryService.js";
import { parsePagination } from "../utils/queryFilters.js";

const router = express.Router();

const MODS_TABLE = "modscraft_modsData";
const MOD_FILES_TABLE = "modscraft_modsDownloadData";
const BUSINESS_CATEGORY_TABLE = "modscraft_business_category";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && x.toLowerCase() !== "none");
}

function normalizeCsv(value, fallback = "None") {
  const next = splitCsv(value).join(",");
  return next || fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    if (String(value).trim() === "") {
      continue;
    }
    return value;
  }
  return "";
}

function toComparableHistoryValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function mapModRow(row) {
  const displayName = firstNonEmpty(row.name, row.old_name, `Mod ${row.post_id}`);
  const subImages = normalizeCsv(row.sub_images, "None");
  const baseVersion = firstNonEmpty(row.version, "1.0.0");
  const iosVersion = firstNonEmpty(row.ios_version, baseVersion, "1.0.0");
  const androidVersion = firstNonEmpty(row.android_version, baseVersion, "1.0.0");
  const basePriority = String(row.priority ?? 0);
  const androidPriority = String(row.android_priority ?? row.priority ?? 0);
  const baseDownload = Number(row.download || 0);
  const androidDownload = Number(row.android_download || row.download || 0);
  const baseIsActive = Number(row.isActive || 0) === 1 ? 1 : 0;
  const androidIsActive = Number(row.android_isActive || row.isActive || 0) === 1 ? 1 : 0;
  const fileFormat = row.file_format || row.sub_category || "";
  const titleForPath = row.title_for_path || "";
  return {
    id: Number(row.post_id),
    modsId: row.modsId ?? null,
    file_format: fileFormat,
    category: row.category || "",
    sub_category: row.sub_category || "",
    name: displayName,
    old_name: firstNonEmpty(row.old_name, row.name, ""),
    description: row.description || "",
    thumb_image: row.thumb_image || "None",
    sub_images: subImages,
    coins: Number(row.coins || 0),
    version: baseVersion,
    title_for_path: titleForPath,
    popular: Number(row.popular || 0),
    priority: basePriority,
    download: baseDownload,
    isActive: baseIsActive,
    ios_version: iosVersion,
    android_priority: androidPriority,
    android_download: androidDownload,
    android_isActive: androidIsActive,
    android_version: androidVersion,
    create_date: row.create_date || null,
    displayName,
    oldName: firstNonEmpty(row.old_name, row.name, ""),
    price: Number(row.coins || 0),
    downloadCount: androidDownload,
    seen: baseDownload,
    likes: 0,
    dislikes: 0,
    subCategory: row.sub_category || "",
    fileFormate: fileFormat,
    category1: row.category || "",
    subCategory1: row.sub_category || "",
    titleForPath,
    size: "",
    iosVersion,
    androidVersion,
    status: androidIsActive === 1 ? "active" : "inactive",
    pack: 0,
    androidPriority,
    comments: "",
    displayImage: row.thumb_image || "None",
    subImages,
    images: subImages,
    isActivate: androidIsActive === 1,
    createdDate: row.create_date || null,
    updatedDate: row.create_date || null
  };
}

router.get(
  "/filters",
  requireAuth,
  requirePermission("all_mods", "view"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT category, sub_category
       FROM ${BUSINESS_CATEGORY_TABLE}
       WHERE android_isActive = 1
       ORDER BY android_priority ASC, id ASC`
    );

    const categories = [];
    const subcategoriesByCategory = {};

    rows.forEach((row) => {
      const category = String(row.category || "").trim();
      const subCategory = String(row.sub_category || "").trim();
      if (!category) {
        return;
      }
      if (!categories.includes(category)) {
        categories.push(category);
      }
      if (!subcategoriesByCategory[category]) {
        subcategoriesByCategory[category] = [];
      }
      if (subCategory && !subcategoriesByCategory[category].includes(subCategory)) {
        subcategoriesByCategory[category].push(subCategory);
      }
    });

    return res.json({ categories, subcategoriesByCategory });
  })
);

router.get(
  "/",
  requireAuth,
  requirePermission("all_mods", "view"),
  asyncHandler(async (req, res) => {
    const { page, itemsPerPage, offset } = parsePagination(req.query, 40, 200);

    const sort = String(req.query.sort || "latest");
    const search = String(req.query.search || "").trim();
    const oldName = String(req.query.oldName || "").trim();
    const category = String(req.query.category || "").trim();
    const subCategory = String(req.query.subCategory || "").trim();
    const activeFilter = String(req.query.activeFilter || "active");

    const whereParts = ["1=1"];
    const params = [];

    if (activeFilter === "active") {
      whereParts.push("android_isActive = 1");
    } else if (activeFilter === "inactive") {
      whereParts.push("android_isActive = 0");
    }

    if (search) {
      whereParts.push("(old_name LIKE ? OR name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (oldName) {
      whereParts.push("old_name LIKE ?");
      params.push(`%${oldName}%`);
    }

    if (category && category !== "all") {
      whereParts.push("category = ?");
      params.push(category);
    }

    if (subCategory && subCategory !== "all") {
      whereParts.push("sub_category = ?");
      params.push(subCategory);
    }

    const orderBy =
      sort === "downloads"
        ? "android_download DESC, post_id DESC"
        : sort === "likes"
        ? "android_download DESC, post_id DESC"
        : sort === "impressions"
        ? "download DESC, post_id DESC"
        : "post_id DESC";

    const whereSql = whereParts.join(" AND ");

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM ${MODS_TABLE} WHERE ${whereSql}`,
      params
    );
    const totalItems = Number(totalRows[0]?.total || 0);

    const [rows] = await pool.execute(
      `SELECT
          post_id,
          name,
          old_name,
          file_format,
          category,
          sub_category,
          thumb_image,
          sub_images,
          coins,
          version,
          ios_version,
          android_version,
          title_for_path,
          popular,
          priority,
          android_priority,
          download,
          android_download,
          isActive,
          android_isActive,
          create_date,
          description
       FROM ${MODS_TABLE}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ?, ?`,
      [...params, offset, itemsPerPage]
    );

    return res.json({
      data: rows.map(mapModRow),
      totalItems,
      itemsPerPage,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage))
    });
  })
);

router.get(
  "/:id",
  requireAuth,
  requirePermission("all_mods", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid mod id" });
    }

    const [rows] = await pool.execute(`SELECT * FROM ${MODS_TABLE} WHERE post_id = ? LIMIT 1`, [id]);
    const mod = rows[0];
    if (!mod) {
      return res.status(404).json({ error: "Mod not found" });
    }

    const [files] = await pool.execute(
      `SELECT id, url, title, size, file_format, title_for_path
       FROM ${MOD_FILES_TABLE}
       WHERE mods_id = ?
       ORDER BY id DESC`,
      [id]
    );

    const mapped = mapModRow(mod);

    return res.json({
      ...mapped,
      files: files.map((file) => ({
        id: Number(file.id),
        url: file.url,
        title: firstNonEmpty(file.title, file.file_format, "file"),
        size: file.size || "0"
      }))
    });
  })
);

router.post(
  "/",
  requireAuth,
  requirePermission("all_mods", "edit"),
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const category = firstNonEmpty(payload.category, payload.category1, "");
    const subCategory = firstNonEmpty(payload.sub_category, payload.subCategory, payload.subCategory1, "");
    const fileFormate = firstNonEmpty(payload.file_format, payload.fileFormate, "");
    const name = firstNonEmpty(
      payload.name,
      payload.displayName,
      payload.old_name,
      payload.oldName,
      "Untitled Mod"
    );
    const oldName = firstNonEmpty(payload.old_name, payload.oldName, payload.displayName, payload.name, name);
    const titleForPath = firstNonEmpty(payload.title_for_path, payload.titleForPath, Date.now());
    const subImages = normalizeCsv(firstNonEmpty(payload.sub_images, payload.subImages, ""), "None");
    const displayImage = firstNonEmpty(payload.thumb_image, payload.displayImage, "None");

    const coins = asNumber(firstNonEmpty(payload.coins, payload.price, 0), 0);
    const downloads = asNumber(firstNonEmpty(payload.download, payload.downloadCount, 0), 0);
    const isActive = asNumber(firstNonEmpty(payload.isActive, payload.isActivate, 1), 1) === 1 ? 1 : 0;
    const priority = asNumber(firstNonEmpty(payload.priority, 0), 0);
    const popular = asNumber(firstNonEmpty(payload.popular, 0), 0);
    const androidPriority = asNumber(
      firstNonEmpty(payload.android_priority, payload.androidPriority, payload.priority, 0),
      0
    );
    const androidDownload = asNumber(
      firstNonEmpty(payload.android_download, payload.androidDownload, payload.downloadCount, payload.download, 0),
      0
    );
    const androidIsActive =
      asNumber(
        firstNonEmpty(payload.android_isActive, payload.androidIsActive, payload.isActivate, payload.isActive, 1),
        1
      ) === 1
        ? 1
        : 0;
    const version = firstNonEmpty(payload.version, "1.0.0");
    const iosVersion = firstNonEmpty(payload.ios_version, payload.iosVersion, version, "1.0.0");
    const androidVersion = firstNonEmpty(
      payload.android_version,
      payload.androidVersion,
      version,
      "1.0.0"
    );

    const [result] = await pool.execute(
      `INSERT INTO ${MODS_TABLE} (
          modsId, file_format, category, sub_category, name, old_name,
          description, thumb_image, sub_images, coins, version, title_for_path,
          popular, priority, download, isActive, ios_version,
          android_priority, android_download, android_isActive, android_version, create_date
       ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, NOW()
       )`,
      [
        null,
        fileFormate,
        category,
        subCategory,
        name,
        oldName,
        payload.description || "",
        displayImage,
        subImages,
        coins,
        version,
        String(titleForPath),
        popular,
        priority,
        downloads,
        isActive,
        iosVersion,
        androidPriority,
        androidDownload,
        androidIsActive,
        androidVersion
      ]
    );

    return res.status(201).json({ id: Number(result.insertId) });
  })
);

router.put(
  "/:id",
  requireAuth,
  requirePermission("all_mods", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid mod id" });
    }

    const payload = req.body || {};

    const [beforeRows] = await pool.execute(`SELECT * FROM ${MODS_TABLE} WHERE post_id = ? LIMIT 1`, [id]);

    const before = beforeRows[0];
    if (!before) {
      return res.status(404).json({ error: "Mod not found" });
    }

    const category = firstNonEmpty(payload.category, payload.category1, before.category, "");
    const subCategory = firstNonEmpty(
      payload.sub_category,
      payload.subCategory,
      payload.subCategory1,
      before.sub_category,
      ""
    );
    const fileFormate = firstNonEmpty(payload.file_format, payload.fileFormate, before.file_format, "");
    const name = firstNonEmpty(
      payload.name,
      payload.displayName,
      payload.old_name,
      payload.oldName,
      before.name,
      "Untitled Mod"
    );
    const oldName = firstNonEmpty(
      payload.old_name,
      payload.oldName,
      payload.displayName,
      payload.name,
      before.old_name,
      name
    );
    const titleForPath = firstNonEmpty(payload.title_for_path, payload.titleForPath, before.title_for_path, Date.now());

    const nextDisplayImage =
      payload.thumb_image === undefined && payload.displayImage === undefined
        ? firstNonEmpty(before.thumb_image, "None")
        : firstNonEmpty(payload.thumb_image, payload.displayImage, "None");
    const nextSubImages =
      payload.sub_images === undefined && payload.subImages === undefined
        ? normalizeCsv(before.sub_images, "None")
        : normalizeCsv(firstNonEmpty(payload.sub_images, payload.subImages, ""), "None");

    const coins = asNumber(firstNonEmpty(payload.coins, payload.price, before.coins, 0), 0);
    const downloads = asNumber(
      firstNonEmpty(payload.download, payload.downloadCount, before.download, 0),
      Number(before.download || 0)
    );
    const isActive =
      asNumber(firstNonEmpty(payload.isActive, payload.isActivate, before.isActive, 1), 1) === 1
        ? 1
        : 0;
    const priority = asNumber(payload.priority, 0);
    const popular = asNumber(payload.popular, 0);
    const androidPriority = asNumber(
      firstNonEmpty(
        payload.android_priority,
        payload.androidPriority,
        before.android_priority,
        before.priority,
        0
      ),
      0
    );
    const androidDownload = asNumber(
      firstNonEmpty(
        payload.android_download,
        payload.androidDownload,
        payload.downloadCount,
        before.android_download,
        before.download,
        0
      ),
      Number(before.android_download || before.download || 0)
    );
    const androidIsActive =
      asNumber(
        firstNonEmpty(
          payload.android_isActive,
          payload.androidIsActive,
          payload.isActivate,
          payload.isActive,
          before.android_isActive,
          before.isActive,
          1
        ),
        1
      ) === 1
        ? 1
        : 0;
    const description =
      payload.description === undefined ? before.description || "" : payload.description || "";
    const normalizedTitleForPath = String(titleForPath);
    const version = firstNonEmpty(payload.version, before.version, "1.0.0");
    const iosVersion = firstNonEmpty(
      payload.ios_version,
      payload.iosVersion,
      before.ios_version,
      version,
      "1.0.0"
    );
    const androidVersion = firstNonEmpty(
      payload.android_version,
      payload.androidVersion,
      before.android_version,
      version,
      "1.0.0"
    );

    await pool.execute(
      `UPDATE ${MODS_TABLE}
       SET
         file_format = ?,
         category = ?,
         sub_category = ?,
         name = ?,
         old_name = ?,
         description = ?,
         thumb_image = ?,
         sub_images = ?,
         coins = ?,
         version = ?,
         title_for_path = ?,
         popular = ?,
         priority = ?,
         download = ?,
         isActive = ?,
         ios_version = ?,
         android_priority = ?,
         android_download = ?,
         android_isActive = ?,
         android_version = ?
       WHERE post_id = ?`,
      [
        fileFormate,
        category,
        subCategory,
        name,
        oldName,
        description,
        nextDisplayImage,
        nextSubImages,
        coins,
        version,
        normalizedTitleForPath,
        popular,
        priority,
        downloads,
        isActive,
        iosVersion,
        androidPriority,
        androidDownload,
        androidIsActive,
        androidVersion,
        id
      ]
    );

    const beforeVersion = firstNonEmpty(before.version, "1.0.0");
    const beforeIosVersion = firstNonEmpty(before.ios_version, beforeVersion, "1.0.0");
    const beforeAndroidVersion = firstNonEmpty(before.android_version, beforeVersion, "1.0.0");
    const beforeDisplayImage = firstNonEmpty(before.thumb_image, "None");
    const beforeSubImages = normalizeCsv(before.sub_images, "None");
    const beforePriority = asNumber(before.priority, 0);
    const beforeDownload = asNumber(before.download, 0);
    const beforeIsActive = asNumber(before.isActive, 0) === 1 ? 1 : 0;
    const beforeAndroidPriority = asNumber(before.android_priority, asNumber(before.priority, 0));
    const beforeAndroidDownload = asNumber(before.android_download, asNumber(before.download, 0));
    const beforeAndroidIsActive =
      asNumber(before.android_isActive, asNumber(before.isActive, 0)) === 1 ? 1 : 0;

    const changeRows = [
      { field: "file_format", before: before.file_format, after: fileFormate },
      { field: "category", before: before.category, after: category },
      { field: "sub_category", before: before.sub_category, after: subCategory },
      { field: "name", before: before.name, after: name },
      { field: "old_name", before: before.old_name, after: oldName },
      { field: "description", before: before.description, after: description },
      { field: "display_image", before: beforeDisplayImage, after: nextDisplayImage },
      { field: "sub_images", before: beforeSubImages, after: nextSubImages },
      { field: "price", before: Number(before.coins || 0), after: coins },
      { field: "version", before: beforeVersion, after: version },
      { field: "ios_version", before: beforeIosVersion, after: iosVersion },
      { field: "android_version", before: beforeAndroidVersion, after: androidVersion },
      { field: "title_for_path", before: before.title_for_path, after: normalizedTitleForPath },
      { field: "popular", before: asNumber(before.popular, 0), after: popular },
      { field: "priority", before: beforePriority, after: priority },
      { field: "download", before: beforeDownload, after: downloads },
      { field: "isActive", before: beforeIsActive, after: isActive },
      { field: "android_priority", before: beforeAndroidPriority, after: androidPriority },
      { field: "android_download", before: beforeAndroidDownload, after: androidDownload },
      { field: "android_isActive", before: beforeAndroidIsActive, after: androidIsActive }
    ].filter(
      (change) =>
        toComparableHistoryValue(change.before) !== toComparableHistoryValue(change.after)
    );

    if (changeRows.length > 0) {
      try {
        const changedAt = new Date();
        for (const change of changeRows) {
          await insertModFieldHistory({
            modId: id,
            field: change.field,
            beforeValue: change.before,
            afterValue: change.after,
            changedBy: req.user.id,
            downloadsAtChange: downloads,
            impressionsAtChange: asNumber(before.download, 0),
            changedAt
          });
        }
      } catch (error) {
        // Ignore if history table is missing.
      }
    }

    return res.json({ ok: true });
  })
);

router.post(
  "/:id/mod-files",
  requireAuth,
  requirePermission("all_mods", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid mod id" });
    }

    const payload = req.body || {};
    const modFilesPayload = Array.isArray(payload.modFiles) ? payload.modFiles : [];
    if (modFilesPayload.length === 0) {
      return res.status(400).json({ error: "modFiles is required" });
    }

    const [rows] = await pool.execute(
      `SELECT post_id, file_format, category, sub_category, title_for_path
       FROM ${MODS_TABLE}
       WHERE post_id = ?
       LIMIT 1`,
      [id]
    );
    const mod = rows[0];
    if (!mod) {
      return res.status(404).json({ error: "Mod not found" });
    }

    const fileFormate = firstNonEmpty(mod.file_format, mod.sub_category, "misc");
    const titleForPath = firstNonEmpty(mod.title_for_path, Date.now());

    const insertedModFiles = [];
    const updatedModFiles = [];
    for (const modFile of modFilesPayload) {
      const fileName = firstNonEmpty(modFile?.fileName, modFile?.url, modFile?.name, "");
      if (!fileName) {
        continue;
      }
      const title = firstNonEmpty(modFile?.title, modFile?.name, "file");
      const size = firstNonEmpty(modFile?.size, "0");
      const modFileId = Number(modFile?.id);

      if (Number.isInteger(modFileId) && modFileId > 0) {
        await pool.execute(
          `UPDATE ${MOD_FILES_TABLE}
           SET file_format = ?, category = ?, sub_category = ?, url = ?, title = ?, title_for_path = ?, size = ?
           WHERE id = ? AND mods_id = ?`,
          [
            fileFormate,
            mod.category || "",
            mod.sub_category || "",
            fileName,
            title,
            String(titleForPath),
            String(size),
            modFileId,
            id
          ]
        );
        updatedModFiles.push(fileName);
        continue;
      }

      await pool.execute(
        `INSERT INTO ${MOD_FILES_TABLE} (file_format, category, sub_category, url, mods_id, title, title_for_path, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileFormate,
          mod.category || "",
          mod.sub_category || "",
          fileName,
          id,
          title,
          String(titleForPath),
          String(size)
        ]
      );

      insertedModFiles.push(fileName);
    }

    return res.json({ ok: true, inserted: insertedModFiles, updated: updatedModFiles });
  })
);

router.post(
  "/:id/assets",
  requireAuth,
  requirePermission("all_mods", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid mod id" });
    }

    const [rows] = await pool.execute(
      `SELECT post_id, file_format, category, sub_category, title_for_path, sub_images, thumb_image, android_download, download
       FROM ${MODS_TABLE}
       WHERE post_id = ?
       LIMIT 1`,
      [id]
    );
    const mod = rows[0];
    if (!mod) {
      return res.status(404).json({ error: "Mod not found" });
    }

    const payload = req.body || {};
    const fileFormate = firstNonEmpty(mod.file_format, mod.sub_category, "misc");
    const titleForPath = firstNonEmpty(mod.title_for_path, Date.now());
    const currentSubImages = normalizeCsv(mod.sub_images, "None");
    const currentDisplayImage = firstNonEmpty(mod.thumb_image, "None");

    const uploadedSubImages = Array.isArray(payload.subImages)
      ? payload.subImages.filter(Boolean)
      : splitCsv(payload.subImages || "");
    const replacedSubImages = Array.isArray(payload.replaceSubImages)
      ? payload.replaceSubImages.filter(Boolean)
      : splitCsv(payload.replaceSubImages || "");
    const deletedSubImages = Array.isArray(payload.deleteSubImages)
      ? payload.deleteSubImages.filter(Boolean)
      : splitCsv(payload.deleteSubImages || "");
    const modFilesPayload = Array.isArray(payload.modFiles) ? payload.modFiles : [];

    const nextSubImageList = splitCsv(currentSubImages).filter(
      (name) => !deletedSubImages.includes(name)
    );
    const snapshotDownloads = asNumber(mod.android_download, asNumber(mod.download, 0));
    const snapshotImpressions = asNumber(mod.download, 0);

    const displayImageInput = firstNonEmpty(payload.displayImage, payload.thumb_image, "");
    const hasDisplayImageUpdate =
      payload.displayImage !== undefined || payload.thumb_image !== undefined;
    const nextDisplayImage = hasDisplayImageUpdate
      ? firstNonEmpty(displayImageInput, "None")
      : currentDisplayImage || "None";

    uploadedSubImages.forEach((name) => {
      if (!nextSubImageList.includes(name)) {
        nextSubImageList.push(name);
      }
    });

    replacedSubImages.forEach((name) => {
      if (!nextSubImageList.includes(name)) {
        nextSubImageList.push(name);
      }
    });

    const nextSubImages = normalizeCsv(nextSubImageList, "None");

    const insertedModFiles = [];
    const updatedModFiles = [];
    for (const modFile of modFilesPayload) {
      const fileName = firstNonEmpty(modFile?.fileName, modFile?.url, modFile?.name, "");
      if (!fileName) {
        continue;
      }
      const title = firstNonEmpty(modFile?.title, modFile?.name, "file");
      const size = firstNonEmpty(modFile?.size, "0");
      const modFileId = Number(modFile?.id);

      if (Number.isInteger(modFileId) && modFileId > 0) {
        await pool.execute(
          `UPDATE ${MOD_FILES_TABLE}
           SET file_format = ?, category = ?, sub_category = ?, url = ?, title = ?, title_for_path = ?, size = ?
           WHERE id = ? AND mods_id = ?`,
          [
            fileFormate,
            mod.category || "",
            mod.sub_category || "",
            fileName,
            title,
            String(titleForPath),
            String(size),
            modFileId,
            id
          ]
        );
        updatedModFiles.push(fileName);
        continue;
      }

      await pool.execute(
        `INSERT INTO ${MOD_FILES_TABLE} (file_format, category, sub_category, url, mods_id, title, title_for_path, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileFormate,
          mod.category || "",
          mod.sub_category || "",
          fileName,
          id,
          title,
          String(titleForPath),
          String(size)
        ]
      );

      insertedModFiles.push(fileName);
    }

    if (
      hasDisplayImageUpdate ||
      uploadedSubImages.length > 0 ||
      replacedSubImages.length > 0 ||
      deletedSubImages.length > 0
    ) {
      await pool.execute(
        `UPDATE ${MODS_TABLE}
         SET thumb_image = ?, sub_images = ?, file_format = ?
         WHERE post_id = ?`,
        [nextDisplayImage, nextSubImages, fileFormate, id]
      );
    }

    const assetChangeRows = [
      { field: "display_image", before: currentDisplayImage, after: nextDisplayImage },
      { field: "sub_images", before: currentSubImages, after: nextSubImages }
    ].filter(
      (change) =>
        toComparableHistoryValue(change.before) !== toComparableHistoryValue(change.after)
    );
    if (insertedModFiles.length > 0) {
      assetChangeRows.push({
        field: "mod_files_added",
        before: "",
        after: insertedModFiles.join(",")
      });
    }
    if (updatedModFiles.length > 0) {
      assetChangeRows.push({
        field: "mod_files_updated",
        before: "",
        after: updatedModFiles.join(",")
      });
    }

    if (assetChangeRows.length > 0) {
      try {
        const changedAt = new Date();
        for (const change of assetChangeRows) {
          await insertModFieldHistory({
            modId: id,
            field: change.field,
            beforeValue: change.before,
            afterValue: change.after,
            changedBy: req.user.id,
            downloadsAtChange: snapshotDownloads,
            impressionsAtChange: snapshotImpressions,
            changedAt
          });
        }
      } catch (error) {
        // Ignore if history table is missing.
      }
    }

    return res.json({
      ok: true,
      displayImage: hasDisplayImageUpdate ? nextDisplayImage : "",
      subImages: uploadedSubImages,
      replacedSubImages,
      deletedSubImages,
      modFiles: insertedModFiles
    });
  })
);

export default router;
