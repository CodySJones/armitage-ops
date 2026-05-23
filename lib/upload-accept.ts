export const photoAccept = [
  "image/*",
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

export const boardPhotoAccept = `${photoAccept},.pdf,application/pdf`;
