import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppTopNav } from "@/components/AppTopNav";

const PLACEHOLDER_EXAMPLES = [
  "例如：今天下午带孩子出去玩，不想太累，预算500，晚上8点前回家",
  "例如：周末想带狗狗出去走走，找几个宠物友好的地方，顺便吃点东西",
  "例如：今晚想和对象轻松约会，别太远，最好有晚餐和散步",
  "例如：下雨了，想找个室内能逛能吃的地方，别太赶",
  "例如：想安排一条少排队的路线，轻松一点，晚上早点回家",
  "例如：预算500以内，帮我安排一个半天的吃喝玩乐路线",
] as const;

const FALLBACK_PROMPT = PLACEHOLDER_EXAMPLES[0].replace(/^例如：/, "");

const SCENES = [
  "亲子半日游",
  "宠物友好路线",
  "轻松约会",
  "雨天也能玩",
  "少排队慢节奏",
  "500 元以内",
] as const;

const PROMPTS: Record<(typeof SCENES)[number], string> = {
  亲子半日游:
    "今天下午带孩子出去玩，不想太累，预算500，最好少排队，晚上8点前回家",
  宠物友好路线:
    "周末想带狗狗出去走走，找几个宠物友好的地方，顺便吃点东西",
  轻松约会:
    "今晚想和对象轻松约会，别太远，最好有晚餐和散步",
  雨天也能玩:
    "下雨了，想找个室内能逛能吃的地方，别太赶",
  少排队慢节奏:
    "想安排一条少排队的路线，轻松一点，晚上早点回家",
  "500 元以内":
    "预算500以内，帮我安排一个半天的吃喝玩乐路线",
};

const FLOATING_CARDS = [
  {
    title: "15:00 亲子活动",
    text: "适合 5 岁儿童 · 少排队",
    className: "left-0 top-[27%] w-48 z-20 opacity-100",
    delay: 0.1,
    ambient: false,
  },
  {
    title: "16:30 甜品休息",
    text: "步行 6 分钟 · 不赶时间",
    className: "right-0 top-[27%] w-44 z-20 opacity-100",
    delay: 0.22,
    ambient: false,
  },
  {
    title: "18:00 亲子晚餐",
    text: "可预约 · 人均 ¥80",
    className: "left-16 bottom-[25%] w-44 z-0 opacity-50",
    delay: 0.34,
    ambient: true,
  },
  {
    title: "20:00 前到家",
    text: "路线更轻松 · 少换乘",
    className: "right-16 bottom-[24%] w-48 z-0 opacity-45",
    delay: 0.46,
    ambient: true,
  },
] as const;

interface WarmHomePageProps {
  initialPrompt: string;
  onStart: (prompt: string) => void;
}

export function WarmHomePage({ onStart }: WarmHomePageProps) {
  const [text, setText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (text.trim()) return;

    const id = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 2800);

    return () => window.clearInterval(id);
  }, [text]);

  const start = (next = text) => {
    const trimmed = next.trim() || FALLBACK_PROMPT;
    onStart(trimmed);
  };

  const scrollToScenarios = () => {
    document
      .getElementById("scenario-entry")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFF9F2] text-[#3C342F]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(246,198,91,0.26),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(238,143,106,0.18),transparent_35%),radial-gradient(circle_at_50%_38%,rgba(255,253,249,0.9),transparent_38%),linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_54%,#FFFDF9_100%)]" />
      <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-white/60 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(120,90,60,0.55)_0.7px,transparent_0.7px)] [background-size:18px_18px]" />

      <div className="relative z-40">
        <AppTopNav activeItem="scenes" onScenesClick={scrollToScenarios} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-6xl flex-col px-5 sm:px-8">
        <section className="relative flex flex-1 items-start justify-center pt-12 sm:pt-14 lg:pt-16">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-10 top-[35%] hidden h-56 w-[calc(100%-5rem)] opacity-24 lg:block"
            viewBox="0 0 1000 220"
            fill="none"
          >
            <path
              d="M70 92 C 260 10, 410 190, 560 102 S 790 46, 930 128"
              stroke="#E3CDAF"
              strokeDasharray="6 13"
              strokeLinecap="round"
              strokeWidth="1.4"
            />
          </svg>

          {FLOATING_CARDS.map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: [0, card.ambient ? -3 : -5, 0] }}
              whileHover={card.ambient ? undefined : { y: -8 }}
              transition={{
                opacity: { delay: 0.35 + card.delay, duration: 0.42 },
                y: {
                  delay: card.delay,
                  duration: card.ambient ? 5.2 : 4.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
              className={`pointer-events-none absolute hidden rounded-[1.35rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9]/80 p-4 text-left shadow-[0_14px_34px_rgba(120,80,40,0.08)] backdrop-blur lg:block ${card.className}`}
            >
              <p className="text-sm font-bold text-[#3C342F]">{card.title}</p>
              {!card.ambient ? (
                <p className="mt-1 text-[12px] leading-5 text-[#8A7666]">{card.text}</p>
              ) : null}
            </motion.div>
          ))}

          <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: "easeOut" }}
              className="mb-3 inline-flex rounded-full border border-[#B78C4D]/15 bg-white/70 px-4 py-2 text-sm font-medium text-[#8A5A2F] shadow-[0_12px_30px_rgba(120,80,40,0.07)]"
            >
              本地吃喝玩乐，按你的节奏安排好
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.52, ease: "easeOut" }}
              className="text-[44px] font-semibold leading-tight tracking-normal text-[#3C342F] sm:text-[64px]"
            >
              一句话，安排你的周末
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.46, ease: "easeOut" }}
              className="mx-auto mt-4 max-w-3xl text-base leading-8 text-[#6E6259] sm:text-lg"
            >
              <span className="block">告诉我和谁出门、预算多少、想轻松还是热闹。</span>
              <span className="block">
                AI 会综合距离、排队、预算和返程，帮你安排一条顺路路线。
              </span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.5, ease: "easeOut" }}
              className="relative z-30 mx-auto mt-6 max-w-3xl rounded-[2rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/94 p-2.5 text-left shadow-[0_20px_58px_rgba(120,80,40,0.11)] backdrop-blur transition hover:shadow-[0_24px_64px_rgba(120,80,40,0.13)] focus-within:border-[#F2A65A]/45 focus-within:bg-[#FFFDF9] focus-within:shadow-[0_24px_64px_rgba(242,166,90,0.13)]"
            >
              <div className="rounded-[1.55rem] px-5 pt-3">
                <p className="text-[12px] font-semibold text-[#8A7666]">
                  我想这样安排：
                </p>
              </div>
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={3}
                  className="relative z-10 min-h-[84px] w-full resize-none rounded-[1.55rem] border-0 bg-transparent px-5 pb-3 pt-1.5 text-base leading-7 text-[#3C342F] outline-none"
                />
                <AnimatePresence mode="wait">
                  {!text ? (
                    <motion.p
                      key={placeholderIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="pointer-events-none absolute left-5 right-5 top-1.5 z-0 whitespace-pre-wrap text-base leading-7 text-[#A99482]"
                    >
                      {PLACEHOLDER_EXAMPLES[placeholderIndex]}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
              <div className="flex flex-col gap-3 border-t border-[rgba(120,90,60,0.10)] px-2 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="px-3 text-sm text-[#8A7666]">
                  会自动兼顾预算、路程、等待时间和回家时间
                </p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => start()}
                  className="rounded-full bg-[#F2A65A] px-7 py-3 text-sm font-bold text-[#3C342F] shadow-[0_14px_32px_rgba(242,166,90,0.32)] transition hover:bg-[#F6C65B]"
                >
                  帮我安排
                </motion.button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.46, ease: "easeOut" }}
              id="scenario-entry"
              className="mt-5 scroll-mt-28"
            >
              <p className="mb-3 text-xs font-medium text-[#9A8575]">
                不知道怎么说？从这些场景开始
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {SCENES.map((scene, index) => (
                  <motion.button
                    key={scene}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.04 }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setText(PROMPTS[scene])}
                    className="rounded-full border border-[rgba(120,90,60,0.12)] bg-white/62 px-4 py-3 text-sm font-semibold text-[#5F5148] shadow-[0_9px_24px_rgba(120,80,40,0.065)] backdrop-blur transition hover:bg-[#FFFDF9] hover:shadow-[0_14px_34px_rgba(120,80,40,0.10)]"
                  >
                    {scene}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  );
}
