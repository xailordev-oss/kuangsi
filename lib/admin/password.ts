import { randomInt } from "node:crypto";

// ຂໍ້ຕົກລົງ 46: ລະຫັດຊົ່ວຄາວແບບສຸ່ມ ສະແດງເທື່ອດຽວ — ບໍ່ມີຕົວອັກສອນທີ່ສັບສົນ (0/O, 1/l/I) ໃຫ້ບອກກັນທາງປາກໄດ້
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(groups = 3, size = 4): string {
  return Array.from({ length: groups }, () => Array.from({ length: size }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
}
