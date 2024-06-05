const http = require('http')
const fs = require('fs')
const ai = require('openai')
const querystring = require('querystring')
const Bus = require('busboy')

let textareaData = ''; // 用于存储textarea字段的值
let longchat = [];

http.createServer((req, res) => {
  const url = req.url
  if (url === '/' || url === 'form.html') {
    // 如果请求根路径，返回 index.html 文件
    fs.readFile('form.html', (err, data) => {
      if (err) {
        res.writeHead(500)
        res.end('Error loading')
      } else {
        res.writeHead(200, {'Content-Type': 'text/html'})
        res.end(data)
      }
    })
  } else if (url.includes('/sse')) {
    // 如果请求 /events 路径，建立 SSE 连接

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // 允许跨域
    })

    let id = 0
    const openai = new ai.OpenAI({
      apiKey: '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',
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })

    async function main() {
      const completion = await openai.chat.completions.create({
        model: "meta/llama3-70b-instruct",
        messages: longchat,
        temperature: 0.5,
        top_p: 1,
        max_tokens: 1024,
        stream: true,
      })

      let dats = "";

      for await (const chunk of completion) {
        res.write(`event: customEvent\n`);
        res.write(`id: ${id}\n`);
        res.write(`retry: 30000\n`);
        const params = url.split('?')[1];
        if (chunk.choices[0].finish_reason === 'stop') {
            // 如果不是 null 或 undefined，设置 data 为 'done'
            var data = chunk.choices[0]?.delta?.content + '<br/><br/><br/>';
        } else {
            // 否则，从第一个选择的 delta.content 获取数据
            var data = chunk.choices[0]?.delta?.content || '' ; // 也可以设置为其他默认值或进行错误处理
        }
        dats = dats + data;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      longchat.push({"role": "assistant", "content":dats.slice(0, -15)})

    }
    main()
    console.log(longchat)

    // 当客户端关闭连接时停止发送消息
    req.on('close', () => {
      console.log("time over")
      res.end()
    })


  }else if(url.includes('/submit-form')){
    const bus = Bus({ headers: req.headers });
    bus.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      if (fieldname === 'username') { // 替换为您的textarea字段名
        textareaData = "请使用简体中文回答以下问题." + val ; // 存储textarea的值
        longchat.push({"role": "user", "content":textareaData})
      }
    });
    bus.on('finish', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Textarea data received');
    });
    req.pipe(bus);

  }else {
    // 如果请求的路径无效，返回 404 状态码
    res.writeHead(404)
    res.end()
  }
}).listen(3000)

console.log('Server listening on port 3000')
