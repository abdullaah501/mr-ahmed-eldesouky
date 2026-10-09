"use server";

import { cookies } from "next/headers";
import clientPromise from "../../../lib/mongoClient";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import User from "../../../models/User";
import Grade from "../../../models/Grade";
import mongoose from "mongoose";
import { signJWT } from "../../../lib/jwt";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  REFRESH_GRACE_WINDOW_MS,
  SESSION_TTL_MS,
  accessCookieOpts,
} from "../../../lib/auth/config";
import Session from "./../../../models/Session";
import { logSecurityEvent } from "../../../lib/securityLogger";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

const ACCESS_COOKIE_OPTS = accessCookieOpts();

export async function updateUserData(email, userData) {
  const { success, user, newAccessToken } = await withCaller("server_action_updateUserData", () => withTracePhase("server_action", () => checkUser()));

  if (!success || !user) {
    return { success: false, message: "Unauthorized" };
  }

  if (!email || !userData || Object.keys(userData).length === 0) {
    return { success: false, message: "No data provided for update" };
  }

  const ALLOWED_FIELDS = [
    "firstName", "lastName", "phone", "guardianPhone",
    "gradeId", "image", "governorate",
  ];
  const PROTECTED_FIELDS = ["role", "email", "password", "verified"];

  const isAdmin = user?.role === "admin";
  const roleChanged = isAdmin && Object.prototype.hasOwnProperty.call(userData, "role") && userData.role !== user.role;
  const filteredData = {};
  for (const [key, value] of Object.entries(userData)) {
    if (PROTECTED_FIELDS.includes(key)) {
      if (isAdmin) filteredData[key] = value;
      continue;
    }
    if (ALLOWED_FIELDS.includes(key)) {
      filteredData[key] = value;
    }
  }

  if (Object.keys(filteredData).length === 0) {
    return { success: false, message: "No data provided for update" };
  }

  // Self-service Grade change: the profile `gradeId` is validated against a
  // real active Grade and the display `grade` string is kept synchronized
  // from the server-resolved document. `grade` itself is never accepted
  // from the client and never authorizes anything.
  if (filteredData.gradeId !== undefined) {
    if (
      typeof filteredData.gradeId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(filteredData.gradeId)
    ) {
      return { success: false, message: "Invalid grade selection" };
    }
    const gradeDoc = await Grade.findById(filteredData.gradeId)
      .select("_id name active")
      .lean();
    if (!gradeDoc || !gradeDoc.active) {
      return { success: false, message: "The selected grade is not available" };
    }
    filteredData.gradeId = new mongoose.Types.ObjectId(gradeDoc._id);
    filteredData.grade = gradeDoc.name;
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const updateOps = { $set: { ...filteredData } };
    if (roleChanged) {
      updateOps.$inc = { tokenVersion: 1 };
    }

    // The session identity is authoritative — a caller can only update
    // their own profile, never another user's.
    const updatedUser = await db.collection("users").findOneAndUpdate(
      { email: user.email },
      updateOps,
      {
        returnDocument: "after",
        projection: { __v: 0, password: 0 },
      }
    );

    if (!updatedUser?._id) {
      return { success: false, message: "User not found" };
    }

    if (roleChanged) {
      logSecurityEvent("ROLE_CHANGED", { userId: String(updatedUser._id), from: user.role, to: filteredData.role });
    }

    const userToken = {
      _id: updatedUser._id.toString(),
      role: updatedUser.role,
      email: updatedUser.email,
      grade: updatedUser.grade,
      gradeId: updatedUser.gradeId ? String(updatedUser.gradeId) : null,
      image: updatedUser.image ?? { url: "", cloudId: "" },
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      guardianPhone: updatedUser.guardianPhone,
      governorate: updatedUser.governorate,
      tokenVersion: updatedUser.tokenVersion ?? 1,
    }

    const cookie = await cookies();
    const refreshToken = await signJWT(userToken, REFRESH_TOKEN_TTL);
    const access_token = await signJWT(userToken, ACCESS_TOKEN_TTL);

    const sessionId = cookie.get("s-i")?.value;

    // Atomic rotation compatible with refreshAuth's grace window:
    // the pipeline records the token being replaced as the session's
    // predecessor BEFORE installing the new one, so a concurrent in-flight
    // refreshAuth holding the old token is treated as a legitimate loser
    // instead of a replay.
    const resToken = await Session.updateOne(
      { _id: sessionId, userId: updatedUser._id },
      [
        {
          $set: {
            previousRefreshToken: "$refreshToken",
            previousRefreshTokenExpiresAt: new Date(Date.now() + REFRESH_GRACE_WINDOW_MS),
            refreshToken,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          },
        },
      ],
      { new: true }
    );


    if (!resToken || resToken.modifiedCount === 0) {
      return { success: false, message: "Database update failed" };
    }

    cookie.set("access_token", access_token, ACCESS_COOKIE_OPTS);

    if (!resToken) {
      return { success: false, message: "Database update failed" };
    }

    return { success: true, message: "User data updated successfully", data: JSON.parse(JSON.stringify(updatedUser)) };

  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, message: "Database update failed" };
  }
}

/** Admin-only user list (used by staff assignment UI). */
export async function getAllUsers() {
  return withCaller("action_get_all_users", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || user.role !== "admin") {
        return { success: false, message: "Unauthorized" };
      }
      await connectToDatabase();
      const users = await User.find({})
        .select("-password -__v -guardianTokenHash -tokenVersion")
        .lean();
      return { success: true, data: JSON.parse(JSON.stringify(users)) };
    })
  );
}
