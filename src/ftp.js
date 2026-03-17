import dotenv from "dotenv";
dotenv.config();
import SftpClient from "ssh2-sftp-client";

export const connectSFTP = async () => {
  const sftp = new SftpClient();

  await sftp.connect({
    host: process.env.FTP_HOST || "178.62.0.70",
    port: 22,                   
    username: process.env.FTP_USER || "renish",
    password: process.env.FTP_PASSWORD || "UpgradeRenish@123",
  });

  return sftp;
};


