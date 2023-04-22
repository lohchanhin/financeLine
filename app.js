require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const yahooFinance = require('yahoo-finance'); // 修改 yf => yahooFinance

// 配置 LINE 令牌和密钥
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// 获取 OpenAI API 密钥
const apiKey2 = process.env.OPENAI_API_KEY;

// 创建 LINE 客户端
const client = new line.Client(config);
// 创建 Express 应用
const app = express();



// 设置回调路由
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

const fetchStockData = async (ticker) => {
  try {
    const stockData = await yahooFinance.quote({
      symbol: ticker,
      modules: ['price', 'summaryProfile', 'financialData', 'earnings'],
    });

    console.log(`${ticker} stock data:`);
    console.log(stockData);

    // 使用 stockData 進行其他操作（例如，獲取特定字段或進一步處理）
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
  }
};

const fetchStockHistoryData = async(ticker)=>{
    try {
        // 設置日期範圍為過去一個月
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);
    
        // 將日期轉換為 yyyy-mm-dd 格式
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
    
          return `${year}-${month}-${day}`;
        };
    
        const fromDate = formatDate(oneMonthAgo);
        const toDate = formatDate(today);
    
        // 使用 yfinance 獲取股票的歷史市場數據
        const historicalData = await yahooFinance.historical({
          symbol: ticker,
          from: fromDate,
          to: toDate,
        });
    
        console.log(`${ticker} historical data:`);
        console.log(historicalData);
    
        return historicalData;
      } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
      }
}


// 定义事件处理函数
async function handleEvent(event) {
  // 如果事件类型不是消息或消息类型不是文本，则忽略
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 检查前四个字符是否是 "分析k線"
  if (event.message.text.slice(0, 4) === "分析k線") {
    const stockCode = event.message.text.slice(4).replace(/\s+/g, '');
    const target = fetchStockHistoryData(stockCode)

    const configuration = new Configuration({ apiKey: apiKey2 });
    const openai = new OpenAIApi(configuration);
    const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
            {
            role: "system",
            content: "You are a helpful assistant."
            },
            {
            role: "user",
            content: "根據過去一個月K線資料以技術指標分析是否適合購買: " + JSON.stringify(target)
            }
        ],
        max_tokens: 2000,
        temperature: 0.2
        });
      
          // 获取助手回复的文本
          const assistantReply = response.data.choices[0].message.content;
          // 构造回复消息
          const reply = { type: 'text', text: assistantReply };
      
          // 使用 LINE API 发送图片消息
          return client.replyMessage(event.replyToken, reply);
      
        } else if (event.message.text.slice(0, 4) === "分析財報") {
          const stockCode = event.message.text.slice(4).replace(/\s+/g, '');
          const target = await fetchStockData(stockCode);
      
          const configuration = new Configuration({ apiKey: apiKey2 });
          const openai = new OpenAIApi(configuration);
          const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant."
              },
              {
                role: "user",
                content: "根據財報為該公司進行評分,滿分10分: " + target
              }
            ],
            max_tokens: 2000,
            temperature: 0.2
          });
      
          // 获取助手回复的文本
          const assistantReply = response.data.choices[0].message.content;
          // 构造回复消息
          const reply = { type: 'text', text: assistantReply };
      
          // 使用 LINE API 发送消息
          return client.replyMessage(event.replyToken, reply);
        }
}
      
// 监听端口
const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`listening on ${port}`);
});
      
// console.log(fetchStockData('2330.TW'))
// console.log(fetchStockHistoryData('2330.TW'))