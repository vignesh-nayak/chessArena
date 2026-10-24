import bcrypt from "bcryptjs";
import {
  registerTestAccountUserId,
  TEST_ACCOUNT_EMAIL,
} from "../middleware/userRateLimit.js";
import { User } from "../models/User.js";

export const TEST_ACCOUNT_USERNAME = "testchess";

const BCRYPT_ROUNDS = 12;

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

/** Creates the shared test login when that email is not already registered. */
export async function ensureTestAccount(): Promise<void> {
  const existing = await User.findOne({ email: TEST_ACCOUNT_EMAIL })
    .select("_id")
    .lean();
  if (existing) {
    registerTestAccountUserId(existing._id.toString());
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(TEST_ACCOUNT_EMAIL, BCRYPT_ROUNDS);
    const user = await User.create({
      username: TEST_ACCOUNT_USERNAME,
      email: TEST_ACCOUNT_EMAIL,
      passwordHash,
    });
    registerTestAccountUserId(user._id.toString());
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;

    const winner = await User.findOne({ email: TEST_ACCOUNT_EMAIL })
      .select("_id")
      .lean();
    if (winner) {
      registerTestAccountUserId(winner._id.toString());
      return;
    }

    console.error(
      "[api] Test account username testchess is already in use",
    );
  }
}
