
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const s3 = new S3Client({
  endpoint: process.env.IDRIVE_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.IDRIVE_KEY,
    secretAccessKey: process.env.IDRIVE_SECRET,
  },
});

export async function POST(req) {
    try {
        const { filename, filesize, filetype } = await req.json();
        
        // Validate file size
        const fileSizeMB = Math.round(filesize / (1024 * 1024));
        if (fileSizeMB > 1000) { // 1GB max
            return NextResponse.json({ 
                error: `File too large (${fileSizeMB}MB). Maximum allowed is 1GB.` 
            }, { status: 413 });
        }
        
        // Create unique key
        const key = `uploads/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${filename}`;
        console.log("dasdasdas")
    
    const command = new PutObjectCommand({
      Bucket: process.env.IDRIVE_BUCKET,
      Key: key,
      ContentType: filetype,
    });

    // Create presigned URL valid for 60 minutes
    const presignedUrl = await getSignedUrl(s3, command, { 
      expiresIn: 3600 // 60 minutes
    });

    return NextResponse.json({
      presignedUrl,
      key,
      maxSize: "1GB",
      expiresIn: 3600
    });

  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ 
      error: "Failed to generate upload URL" 
    }, { status: 500 });
  }
}
