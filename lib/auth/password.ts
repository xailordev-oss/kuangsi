import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// hash ທີ່ຜິດຮູບແບບ (ເຊັ່ນ placeholder ໃນ seed) ຖືວ່າບໍ່ຜ່ານ ບໍ່ແມ່ນ error
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

// ໃຊ້ຕອນບໍ່ພົບ username ເພື່ອໃຫ້ເວລາຕອບໃກ້ຄຽງກັບກໍລະນີລະຫັດຜິດ (ກັນການເດົາວ່າ username ມີຢູ່ບໍ່)
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
}
