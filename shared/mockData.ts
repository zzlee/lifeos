import type { LifeOSState } from "./domain";

export const initialData: LifeOSState = {
  finance: [
    { id: 1, date: "2026-03-26", amount: 150, category: "餐飲", note: "午餐牛肉麵" },
    { id: 2, date: "2026-03-25", amount: 55, category: "餐飲", note: "全家咖啡" },
    { id: 3, date: "2026-03-24", amount: 1200, category: "交通", note: "高鐵票" },
    { id: 4, date: "2026-03-22", amount: 850, category: "娛樂", note: "電影與爆米花" },
    { id: 5, date: "2026-03-20", amount: 300, category: "生活", note: "日常用品" }
  ],
  journals: [
    { id: 1, date: "2026-03-26 10:30", content: "今天早上的會議非常順利，專案架構終於敲定。", tags: ["成就感", "工作"] },
    { id: 2, date: "2026-03-24 21:15", content: "晚餐吃了很雷的義大利麵，心情稍微受影響。", tags: ["抱怨", "飲食"] },
    { id: 3, date: "2026-03-21 08:00", content: "週末晨跑 5 公里，感覺精神百倍。", tags: ["活力", "運動"] }
  ],
  health: [
    { date: "03-20", sys: 118, dia: 78, hr: 72, weight: 72.8 },
    { date: "03-21", sys: 120, dia: 80, hr: 75, weight: 72.6 },
    { date: "03-22", sys: 115, dia: 75, hr: 70, weight: 72.7 },
    { date: "03-23", sys: 122, dia: 82, hr: 78, weight: 72.5 },
    { date: "03-24", sys: 119, dia: 79, hr: 73, weight: 72.5 },
    { date: "03-25", sys: 117, dia: 77, hr: 71, weight: 72.4 },
    { date: "03-26", sys: 121, dia: 81, hr: 74, weight: 72.5 }
  ],
  vault: [
    { id: 1, site: "GitHub", username: "developer_os", secret: "gh_pass_2026" },
    { id: 2, site: "Netflix", username: "family_main", secret: "movie_time!99" },
    { id: 3, site: "AWS Console", username: "admin_root", secret: "aws_secure_!@#" },
    { id: 4, site: "OpenAI API", username: "agent_key", secret: "sk-proj-xxxxxx" }
  ]
};
