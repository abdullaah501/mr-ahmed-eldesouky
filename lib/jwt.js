// lib/jwt.ts
// import { SignJWT, jwtVerify } from "jose";

import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);


export async function signJWT(payload, expiresIn = "30m") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJWT(token = "") {
    const {payload} = await jwtVerify(token, secret);
  return payload;
}
