
import db from "../db.js";

export const Mods = {
  // Get all mods
  getAll: (
    page = 1,
    limit = 20, 
    category = "",
    subCategory = "",
    isActive = "",
    platform="iOS",
    search = "",
    oldNameSearch = "",
    sortBy = "",
    callback,
  ) => {
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM snap_tech_modsforminecraft_modsData "; 
    let countQuery =
      "SELECT COUNT(*) as total FROM snap_tech_modsforminecraft_modsData";
    let queryParams = [];
    let countParams = [];
    let whereAdded = false;

    
  const activeColumn = platform === "Android" ? "android_isActive" : "isActive";
    if (isActive === "1" || isActive === "0") {
    query += whereAdded ? ` AND ${activeColumn} = ?` : ` WHERE ${activeColumn} = ?`;
    countQuery += whereAdded ? ` AND ${activeColumn} = ?` : ` WHERE ${activeColumn} = ?`;
    queryParams.push(isActive);
    countParams.push(isActive);
    whereAdded = true;
  }

   

    // Filter by category
    if (category) {
      query += whereAdded ? " AND category = ?" : " WHERE category = ?";
      countQuery += whereAdded ? " AND category = ?" : " WHERE category = ?";
      queryParams.push(category);
      countParams.push(category);
      whereAdded = true;
    }

    // Filter by subcategory
    if (subCategory) {
      query += whereAdded ? " AND sub_category = ?" : " WHERE sub_category = ?";
      countQuery += whereAdded
        ? " AND sub_category = ?"
        : " WHERE sub_category = ?";
      queryParams.push(subCategory);
      countParams.push(subCategory);
      whereAdded = true;
    }

    if (search) {
      query += whereAdded
        ? " AND (name LIKE ? OR category LIKE ? OR sub_category LIKE ? )"
        : " WHERE (name LIKE ? OR category LIKE ? OR sub_category LIKE ?)";

      countQuery += whereAdded
        ? " AND (name LIKE ? OR category LIKE ? OR sub_category LIKE ?)"
        : " WHERE (name LIKE ? OR category LIKE ? OR sub_category LIKE ?)";

      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);

      whereAdded = true;
    }

    if (oldNameSearch) {
      query += whereAdded
        ? " AND LOWER(old_name) LIKE ?"
        : " WHERE LOWER(old_name) LIKE ?";

      countQuery += whereAdded
        ? " AND LOWER(old_name) LIKE ?"
        : " WHERE LOWER(old_name) LIKE ?";

      queryParams.push(`%${oldNameSearch}%`);
      countParams.push(`%${oldNameSearch}%`);

      whereAdded = true;
    }

    // Sorting

    if (sortBy === "latest") {
      query += " ORDER BY post_id DESC";
    }

        const downloadColumn = platform === "Android" ? "android_download" : "download";
          if (sortBy === "download") {
            query += ` ORDER BY ${downloadColumn} DESC`;
          }

    // if (sortBy === "download") {
    //   query += " ORDER BY download DESC";
    // }

    query += " LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    db.query(query, queryParams, (err, results) => {
      if (err) return callback(err, null);

      db.query(countQuery, countParams, (countErr, countResult) => {
        if (countErr) return callback(countErr, null);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        callback(null, { mods: results, total, totalPages, page });
      });
    });
  },

  // Get mod by ID

  getById: (id, callback) => {
    const query =
      "SELECT * FROM snap_tech_modsforminecraft_modsData WHERE post_id = ? ";

    db.query(query, [id], (err, results) => {
      if (err) {
        return callback(err, null); // Stop here if error
      }

      if (!results || results.length === 0) {
        return callback(null, null); // No record found
      }

    
      callback(null, results[0]); // Send first record safely
    });
  },



updateMod: (id, data, platform, callback) => {
  if (!data) return callback(new Error("No data provided"), null);

  db.query(
    "SELECT * FROM snap_tech_modsforminecraft_modsData WHERE post_id = ?",
    [id],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(new Error("Mod not found"));

      const oldData = rows[0];

     const newData = {
  image_url: data.image_url ?? oldData.image_url,
  name: data.name ?? oldData.name,
  old_name: data.old_name ?? oldData.old_name,
  category: data.category ?? oldData.category,
  sub_category: data.sub_category ?? oldData.sub_category,
  title_for_path: data.title_for_path ?? oldData.title_for_path,
  description: data.description ?? oldData.description,
  file_format: data.file_format ?? oldData.file_format
};

      // platform fields
    if (platform === "Android") {
  newData.coin = data.coin ?? oldData.android_coins;
  newData.download = data.download ?? oldData.android_download;
  newData.isActive = data.isActive ?? oldData.android_isActive;
} else {
  newData.coin = data.coin ?? oldData.coin;
  newData.download = data.download ?? oldData.download;
  newData.isActive = data.isActive ?? oldData.isActive;
}
      const historyRows = [];

    Object.keys(newData).forEach(field => {
    const oldValue = oldData[field] ?? "";
    const newValue = newData[field] ?? "";

  // convert both to string for accurate compare
      if (String(oldValue).trim() !== String(newValue).trim()) {
        historyRows.push([
          id,
          field,
          oldValue,
          newValue,
          0,
          platform
        ]);
      }
    });

      const insertHistory = () => {
        if (historyRows.length === 0) return Promise.resolve();

        return new Promise((resolve, reject) => {
          const historyQuery = `
            INSERT INTO snap_tech_modsforminecraft_history
            (mod_id, field, value_before, value_after, changed_by, platform)
            VALUES ?
          `;

          db.query(historyQuery, [historyRows], err => {
            if (err) reject(err);
            else resolve();
          });
        });
      };

      insertHistory()
        .then(() => {

          let query = `
            UPDATE snap_tech_modsforminecraft_modsData
            SET image_url = ?, 
                name = ?, 
                old_name = ?, 
                category = ?, 
                sub_category = ?,  
                title_for_path = ?,  
                description = ?, 
                file_format = ?
          `;

          const values = [
            newData.image_url,
            newData.name,
            newData.old_name,
            newData.category,
            newData.sub_category,
            newData.title_for_path,
            newData.description,
            newData.file_format
          ];

          if (platform === "Android") {
            query += `,
              android_coins = ?, 
              android_download = ?, 
              android_isActive = ?
            `;
            values.push(newData.coin, newData.download, newData.isActive);
          } else {
            query += `,
              coin = ?, 
              download = ?, 
              isActive = ?
            `;
            values.push(newData.coin, newData.download, newData.isActive);
          }

          query += ` WHERE post_id = ?`;
          values.push(id);

          db.query(query, values, (err, results) => {
            callback(err, results);
          });

        })
        .catch(callback);
    }
  );
},

  //file mods downloaddata
  getAllModdownloadData : (callback) =>{
    const query = "SELECT * from snap_tech_modsforminecraft_modsDownloadData "

    db.query(query, (err, results) => {
      if (err) {
        return callback(err, null);
      }
      return callback(null, results);
    }); 
    },

  getModDownloadById: (id, callback) => {
    const query = "SELECT * FROM snap_tech_modsforminecraft_modsDownloadData WHERE id = ?";
    db.query(query, [id], (err, results) => {
      callback(err, results);
    });
  },

  getModDownloadByModId: (id, callback) => {
    const query = "SELECT * FROM snap_tech_modsforminecraft_modsDownloadData WHERE mods_id = ?";
    db.query(query, [id], (err, results) => {
      callback(err, results);
    });
  },

  updateModDownload: (id, data, callback) => {
    const query = `
      UPDATE snap_tech_modsforminecraft_modsDownloadData
      SET url = ?, title = ?, size = ?
      WHERE id = ?
    `;

    db.query(
      query,
      [data.url, data.title, data.size, id],
      (err, result) => {
        callback(err, result);
      }
    );
  },
 
  AddMod : (data , callback) => {
    if(!data) return callback(new Error("No data Provide"), null);

    const {
      file_format,
      category,
      sub_category,
      name,
      old_name,
      coin,
      download, 
      image_url,
      isActive,
      ios_version,
      description,
      title_for_path,
      version,
      android_coins,
      android_download,
      android_isActive,
      android_version,
 
    
  } = data;

  const query = ` INSERT INTO snap_tech_modsforminecraft_modsData (file_format,
      category,
      sub_category,
      name,
      old_name,
      coin,
      download, 
      image_url,
      isActive,
      ios_version,
      description,
      title_for_path,
      version,
      android_coins,
      android_download,
      android_isActive,
      android_version
      ) VALUES (?, ? ,?, ?, ?, ? ,?, ? ,?, ? ,?, ? ,?, ? ,? ,?, ?)`;
      
      const values = [
        file_format || "",
        category || "",
        sub_category  || "",
        name  || "",
        old_name  || "",
        coin  || 0,
        download  || 0, 
        image_url  || "",
        isActive  || "",
        ios_version  || "",
        description  || "",
        title_for_path  || "",
        version,
        android_coins  || 0,
        android_download  || 0,
        android_isActive  || "",
        android_version || "",
      ];

      db.query(query, values, (err, results) => {
        if (err) return callback(err, null);

            // ✅ Return only modId
    callback(null, { modId: results.insertId });
    
    });
  },
  
  



  // get mod by category
  // getModByCategory: (category, callback) => {
  // const query =
  //     "SELECT * FROM snap_tech_modsforminecraft_modsData WHERE category = ?";

  // db.query(query, [category], (err, results) => {
  //     if (err) {
  //     return callback(err, null);
  //     }

  //     if (!results || results.length === 0) {
  //     return callback(null, []); // return empty array instead of null
  //     }

  //     callback(null, results); // return all matching mods
  // });
  // },

  // Create new mod
  //   create: (data, callback) => {
  //     const { image, name, category, subcategory, coin, download } = data;
  //     const query =
  //       "INSERT INTO snap_tech_modsforminecraft_modsData (image, name, category, subcategory, coin, download) VALUES (?, ?, ?, ?, ?, ?)";
  //     db.query(
  //       query,
  //       [image, name, category, subcategory, coin, download],
  //       (err, results) => {
  //         callback(err, results);
  //       },
  //     );
  //   },

 

  // Delete mod
  //   delete: (id, callback) => {
  //     const query = "DELETE FROM snap_tech_modsforminecraft_modsData WHERE post_id=?";
  //     db.query(query, [id], (err, results) => {
  //       callback(err, results);
  //     });
  //   },

  getModHistorySummary: (platform, range, start, end, callback) => {

  let dateCondition = "";
  let params = [platform];

  switch (range) {

    case "today":
      dateCondition = "DATE(h.changed_at) = CURDATE()";
      break;

    case "yesterday":
      dateCondition = "DATE(h.changed_at) = CURDATE() - INTERVAL 1 DAY";
      break;

    case "last7":
      dateCondition = "h.changed_at >= NOW() - INTERVAL 7 DAY";
      break;

    case "last30":
      dateCondition = "h.changed_at >= NOW() - INTERVAL 30 DAY";
      break;

    case "last90":
      dateCondition = "h.changed_at >= NOW() - INTERVAL 90 DAY";
      break;

    case "custom":
      dateCondition = "h.changed_at BETWEEN ? AND ?";
      params.push(start, end);
      break;

    case "all":
    default:
      dateCondition = "1=1";
  }

  const query = `
     SELECT t.*, 
           (SELECT COUNT(*) FROM (
              SELECT DISTINCT mod_id
              FROM snap_tech_modsforminecraft_history h
              WHERE h.platform = ?
              AND ${dateCondition}
           ) x) AS total_mods
    FROM (
        SELECT 
          h.mod_id,
          m.name AS mod_name,
          MIN(DATE_FORMAT(h.changed_at,'%Y-%m-%d %H:%i:%s')) AS first_change,
          MAX(DATE_FORMAT(h.changed_at,'%Y-%m-%d %H:%i:%s')) AS last_change,
          COUNT(*) AS total_changes
        FROM snap_tech_modsforminecraft_history h
        JOIN snap_tech_modsforminecraft_modsData m 
          ON h.mod_id = m.post_id
        WHERE h.platform = ?
          AND ${dateCondition}  
        GROUP BY h.mod_id
    ) t
    ORDER BY last_change DESC
  `;

  db.query(query, [platform, ...params, platform, ...params], (err, results) => {
    if (err) return callback(err, null);
    callback(null, results);
  });

},

//  getModChangeTimeline: (mod_id, platform, start, end, callback) => {

//   let dateFilter = "";
//   let params = [mod_id, platform];

//   if (start && end) {
//     dateFilter = "AND DATE(h.changed_at) BETWEEN ? AND ?";
//     params.push(start, end);
//   }

//   const query = `
//     SELECT 
//       h.id,
//       h.mod_id,
//       m.name AS mod_name,
//       h.field,
//       h.value_before,
//       h.value_after,
//       h.changed_at,
//       h.platform
//     FROM snap_tech_modsforminecraft_history h
//     JOIN snap_tech_modsforminecraft_modsData m 
//       ON m.post_id = h.mod_id
//     WHERE h.mod_id = ?
//       AND h.platform = ?
//       ${dateFilter}
//     ORDER BY h.changed_at DESC
//   `;

//   db.query(query, params, (err, results) => {
//     if (err) return callback(err, null);
//     callback(null, results);
//   });

// },


getModChangeTimeline: (mod_id, platform, start, end, callback) => {
  let dateFilter = "";
  let params = [mod_id, platform];

  if (start && end) {
    dateFilter = "AND h.changed_at BETWEEN ? AND ?";
    params.push(start, end);
  }

  const query = `
  SELECT 
    h.id,
    h.mod_id,
    m.name AS mod_name,
    h.field,
    h.value_before,
    h.value_after,
    DATE_FORMAT(h.changed_at, '%Y-%m-%d %H:%i:%s') AS changed_at,
    h.platform,

    -- TOTAL BEFORE
    (SELECT COUNT(*) 
     FROM snap_tech_modsforminecraft_impressioncount_store c
     WHERE c.post_id = h.mod_id 
     AND c.create_date <= h.changed_at) AS impression_before,

    (SELECT COUNT(*) 
     FROM snap_tech_modsforminecraft_downloadcount_store c
     WHERE c.post_id = h.mod_id 
     AND c.create_date <= h.changed_at) AS download_before,

    -- TOTAL AFTER
    (SELECT COUNT(*) 
     FROM snap_tech_modsforminecraft_impressioncount_store c
     WHERE c.post_id = h.mod_id 
     AND c.create_date >= h.changed_at) AS impression_after,

    (SELECT COUNT(*) 
     FROM snap_tech_modsforminecraft_downloadcount_store c
     WHERE c.post_id = h.mod_id 
     AND c.create_date >= h.changed_at) AS download_after,

    -- TOP COUNTRY BEFORE
    (
      SELECT country
      FROM snap_tech_modsforminecraft_impressioncount_store c
      WHERE c.post_id = h.mod_id
      AND c.create_date <= h.changed_at
      GROUP BY country
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_country_before,

    -- IMPRESSION OF TOP COUNTRY BEFORE
    (
      SELECT COUNT(*)
      FROM snap_tech_modsforminecraft_impressioncount_store c
      WHERE c.post_id = h.mod_id
      AND c.country = (
          SELECT country
          FROM snap_tech_modsforminecraft_impressioncount_store c2
          WHERE c2.post_id = h.mod_id
          AND c2.create_date <= h.changed_at
          GROUP BY country
          ORDER BY COUNT(*) DESC
          LIMIT 1
      )
      AND c.create_date <= h.changed_at
    ) AS top_country_before_impression,

    -- DOWNLOAD OF TOP COUNTRY BEFORE
    (
      SELECT COUNT(*)
      FROM snap_tech_modsforminecraft_downloadcount_store c
      WHERE c.post_id = h.mod_id
      AND c.country = (
          SELECT country
          FROM snap_tech_modsforminecraft_impressioncount_store c2
          WHERE c2.post_id = h.mod_id
          AND c2.create_date <= h.changed_at
          GROUP BY country
          ORDER BY COUNT(*) DESC
          LIMIT 1
      )
      AND c.create_date <= h.changed_at
    ) AS top_country_before_download,

    -- TOP COUNTRY AFTER
    (
      SELECT country
      FROM snap_tech_modsforminecraft_impressioncount_store c
      WHERE c.post_id = h.mod_id
      AND c.create_date >= h.changed_at
      GROUP BY country
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_country_after,

    -- IMPRESSION OF TOP COUNTRY AFTER
    (
      SELECT COUNT(*)
      FROM snap_tech_modsforminecraft_impressioncount_store c
      WHERE c.post_id = h.mod_id
      AND c.country = (
          SELECT country
          FROM snap_tech_modsforminecraft_impressioncount_store c2
          WHERE c2.post_id = h.mod_id
          AND c2.create_date >= h.changed_at
          GROUP BY country
          ORDER BY COUNT(*) DESC
          LIMIT 1
      )
      AND c.create_date >= h.changed_at
    ) AS top_country_after_impression,

    -- DOWNLOAD OF TOP COUNTRY AFTER
    (
      SELECT COUNT(*)
      FROM snap_tech_modsforminecraft_downloadcount_store c
      WHERE c.post_id = h.mod_id
      AND c.country = (
          SELECT country
          FROM snap_tech_modsforminecraft_impressioncount_store c2
          WHERE c2.post_id = h.mod_id
          AND c2.create_date >= h.changed_at
          GROUP BY country
          ORDER BY COUNT(*) DESC
          LIMIT 1
      )
      AND c.create_date >= h.changed_at
    ) AS top_country_after_download

  FROM snap_tech_modsforminecraft_history h
  JOIN snap_tech_modsforminecraft_modsData m 
    ON m.post_id = h.mod_id

  WHERE h.mod_id = ?
  AND h.platform = ?
  ${dateFilter}

  ORDER BY h.changed_at DESC
  `;

  db.query(query, params, (err, results) => {
    if (err) return callback(err, null);
    callback(null, results);
  });
},

};
