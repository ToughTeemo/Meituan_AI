import { useState } from "react";
import { motion } from "framer-motion";

const DEFAULT_PROMPT =
  "今天下午带老婆和5岁孩子出去玩，不想太累，预算500，最好别排队，晚上8点前回家";

const SCENES = [
  "亲子半日游",
  "宠物友好路线",
  "周末轻松约会",
  "雨天也能玩",
  "少排队慢节奏",
  "500 元以内",
] as const;

const PROMPTS: Record<(typeof SCENES)[number], string> = {
  亲子半日游: DEFAULT_PROMPT,
  宠物友好路线: "周末想带宠物一起出门，找宠物友好的吃喝玩乐路线，预算500，别太赶",
  周末轻松约会: "周末下午想安排一次轻松约会，吃饭加散步，预算600，路线别太累",
  雨天也能玩: "今天可能下雨，想安排室内活动和晚餐，预算500，少走路",
  少排队慢节奏: "帮我安排一条少排队、慢节奏的周末路线，适合2大1小，晚上8点前回家",
  "500 元以内": "一家三口周末下午出去玩，预算控制在500元以内，轻松一点",
};

const FLOATING_CARDS = [
  {
    title: "15:00 亲子活动",
    text: "适合 5 岁儿童 · 少排队",
    className: "left-0 top-[30%] w-48",
    delay: 0.1,
  },
  {
    title: "16:30 甜品休息",
    text: "步行 6 分钟 · 不赶时间",
    className: "right-0 top-[28%] w-44",
    delay: 0.22,
  },
  {
    title: "18:00 亲子晚餐",
    text: "可预约 · 人均 ¥80",
    className: "left-14 bottom-[23%] w-44",
    delay: 0.34,
  },
  {
    title: "20:00 前到家",
    text: "路线更轻松 · 少换乘",
    className: "right-16 bottom-[20%] w-48",
    delay: 0.46,
  },
] as const;

interface WarmHomePageProps {
  initialPrompt: string;
  onStart: (prompt: string) => void;
}

export function WarmHomePage({ initialPrompt, onStart }: WarmHomePageProps) {
  const [text, setText] = useState(initialPrompt || DEFAULT_PROMPT);

  const start = (next = text) => {
    const trimmed = next.trim() || DEFAULT_PROMPT;
    setText(trimmed);
    onStart(trimmed);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFF9F2] text-[#3C342F]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(246,198,91,0.26),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(238,143,106,0.18),transparent_35%),radial-gradient(circle_at_50%_42%,rgba(255,253,249,0.86),transparent_36%),linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_54%,#FFFDF9_100%)]" />
      <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-white/58 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(120,90,60,0.55)_0.7px,transparent_0.7px)] [background-size:18px_18px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
        <nav className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6C65B] text-lg shadow-[0_12px_30px_rgba(120,80,40,0.14)]">
              ☀️
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight text-[#3C342F]">
                周末小助手
              </p>
              <p className="mt-0.5 text-[11px] text-[#8A7666]">
                Meituan Weekend AI
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#6E6259] sm:flex">
            <button className="rounded-full px-3 py-2 transition hover:bg-white/60" type="button">
              示例场景
            </button>
            <button className="rounded-full px-3 py-2 transition hover:bg-white/60" type="button">
              我的方案
            </button>
            <button
              className="rounded-full border border-[rgba(120,90,60,0.12)] bg-[#F7EEDF]/62 px-3.5 py-2 text-[#7A6657] transition hover:bg-[#FFF4DE]"
              type="button"
            >
              演示模式
            </button>
          </div>
        </nav>

        <section className="relative flex flex-1 items-center py-8 sm:py-10">
          {FLOATING_CARDS.map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: [0, -5, 0] }}
              whileHover={{ y: -8 }}
              transition={{
                opacity: { delay: 0.35 + card.delay, duration: 0.42 },
                y: {
                  delay: card.delay,
                  duration: 4.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
              className={`pointer-events-none absolute hidden rounded-[1.35rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9]/78 p-4 text-left shadow-[0_14px_34px_rgba(120,80,40,0.08)] backdrop-blur lg:block ${card.className}`}
            >
              <p className="text-sm font-bold text-[#3C342F]">{card.title}</p>
              <p className="mt-1 text-[12px] leading-5 text-[#8A7666]">{card.text}</p>
            </motion.div>
          ))}

          <div className="mx-auto w-full max-w-4xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: "easeOut" }}
              className="mb-4 inline-flex rounded-full border border-[#B78C4D]/15 bg-white/70 px-4 py-2 text-sm font-medium text-[#8A5A2F] shadow-[0_12px_30px_rgba(120,80,40,0.07)]"
            >
              本地吃喝玩乐，按你的节奏安排好
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.52, ease: "easeOut" }}
              className="text-5xl font-bold leading-tight tracking-normal sm:text-7xl"
            >
              一句话，安排你的周末
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.46, ease: "easeOut" }}
              className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#6E6259] sm:text-lg"
            >
              <span className="block">告诉我和谁出门、预算多少、想轻松还是热闹。</span>
              <span className="block">自动帮你规划吃喝玩乐路线</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.5, ease: "easeOut" }}
              className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/94 p-3 text-left shadow-[0_20px_58px_rgba(120,80,40,0.11)] backdrop-blur transition hover:shadow-[0_24px_64px_rgba(120,80,40,0.13)] focus-within:border-[#F2A65A]/45 focus-within:bg-[#FFFDF9] focus-within:shadow-[0_24px_64px_rgba(242,166,90,0.13)]"
            >
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                placeholder={DEFAULT_PROMPT}
                className="min-h-24 w-full resize-none rounded-[1.55rem] border-0 bg-transparent px-5 py-4 text-base leading-7 text-[#3C342F] outline-none placeholder:text-[#A99482]"
              />
              <div className="flex flex-col gap-3 border-t border-[rgba(120,90,60,0.10)] px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="px-3 text-sm text-[#8A7666]">
                  自动综合预算、距离、排队和返程安排
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
              className="mt-6"
            >
              <p className="mb-3 text-xs font-medium text-[#9A8575]">
                也可以从这些场景开始
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
                    onClick={() => start(PROMPTS[scene])}
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
