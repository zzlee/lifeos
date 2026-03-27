# **LifeOS: 個人數位生活導航系統 (Final Specification)**

## **1\. 專案願景**

LifeOS 是一個以「效率」與「數據主權」為核心的個人 Dashboard。它不只是工具的堆疊，而是透過 AI 介面將零碎的生活資訊（消費、心情、生理健康、密碼）整合進一個統一的邊緣運算資料庫。

## **2\. 技術架構 (Cloudflare Native)**

* **前端 (Frontend):** React \+ Tailwind CSS (部署於 Cloudflare Pages)。  
* **後端 (Backend):** Hono.js (部署於 Cloudflare Workers)。  
* **資料庫 (Database):** Cloudflare D1 (Serverless SQL)。  
* **驗證 (Auth):** Google OAuth 2.0 \+ JWT。  
* **AI 整合:** OpenAI GPT-4o-mini (經由 Function Calling 進行結構化資料寫入)。  
* **加密 (Security):** Web Crypto API (AES-GCM) 處理密碼管理模組。

## **3\. 功能模組詳細規格**

### **A. 生活消費記錄 (Finance)**

* **欄位:** 金額、類別 (AI 自動歸類)、備註、日期。  
* **AI 互動:** 「昨天在全家買咖啡花 55 元」-\> 自動建立記錄。

### **B. 隨手日記 (Journal)**

* **欄位:** 正文、情緒標籤 (AI 分析)、建立時間。  
* **AI 互動:** 「今天心情很好，專案終於上線了」-\> 存入日記並標註 \#成就感。

### **C. 生理資訊 (Health)**

* **指標:** 血壓 (收縮/舒張)、心跳、身高體重。  
* **AI 互動:** 「體重 72.5kg，血壓 118/78」-\> 同時更新多項指標。

### **D. 簡易密碼管理 (Vault)**

* **安全:** 密碼在 Workers 端加密，D1 僅儲存加密後的 Base64 字串。  
* **功能:** 支援站點搜尋、快速複製、AI 輔助新增。

### **E. AI 助理 (LifeOS Agent)**

* **核心:** 作為系統的「自然語言入口」，透過 Tool Use 直接操作 D1 SQL。

## **4\. 資料庫 Schema (D1 SQL)**

CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);  
CREATE TABLE expenses (id INTEGER PRIMARY KEY, user\_id TEXT, amount REAL, category TEXT, note TEXT, date DATE);  
CREATE TABLE journals (id INTEGER PRIMARY KEY, user\_id TEXT, content TEXT, tags TEXT, created\_at DATETIME);  
CREATE TABLE health (id INTEGER PRIMARY KEY, user\_id TEXT, type TEXT, value REAL, recorded\_at DATETIME);  
CREATE TABLE passwords (id INTEGER PRIMARY KEY, user\_id TEXT, site TEXT, username TEXT, secret TEXT, iv TEXT);

## **5\. CLI 工具設計 (LifeOS-CLI)**

* lifeos auth: 執行 Google 登入並取得 JWT。  
* lifeos log "\<text\>": 最核心指令，將字串傳給 AI 助理。  
* lifeos ls \<module\>: 快速列出最近的消費或生理數據。

## **6\. 部署指南**

1. npx wrangler d1 create lifeos-db  
2. npx wrangler d1 execute lifeos-db \--file=./schema.sql  
3. 在 Cloudflare Dashboard 設定 OPENAI\_API\_KEY 密鑰。  
4. npm run deploy 部署至 Workers 與 Pages。