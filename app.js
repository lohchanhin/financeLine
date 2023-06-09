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
      const data = await yahooFinance.quote({
        symbol: ticker,
        modules: ['price', 'summaryProfile', 'financialData', 'earnings'],
      });
      
    console.log(data)
    const result = {
      companyName: data.summaryProfile?.longName,
      currentQuarterEstimate: data.earnings?.earningsChart?.currentQuarterEstimate,
      earningsQ1_2023: data.earnings?.earningsChart?.quarterly?.find(item => item.date === '1Q2023')?.actual,
      earningsQ4_2022: data.earnings?.earningsChart?.quarterly?.find(item => item.date === '4Q2022')?.actual,
      earningsQ3_2022: data.earnings?.earningsChart?.quarterly?.find(item => item.date === '3Q2022')?.actual,
      earningsQ2_2022: data.earnings?.earningsChart?.quarterly?.find(item => item.date === '2Q2022')?.actual,
      currentPrice: data.financialData?.currentPrice,
      targetHighPrice: data.financialData?.targetHighPrice,
      targetLowPrice: data.financialData?.targetLowPrice,
      targetMeanPrice: data.financialData?.targetMeanPrice,
      numberOfAnalystOpinions: data.financialData?.numberOfAnalystOpinions,
      recommendationMean: data.financialData?.recommendationMean,
      revenuePerShare: data.financialData?.revenuePerShare,
      returnOnAssets: data.financialData?.returnOnAssets,
      returnOnEquity: data.financialData?.returnOnEquity,
      grossProfits: data.financialData?.grossProfits,
      grossMargins: data.financialData?.grossMargins,
      ebitdaMargins: data.financialData?.ebitdaMargins,
      operatingMargins: data.financialData?.operatingMargins,
    };

      // 將資料整理成字串
      const stockDataString = JSON.stringify(result, null, 2);
  
      console.log(`${ticker} stock data:`);
      console.log(stockDataString);
  
      return stockDataString;
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error);
    }
  };
  
  const fetchStockHistoryData = async (ticker) => {
    try {
      // 設置日期範圍為過去一個月
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 2);
  
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
      
          // 篩選出只有 open, high, low, close 的數據
      const simplifiedData = historicalData.map((data) => ({
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      }));

      //console.log(simplifiedData);

      // 將資料整理成字串
      const historicalDataString = JSON.stringify(simplifiedData, null, 2);
  
      console.log(`${ticker} historical data:`);
      console.log(historicalDataString);
  
      return historicalDataString;
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error);
    }
  };
  


// 定义事件处理函数
async function handleEvent(event) {
  // 如果事件类型不是消息或消息类型不是文本，则忽略
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 检查前四个字符是否是 "分析k線"
  if (event.message.text.slice(0, 4) === "分析k線") {
    const stockCode = event.message.text.slice(4).replace(/\s+/g, '');
    const target = await fetchStockHistoryData(stockCode)

    const configuration = new Configuration({ apiKey: apiKey2 });
    const openai = new OpenAIApi(configuration);
    const response = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
            {
            role: "system",
            content: "K線分析師."
            },
            {
            role: "user",
            content: "這是過去一個月K線資料以rsi,日均線,MACD和布林線分析,寫出分析結果以及是否適合購買,如果適合給買入點,不需要解釋技術: " + target
            }
        ],
        //max_tokens: 2000,
        temperature: 0.1
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
            model: 'gpt-4',
            messages: [
              {
                role: "system",
                content: "財報分析師."
              },
              {
                role: "user",
                content: "根據財報為該公司寫一段總結並且進行評分,滿分10分: " + target
              }
            ],
            //max_tokens: 2000,
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

// fetchStockData('2899.HK')
// fetchStockHistoryData('2330.TW')

