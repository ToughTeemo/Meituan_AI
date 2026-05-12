import type { Card, POI } from "@/types/plan";
import { useUI } from "@/context/UIContext";

interface CardDetailProps {
  card: Card;
}

type InfoTone = "warm" | "green" | "orange";

export function isTransitCard(card: Card): boolean {
  const text = `${card.label} ${card.poi?.category ?? ""} ${card.poi?.name ?? ""}`;
  return (
    card.type === "transit" ||
    text.includes("地铁") ||
    text.includes("返程") ||
    text.includes("站") ||
    text.includes("交通")
  );
}

export function isDiningCard(card: Card): boolean {
  const text = `${card.label} ${card.poi?.category ?? ""} ${card.poi?.name ?? ""}`;
  return (
    card.type === "dining" ||
    text.includes("晚餐") ||
    text.includes("餐厅") ||
    text.includes("东坡")
  );
}

export function isIndoorRestCard(card: Card): boolean {
  const text = `${card.label} ${card.poi?.category ?? ""} ${card.poi?.name ?? ""}`;
  return text.includes("书店") || text.includes("室内") || text.includes("休息");
}

function InfoPill({
  label,
  value,
  tone = "warm",
}: {
  label: string;
  value: string;
  tone?: InfoTone;
}) {
  const cls =
    tone === "green"
      ? "bg-[#EFF5E9] text-[#526849]"
      : tone === "orange"
        ? "bg-[#FFF4DE] text-[#8A5A2F]"
        : "bg-[#F7EEDF]/62 text-[#6E6259]";

  return (
    <span className={`rounded-2xl px-3 py-2 text-[11px] ${cls}`}>
      {label} <b className="text-[#3C342F]">{value}</b>
    </span>
  );
}

function Header({
  title,
  type,
  score,
}: {
  title: string;
  type: string;
  score?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-base font-bold leading-snug text-[#3C342F]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#8A7666]">{type}</p>
      </div>
      {score ? (
        <span className="shrink-0 rounded-full bg-[#FCE8C1] px-3 py-1 text-[11px] font-bold text-[#8A5A2F]">
          {score}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-[#EFF5E9] px-3 py-1 text-[11px] font-bold text-[#526849]">
          {type}
        </span>
      )}
    </div>
  );
}

function TransitDetail({ card, poi }: { card: Card; poi: POI }) {
  return (
    <>
      <Header title={card.label} type="交通" />
      <div className="grid grid-cols-2 gap-2">
        <InfoPill label="预计费用" value={`¥${poi.price_per_person} / 人`} />
        <InfoPill label="预计用时" value={`约${card.duration_minutes}分钟`} />
        <InfoPill label="步行到站" value="约6分钟" />
        <InfoPill label="拥挤程度" value="较低" tone="green" />
        <InfoPill label="换乘情况" value="无需换乘" tone="green" />
        <InfoPill label="出行体验" value="少步行" tone="green" />
      </div>
      {poi.hours_label ? (
        <p className="rounded-2xl bg-white/65 px-3 py-2 text-[11px] text-[#6E6259]">
          运营提示：{poi.hours_label}
        </p>
      ) : null}
    </>
  );
}

function DiningDetail({ poi }: { poi: POI }) {
  return (
    <>
      <Header title="眉州东坡 · 亲子晚餐" type="家庭餐厅" score="4.6" />
      <div className="grid grid-cols-2 gap-2">
        <InfoPill label="人均" value="¥80" />
        <InfoPill label="距离" value="约1.0km" />
        <InfoPill label="排队" value="较少" tone="green" />
        <InfoPill label="营业时间" value={poi.hours_label ?? "10:00-22:00"} />
        <InfoPill label="适合" value="家庭用餐" tone="green" />
        <InfoPill label="预约" value="可预约" tone="green" />
      </div>
      <p className="rounded-2xl bg-[#EFF5E9]/75 px-3 py-2 text-[11px] leading-5 text-[#526849]">
        已预留晚餐时间，节奏不赶。
      </p>
    </>
  );
}

function IndoorDetail({ card, poi }: { card: Card; poi: POI }) {
  return (
    <>
      <Header title={poi.name} type="室内休息" score={poi.rating.toFixed(1)} />
      <div className="grid grid-cols-2 gap-2">
        <InfoPill label="预计停留" value={`约${card.duration_minutes}分钟`} />
        <InfoPill label="排队" value="低等待" tone="green" />
        <InfoPill label="距离" value="步行约6分钟" />
        <InfoPill label="适合" value="儿童短暂停留" tone="green" />
        <InfoPill label="环境" value="室内" tone="green" />
        <InfoPill label="节奏" value="不赶" tone="green" />
      </div>
      <p className="rounded-2xl bg-[#EFF5E9]/75 px-3 py-2 text-[11px] leading-5 text-[#526849]">
        已调整：加入低等待室内休息点，避免孩子太累。
      </p>
    </>
  );
}

function ActivityDetail({ card, poi }: { card: Card; poi: POI }) {
  return (
    <>
      <Header title={poi.name} type="亲子活动" score={poi.rating.toFixed(1)} />
      <div className="grid grid-cols-2 gap-2">
        <InfoPill label="预计停留" value={`约${card.duration_minutes}分钟`} />
        <InfoPill label="排队" value="已缩短高等待部分" tone="green" />
        <InfoPill label="距离" value="约1.2km" />
        <InfoPill label="适合" value="5岁儿童" tone="green" />
        <InfoPill label="节奏" value="轻松" tone="green" />
        <InfoPill label="风险" value="已调整" tone="orange" />
      </div>
      <p className="rounded-2xl border border-[#F2A65A]/18 bg-[#FFF4DE] px-3 py-2 text-[11px] leading-5 text-[#8A5A2F]">
        已调整：原儿童乐园等待过长，已缩短停留并保留晚餐时间。
      </p>
    </>
  );
}

function explanationFor(card: Card): string {
  if (isTransitCard(card)) {
    return "这段路线换乘少、步行距离短，适合带孩子出行，也能把路上时间控制在可接受范围内。";
  }
  if (isDiningCard(card)) {
    return "这家餐厅可预约、排队少，适合家庭用餐；位置也方便衔接返程，能保证 20:00 前到家。";
  }
  if (isIndoorRestCard(card)) {
    return "这是一段低等待的缓冲安排，可以让孩子休息，也能避免下午行程过满。";
  }
  return "这里适合安排在下午主活动段，孩子有活动空间；同时已缩短高等待项目，避免影响晚餐和返程。";
}

function actionLabels(card: Card): string[] {
  if (isTransitCard(card)) return ["查看路线", "提醒出发", "切换打车"];
  if (isDiningCard(card)) return ["预约晚餐", "换一家", "查看菜单"];
  if (isIndoorRestCard(card)) return ["查看位置", "换个休息点", "加入收藏"];
  return ["查看门票", "换个室内点", "缩短停留"];
}

export function CardDetail({ card }: CardDetailProps) {
  const poi = card.poi;
  const { dispatch } = useUI();
  if (!poi) return null;

  const transit = isTransitCard(card);
  const dining = isDiningCard(card);
  const indoor = isIndoorRestCard(card);
  const actions = actionLabels(card);

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-[1.45rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] p-4 shadow-[0_9px_24px_rgba(120,80,40,0.05)]">
        {transit ? (
          <TransitDetail card={card} poi={poi} />
        ) : dining ? (
          <DiningDetail poi={poi} />
        ) : indoor ? (
          <IndoorDetail card={card} poi={poi} />
        ) : (
          <ActivityDetail card={card} poi={poi} />
        )}
      </div>

      <div className="rounded-[1.3rem] border border-[#F2A65A]/14 bg-[#FFF4DE]/70 p-3 text-[12px] leading-6 text-[#6E6259]">
        <p className="font-bold text-[#8A5A2F]">为什么这样安排？</p>
        <p className="mt-1">{explanationFor(card)}</p>
      </div>

      <div className="rounded-[1.3rem] border border-[rgba(120,90,60,0.08)] bg-[#FFFDF9] p-3">
        <p className="text-[11px] font-bold text-[#8A5A2F]">下一步可以做</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <button
              key={action}
              type="button"
              onClick={() =>
                dispatch({
                  type: "APPEND_LOG",
                  message: `收到：${action}。我会继续帮你衔接当前安排。`,
                })
              }
              className={
                index === 0
                  ? "rounded-full border border-[#F2A65A]/28 bg-[#FFF4DE]/70 px-3 py-1.5 text-[11px] font-semibold text-[#8A5A2F] transition hover:bg-[#FCE8C1]"
                  : "rounded-full border border-[rgba(120,90,60,0.10)] bg-[#F7EEDF]/58 px-3 py-1.5 text-[11px] font-medium text-[#6E6259] transition hover:bg-[#FFF4DE]"
              }
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
