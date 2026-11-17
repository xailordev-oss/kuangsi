import { Noto_Sans, Noto_Sans_Lao, Noto_Sans_SC, Noto_Sans_Thai } from "next/font/google";

// ໃຊ້ຮ່ວມກັນລະຫວ່າງ root layout ຂອງລູກຄ້າ (/[lang]) ແລະ ພະນັກງານ (/staff)
const notoLatin = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto-latin", display: "swap" });
const notoLao = Noto_Sans_Lao({ subsets: ["lao"], variable: "--font-noto-lao", display: "swap" });
const notoThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-noto-thai", display: "swap", preload: false });
const notoSc = Noto_Sans_SC({ weight: ["400", "700"], variable: "--font-noto-sc", display: "swap", preload: false });

export const fontVariables = `${notoLatin.variable} ${notoLao.variable} ${notoThai.variable} ${notoSc.variable}`;
