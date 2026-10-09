import toast from "react-hot-toast";

export async function upload(ev, callbackFn) {
  const file = ev.target.files?.[0];
  if (!file) return;

  const uploadPromise = new Promise(async (resolve, reject) => {
    try {
      // Step 1: Request signed URL from backend
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!res.ok) throw new Error("Failed to get signed URL");

      const { signedUrl, url, key } = await res.json();

      // Step 2: Upload file directly to iDrive/S3
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Direct upload failed");

      // Step 3: Call the callback and resolve
      callbackFn({ url, cloudId: key, signedUrl });
      resolve({ url, key });
    } catch (err) {
      reject(err);
    }
  });

  await toast.promise(uploadPromise, {
    loading: "Uploading...",
    success: "Uploaded!",
    error: "Upload error!",
  });
}